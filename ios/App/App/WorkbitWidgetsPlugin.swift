import Foundation
import Capacitor
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/**
 * The page's way to the widgets (lib/native-widgets.ts): it hands over the
 * person's shifts and open entry, kept where the widget extension reads
 * them. An open entry starts the Live Activity, none ends it.
 */
@objc(WorkbitWidgetsPlugin)
public class WorkbitWidgetsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WorkbitWidgetsPlugin"
    public let jsName = "WorkbitWidgets"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takeOpen", returnType: CAPPluginReturnPromise),
    ]

    // MARK: Opened from a widget, the Live Activity or a notification

    private static weak var shared: WorkbitWidgetsPlugin?
    private static var pending: (path: String, at: Date)?

    override public func load() {
        WorkbitWidgetsPlugin.shared = self
    }

    /// workbit://timbra ("Esci" on the Live Activity) stamps on Oggi;
    /// workbit://oggi just opens it. Told to the page if it is listening,
    /// otherwise kept until it asks (takeOpen) - for a minute at most.
    @discardableResult
    static func open(_ url: URL) -> Bool {
        guard url.scheme == "workbit" else { return false }
        let path = url.host == "timbra" ? "/dashboard?azione=timbra" : "/dashboard"
        if let plugin = shared, plugin.hasListeners("open") {
            plugin.notifyListeners("open", data: ["path": path])
        } else {
            pending = (path, Date())
        }
        return true
    }

    @objc func takeOpen(_ call: CAPPluginCall) {
        defer { WorkbitWidgetsPlugin.pending = nil }
        if let pending = WorkbitWidgetsPlugin.pending, Date().timeIntervalSince(pending.at) < 60 {
            call.resolve(["path": pending.path])
        } else {
            call.resolve([:])
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard let text = call.getString("snapshot"),
              let data = text.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            call.reject("Dati dei widget non validi")
            return
        }
        let saved = WorkbitSharedStore.save(data)
        let readBack = WorkbitSharedStore.loadIfSaved() != nil
        let readStatus = WorkbitSharedStore.lastStatus
        WidgetCenter.shared.reloadAllTimelines()
        if #available(iOS 16.2, *) {
            ShiftActivityController.sync(snapshot)
        }
        call.resolve([
            "saved": Int(saved),
            "readBack": readBack,
            "readStatus": Int(readStatus),
            "group": WorkbitSharedStore.accessGroup ?? "",
        ])
    }

    @objc func clear(_ call: CAPPluginCall) {
        WorkbitSharedStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
        if #available(iOS 16.2, *) {
            ShiftActivityController.sync(.empty)
        }
        call.resolve()
    }
}

#if canImport(ActivityKit)
@available(iOS 16.2, *)
enum ShiftActivityController {
    static func sync(_ snapshot: WidgetSnapshot) {
        let running = Activity<ShiftActivityAttributes>.activities.filter {
            $0.activityState == .active || $0.activityState == .stale
        }

        guard let open = snapshot.open else {
            // The exit was stamped: say so for a moment, then go.
            for activity in running {
                var state = activity.content.state
                state.out = Date()
                Task {
                    await activity.end(
                        ActivityContent(state: state, staleDate: nil),
                        dismissalPolicy: .after(Date().addingTimeInterval(2 * 60))
                    )
                }
            }
            return
        }

        let state = ShiftActivityAttributes.ContentState(
            since: open.sinceDate,
            end: open.endDate,
            out: nil,
            month: snapshot.month,
            monthHours: snapshot.monthHours
        )

        if let current = running.first {
            if current.content.state != state {
                Task { await current.update(ActivityContent(state: state, staleDate: nil)) }
            }
            for extra in running.dropFirst() {
                Task { await extra.end(nil, dismissalPolicy: .immediate) }
            }
            return
        }

        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = ShiftActivityAttributes(venue: snapshot.venue ?? "Workbit", area: open.area ?? "")
        _ = try? Activity.request(
            attributes: attributes,
            content: ActivityContent(state: state, staleDate: nil),
            pushType: nil
        )
    }
}
#endif
