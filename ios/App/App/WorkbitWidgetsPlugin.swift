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
    ]

    @objc func update(_ call: CAPPluginCall) {
        guard let text = call.getString("snapshot"),
              let data = text.data(using: .utf8),
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            call.reject("Dati dei widget non validi")
            return
        }
        WorkbitSharedStore.save(data)
        WidgetCenter.shared.reloadAllTimelines()
        if #available(iOS 16.2, *) {
            ShiftActivityController.sync(snapshot)
        }
        call.resolve()
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

        let state = ShiftActivityAttributes.ContentState(since: open.sinceDate, end: open.endDate, out: nil)

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
