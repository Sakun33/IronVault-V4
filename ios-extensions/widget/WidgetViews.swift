//
//  WidgetViews.swift
//  IronVaultWidget
//
//  SwiftUI views for every supported widget family. WidgetKit picks the
//  right one from `family` at runtime — small/medium for home screen,
//  accessoryCircular/Rectangular/Inline for lock screen on iOS 16+.
//

import SwiftUI
import WidgetKit

// IronVault brand emerald → teal, plus a "locked" muted state.
private let kEmerald = Color(red: 16/255,  green: 185/255, blue: 129/255)
private let kTeal    = Color(red: 20/255,  green: 184/255, blue: 166/255)
private let kMuted   = Color.secondary

private func scoreColor(_ score: Int) -> Color {
    if score >= 80 { return kEmerald }
    if score >= 60 { return .yellow }
    return .red
}

// MARK: - Security widget

struct SecurityWidgetEntryView: View {
    var entry: SecurityEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:           SecuritySmall(entry: entry)
        case .systemMedium:          SecurityMedium(entry: entry)
        case .accessoryCircular:     SecurityCircular(entry: entry)
        case .accessoryRectangular:  SecurityRectangular(entry: entry)
        case .accessoryInline:       SecurityInline(entry: entry)
        default:                     SecuritySmall(entry: entry)
        }
    }
}

private struct LockedSplash: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "lock.shield")
                .font(.system(size: 28, weight: .semibold))
                .foregroundColor(kMuted)
            Text("Vault locked")
                .font(.caption)
                .foregroundColor(kMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct SecuritySmall: View {
    let entry: SecurityEntry
    var body: some View {
        ZStack {
            if entry.isLocked {
                LockedSplash()
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Image(systemName: "shield.lefthalf.filled")
                            .foregroundColor(scoreColor(entry.securityScore))
                            .font(.system(size: 16, weight: .semibold))
                        Spacer()
                        Text("IronVault")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(kMuted)
                    }
                    Spacer(minLength: 0)
                    Text("\(entry.securityScore)")
                        .font(.system(size: 44, weight: .bold, design: .rounded))
                        .foregroundColor(scoreColor(entry.securityScore))
                    Text(entry.securityLevel)
                        .font(.caption.weight(.medium))
                        .foregroundColor(kMuted)
                    if entry.breachedCount > 0 {
                        HStack(spacing: 4) {
                            Image(systemName: "exclamationmark.triangle.fill").font(.caption2)
                            Text("\(entry.breachedCount) breached")
                                .font(.caption2.weight(.semibold))
                        }
                        .foregroundColor(.red)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
    }
}

private struct SecurityMedium: View {
    let entry: SecurityEntry
    var body: some View {
        if entry.isLocked {
            LockedSplash()
        } else {
            HStack(spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Security Score")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(kMuted)
                    Text("\(entry.securityScore)")
                        .font(.system(size: 56, weight: .bold, design: .rounded))
                        .foregroundColor(scoreColor(entry.securityScore))
                    Text(entry.securityLevel)
                        .font(.subheadline.weight(.medium))
                        .foregroundColor(kMuted)
                }
                Spacer()
                VStack(alignment: .leading, spacing: 8) {
                    if entry.breachedCount > 0 {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.triangle.fill")
                            Text("\(entry.breachedCount) breached")
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.red)
                    } else {
                        HStack(spacing: 6) {
                            Image(systemName: "checkmark.shield.fill")
                            Text("No breaches found")
                        }
                        .font(.caption.weight(.semibold))
                        .foregroundColor(kEmerald)
                    }
                    Text("Open IronVault for the full report")
                        .font(.caption2)
                        .foregroundColor(kMuted)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

private struct SecurityCircular: View {
    let entry: SecurityEntry
    var body: some View {
        if entry.isLocked {
            Image(systemName: "lock.shield")
        } else {
            ZStack {
                Circle().stroke(Color.secondary.opacity(0.3), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: CGFloat(min(max(entry.securityScore, 0), 100)) / 100.0)
                    .stroke(scoreColor(entry.securityScore), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(entry.securityScore)")
                    .font(.system(size: 18, weight: .bold, design: .rounded))
            }
        }
    }
}

private struct SecurityRectangular: View {
    let entry: SecurityEntry
    var body: some View {
        if entry.isLocked {
            HStack {
                Image(systemName: "lock.shield")
                Text("IronVault — locked")
            }
            .font(.caption)
        } else {
            VStack(alignment: .leading) {
                Text("IronVault")
                    .font(.caption2.weight(.bold))
                Text("Score \(entry.securityScore) · \(entry.securityLevel)")
                    .font(.caption2)
                if entry.breachedCount > 0 {
                    Text("⚠︎ \(entry.breachedCount) breached")
                        .font(.caption2.weight(.semibold))
                }
            }
        }
    }
}

private struct SecurityInline: View {
    let entry: SecurityEntry
    var body: some View {
        if entry.isLocked {
            Text("IronVault locked")
        } else if entry.breachedCount > 0 {
            Text("IronVault: \(entry.breachedCount) breached")
        } else {
            Text("IronVault score \(entry.securityScore)")
        }
    }
}

// MARK: - Renewals widget

struct RenewalsWidgetEntryView: View {
    var entry: RenewalsEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall, .systemMedium:
            renewalsBlock
        case .accessoryRectangular:
            VStack(alignment: .leading) {
                Text("Renewals").font(.caption2.weight(.bold))
                Text(entry.isLocked ? "Vault locked" : "\(entry.upcomingRenewals) due (7d)").font(.caption2)
            }
        case .accessoryInline:
            Text(entry.isLocked ? "IronVault locked" : "\(entry.upcomingRenewals) renewals due")
        default:
            renewalsBlock
        }
    }

    private var renewalsBlock: some View {
        Group {
            if entry.isLocked {
                LockedSplash()
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "calendar.badge.clock")
                            .foregroundColor(kEmerald)
                        Text("Renewals").font(.caption.weight(.semibold)).foregroundColor(kMuted)
                        Spacer()
                    }
                    Text("\(entry.upcomingRenewals)")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                        .foregroundColor(entry.upcomingRenewals > 0 ? kEmerald : kMuted)
                    Text(entry.upcomingRenewals == 1 ? "due in 7 days" : "due in next 7 days")
                        .font(.caption)
                        .foregroundColor(kMuted)
                }
                .padding(12)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
    }
}
