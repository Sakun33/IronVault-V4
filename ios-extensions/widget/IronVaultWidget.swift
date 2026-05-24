//
//  IronVaultWidget.swift
//  IronVaultWidget
//
//  WidgetKit widget bundle for IronVault. Registered as the entry point
//  of the widget extension target (Info.plist → NSExtensionPrincipalClass
//  is irrelevant for WidgetBundle, the @main attribute below is what wires
//  it up).
//
//  Two widget kinds are provided:
//    * IronVaultSecurityWidget — security score + breached/weak counts.
//    * IronVaultRenewalsWidget — upcoming subscription/reminder renewals.
//
//  Both pull their data from a shared App Group UserDefaults that the
//  main app writes through WidgetBridgePlugin → bridgeSet().
//

import WidgetKit
import SwiftUI

@main
struct IronVaultWidgetBundle: WidgetBundle {
    var body: some Widget {
        IronVaultSecurityWidget()
        IronVaultRenewalsWidget()
    }
}

// MARK: - Security Score widget

struct IronVaultSecurityWidget: Widget {
    let kind: String = "IronVaultSecurityWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SecurityProvider()) { entry in
            SecurityWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Security Score")
        .description("Glance at your IronVault password security at any time.")
        // Lock-screen widgets are .accessoryCircular / .accessoryRectangular /
        // .accessoryInline. Home-screen widgets are .systemSmall / .systemMedium.
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

struct IronVaultRenewalsWidget: Widget {
    let kind: String = "IronVaultRenewalsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RenewalsProvider()) { entry in
            RenewalsWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Upcoming Renewals")
        .description("See subscriptions and reminders due in the next 7 days.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
