import WidgetKit
import SwiftUI

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
        NextShiftWidget()
        WeekWidget()
        ShiftLiveActivity()
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
        let now = Date()
        let stored = WorkbitSharedStore.loadIfSaved()
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
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(6 * 60 * 60))))
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
        .description("Quando lavori la prossima volta.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}

struct NextShiftView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ShiftsEntry

    var body: some View {
        switch family {
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
        .description("I tuoi turni da lunedì a domenica e le ore.")
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
