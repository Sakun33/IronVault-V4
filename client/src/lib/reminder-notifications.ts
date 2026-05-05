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

import type { ReminderEntry } from '@shared/schema';

const FIRED_KEY = 'iv_reminder_fired_ids_v1';
const FIRE_WINDOW_MS = 90 * 1000; // ±90s tolerance around the alert moment

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
