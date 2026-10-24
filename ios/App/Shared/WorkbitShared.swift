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

/// The floor, for the owner and the managers: who is in, what waits.
struct WidgetTeam: Codable, Hashable {
    struct Person: Codable, Hashable {
        let name: String
        let initials: String
    }

    struct Pending: Codable, Hashable {
        let icon: String
        let title: String
        let when: String
        let attention: Bool
    }

    /// Someone late (minutes past the start) or on the way (minutes to it).
    struct Due: Codable, Hashable {
        let name: String
        let initials: String
        let detail: String
        let minutes: Int
    }

    struct DayRow: Codable, Hashable {
        let name: String
        let start: Double
        let end: Double
        /// in, late, next, done
        let state: String
    }

    struct Day: Codable, Hashable {
        let from: Double
        let to: Double
        let rows: [DayRow]
    }

    struct Week: Codable, Hashable {
        let worked: Double
        let planned: Double
        let cost: Double?
        let missingRates: Int
        let label: String
    }

    let inService: [Person]
    let expected: Int
    let pending: [Pending]
    let pendingCount: Int
    var late: [Due]? = nil
    var arriving: [Due]? = nil
    var day: Day? = nil
    var week: Week? = nil
}

/// One venue they run and its floor: a widget can be set to show it.
struct WidgetFloor: Codable, Hashable {
    let id: String
    let name: String
    let team: WidgetTeam?
}

/// Who one works with on the next shift.
struct WidgetMates: Codable, Hashable {
    let start: Double
    let end: Double
    let people: [WidgetTeam.Person]
}

/// Today's notes and duties, the open ones first.
struct WidgetTasks: Codable, Hashable {
    struct Item: Codable, Hashable {
        let title: String
        let done: Bool
        let urgent: Bool
    }

    let total: Int
    let done: Int
    let items: [Item]
}

struct WidgetSnapshot: Codable {
    var v: Int
    var venue: String?
    var shifts: [WidgetShift]
    var open: WidgetOpenEntry?
    /// "ottobre" and the month's closed hours, for "Ore di ottobre: 86 h".
    var month: String? = nil
    var monthHours: Double? = nil
    /// "manager" for the owner and staff running the floor.
    var role: String? = nil
    var team: WidgetTeam? = nil
    /// Lets the widgets refresh by themselves (lib/widget-snapshot.ts).
    var token: String? = nil
    var monthPlannedHours: Double? = nil
    var mates: WidgetMates? = nil
    var tasks: WidgetTasks? = nil
    /// When the server made it, in ms: "12 min late" keeps counting from here.
    var updatedAt: Double? = nil
    /// Every venue they run; the first is the default for the owner's widgets.
    var floors: [WidgetFloor]? = nil

    static let empty = WidgetSnapshot(v: 1, venue: nil, shifts: [], open: nil)
}

enum WorkbitSharedStore {
    private static let service = "it.workbit.widgets"
    private static let account = "snapshot"

    /// "TEAMID.it.workbit.shared". The team prefix is read from the keychain
    /// itself - the group a plain item lands in starts with it - because
    /// $(AppIdentifierPrefix) in the Info.plist came out empty in the builds
    /// signed on GitHub, and the app and the widget then never met.
    static let accessGroup: String? = {
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

    /// What the keychain said last, shown by the temporary check page.
    static var lastStatus: OSStatus = 0

    @discardableResult
    static func save(_ data: Data) -> OSStatus {
        SecItemDelete(query() as CFDictionary)
        var item = query()
        item[kSecValueData as String] = data
        // The widgets refresh while the phone is locked too.
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(item as CFDictionary, nil)
        if status != errSecSuccess {
            NSLog("[widgets] snapshot not saved (%d) in %@", status, accessGroup ?? "default group")
        }
        lastStatus = status
        return status
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
        lastStatus = SecItemCopyMatching(request as CFDictionary, &result)
        guard lastStatus == errSecSuccess,
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
