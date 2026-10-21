import ActivityKit
import WidgetKit
import SwiftUI

/**
 * "In servizio" on the lock screen and in the Dynamic Island, from the entry
 * to the exit. The counter and the bar run by themselves: the system draws
 * them from the entry time, nothing has to be sent while the shift goes on.
 */
struct ShiftLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ShiftActivityAttributes.self) { context in
            LockScreenActivityView(context: context)
                .activityBackgroundTint(Color.white.opacity(0.96))
                .activitySystemActionForegroundColor(Brand.ink)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 10) {
                        Logo(size: 34)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(context.state.out == nil ? "In servizio" : "Uscita timbrata")
                                .font(.system(size: 15))
                            Text(place(context.attributes))
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.7))
                                .lineLimit(1)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Elapsed(state: context.state)
                        .font(.system(size: 30, weight: .bold))
                        .foregroundColor(Color(red: 0x7d / 255, green: 0xd3 / 255, blue: 0xfc / 255))
                        .frame(maxWidth: 130, alignment: .trailing)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(spacing: 8) {
                        if let end = context.state.end, context.state.out == nil, end > context.state.since {
                            ProgressView(timerInterval: context.state.since...end, countsDown: false) {
                                EmptyView()
                            } currentValueLabel: {
                                EmptyView()
                            }
                            .tint(Brand.violet)
                        }
                        HStack {
                            Text("Entrata \(Words.clock(context.state.since))")
                            Spacer()
                            if let end = context.state.end {
                                Text("Fine turno \(Words.clock(end, endOf: context.state.since))")
                            }
                        }
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.7))
                    }
                }
            } compactLeading: {
                Logo(size: 22)
            } compactTrailing: {
                Elapsed(state: context.state)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(red: 0x7d / 255, green: 0xd3 / 255, blue: 0xfc / 255))
                    .frame(maxWidth: 56)
            } minimal: {
                Logo(size: 22)
            }
            .keylineTint(Brand.violet)
        }
    }
}

private func place(_ attributes: ShiftActivityAttributes) -> String {
    attributes.area.isEmpty ? attributes.venue : "\(attributes.venue) · \(attributes.area)"
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
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct LockScreenActivityView: View {
    let context: ActivityViewContext<ShiftActivityAttributes>

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 2).fill(Brand.sky).frame(width: 3).padding(.trailing, 13)
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Logo(size: 24)
                    Text(place(context.attributes))
                        .font(.system(size: 13))
                        .foregroundColor(Brand.muted)
                        .lineLimit(1)
                    Spacer()
                    HStack(spacing: 5) {
                        Circle().fill(context.state.out == nil ? Brand.sky : Brand.green).frame(width: 7, height: 7)
                        Text(context.state.out == nil ? "In servizio" : "Uscita timbrata")
                            .font(.system(size: 12))
                            .foregroundColor(context.state.out == nil ? Brand.skyInk : Color(red: 0x04 / 255, green: 0x78 / 255, blue: 0x57 / 255))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(context.state.out == nil
                        ? Color(red: 0xe3 / 255, green: 0xf4 / 255, blue: 0xfc / 255)
                        : Color(red: 0xe3 / 255, green: 0xf7 / 255, blue: 0xef / 255)))
                }
                Elapsed(state: context.state)
                    .font(.system(size: 40, weight: .bold))
                    .foregroundColor(Brand.ink)
                if let end = context.state.end, context.state.out == nil, end > context.state.since {
                    ProgressView(timerInterval: context.state.since...end, countsDown: false) {
                        EmptyView()
                    } currentValueLabel: {
                        EmptyView()
                    }
                    .tint(Brand.violet)
                }
                HStack {
                    Text("Entrata").foregroundColor(Brand.muted)
                    Text(Words.clock(context.state.since)).foregroundColor(Brand.ink)
                    Spacer()
                    if let out = context.state.out {
                        Text("Uscita").foregroundColor(Brand.muted)
                        Text(Words.clock(out)).foregroundColor(Brand.ink)
                    } else if let end = context.state.end {
                        Text("Fine turno").foregroundColor(Brand.muted)
                        Text(Words.clock(end, endOf: context.state.since)).foregroundColor(Brand.ink)
                    }
                }
                .font(.system(size: 13))
            }
        }
        .padding(16)
    }
}
