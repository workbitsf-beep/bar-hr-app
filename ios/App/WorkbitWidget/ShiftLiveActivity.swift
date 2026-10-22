import ActivityKit
import WidgetKit
import SwiftUI

/**
 * "In servizio" on the lock screen and in the Dynamic Island, from the entry
 * to the exit. The counter runs by itself from the entry time: nothing has
 * to be sent while the shift goes on.
 *
 * The round ESCI button opens Workbit, which stamps the exit straight away
 * (asking first if the shift is not near its end). Anywhere else opens Oggi.
 */

private let stampURL = URL(string: "workbit://timbra")!
private let todayURL = URL(string: "workbit://oggi")!

private enum Glass {
    static let ground = Color(red: 0x2a / 255, green: 0x18 / 255, blue: 0x66 / 255)
    static let soft = Color.white.opacity(0.78)
    static let button = RadialGradient(
        colors: [
            Color(red: 0x9d / 255, green: 0x8c / 255, blue: 0xff / 255),
            Color(red: 0x6d / 255, green: 0x5c / 255, blue: 0xe7 / 255),
            Color(red: 0x4a / 255, green: 0x2f / 255, blue: 0xc4 / 255),
        ],
        center: UnitPoint(x: 0.35, y: 0.3),
        startRadius: 2,
        endRadius: 70
    )
    static let done = Color(red: 0x10 / 255, green: 0xb9 / 255, blue: 0x81 / 255)
}

struct ShiftLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ShiftActivityAttributes.self) { context in
            LockScreenActivityView(state: context.state)
                .activityBackgroundTint(Glass.ground.opacity(0.92))
                .activitySystemActionForegroundColor(.white)
                .widgetURL(todayURL)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    StampButton(state: context.state, size: 64)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .leading, spacing: 2) {
                        SmallCaps(context.state.out == nil ? "In servizio da" : "Uscita timbrata")
                        Elapsed(state: context.state)
                            .font(.system(size: 30, weight: .bold))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    MonthLine(state: context.state)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.leading, 4)
                }
            } compactLeading: {
                Logo(size: 22)
            } compactTrailing: {
                Elapsed(state: context.state)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(red: 0xc4 / 255, green: 0xb5 / 255, blue: 0xfd / 255))
                    .frame(maxWidth: 56)
            } minimal: {
                Logo(size: 22)
            }
            .widgetURL(todayURL)
            .keylineTint(Brand.violet)
        }
    }
}

/// The round button: ESCI while at work, a tick once the exit is stamped.
private struct StampButton: View {
    let state: ShiftActivityAttributes.ContentState
    let size: CGFloat

    var body: some View {
        if state.out == nil {
            Link(destination: stampURL) {
                ZStack {
                    Circle().fill(Glass.button)
                    Circle().strokeBorder(Color.white.opacity(0.18), lineWidth: 1)
                    Text("ESCI")
                        .font(.system(size: size * 0.24, weight: .bold))
                        .foregroundColor(.white)
                }
                .frame(width: size, height: size)
                .shadow(color: Brand.violet.opacity(0.55), radius: 12)
            }
        } else {
            ZStack {
                Circle().fill(Glass.done)
                Image(systemName: "checkmark")
                    .font(.system(size: size * 0.36, weight: .bold))
                    .foregroundColor(.white)
            }
            .frame(width: size, height: size)
        }
    }
}

private struct SmallCaps: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .semibold))
            .tracking(1.6)
            .foregroundColor(Glass.soft)
            .lineLimit(1)
    }
}

/// "Ore di ottobre: 86 h, già contate", or where and until when.
private struct MonthLine: View {
    let state: ShiftActivityAttributes.ContentState

    var body: some View {
        Group {
            if let month = state.month, let hours = state.monthHours {
                Text("Ore di \(month): ") + Text("\(Int(hours.rounded())) h").bold() + Text(", già contate")
            } else if let end = state.end {
                Text("Fine turno alle \(Words.clock(end, endOf: state.since))")
            } else {
                Text("Entrata alle \(Words.clock(state.since))")
            }
        }
        .font(.system(size: 14))
        .foregroundColor(Glass.soft)
        .lineLimit(1)
        .minimumScaleFactor(0.8)
    }
}

private struct Logo: View {
    let size: CGFloat

    var body: some View {
        Image("WorkbitLogo")
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: size * 0.27))
    }
}

/// The time at work, counting up by itself; fixed once the exit is stamped.
private struct Elapsed: View {
    let state: ShiftActivityAttributes.ContentState

    var body: some View {
        if let out = state.out {
            Text(Words.hours(out.timeIntervalSince(state.since)))
                .monospacedDigit()
        } else {
            Text(timerInterval: state.since...Date.distantFuture, countsDown: false)
                .monospacedDigit()
        }
    }
}

private struct LockScreenActivityView: View {
    let state: ShiftActivityAttributes.ContentState

    var body: some View {
        HStack(spacing: 18) {
            StampButton(state: state, size: 84)
            VStack(alignment: .leading, spacing: 4) {
                SmallCaps(state.out == nil ? "In servizio da" : "Uscita timbrata")
                Elapsed(state: state)
                    .font(.system(size: 42, weight: .bold))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                MonthLine(state: state)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 16)
    }
}
