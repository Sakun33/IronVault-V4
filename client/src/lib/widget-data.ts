// Widget data layer.
//
// Capacitor doesn't ship a WidgetKit plugin out of the box, so we can't render
// SwiftUI directly from JS. The actual iOS Today/Lock-screen widget needs to
// be added in Xcode (target → Widget Extension) reading from a shared App
// Group container. What this module does is the *data half*: the app writes
// the values the widget needs into `@capacitor/preferences`, configured to
// use the shared App Group on iOS, so the Swift widget code can read them
// via UserDefaults(suiteName: …).
//
// Until the native widget extension lands the keys are still useful: the
// Android Glance widget and any future PWA-attached surfaces (e.g. macOS
// Catalyst, Wear OS, watchOS companion) share the same data contract.

import { Preferences } from '@capacitor/preferences';

// Shared App Group identifier — must match the entitlement on the iOS
// widget extension target (Xcode → Signing & Capabilities → App Groups).
const APP_GROUP = 'group.app.ironvault.shared';

const KEYS = {
  securityScore: 'iv_widget_security_score',
  securityLevel: 'iv_widget_security_level',
  upcomingRenewals: 'iv_widget_upcoming_renewals',
  breachedCount: 'iv_widget_breached_count',
  updatedAt: 'iv_widget_updated_at',
} as const;

export interface WidgetSnapshot {
  securityScore: number;       // 0–100
  securityLevel: string;       // "Excellent" | "Good" | "Needs Attention" | etc
  upcomingRenewals: number;    // count of subscriptions/reminders within 14 days
  breachedCount: number;       // most-recent /security-health breach scan count
}

/**
 * Push the latest widget snapshot to native shared storage.
 * Safe on web — Preferences falls back to localStorage where Capacitor
 * isn't running, so the call is a no-op rather than an error.
 */
export async function publishWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const writes: Promise<unknown>[] = [
    Preferences.set({ key: KEYS.securityScore, value: String(snapshot.securityScore) }),
    Preferences.set({ key: KEYS.securityLevel, value: snapshot.securityLevel }),
    Preferences.set({ key: KEYS.upcomingRenewals, value: String(snapshot.upcomingRenewals) }),
    Preferences.set({ key: KEYS.breachedCount, value: String(snapshot.breachedCount) }),
    Preferences.set({ key: KEYS.updatedAt, value: String(Date.now()) }),
  ];
  try {
    await Promise.all(writes);
  } catch {
    // Failing to publish to the widget should never break the app.
  }
}

/** Read whatever was last published. Useful for tests + diagnostics. */
export async function readWidgetSnapshot(): Promise<WidgetSnapshot & { updatedAt: number } | null> {
  try {
    const [score, level, renewals, breached, ts] = await Promise.all([
      Preferences.get({ key: KEYS.securityScore }),
      Preferences.get({ key: KEYS.securityLevel }),
      Preferences.get({ key: KEYS.upcomingRenewals }),
      Preferences.get({ key: KEYS.breachedCount }),
      Preferences.get({ key: KEYS.updatedAt }),
    ]);
    if (!ts.value) return null;
    return {
      securityScore: parseInt(score.value || '0', 10) || 0,
      securityLevel: level.value || 'Unknown',
      upcomingRenewals: parseInt(renewals.value || '0', 10) || 0,
      breachedCount: parseInt(breached.value || '0', 10) || 0,
      updatedAt: parseInt(ts.value, 10) || 0,
    };
  } catch {
    return null;
  }
}

export const WIDGET_APP_GROUP = APP_GROUP;
export const WIDGET_KEYS = KEYS;
