import Foundation
import Security
#if canImport(ActivityKit)
import ActivityKit
#endif

/**
 * Shared by the app and its widget extension: what the page hands over
 * (app/api/widgets) and where it is kept between the two.
 *
 * It lives in a keychain item both can read. An App Group would be the usual
 * place, but App Groups can only be made on the developer website, and
 * everything else here is set up through the App Store Connect API.
 */

struct WidgetShift: Codable, Hashable {
    let start: Double
    let end: Double
    let area: String?

    var startDate: Date { Date(timeIntervalSince1970: start / 1000) }
    var endDate: Date { Date(timeIntervalSince1970: end / 1000) }
}

struct WidgetOpenEntry: Codable, Hashable {
    let since: Double
    let end: Double?
    let area: String?

    var sinceDate: Date { Date(timeIntervalSince1970: since / 1000) }
    var endDate: Date? { end.map { Date(timeIntervalSince1970: $0 / 1000) } }
}

struct WidgetSnapshot: Codable {
    var v: Int
    var venue: String?
    var shifts: [WidgetShift]
    var open: WidgetOpenEntry?
    /// "ottobre" and the month's closed hours, for "Ore di ottobre: 86 h".
    var month: String? = nil
    var monthHours: Double? = nil

    static let empty = WidgetSnapshot(v: 1, venue: nil, shifts: [], open: nil)
}

enum WorkbitSharedStore {
    private static let service = "it.workbit.widgets"
    private static let account = "snapshot"

    /// "TEAMID.it.workbit.shared". The team prefix is read from the keychain
    /// itself - the group a plain item lands in starts with it - because
    /// $(AppIdentifierPrefix) in the Info.plist came out empty in the builds
    /// signed on GitHub, and the app and the widget then never met.
    private static let accessGroup: String? = {
        if let prefix = teamPrefix() { return prefix + "it.workbit.shared" }
        guard let group = Bundle.main.object(forInfoDictionaryKey: "WorkbitKeychainGroup") as? String,
              !group.isEmpty, group.contains("."), !group.hasPrefix("it.") else { return nil }
        return group
    }()

    private static func teamPrefix() -> String? {
        let probe: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "it.workbit.team-prefix",
            kSecAttrAccount as String: "probe",
            kSecReturnAttributes as String: true,
        ]
        var result: AnyObject?
        var status = SecItemCopyMatching(probe as CFDictionary, &result)
        if status == errSecItemNotFound {
            var item = probe
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            status = SecItemAdd(item as CFDictionary, &result)
        }
        guard status == errSecSuccess,
              let attributes = result as? [String: Any],
              let group = attributes[kSecAttrAccessGroup as String] as? String,
              let dot = group.firstIndex(of: ".") else { return nil }
        return String(group[...dot])
    }

    private static func query() -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        if let accessGroup { query[kSecAttrAccessGroup as String] = accessGroup }
        return query
    }

    static func save(_ data: Data) {
        SecItemDelete(query() as CFDictionary)
        var item = query()
        item[kSecValueData as String] = data
        // The widgets refresh while the phone is locked too.
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(item as CFDictionary, nil)
        if status != errSecSuccess {
            NSLog("[widgets] snapshot not saved (%d) in %@", status, accessGroup ?? "default group")
        }
    }

    static func clear() {
        SecItemDelete(query() as CFDictionary)
    }

    static func load() -> WidgetSnapshot {
        loadIfSaved() ?? .empty
    }

    /// Nil when the app never handed anything over: the widgets then say to open it.
    static func loadIfSaved() -> WidgetSnapshot? {
        var request = query()
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            return nil
        }
        return snapshot
    }
}

#if canImport(ActivityKit)
/// The Live Activity of a stamp in progress: from the entry to the exit.
@available(iOS 16.1, *)
struct ShiftActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var since: Date
        var end: Date?
        /// Set once the exit is stamped: the activity says so, then goes.
        var out: Date?
        var month: String? = nil
        var monthHours: Double? = nil
    }

    var venue: String
    var area: String
}
#endif
