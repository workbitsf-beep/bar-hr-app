import WidgetKit
import SwiftUI
import AppIntents

/**
 * The home and lock screen widgets: the next shift and the week. They read
 * what the app last handed over (WorkbitShared.swift) and work out the rest
 * from the clock, so "Domani" turns into "Oggi" without the app being opened.
 *
 * The look follows the app: white cards, a coloured dot with a small-caps
 * label, a violet rail for what is yours, bold only for your own hours.
 */

@main
struct WorkbitWidgetBundle: WidgetBundle {
    var body: some Widget {
        StaffWidgets().body
        FloorWidgets().body
        ShiftLiveActivity()
    }
}

/// A bundle holds ten widgets at most: one for everyone's own...
struct StaffWidgets: WidgetBundle {
    var body: some Widget {
        NextShiftWidget()
        WeekWidget()
        MatesWidget()
        MonthWidget()
        TasksWidget()
    }
}

/// ...and one for the owner's and the managers'.
struct FloorWidgets: WidgetBundle {
    var body: some Widget {
        TeamNowWidget()
        PendingWidget()
        LateWidget()
        DayWidget()
        WeekHoursWidget()
        BoardWidget()
    }
}

// MARK: - Colours

enum Brand {
    static let violet = Color(red: 0x6d / 255, green: 0x5c / 255, blue: 0xe7 / 255)
    static let violetInk = Color(red: 0x55 / 255, green: 0x46 / 255, blue: 0xc9 / 255)
    static let ink = Color(red: 0x1b / 255, green: 0x18 / 255, blue: 0x30 / 255)
    static let muted = Color(red: 0x57 / 255, green: 0x53 / 255, blue: 0x6b / 255)
    static let lilac = Color(red: 0xef / 255, green: 0xec / 255, blue: 0xfd / 255)
    static let lilacInk = Color(red: 0x3b / 255, green: 0x2f / 255, blue: 0xa8 / 255)
    static let hairline = Color(red: 0xec / 255, green: 0xe9 / 255, blue: 0xf5 / 255)
    static let dashed = Color(red: 0xd6 / 255, green: 0xd1 / 255, blue: 0xea / 255)
    static let sky = Color(red: 0x0e / 255, green: 0xa5 / 255, blue: 0xe9 / 255)
    static let skyInk = Color(red: 0x07 / 255, green: 0x59 / 255, blue: 0x85 / 255)
    static let green = Color(red: 0x10 / 255, green: 0xb9 / 255, blue: 0x81 / 255)
    static let gradient = LinearGradient(
        colors: [
            Color(red: 0x3b / 255, green: 0x1d / 255, blue: 0x8f / 255),
            Color(red: 0x5e / 255, green: 0x4a / 255, blue: 0xe3 / 255),
            Color(red: 0x8b / 255, green: 0x5c / 255, blue: 0xf6 / 255),
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - Words and times

enum Words {
    static let italian = Locale(identifier: "it_IT")

    static func clock(_ date: Date, endOf start: Date? = nil) -> String {
        let calendar = Calendar.current
        let parts = calendar.dateComponents([.hour, .minute], from: date)
        // A shift ending at midnight ends at 24:00, not at 00:00.
        if let start, parts.hour == 0, parts.minute == 0, date > start, !calendar.isDate(date, inSameDayAs: start) {
            return "24:00"
        }
        return String(format: "%02d:%02d", parts.hour ?? 0, parts.minute ?? 0)
    }

    /// "18" for 18:00, "18:30" otherwise: the week's cells are narrow.
    static func hour(_ date: Date, endOf start: Date? = nil) -> String {
        let text = clock(date, endOf: start)
        return text.hasSuffix(":00") ? String(text.prefix(2)) : text
    }

    static func range(_ shift: WidgetShift) -> String {
        "\(clock(shift.startDate))–\(clock(shift.endDate, endOf: shift.startDate))"
    }

    static func weekday(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = italian
        formatter.dateFormat = "EEE"
        return formatter.string(from: date).lowercased()
    }

    static func day(_ date: Date, now: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDate(date, inSameDayAs: now) { return "Oggi" }
        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: now), calendar.isDate(date, inSameDayAs: tomorrow) {
            let formatter = DateFormatter()
            formatter.locale = italian
            formatter.dateFormat = "EEE d"
            return "Domani · \(formatter.string(from: date).lowercased())"
        }
        let formatter = DateFormatter()
        formatter.locale = italian
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: date).lowercased()
    }

    /// "tra 21 h", "tra 40 min", "in corso".
    static func countdown(to shift: WidgetShift, now: Date) -> String {
        if shift.startDate <= now { return "in corso" }
        let minutes = Int(shift.startDate.timeIntervalSince(now) / 60)
        if minutes < 60 { return "tra \(max(minutes, 1)) min" }
        let hours = minutes / 60
        if hours < 48 { return "tra \(hours) h" }
        return "tra \(hours / 24) giorni"
    }

    static func hours(_ seconds: TimeInterval) -> String {
        let minutes = Int(seconds / 60)
        let h = minutes / 60
        let m = minutes % 60
        return m == 0 ? "\(h) h" : String(format: "%d h %02d", h, m)
    }

    static func monthDays(_ from: Date, _ to: Date) -> String {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = italian
        formatter.dateFormat = "MMM"
        let first = calendar.component(.day, from: from)
        let last = calendar.component(.day, from: to)
        if calendar.component(.month, from: from) == calendar.component(.month, from: to) {
            return "\(first)–\(last) \(formatter.string(from: to).lowercased())"
        }
        return "\(first) \(formatter.string(from: from).lowercased()) – \(last) \(formatter.string(from: to).lowercased())"
    }
}

// MARK: - Timeline

struct ShiftsEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
    /// False until the app has handed the shifts over once.
    var hasData = true

    var next: WidgetShift? {
        snapshot.shifts.sorted { $0.start < $1.start }.first { $0.endDate > date }
    }

    struct Day: Identifiable {
        let id: Int
        let label: String
        let shift: WidgetShift?
        let isToday: Bool
    }

    var week: (days: [Day], from: Date, to: Date, total: TimeInterval) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        calendar.timeZone = .current
        let monday = calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? calendar.startOfDay(for: date)
        var days: [Day] = []
        var total: TimeInterval = 0
        for offset in 0..<7 {
            let day = calendar.date(byAdding: .day, value: offset, to: monday)!
            let shifts = snapshot.shifts.filter { calendar.isDate($0.startDate, inSameDayAs: day) }.sorted { $0.start < $1.start }
            total += shifts.reduce(0) { $0 + $1.endDate.timeIntervalSince($1.startDate) }
            days.append(Day(id: offset, label: Words.weekday(day), shift: shifts.first, isToday: calendar.isDate(day, inSameDayAs: date)))
        }
        let sunday = calendar.date(byAdding: .day, value: 6, to: monday)!
        return (days, monday, sunday, total)
    }
}

struct ShiftsProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShiftsEntry {
        ShiftsEntry(date: Date(), snapshot: Self.sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (ShiftsEntry) -> Void) {
        let stored = WorkbitSharedStore.loadIfSaved()
        if context.isPreview && (stored?.shifts.isEmpty ?? true) {
            completion(ShiftsEntry(date: Date(), snapshot: Self.sample))
        } else {
            completion(ShiftsEntry(date: Date(), snapshot: stored ?? .empty, hasData: stored != nil))
        }
    }

    /// One entry now and one at every moment the words change: each start
    /// and end of a shift in the next two days, and midnight.
    func getTimeline(in context: Context, completion: @escaping (Timeline<ShiftsEntry>) -> Void) {
        WidgetRefresh.fetch { stored in
            completion(Self.timeline(stored))
        }
    }

    static func timeline(_ stored: WidgetSnapshot?) -> Timeline<ShiftsEntry> {
        let now = Date()
        let snapshot = stored ?? .empty
        let horizon = now.addingTimeInterval(48 * 60 * 60)
        var moments: Set<Date> = [now]
        for shift in snapshot.shifts {
            for moment in [shift.startDate, shift.endDate] where moment > now && moment < horizon {
                moments.insert(moment)
            }
        }
        let calendar = Calendar.current
        if let midnight = calendar.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0), matchingPolicy: .nextTime) {
            moments.insert(midnight)
        }
        // "tra 3 h" counts down: once an hour is enough to keep it true.
        for hour in 1...12 {
            moments.insert(now.addingTimeInterval(Double(hour) * 60 * 60))
        }
        let entries = moments.sorted().map { ShiftsEntry(date: $0, snapshot: snapshot, hasData: stored != nil) }
        // Asked again soon, to fetch fresh data: the floor changes by the
        // minute, one's own shifts much less. iOS may stretch it.
        let refresh = snapshot.role == "manager" ? 20.0 : 45.0
        return Timeline(entries: entries, policy: .after(now.addingTimeInterval(refresh * 60)))
    }

    static let sample: WidgetSnapshot = {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        func shift(_ day: Int, _ from: Int, _ to: Int) -> WidgetShift {
            let start = calendar.date(byAdding: .hour, value: day * 24 + from, to: today)!
            let end = calendar.date(byAdding: .hour, value: day * 24 + to, to: today)!
            return WidgetShift(start: start.timeIntervalSince1970 * 1000, end: end.timeIntervalSince1970 * 1000, area: "Sala")
        }
        return WidgetSnapshot(v: 1, venue: "Bar Aurora", shifts: [shift(0, 10, 16), shift(1, 18, 24), shift(2, 18, 26), shift(3, 18, 26)], open: nil)
    }()
}

// MARK: - Pieces

struct Label11: View {
    let text: String
    let dot: Color
    let ink: Color

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(dot).frame(width: 7, height: 7)
            Text(text.uppercased())
                .font(.system(size: 10.5))
                .tracking(0.8)
                .foregroundColor(ink)
                .lineLimit(1)
        }
    }
}

extension View {
    @ViewBuilder
    func workbitBackground(_ color: Color = .white) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            containerBackground(color, for: .widget)
        } else {
            background(color)
        }
    }
}

// MARK: - Prossimo turno

struct NextShiftWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WorkbitNextShift", provider: ShiftsProvider()) { entry in
            NextShiftView(entry: entry)
        }
        .configurationDisplayName("Prossimo turno")
        .description("I tuoi turni: quando lavori la prossima volta.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline, .accessoryCircular])
    }
}

struct NextShiftView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        switch family {
        case .accessoryCircular:
            CountdownRing(entry: entry)
        case .accessoryInline:
            if let next = entry.next {
                Text("\(Words.day(next.startDate, now: entry.date).components(separatedBy: " · ").first ?? "") \(Words.range(next))")
            } else {
                Text("Nessun turno")
            }
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                if let next = entry.next {
                    Text(Words.day(next.startDate, now: entry.date).components(separatedBy: " · ").first.map { "Turno \($0.lowercased())" } ?? "Turno")
                        .font(.system(size: 12))
                    Text(Words.range(next)).font(.system(size: 17, weight: .bold))
                    if let area = next.area, !area.isEmpty { Text(area).font(.system(size: 12)) }
                } else {
                    Text("Turni").font(.system(size: 12))
                    Text("Nessun turno").font(.system(size: 15, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .workbitBackground(.clear)
        default:
            small
        }
    }

    private var small: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 2).fill(Brand.violet).frame(width: 3)
                .padding(.trailing, 10)
            VStack(alignment: .leading, spacing: 0) {
                Label11(text: "Prossimo turno", dot: Brand.violet, ink: Brand.violetInk)
                Spacer(minLength: 6)
                if let next = entry.next {
                    Text(Words.day(next.startDate, now: entry.date))
                        .font(.system(size: 13))
                        .foregroundColor(Brand.muted)
                        .lineLimit(1)
                    Text(Words.range(next))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(Brand.ink)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    HStack {
                        if let area = next.area, !area.isEmpty {
                            Text(area)
                                .font(.system(size: 11))
                                .foregroundColor(Brand.lilacInk)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(Brand.lilac))
                        }
                        Spacer(minLength: 4)
                        Text(Words.countdown(to: next, now: entry.date))
                            .font(.system(size: 11))
                            .foregroundColor(Brand.muted)
                            .lineLimit(1)
                    }
                } else if !entry.hasData {
                    Text("Apri Workbit per vedere i tuoi turni")
                        .font(.system(size: 14))
                        .foregroundColor(Brand.muted)
                    Spacer()
                } else {
                    Text("Nessun turno in programma")
                        .font(.system(size: 15))
                        .foregroundColor(Brand.muted)
                    Spacer()
                }
            }
        }
        .workbitBackground()
    }
}

// MARK: - La tua settimana

struct WeekWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WorkbitWeek", provider: ShiftsProvider()) { entry in
            WeekView(entry: entry)
        }
        .configurationDisplayName("La tua settimana")
        .description("I tuoi turni: da lunedì a domenica, con le ore.")
        .supportedFamilies([.systemMedium, .accessoryCircular])
    }
}

struct WeekView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        let week = entry.week
        if family == .accessoryCircular {
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text("\(Int(week.total / 3600))").font(.system(size: 18, weight: .bold))
                    Text("ore").font(.system(size: 11))
                }
            }
            .workbitBackground(.clear)
        } else {
            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    Label11(text: "La tua settimana", dot: Brand.violet, ink: Brand.violetInk)
                    Spacer()
                    Text(Words.hours(week.total)).font(.system(size: 14, weight: .bold)).foregroundColor(Brand.ink)
                    Text(Words.monthDays(week.from, week.to)).font(.system(size: 11)).foregroundColor(Brand.muted)
                }
                if !entry.hasData {
                    Text("Apri Workbit per vedere i tuoi turni")
                        .font(.system(size: 14))
                        .foregroundColor(Brand.muted)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    HStack(spacing: 5) {
                        ForEach(week.days) { day in
                            VStack(spacing: 5) {
                                Text(day.label)
                                    .font(.system(size: 11))
                                    .foregroundColor(day.isToday ? Brand.violetInk : Brand.muted)
                                cell(day)
                            }
                        }
                    }
                }
            }
            .workbitBackground()
        }
    }

    @ViewBuilder
    private func cell(_ day: ShiftsEntry.Day) -> some View {
        if let shift = day.shift {
            VStack(spacing: 1) {
                Text(Words.hour(shift.startDate)).font(.system(size: 14, weight: .bold))
                Text("–\(Words.hour(shift.endDate, endOf: shift.startDate))").font(.system(size: 10))
            }
            .foregroundColor(day.isToday ? .white : Brand.lilacInk)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(day.isToday ? AnyShapeStyle(Brand.gradient) : AnyShapeStyle(Brand.lilac))
            )
        } else {
            Text("riposo")
                .font(.system(size: 9))
                .foregroundColor(Brand.muted)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(Brand.dashed, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                )
        }
    }
}

// MARK: - Refreshing by themselves

/// Fetches a fresh snapshot with the token the app left, and keeps it. Falls
/// back to what is stored when offline or when the token is no longer good.
enum WidgetRefresh {
    static func fetch(_ done: @escaping (WidgetSnapshot?) -> Void) {
        let stored = WorkbitSharedStore.loadIfSaved()
        guard let token = stored?.token,
              var components = URLComponents(string: "https://app.workbit.it/api/widgets") else {
            done(stored)
            return
        }
        components.queryItems = [URLQueryItem(name: "t", value: token)]
        guard let url = components.url else {
            done(stored)
            return
        }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        URLSession.shared.dataTask(with: request) { data, response, _ in
            guard let data,
                  (response as? HTTPURLResponse)?.statusCode == 200,
                  var fresh = try? JSONDecoder().decode(WidgetSnapshot.self, from: data) else {
                done(stored)
                return
            }
            fresh.token = token
            if let encoded = try? JSONEncoder().encode(fresh) {
                WorkbitSharedStore.save(encoded)
            }
            done(fresh)
        }.resume()
    }
}

// MARK: - Per il titolare: in servizio

private let avatarColors: [Color] = [
    Color(red: 0x6d / 255, green: 0x5c / 255, blue: 0xe7 / 255),
    Color(red: 0x0e / 255, green: 0x74 / 255, blue: 0x90 / 255),
    Color(red: 0xb4 / 255, green: 0x53 / 255, blue: 0x09 / 255),
    Color(red: 0x04 / 255, green: 0x78 / 255, blue: 0x57 / 255),
]

private let greenInk = Color(red: 0x04 / 255, green: 0x78 / 255, blue: 0x57 / 255)

struct TeamNowWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "WorkbitTeamNow", intent: VenueIntent.self, provider: FloorProvider()) { entry in
            TeamNowSwitch(entry: entry)
        }
        .configurationDisplayName("In servizio")
        .description("Per il titolare: chi è al lavoro adesso.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

struct TeamNowView: View {
    let entry: ShiftsEntry

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 2).fill(Brand.sky).frame(width: 3).padding(.trailing, 10)
            VStack(alignment: .leading, spacing: 0) {
                Label11(text: "In servizio", dot: Brand.sky, ink: Color(red: 0x03 / 255, green: 0x69 / 255, blue: 0xa1 / 255))
                Spacer(minLength: 4)
                if let team = entry.snapshot.team {
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text("\(team.inService.count)")
                            .font(.system(size: 42))
                            .foregroundColor(Brand.ink)
                        Text("di \(team.expected)")
                            .font(.system(size: 16))
                            .foregroundColor(Brand.muted)
                    }
                    Spacer(minLength: 4)
                    HStack(spacing: -8) {
                        ForEach(Array(team.inService.prefix(5).enumerated()), id: \.offset) { index, person in
                            Text(person.initials)
                                .font(.system(size: 9))
                                .foregroundColor(.white)
                                .frame(width: 26, height: 26)
                                .background(Circle().fill(avatarColors[index % avatarColors.count]))
                                .overlay(Circle().stroke(Color.white, lineWidth: 2))
                        }
                    }
                } else {
                    Text(entry.hasData ? "Per titolare e responsabili" : "Apri Workbit")
                        .font(.system(size: 13))
                        .foregroundColor(Brand.muted)
                    Spacer()
                }
            }
            Spacer(minLength: 0)
        }
        .workbitBackground()
    }
}

// MARK: - Per il titolare: da approvare

struct PendingWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "WorkbitPending", intent: VenueIntent.self, provider: FloorProvider()) { entry in
            PendingSwitch(entry: entry)
        }
        .configurationDisplayName("Da approvare")
        .description("Per il titolare: ferie, permessi e timbrature da approvare.")
        .supportedFamilies([.systemMedium, .accessoryInline])
    }
}

struct PendingView: View {
    let entry: ShiftsEntry
    /// Inside the Plancia, which draws the card itself.
    var embedded = false

    var body: some View {
        if embedded {
            list
        } else {
            list.workbitBackground()
        }
    }

    private var list: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Label11(text: "Da approvare", dot: Brand.green, ink: greenInk)
                Spacer()
                if let count = entry.snapshot.team?.pendingCount, count > 0 {
                    Text("\(count)")
                        .font(.system(size: 12))
                        .foregroundColor(greenInk)
                        .padding(.horizontal, 9)
                        .padding(.vertical, 2)
                        .background(Capsule().fill(Color(red: 0xe3 / 255, green: 0xf7 / 255, blue: 0xef / 255)))
                }
            }
            .padding(.bottom, 6)

            if let team = entry.snapshot.team {
                if team.pending.isEmpty {
                    Spacer()
                    Text("Niente da approvare")
                        .font(.system(size: 14))
                        .foregroundColor(Brand.muted)
                        .frame(maxWidth: .infinity)
                    Spacer()
                } else {
                    ForEach(Array(team.pending.prefix(3).enumerated()), id: \.offset) { _, item in
                        VStack(spacing: 0) {
                            Rectangle().fill(Brand.hairline).frame(height: 1)
                            HStack(spacing: 8) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(item.attention ? Color(red: 0xf5 / 255, green: 0x9e / 255, blue: 0x0b / 255) : Brand.green)
                                    .frame(width: 3, height: 18)
                                Text(item.icon).font(.system(size: 15))
                                Text(item.title)
                                    .font(.system(size: 13))
                                    .foregroundColor(Brand.ink)
                                    .lineLimit(1)
                                Spacer(minLength: 4)
                                Text(item.when)
                                    .font(.system(size: 12))
                                    .foregroundColor(Brand.muted)
                                    .lineLimit(1)
                                Text("›").foregroundColor(Brand.muted)
                            }
                            .padding(.vertical, 6)
                        }
                    }
                    Spacer(minLength: 0)
                }
            } else {
                Spacer()
                Text(entry.hasData ? "Per titolare e responsabili" : "Apri Workbit")
                    .font(.system(size: 14))
                    .foregroundColor(Brand.muted)
                    .frame(maxWidth: .infinity)
                Spacer()
            }
        }
    }
}

// MARK: - Shared pieces for the new widgets

private let amber = Color(red: 0xf5 / 255, green: 0x9e / 255, blue: 0x0b / 255)
private let amberInk = Color(red: 0x92 / 255, green: 0x40 / 255, blue: 0x0e / 255)
private let amberSoft = Color(red: 0xfe / 255, green: 0xf3 / 255, blue: 0xc7 / 255)
private let skyInk = Color(red: 0x03 / 255, green: 0x69 / 255, blue: 0xa1 / 255)
private let purple = Color(red: 0x7e / 255, green: 0x22 / 255, blue: 0xce / 255)
private let purpleInk = Color(red: 0x6b / 255, green: 0x21 / 255, blue: 0xa8 / 255)
private let lilacBar = Color(red: 0xc9 / 255, green: 0xc2 / 255, blue: 0xf5 / 255)
private let doneBar = Color(red: 0xd6 / 255, green: 0xd1 / 255, blue: 0xea / 255)
private let nowLine = Color(red: 0xe0 / 255, green: 0x86 / 255, blue: 0x8f / 255)

private func hoursText(_ value: Double) -> String {
    value.rounded() == value ? "\(Int(value)) h" : String(format: "%.1f h", value).replacingOccurrences(of: ".", with: ",")
}

private func euros(_ value: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Words.italian
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = 0
    return "\(formatter.string(from: NSNumber(value: value)) ?? "\(Int(value))") €"
}

/// Minutes late, still counting from when the server looked.
private func lateMinutes(_ due: WidgetTeam.Due, entry: ShiftsEntry) -> Int {
    guard let updated = entry.snapshot.updatedAt else { return due.minutes }
    let since = entry.date.timeIntervalSince(Date(timeIntervalSince1970: updated / 1000))
    return due.minutes + max(0, Int(since / 60))
}

private func floorOnly(_ entry: ShiftsEntry, size: CGFloat = 14) -> some View {
    Text(entry.hasData ? "Per titolare e responsabili" : "Apri Workbit")
        .font(.system(size: size))
        .foregroundColor(Brand.muted)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
}

private struct Ring: View {
    let progress: Double
    let color: Color
    var track: Color = Brand.hairline
    var width: CGFloat = 8

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: width)
            Circle()
                .trim(from: 0, to: max(0.001, min(1, progress)))
                .stroke(color, style: StrokeStyle(lineWidth: width, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

private struct Avatar: View {
    let initials: String
    let index: Int
    var size: CGFloat = 22

    var body: some View {
        Text(initials)
            .font(.system(size: size * 0.4))
            .foregroundColor(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(avatarColors[index % avatarColors.count]))
    }
}

// MARK: - Lock screen variants of the first widgets

struct CountdownRing: View {
    let entry: ShiftsEntry

    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let next = entry.next {
                let started = next.startDate <= entry.date
                let left = (started ? next.endDate : next.startDate).timeIntervalSince(entry.date)
                let progress = started
                    ? entry.date.timeIntervalSince(next.startDate) / max(1, next.endDate.timeIntervalSince(next.startDate))
                    : 1 - min(1, left / (12 * 3600))
                Ring(progress: progress, color: .white, track: Color.white.opacity(0.25), width: 5)
                    .padding(4)
                VStack(spacing: 0) {
                    Text(left < 3600 ? "\(max(1, Int(left / 60))) m" : "\(Int(left / 3600)) h")
                        .font(.system(size: 15, weight: .bold))
                    Text(started ? "alla fine" : "al turno")
                        .font(.system(size: 8))
                }
            } else {
                Text("—").font(.system(size: 15))
            }
        }
        .workbitBackground(.clear)
    }
}

struct TeamNowSwitch: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        if family == .accessoryCircular {
            ZStack {
                AccessoryWidgetBackground()
                if let team = entry.snapshot.team {
                    Ring(progress: Double(team.inService.count) / Double(max(1, team.expected)), color: .white, track: Color.white.opacity(0.25), width: 5)
                        .padding(4)
                    VStack(spacing: 0) {
                        Text("\(team.inService.count)/\(team.expected)").font(.system(size: 15, weight: .bold))
                        Text("dentro").font(.system(size: 8))
                    }
                } else {
                    Text("—").font(.system(size: 15))
                }
            }
            .workbitBackground(.clear)
        } else {
            TeamNowView(entry: entry)
        }
    }
}

struct PendingSwitch: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        if family == .accessoryInline {
            let count = entry.snapshot.team?.pendingCount ?? 0
            Text(count == 0 ? "Workbit: niente da approvare" : "Workbit: \(count) da approvare")
        } else {
            PendingView(entry: entry)
        }
    }
}

// MARK: - Ritardi

struct LateWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "WorkbitLate", intent: VenueIntent.self, provider: FloorProvider()) { entry in
            LateView(entry: entry)
        }
        .configurationDisplayName("Ritardi")
        .description("Per il titolare: chi doveva entrare e non ha ancora timbrato.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

struct LateView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        let team = entry.snapshot.team
        let late = team?.late ?? []
        switch family {
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(late.isEmpty ? "Nessun ritardo" : "In ritardo \(late.count)").font(.system(size: 12))
                ForEach(Array(late.prefix(2).enumerated()), id: \.offset) { _, due in
                    Text("\(due.name) · \(lateMinutes(due, entry: entry)) min").font(.system(size: 14, weight: .semibold)).lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .workbitBackground(.clear)
        case .systemSmall:
            HStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 2).fill(late.isEmpty ? Brand.green : amber).frame(width: 3).padding(.trailing, 10)
                VStack(alignment: .leading, spacing: 0) {
                    Label11(text: "In ritardo", dot: late.isEmpty ? Brand.green : amber, ink: late.isEmpty ? greenInk : amberInk)
                    Spacer(minLength: 4)
                    if team == nil {
                        floorOnly(entry, size: 13)
                    } else if late.isEmpty {
                        Text("Tutti puntuali").font(.system(size: 17)).foregroundColor(Brand.ink)
                        Spacer(minLength: 4)
                    } else {
                        HStack(alignment: .firstTextBaseline, spacing: 5) {
                            Text("\(late.count)").font(.system(size: 42)).foregroundColor(Brand.ink)
                            Text(late.count == 1 ? "persona" : "persone").font(.system(size: 15)).foregroundColor(Brand.muted)
                        }
                        Spacer(minLength: 4)
                        ForEach(Array(late.prefix(2).enumerated()), id: \.offset) { index, due in
                            Text("\(due.name) · \(lateMinutes(due, entry: entry)) min")
                                .font(.system(size: 12))
                                .foregroundColor(index == 0 ? Brand.ink : Brand.muted)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
            .workbitBackground()
        default:
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Label11(text: "Dovevano entrare", dot: amber, ink: amberInk)
                    Spacer()
                    Text("alle \(Words.clock(entry.date))").font(.system(size: 11)).foregroundColor(Brand.muted)
                }
                .padding(.bottom, 6)
                if team == nil {
                    floorOnly(entry)
                } else if late.isEmpty && (team?.arriving ?? []).isEmpty {
                    Text("Tutti puntuali").font(.system(size: 15)).foregroundColor(Brand.muted).frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    let rows: [(WidgetTeam.Due, Bool)] = late.map { ($0, true) } + (team?.arriving ?? []).map { ($0, false) }
                    ForEach(Array(rows.prefix(3).enumerated()), id: \.offset) { _, row in
                        VStack(spacing: 0) {
                            Rectangle().fill(Brand.hairline).frame(height: 1)
                            HStack(spacing: 8) {
                                RoundedRectangle(cornerRadius: 2).fill(row.1 ? amber : doneBar).frame(width: 3, height: 26)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(row.0.name).font(.system(size: 13)).foregroundColor(Brand.ink)
                                    Text(row.0.detail).font(.system(size: 11)).foregroundColor(Brand.muted).lineLimit(1)
                                }
                                Spacer(minLength: 4)
                                Text(row.1 ? "\(lateMinutes(row.0, entry: entry)) min" : "tra \(row.0.minutes) min")
                                    .font(.system(size: 12))
                                    .foregroundColor(row.1 ? amberInk : Brand.muted)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(row.1 ? amberSoft : Brand.lilac))
                            }
                            .padding(.vertical, 5)
                        }
                    }
                    Spacer(minLength: 0)
                }
            }
            .workbitBackground()
        }
    }
}

// MARK: - La giornata

struct DayWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "WorkbitDay", intent: VenueIntent.self, provider: FloorProvider()) { entry in
            DayView(entry: entry)
        }
        .configurationDisplayName("La giornata")
        .description("Per il titolare: i turni di oggi su una riga del tempo.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct DayChart: View {
    let day: WidgetTeam.Day
    let now: Date
    let rowHeight: CGFloat

    private func color(_ state: String) -> Color {
        switch state {
        case "in": return Brand.sky
        case "late": return amber
        case "done": return doneBar
        default: return lilacBar
        }
    }

    var body: some View {
        let span = max(3600 * 1000, day.to - day.from)
        let firstHour = Int(ceil(day.from / 3_600_000))
        let lastHour = Int(floor(day.to / 3_600_000))
        let step = max(1, (lastHour - firstHour) / 5)
        VStack(alignment: .leading, spacing: 5) {
            GeometryReader { geo in
                ForEach(Array(stride(from: firstHour, through: lastHour, by: step)), id: \.self) { hour in
                    let x = CGFloat((Double(hour) * 3_600_000 - day.from) / span) * geo.size.width
                    Text(Words.hour(Date(timeIntervalSince1970: Double(hour) * 3600)))
                        .font(.system(size: 9))
                        .foregroundColor(Brand.muted)
                        .position(x: min(max(x, 6), geo.size.width - 6), y: 5)
                }
            }
            .frame(height: 10)
            .padding(.leading, 66)
            ZStack(alignment: .topLeading) {
                VStack(spacing: 5) {
                    ForEach(Array(day.rows.enumerated()), id: \.offset) { _, row in
                        HStack(spacing: 4) {
                            Text(row.name)
                                .font(.system(size: 11))
                                .foregroundColor(row.state == "late" ? amberInk : Brand.ink)
                                .lineLimit(1)
                                .frame(width: 62, alignment: .leading)
                            GeometryReader { geo in
                                ZStack(alignment: .leading) {
                                    Capsule().fill(Color(red: 0xf3 / 255, green: 0xf1 / 255, blue: 0xf8 / 255))
                                    Capsule()
                                        .fill(color(row.state))
                                        .frame(width: max(6, CGFloat((row.end - row.start) / span) * geo.size.width))
                                        .offset(x: CGFloat((row.start - day.from) / span) * geo.size.width)
                                }
                            }
                            .frame(height: rowHeight)
                        }
                    }
                }
                GeometryReader { geo in
                    let position = (now.timeIntervalSince1970 * 1000 - day.from) / span
                    if position > 0 && position < 1 {
                        RoundedRectangle(cornerRadius: 1)
                            .fill(nowLine)
                            .frame(width: 2)
                            .offset(x: 66 + CGFloat(position) * (geo.size.width - 66))
                    }
                }
            }
        }
    }
}

struct DayView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label11(text: "La giornata", dot: Brand.violet, ink: Brand.violetInk)
                Spacer()
                if let day = entry.snapshot.team?.day {
                    Text("\(Set(day.rows.map(\.name)).count) persone").font(.system(size: 11)).foregroundColor(Brand.muted)
                }
            }
            if let day = entry.snapshot.team?.day {
                if day.rows.isEmpty {
                    Text("Nessun turno oggi").font(.system(size: 14)).foregroundColor(Brand.muted).frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    let rows = family == .systemLarge ? day.rows : Array(day.rows.prefix(4))
                    DayChart(day: WidgetTeam.Day(from: day.from, to: day.to, rows: rows), now: entry.date, rowHeight: family == .systemLarge ? 14 : 11)
                    Spacer(minLength: 0)
                }
            } else {
                floorOnly(entry)
            }
        }
        .workbitBackground()
    }
}

// MARK: - Ore della settimana

struct WeekHoursWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "WorkbitWeekHours", intent: VenueIntent.self, provider: FloorProvider()) { entry in
            WeekHoursView(entry: entry)
        }
        .configurationDisplayName("Ore della settimana")
        .description("Per il titolare: ore lavorate, programmate e costo stimato.")
        .supportedFamilies([.systemMedium])
    }
}

struct WeekHoursView: View {
    let entry: ShiftsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Label11(text: "Ore della settimana", dot: purple, ink: purpleInk)
                Spacer()
                if let week = entry.snapshot.team?.week {
                    Text(week.label).font(.system(size: 11)).foregroundColor(Brand.muted)
                }
            }
            if let week = entry.snapshot.team?.week {
                Spacer(minLength: 6)
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(hoursText(week.worked)).font(.system(size: 32)).foregroundColor(Brand.ink)
                            Text("di \(hoursText(week.planned))").font(.system(size: 14)).foregroundColor(Brand.muted)
                        }
                        Text("lavorate su programmate").font(.system(size: 11)).foregroundColor(Brand.muted)
                    }
                    Spacer()
                    if let cost = week.cost {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(euros(cost)).font(.system(size: 22)).foregroundColor(Brand.ink)
                            Text(week.missingRates > 0 ? "\(week.missingRates) senza paga oraria" : "costo stimato")
                                .font(.system(size: 11))
                                .foregroundColor(week.missingRates > 0 ? amberInk : Brand.muted)
                        }
                    }
                }
                Spacer(minLength: 8)
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color(red: 0xeb / 255, green: 0xe8 / 255, blue: 0xf6 / 255))
                        Capsule()
                            .fill(Brand.gradient)
                            .frame(width: geo.size.width * CGFloat(min(1, week.worked / max(1, week.planned))))
                    }
                }
                .frame(height: 8)
            } else {
                floorOnly(entry)
            }
        }
        .workbitBackground()
    }
}

// MARK: - Plancia

struct BoardWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "WorkbitBoard", intent: VenueIntent.self, provider: FloorProvider()) { entry in
            BoardView(entry: entry)
        }
        .configurationDisplayName("Plancia")
        .description("Per il titolare: in servizio, ritardi e cose da approvare.")
        .supportedFamilies([.systemLarge])
    }
}

struct BoardView: View {
    let entry: ShiftsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image("WorkbitLogo").resizable().scaledToFill().frame(width: 24, height: 24).clipShape(RoundedRectangle(cornerRadius: 7))
                Text(entry.snapshot.venue ?? "Workbit").font(.system(size: 15)).foregroundColor(Brand.ink).lineLimit(1)
                Spacer()
                Text(Words.clock(entry.date)).font(.system(size: 12)).foregroundColor(Brand.muted)
            }
            if let team = entry.snapshot.team {
                HStack(spacing: 10) {
                    tile(rail: Brand.sky, label: "In servizio", ink: skyInk, ground: Color(red: 0xf4 / 255, green: 0xf9 / 255, blue: 0xfd / 255)) {
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text("\(team.inService.count)").font(.system(size: 28)).foregroundColor(Brand.ink)
                            Text("di \(team.expected)").font(.system(size: 12)).foregroundColor(Brand.muted)
                        }
                        HStack(spacing: -6) {
                            ForEach(Array(team.inService.prefix(5).enumerated()), id: \.offset) { index, person in
                                Avatar(initials: person.initials, index: index, size: 20)
                            }
                        }
                    }
                    let late = team.late ?? []
                    tile(rail: late.isEmpty ? Brand.green : amber, label: "In ritardo", ink: late.isEmpty ? greenInk : amberInk, ground: late.isEmpty ? Color(red: 0xf2 / 255, green: 0xfb / 255, blue: 0xf7 / 255) : Color(red: 0xff / 255, green: 0xfa / 255, blue: 0xf0 / 255)) {
                        Text(late.isEmpty ? "0" : "\(late.count)").font(.system(size: 28)).foregroundColor(Brand.ink)
                        Text(late.isEmpty ? "tutti puntuali" : late.prefix(2).map { "\($0.name) \(lateMinutes($0, entry: entry))′" }.joined(separator: " · "))
                            .font(.system(size: 11))
                            .foregroundColor(late.isEmpty ? greenInk : amberInk)
                            .lineLimit(1)
                    }
                }
                PendingView(entry: entry, embedded: true)
            } else {
                floorOnly(entry)
            }
        }
        .workbitBackground()
    }

    private func tile<Content: View>(rail: Color, label: String, ink: Color, ground: Color, @ViewBuilder content: () -> Content) -> some View {
        HStack(spacing: 0) {
            Rectangle().fill(rail).frame(width: 3)
            VStack(alignment: .leading, spacing: 5) {
                Text(label.uppercased()).font(.system(size: 10)).tracking(0.8).foregroundColor(ink)
                content()
            }
            .padding(10)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity)
        .background(ground)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Con chi lavori

struct MatesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WorkbitMates", provider: ShiftsProvider()) { entry in
            MatesView(entry: entry)
        }
        .configurationDisplayName("Con chi lavori")
        .description("I tuoi turni: i colleghi del prossimo turno.")
        .supportedFamilies([.systemSmall])
    }
}

struct MatesView: View {
    let entry: ShiftsEntry

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 2).fill(Brand.violet).frame(width: 3).padding(.trailing, 10)
            VStack(alignment: .leading, spacing: 6) {
                Label11(text: "Con chi lavori", dot: Brand.violet, ink: Brand.violetInk)
                if let mates = entry.snapshot.mates {
                    let start = Date(timeIntervalSince1970: mates.start / 1000)
                    let end = Date(timeIntervalSince1970: mates.end / 1000)
                    Text("\(Words.day(start, now: entry.date).components(separatedBy: " · ").first ?? "") · \(Words.clock(start))–\(Words.clock(end, endOf: start))")
                        .font(.system(size: 12))
                        .foregroundColor(Brand.muted)
                        .lineLimit(1)
                    Spacer(minLength: 2)
                    if mates.people.isEmpty {
                        Text("Da solo").font(.system(size: 14)).foregroundColor(Brand.ink)
                    } else {
                        ForEach(Array(mates.people.prefix(3).enumerated()), id: \.offset) { index, person in
                            HStack(spacing: 7) {
                                Avatar(initials: person.initials, index: index)
                                Text(person.name).font(.system(size: 13)).foregroundColor(Brand.ink).lineLimit(1)
                            }
                        }
                        if mates.people.count > 3 {
                            Text("e altri \(mates.people.count - 3)").font(.system(size: 11)).foregroundColor(Brand.muted)
                        }
                    }
                    Spacer(minLength: 0)
                } else {
                    Spacer()
                    Text(entry.hasData ? "Nessun turno in programma" : "Apri Workbit").font(.system(size: 13)).foregroundColor(Brand.muted)
                    Spacer()
                }
            }
            Spacer(minLength: 0)
        }
        .workbitBackground()
    }
}

// MARK: - Ore del mese

struct MonthWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WorkbitMonth", provider: ShiftsProvider()) { entry in
            MonthView(entry: entry)
        }
        .configurationDisplayName("Ore del mese")
        .description("I tuoi turni: le ore del mese su quelle programmate.")
        .supportedFamilies([.systemSmall, .accessoryCircular])
    }
}

struct MonthView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        let worked = entry.snapshot.monthHours ?? 0
        let planned = entry.snapshot.monthPlannedHours ?? 0
        let progress = planned > 0 ? worked / planned : 0
        if family == .accessoryCircular {
            ZStack {
                AccessoryWidgetBackground()
                Ring(progress: progress, color: .white, track: Color.white.opacity(0.25), width: 5).padding(4)
                VStack(spacing: 0) {
                    Text("\(Int(worked.rounded()))").font(.system(size: 16, weight: .bold))
                    Text("ore").font(.system(size: 8))
                }
            }
            .workbitBackground(.clear)
        } else {
            VStack(spacing: 6) {
                Label11(text: "Ore di \(entry.snapshot.month ?? "questo mese")", dot: Brand.sky, ink: skyInk)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ZStack {
                    Ring(progress: progress, color: Brand.violet, width: 9)
                    VStack(spacing: 0) {
                        Text(hoursText(worked)).font(.system(size: 20, weight: .bold)).foregroundColor(Brand.ink)
                        Text(planned > 0 ? "di \(hoursText(planned))" : "lavorate").font(.system(size: 11)).foregroundColor(Brand.muted)
                    }
                }
                .padding(4)
            }
            .workbitBackground()
        }
    }
}

// MARK: - Da fare oggi

struct TasksWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WorkbitTasks", provider: ShiftsProvider()) { entry in
            TasksView(entry: entry)
        }
        .configurationDisplayName("Da fare oggi")
        .description("I tuoi turni: note e mansioni di oggi.")
        .supportedFamilies([.systemMedium])
    }
}

struct TasksView: View {
    let entry: ShiftsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Label11(text: "Da fare oggi", dot: amber, ink: amberInk)
                Spacer()
                if let tasks = entry.snapshot.tasks, tasks.total > 0 {
                    Text("\(tasks.done) di \(tasks.total) fatte").font(.system(size: 11)).foregroundColor(Brand.muted)
                }
            }
            .padding(.bottom, 6)
            if let tasks = entry.snapshot.tasks, !tasks.items.isEmpty {
                ForEach(Array(tasks.items.prefix(4).enumerated()), id: \.offset) { _, item in
                    VStack(spacing: 0) {
                        Rectangle().fill(Brand.hairline).frame(height: 1)
                        HStack(spacing: 9) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(item.done ? Brand.green : Color.white)
                                RoundedRectangle(cornerRadius: 5)
                                    .strokeBorder(item.done ? Brand.green : lilacBar, lineWidth: 1.5)
                                if item.done {
                                    Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundColor(.white)
                                }
                            }
                            .frame(width: 16, height: 16)
                            Text(item.title)
                                .font(.system(size: 13))
                                .foregroundColor(item.done ? Brand.muted : Brand.ink)
                                .strikethrough(item.done)
                                .lineLimit(1)
                            Spacer(minLength: 4)
                            if item.urgent && !item.done {
                                Text("urgente")
                                    .font(.system(size: 10))
                                    .foregroundColor(Color(red: 0xb3 / 255, green: 0x20 / 255, blue: 0x2f / 255))
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(Color(red: 0xfd / 255, green: 0xec / 255, blue: 0xee / 255)))
                            }
                        }
                        .padding(.vertical, 5)
                    }
                }
                Spacer(minLength: 0)
            } else {
                Text(entry.hasData ? "Niente da fare oggi" : "Apri Workbit")
                    .font(.system(size: 14))
                    .foregroundColor(Brand.muted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .workbitBackground()
    }
}

// MARK: - Which venue an owner's widget shows

/// A venue one runs, offered in the widget's settings (long press > Modifica widget).
struct VenueEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Locale"
    static var defaultQuery = VenueQuery()

    var id: String
    var name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct VenueQuery: EntityQuery {
    private func all() -> [VenueEntity] {
        (WorkbitSharedStore.loadIfSaved()?.floors ?? []).map { VenueEntity(id: $0.id, name: $0.name) }
    }

    func entities(for identifiers: [VenueEntity.ID]) async throws -> [VenueEntity] {
        all().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [VenueEntity] {
        all()
    }

    func defaultResult() async -> VenueEntity? {
        nil
    }
}

struct VenueIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Locale"
    static var description = IntentDescription("Il locale che il widget mostra. Vuoto: quello aperto nell'app.")

    @Parameter(title: "Locale")
    var venue: VenueEntity?
}

/// The owner's widgets: the same data as the others, with the floor of the
/// venue chosen in the widget's settings when there is one.
struct FloorProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> ShiftsEntry {
        ShiftsEntry(date: Date(), snapshot: ShiftsProvider.sample)
    }

    func snapshot(for configuration: VenueIntent, in context: Context) async -> ShiftsEntry {
        let stored = WorkbitSharedStore.loadIfSaved()
        return ShiftsEntry(date: Date(), snapshot: Self.pick(stored ?? .empty, configuration), hasData: stored != nil)
    }

    func timeline(for configuration: VenueIntent, in context: Context) async -> Timeline<ShiftsEntry> {
        let stored: WidgetSnapshot? = await withCheckedContinuation { continuation in
            WidgetRefresh.fetch { continuation.resume(returning: $0) }
        }
        return ShiftsProvider.timeline(stored.map { Self.pick($0, configuration) })
    }

    private static func pick(_ snapshot: WidgetSnapshot, _ configuration: VenueIntent) -> WidgetSnapshot {
        guard let chosen = configuration.venue?.id,
              let floor = snapshot.floors?.first(where: { $0.id == chosen }) else { return snapshot }
        var copy = snapshot
        copy.team = floor.team
        copy.venue = floor.name
        return copy
    }
}
