/**
 * Reminder notifications — fires Web Notifications (and Capacitor LocalNotifications
 * on native) when a stored reminder's due-time-minus-alert-window arrives.
 *
 * Design:
 * - Idempotent: a per-reminder Set tracks which IDs we've already fired in
 *   the current session so we don't spam notifications on every tick.
 * - Server-less: runs entirely in the browser. No Service Worker periodic
 *   sync (broad-compat) — instead we tick once a minute while the tab is
 *   open. Native builds layer Capacitor LocalNotifications for offline /
 *   background scheduling.
 * - Honors `reminder.notificationEnabled` and skips completed reminders.
 *
 * Permission grants are NOT requested automatically — call
 * `requestNotificationPermission()` from a user gesture (e.g., a "Enable
 * notifications" button in Settings or a one-time prompt on the reminders
 * page). Browsers reject permission prompts that aren't tied to a user
 * gesture.
 */

import type { ReminderEntry, SubscriptionEntry } from '@shared/schema';
import { NotificationService } from '@/lib/notifications';

const FIRED_KEY = 'iv_reminder_fired_ids_v1';
const FIRE_WINDOW_MS = 90 * 1000; // ±90s tolerance around the alert moment

// Persistent (cross-session) dedupe for subscription renewal alerts. Keyed
// per (subscriptionId, threshold-day) so the same renewal doesn't fire on
// every tab open. localStorage so it survives reloads — sessionStorage
// would re-notify on each new tab.
const SUB_FIRED_KEY = 'iv_subscription_fired_ids_v1';
// Down from [7, 3, 1]. Three pings per renewal × N subscriptions was the
// dominant source of iOS notification spam — most users only act on the
// last-minute reminder anyway. The notification center (in-app) still
// surfaces broader visibility via the dashboard.
const SUB_RENEWAL_THRESHOLDS = [1] as const;
// Per-tick rate-limit so a backfill (many subs renewing on the same day)
// trickles rather than dumps a dozen notifications at once.
const MAX_NEW_PER_TICK = 3;

function getFiredSet(): Set<string> {
  try {
    const raw = sessionStorage.getItem(FIRED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistFiredSet(set: Set<string>): void {
  try {
    sessionStorage.setItem(FIRED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

export function browserSupportsNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!browserSupportsNotifications()) return 'unsupported';
  return Notification.permission;
}

/**
 * Asks the user for notification permission. Must be called from a user
 * gesture (button click, etc.) — browsers ignore programmatic requests
 * outside of one. Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!browserSupportsNotifications()) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Compute the absolute alert moment for a reminder. Combines `dueDate`
 * (date-at-midnight) with `dueTime` (HH:MM) and subtracts
 * `alertMinutesBefore`. Returns null if the reminder is completed or
 * disabled, so callers can short-circuit the firing logic.
 */
function computeAlertAt(reminder: ReminderEntry): Date | null {
  if (reminder.isCompleted) return null;
  if (reminder.notificationEnabled === false) return null;
  const due = new Date(reminder.dueDate);
  if (Number.isNaN(due.getTime())) return null;
  if (reminder.dueTime) {
    const [hh, mm] = reminder.dueTime.split(':').map(n => parseInt(n, 10));
    if (!Number.isNaN(hh) && !Number.isNaN(mm)) {
      due.setHours(hh, mm, 0, 0);
    }
  }
  const offset = (reminder.alertMinutesBefore ?? 0) * 60 * 1000;
  return new Date(due.getTime() - offset);
}

/**
 * Walk the list of reminders and fire any whose alert moment falls within
 * the firing window. Safe to call repeatedly; per-reminder dedupe uses
 * sessionStorage so reloads don't re-fire (until the tab closes).
 */
export function checkAndFireReminders(reminders: ReminderEntry[]): void {
  if (!browserSupportsNotifications() || Notification.permission !== 'granted') return;
  const now = Date.now();
  const fired = getFiredSet();
  let mutated = false;

  for (const r of reminders) {
    if (fired.has(r.id)) continue;
    const at = computeAlertAt(r);
    if (!at) continue;
    const diff = at.getTime() - now;
    // Fire when we're inside the window OR within 1 minute past it (catches
    // ticks that slipped slightly behind the schedule).
    if (diff <= FIRE_WINDOW_MS && diff >= -FIRE_WINDOW_MS) {
      try {
        new Notification('IronVault Reminder', {
          body: r.title + (r.description ? ` — ${r.description}` : ''),
          icon: '/icons/icon-192x192.png',
          tag: r.id,
          badge: '/icons/icon-192x192.png',
          requireInteraction: r.priority === 'urgent' || r.priority === 'high',
        });
        fired.add(r.id);
        mutated = true;
      } catch (err) {
        console.warn('[reminders] notification failed:', err);
      }
    }
  }

  if (mutated) persistFiredSet(fired);
}

/**
 * Subscribe to a reminders array and tick once a minute, firing any that
 * come due. Returns an unsubscribe function.
 *
 *   const stop = startReminderLoop(() => myReminders);
 *   // ...
 *   stop();
 */
export function startReminderLoop(getReminders: () => ReminderEntry[]): () => void {
  // Fire once immediately so reminders that came due while the tab was
  // backgrounded surface as soon as the user returns.
  checkAndFireReminders(getReminders());
  const id = window.setInterval(() => {
    checkAndFireReminders(getReminders());
  }, 60 * 1000);
  return () => window.clearInterval(id);
}

/**
 * Native (Capacitor) — schedule a local notification for the reminder's
 * alert moment. Falls through to a no-op on the web. Wrapped in dynamic
 * import so the bundle doesn't pull `@capacitor/local-notifications` in
 * web builds.
 */
export async function scheduleNativeReminder(reminder: ReminderEntry): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const at = computeAlertAt(reminder);
    if (!at) return;
    if (at.getTime() <= Date.now()) return;
    // Hash reminder.id → 31-bit positive int for the LocalNotifications id
    // requirement. Stable per reminder so re-scheduling overwrites cleanly.
    let h = 0;
    for (let i = 0; i < reminder.id.length; i++) {
      h = (h * 31 + reminder.id.charCodeAt(i)) | 0;
    }
    const notificationId = Math.abs(h);

    const { LocalNotifications } = await import('@capacitor/local-notifications');
    // Request permission first (no-op if already granted).
    try { await LocalNotifications.requestPermissions(); } catch { /* user denied — non-fatal */ }
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId,
        title: 'IronVault Reminder',
        body: reminder.title,
        schedule: { at },
        smallIcon: 'ic_stat_icon',
        sound: undefined,
      }],
    });
  } catch (err) {
    console.warn('[reminders] native schedule failed:', err);
  }
}

// ── Subscription renewal reminders ──────────────────────────────────────────
//
// Fires both an in-app NotificationCenter entry AND (where granted) a
// browser/native notification for each active subscription whose renewal
// falls within the configured thresholds. Per-(sub, threshold) dedupe is
// persistent across sessions so the same renewal doesn't re-fire on
// reload. Thresholds: 7-day, 3-day, 1-day. Auto-prunes entries for
// renewals more than 30 days in the past so the dedupe set doesn't grow
// without bound.

function loadSubFiredMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SUB_FIRED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function saveSubFiredMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(SUB_FIRED_KEY, JSON.stringify(map));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

function pruneSubFiredMap(map: Record<string, number>): Record<string, number> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    if (typeof v === 'number' && v > cutoff) next[k] = v;
  }
  return next;
}

function formatRenewalAmount(sub: SubscriptionEntry): string {
  const currency = sub.currency || 'USD';
  // Use the user's locale where possible; fall back to en-US.
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(sub.cost);
  } catch {
    // Unknown currency code — render plain.
    return `${currency} ${sub.cost}`;
  }
}

export interface CheckSubscriptionRenewalsOptions {
  /** Used to scope notification-center entries to a user. */
  userId: string;
  /** Subscriptions to evaluate. Inactive entries are skipped. */
  subscriptions: SubscriptionEntry[];
  /**
   * If true (default), also surfaces a browser/native notification when
   * permission has been granted. Pass false to *only* write to the
   * notification center (e.g. for background dashboard refreshes).
   */
  fireSystemNotification?: boolean;
}

/**
 * Walk subscriptions and fire renewal reminders for each that's at the
 * 7-day, 3-day, or 1-day mark (calendar-day-aligned). Idempotent across
 * sessions — relies on `iv_subscription_fired_ids_v1` to dedupe.
 *
 * Returns the number of NEW alerts fired in this call.
 */
export async function checkAndFireSubscriptionRenewals(
  opts: CheckSubscriptionRenewalsOptions,
): Promise<number> {
  const { userId, subscriptions, fireSystemNotification = true } = opts;
  if (!subscriptions?.length) return 0;

  const fired = pruneSubFiredMap(loadSubFiredMap());
  const todayMidnight = new Date().setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  let newCount = 0;

  for (const sub of subscriptions) {
    if (!sub.isActive || !sub.nextBillingDate) continue;
    const due = new Date(sub.nextBillingDate);
    if (Number.isNaN(due.getTime())) continue;

    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const daysOut = Math.round((dueMidnight - todayMidnight) / dayMs);
    if (daysOut < 0) continue;

    // Match the closest threshold *equal to or below* daysOut so a 4-day-out
    // renewal still hits the 3-day threshold. Each (sub, threshold) only
    // fires once per renewal cycle.
    const threshold = SUB_RENEWAL_THRESHOLDS.find(t => daysOut === t);
    if (threshold === undefined) continue;

    // Dedupe key includes the renewal date so a fresh cycle (next month)
    // gets to fire again.
    const renewalKey = `${sub.id}:${threshold}:${dueMidnight}`;
    if (fired[renewalKey]) continue;

    const amount = formatRenewalAmount(sub);
    const dayLabel = threshold === 1 ? 'tomorrow' : `in ${threshold} days`;
    const title = `${sub.name} renews ${dayLabel}`;
    const message = `${amount} will be charged on ${due.toLocaleDateString()}.`;

    // Notification-center entry (always).
    try {
      await NotificationService.createOrSkip(
        {
          type: 'subscription',
          title,
          message,
          userId,
          actionUrl: '/subscriptions',
          actionText: 'View',
          metadata: {
            subscriptionId: sub.id,
            subscriptionName: sub.name,
            daysUntilRenewal: threshold,
            amount: sub.cost,
            currency: sub.currency || 'USD',
            renewalDate: due.toISOString(),
          },
        },
        renewalKey,
        // Match our renewal-cycle window: 30 days is plenty.
        30 * dayMs,
      );
    } catch { /* non-fatal */ }

    // Browser/native notification (best-effort, gated by permission).
    if (fireSystemNotification && browserSupportsNotifications() && Notification.permission === 'granted') {
      try {
        new Notification('IronVault', {
          body: `${title} — ${amount}`,
          icon: '/icons/icon-192x192.png',
          tag: `iv-sub-${sub.id}-${threshold}`,
          badge: '/icons/icon-192x192.png',
        });
      } catch (err) {
        console.warn('[reminders] subscription notification failed:', err);
      }
    }

    fired[renewalKey] = Date.now();
    newCount++;
    if (newCount >= MAX_NEW_PER_TICK) break;
  }

  if (newCount > 0) saveSubFiredMap(fired);
  return newCount;
}

/**
 * Subscribe to a subscriptions array and tick once an hour, firing renewal
 * reminders as they come due. Returns an unsubscribe function. Hourly is
 * plenty — renewal alerts are calendar-day granular.
 */
export function startSubscriptionReminderLoop(
  getOptions: () => CheckSubscriptionRenewalsOptions,
): () => void {
  // Fire once immediately so renewals that came due while the tab was closed
  // surface as soon as the user returns.
  checkAndFireSubscriptionRenewals(getOptions()).catch(() => {});
  const id = window.setInterval(() => {
    checkAndFireSubscriptionRenewals(getOptions()).catch(() => {});
  }, 60 * 60 * 1000);
  return () => window.clearInterval(id);
}

export async function cancelNativeReminder(reminderId: string): Promise<void> {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    let h = 0;
    for (let i = 0; i < reminderId.length; i++) {
      h = (h * 31 + reminderId.charCodeAt(i)) | 0;
    }
    const notificationId = Math.abs(h);
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
  } catch {
    /* not installed / native missing — non-fatal */
  }
}
