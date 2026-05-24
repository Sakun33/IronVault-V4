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
import {
  bridgeSet,
  bridgeRemove,
  bridgeReloadWidgets,
  WIDGET_APP_GROUP,
} from '@/native/widget-bridge';

// Shared App Group identifier — must match the entitlement on the iOS
// widget extension target (Xcode → Signing & Capabilities → App Groups).
// Re-exported below under the original name for backwards compatibility.
const APP_GROUP: string = WIDGET_APP_GROUP;

const KEYS = {
  securityScore: 'iv_widget_security_score',
  securityLevel: 'iv_widget_security_level',
  upcomingRenewals: 'iv_widget_upcoming_renewals',
  breachedCount: 'iv_widget_breached_count',
  updatedAt: 'iv_widget_updated_at',
  vaultStatus: 'iv_widget_vault_status',
} as const;

export interface WidgetSnapshot {
  securityScore: number;       // 0–100
  securityLevel: string;       // "Excellent" | "Good" | "Needs Attention" | etc
  upcomingRenewals: number;    // count of subscriptions/reminders within 14 days
  breachedCount: number;       // most-recent /security-health breach scan count
}

/**
 * Push the latest widget snapshot to native shared storage.
 *
 * Two backends are written in parallel:
 *
 * 1. `@capacitor/preferences` — keeps the previous (NativeStorage-prefixed)
 *    behaviour for any web/diagnostic code that reads from it.
 * 2. `WidgetBridge` custom plugin — writes the same keys into the App
 *    Group UserDefaults so the iOS Widget extension can actually read
 *    them. No-op on web / non-iOS, so callers don't need to branch.
 *
 * After the writes succeed we tell WidgetKit to reload all timelines so
 * the lock-screen and home-screen widgets pick up the new values within
 * the next render pass.
 */
export async function publishWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  const now = String(Date.now());
  const entries: Array<[string, string]> = [
    [KEYS.securityScore, String(snapshot.securityScore)],
    [KEYS.securityLevel, snapshot.securityLevel],
    [KEYS.upcomingRenewals, String(snapshot.upcomingRenewals)],
    [KEYS.breachedCount, String(snapshot.breachedCount)],
    [KEYS.updatedAt, now],
    [KEYS.vaultStatus, 'unlocked'],
  ];

  try {
    await Promise.all([
      ...entries.map(([k, v]) => Preferences.set({ key: k, value: v })),
      ...entries.map(([k, v]) => bridgeSet(k, v)),
    ]);
    await bridgeReloadWidgets();
  } catch {
    // Failing to publish to the widget should never break the app.
  }
}

/**
 * Publish a "vault locked" snapshot. Called when the vault auto-locks or
 * the user signs out — wipes the previous numbers from the widget so a
 * shoulder surfer can't read stats off the lock screen.
 */
export async function publishLockedWidgetSnapshot(): Promise<void> {
  const zero = '0';
  const entries: Array<[string, string]> = [
    [KEYS.securityScore, zero],
    [KEYS.securityLevel, 'Locked'],
    [KEYS.upcomingRenewals, zero],
    [KEYS.breachedCount, zero],
    [KEYS.updatedAt, String(Date.now())],
    [KEYS.vaultStatus, 'locked'],
  ];
  try {
    await Promise.all([
      ...entries.map(([k, v]) => Preferences.set({ key: k, value: v })),
      ...entries.map(([k, v]) => bridgeSet(k, v)),
    ]);
    await bridgeReloadWidgets();
  } catch { /* noop */ }
}

/**
 * Drop every widget key. Used on full account logout — wipes any residual
 * stat the previous user wrote before a different person signs in.
 */
export async function clearWidgetSnapshot(): Promise<void> {
  const keys = Object.values(KEYS);
  try {
    await Promise.all([
      ...keys.map(k => Preferences.remove({ key: k }).catch(() => undefined)),
      ...keys.map(k => bridgeRemove(k)),
    ]);
    await bridgeReloadWidgets();
  } catch { /* noop */ }
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

export { WIDGET_APP_GROUP };
export const WIDGET_KEYS = KEYS;
