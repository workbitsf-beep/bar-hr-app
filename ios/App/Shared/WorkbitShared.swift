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
    let v: Int
    let venue: String?
    let shifts: [WidgetShift]
    let open: WidgetOpenEntry?

    static let empty = WidgetSnapshot(v: 1, venue: nil, shifts: [], open: nil)
}

enum WorkbitSharedStore {
    private static let service = "it.workbit.widgets"
    private static let account = "snapshot"

    /// "TEAMID.it.workbit.shared", from the Info.plist of whichever side reads it.
    private static var accessGroup: String? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "WorkbitKeychainGroup") as? String,
              !group.isEmpty, !group.hasPrefix(".") else { return nil }
        return group
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
        SecItemAdd(item as CFDictionary, nil)
    }

    static func clear() {
        SecItemDelete(query() as CFDictionary)
    }

    static func load() -> WidgetSnapshot {
        var request = query()
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(request as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let snapshot = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
            return .empty
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
    }

    var venue: String
    var area: String
}
#endif
