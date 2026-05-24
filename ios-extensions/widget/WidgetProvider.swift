//
//  WidgetProvider.swift
//  IronVaultWidget
//
//  TimelineProvider reads the snapshot the main app published into the
//  shared App Group UserDefaults. WidgetKit ticks every 30 minutes — that
//  is plenty for stats like "weak passwords" and "upcoming renewals",
//  which don't change minute-to-minute. The main app additionally calls
//  WidgetCenter.reloadAllTimelines() through WidgetBridgePlugin whenever
//  data changes inside the app, so the widget refreshes immediately
//  after a user action rather than waiting for the next tick.
//

import WidgetKit
import SwiftUI

// Must match the App Group identifier on every target's entitlement file.
let kAppGroup = "group.app.ironvault.shared"

// Keys mirror client/src/lib/widget-data.ts → KEYS.
struct WidgetStoreKeys {
    static let securityScore     = "iv_widget_security_score"
    static let securityLevel     = "iv_widget_security_level"
    static let upcomingRenewals  = "iv_widget_upcoming_renewals"
    static let breachedCount     = "iv_widget_breached_count"
    static let updatedAt         = "iv_widget_updated_at"
    static let vaultStatus       = "iv_widget_vault_status"
}

// MARK: - Entries

struct SecurityEntry: TimelineEntry {
    let date: Date
    let securityScore: Int
    let securityLevel: String
    let breachedCount: Int
    let isLocked: Bool
}

struct RenewalsEntry: TimelineEntry {
    let date: Date
    let upcomingRenewals: Int
    let isLocked: Bool
}

private func sharedDefaults() -> UserDefaults? {
    return UserDefaults(suiteName: kAppGroup)
}

private func readSecuritySnapshot() -> SecurityEntry {
    let d = sharedDefaults()
    let status = d?.string(forKey: WidgetStoreKeys.vaultStatus) ?? "locked"
    let isLocked = status != "unlocked"
    let score = Int(d?.string(forKey: WidgetStoreKeys.securityScore) ?? "0") ?? 0
    let level = d?.string(forKey: WidgetStoreKeys.securityLevel) ?? "—"
    let breached = Int(d?.string(forKey: WidgetStoreKeys.breachedCount) ?? "0") ?? 0
    return SecurityEntry(
        date: Date(),
        securityScore: score,
        securityLevel: level,
        breachedCount: breached,
        isLocked: isLocked
    )
}

private func readRenewalsSnapshot() -> RenewalsEntry {
    let d = sharedDefaults()
    let status = d?.string(forKey: WidgetStoreKeys.vaultStatus) ?? "locked"
    let isLocked = status != "unlocked"
    let upcoming = Int(d?.string(forKey: WidgetStoreKeys.upcomingRenewals) ?? "0") ?? 0
    return RenewalsEntry(
        date: Date(),
        upcomingRenewals: upcoming,
        isLocked: isLocked
    )
}

// MARK: - Providers

struct SecurityProvider: TimelineProvider {
    func placeholder(in context: Context) -> SecurityEntry {
        SecurityEntry(date: Date(), securityScore: 92, securityLevel: "Excellent", breachedCount: 0, isLocked: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (SecurityEntry) -> Void) {
        completion(readSecuritySnapshot())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SecurityEntry>) -> Void) {
        let entry = readSecuritySnapshot()
        // Next refresh in 30 minutes. The host app additionally calls
        // reloadAllTimelines() whenever data changes.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct RenewalsProvider: TimelineProvider {
    func placeholder(in context: Context) -> RenewalsEntry {
        RenewalsEntry(date: Date(), upcomingRenewals: 3, isLocked: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (RenewalsEntry) -> Void) {
        completion(readRenewalsSnapshot())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RenewalsEntry>) -> Void) {
        let entry = readRenewalsSnapshot()
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}
