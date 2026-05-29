import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { isNativeApp } from './platform';

export interface NotificationSettings {
  remindersEnabled: boolean;
  renewalsEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

let notificationsPermissionGranted = false;

// ── Notification preferences gate ───────────────────────────────────────────
// Mirrors `iv_notification_preferences` from NotificationService. Each channel
// can be muted globally so a single toggle in Settings silences a category
// without disabling OS permission. Defaults to enabled (treated as "no
// preference set yet").

type Channel = 'reminders' | 'subscriptions' | 'security' | 'sync' | 'expiry';

function channelAllowed(channel: Channel): boolean {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('iv_notification_preferences') ?? localStorage.getItem('securevault_notification_preferences'))
      : null;
    if (!raw) return true;
    const arr = JSON.parse(raw);
    // First entry — single-user app on device.
    const prefs = Array.isArray(arr) ? arr[0] : arr;
    if (!prefs || typeof prefs !== 'object') return true;
    // Global push toggle gates everything.
    if (prefs.push === false) return false;
    switch (channel) {
      case 'subscriptions':
      case 'expiry':
        return prefs.subscriptionReminders !== false;
      case 'security':
        return prefs.securityAlerts !== false;
      case 'reminders':
      case 'sync':
      default:
        return true;
    }
  } catch {
    return true;
  }
}

// Dedupe: only schedule the same logical notification once per session per ID.
// Capacitor `schedule` with a duplicate id replaces the prior one — but on iOS,
// schedules that have already fired aren't tracked as "pending" and a new
// schedule for that same id will *re-fire*. This in-memory set short-circuits
// the second call so we don't re-notify the user on every page revisit.
const scheduledThisSession = new Set<number>();

function alreadyScheduledThisSession(id: number): boolean {
  if (scheduledThisSession.has(id)) return true;
  scheduledThisSession.add(id);
  return false;
}

function stableNotificationId(seed: string): number {
  // Capacitor LocalNotifications requires numeric IDs. Hash the input string
  // into a 31-bit unsigned int that's stable across reschedules so calling
  // schedule() with the same seed replaces the prior notification rather
  // than queuing a duplicate.
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
  }
  return Math.abs(h) % 2_000_000_000;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      notificationsPermissionGranted = permission === 'granted';
      return notificationsPermissionGranted;
    }
    return false;
  }

  try {
    const result = await LocalNotifications.requestPermissions();
    notificationsPermissionGranted = result.display === 'granted';
    return notificationsPermissionGranted;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}

export async function checkNotificationPermission(): Promise<boolean> {
  if (!isNativeApp()) {
    if ('Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  }

  try {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  } catch (error) {
    console.error('Failed to check notification permission:', error);
    return false;
  }
}

export async function scheduleReminderNotification(
  id: number,
  title: string,
  body: string,
  scheduledAt: Date
): Promise<boolean> {
  try {
    if (!channelAllowed('reminders')) return false;

    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return false;

    // Don't schedule reminders in the past or > 1 year out — past-due is
    // noise; far-future is noise too.
    const now = Date.now();
    if (scheduledAt.getTime() <= now) return false;
    if (scheduledAt.getTime() - now > 365 * 24 * 60 * 60 * 1000) return false;

    if (alreadyScheduledThisSession(id)) return false;

    if (!isNativeApp()) {
      return scheduleWebNotification(title, body, scheduledAt);
    }

    // Replace any prior pending entry with the same id before scheduling.
    try { await LocalNotifications.cancel({ notifications: [{ id }] }); } catch { /* non-fatal */ }

    const options: ScheduleOptions = {
      notifications: [
        {
          id,
          title,
          body,
          schedule: {
            at: scheduledAt,
            allowWhileIdle: true,
          },
          sound: 'default',
          smallIcon: 'ic_notification',
          actionTypeId: 'REMINDER_ACTION',
        },
      ],
    };

    await LocalNotifications.schedule(options);
    return true;
  } catch (error) {
    console.error('Failed to schedule reminder notification:', error);
    return false;
  }
}

export async function scheduleSubscriptionRenewalNotification(
  subscriptionId: string,
  subscriptionName: string,
  renewalDate: Date,
  amount: string
): Promise<boolean> {
  try {
    if (!channelAllowed('subscriptions')) return false;

    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return false;

    // Only one OS-level alert per renewal: 1 day before. Multiple advance
    // pings (7d/3d) were the main source of iOS notification spam — the
    // in-app notification center still surfaces broader thresholds.
    const oneDayBefore = new Date(renewalDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    // Only schedule if the alert is in the future AND within the next 60
    // days — anything beyond is speculative.
    const at = oneDayBefore;
    const now = Date.now();
    if (at.getTime() <= now) return false;
    if (at.getTime() - now > 60 * 24 * 60 * 60 * 1000) return false;

    // Stable hash includes the renewal timestamp so a fresh cycle (next
    // month) re-fires, but mid-cycle re-renders share the same id and
    // get deduped by the OS replace semantics + our in-memory set.
    const notificationId = stableNotificationId(
      `sub-renewal:${subscriptionId}:${at.toISOString().slice(0, 10)}`,
    );
    if (alreadyScheduledThisSession(notificationId)) return false;

    if (!isNativeApp()) {
      return scheduleWebNotification(
        `${subscriptionName} Renewal`,
        `Renews tomorrow for ${amount}`,
        at,
      );
    }

    // Replace any prior pending entry with the same id before scheduling.
    try { await LocalNotifications.cancel({ notifications: [{ id: notificationId }] }); } catch { /* non-fatal */ }

    const options: ScheduleOptions = {
      notifications: [
        {
          id: notificationId,
          title: `${subscriptionName} renews tomorrow`,
          body: `${amount} will be charged on ${renewalDate.toLocaleDateString()}.`,
          schedule: {
            at,
            allowWhileIdle: true,
          },
          sound: 'default',
          smallIcon: 'ic_notification',
          actionTypeId: 'RENEWAL_ACTION',
          extra: {
            subscriptionId,
            type: 'renewal',
          },
        },
      ],
    };

    await LocalNotifications.schedule(options);
    return true;
  } catch (error) {
    console.error('Failed to schedule renewal notification:', error);
    return false;
  }
}

function scheduleWebNotification(title: string, body: string, scheduledAt: Date): boolean {
  try {
    const timeUntilNotification = scheduledAt.getTime() - Date.now();
    
    if (timeUntilNotification <= 0) {
      return false;
    }

    setTimeout(() => {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'ironvault-reminder',
        });
      }
    }, timeUntilNotification);

    return true;
  } catch (error) {
    console.error('Failed to schedule web notification:', error);
    return false;
  }
}

export async function cancelNotification(id: number): Promise<void> {
  try {
    if (!isNativeApp()) {
      return;
    }

    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    if (!isNativeApp()) {
      return;
    }

    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch (error) {
    console.error('Failed to cancel all notifications:', error);
  }
}

export async function getPendingNotifications(): Promise<number> {
  try {
    if (!isNativeApp()) {
      return 0;
    }

    const pending = await LocalNotifications.getPending();
    return pending.notifications.length;
  } catch (error) {
    console.error('Failed to get pending notifications:', error);
    return 0;
  }
}

export function setupNotificationListeners(): void {
  if (!isNativeApp()) {
    return;
  }

  LocalNotifications.addListener('localNotificationReceived', (notification) => {
  });

  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    
    const notificationData = action.notification;
    const extra = notificationData.extra;

    if (extra?.type === 'renewal' && extra?.subscriptionId) {
      window.location.href = `/subscriptions?id=${extra.subscriptionId}`;
    } else if (action.actionId === 'REMINDER_ACTION') {
      window.location.href = '/reminders';
    }
  });
}

export function cleanupNotificationListeners(): void {
  if (!isNativeApp()) {
    return;
  }

  LocalNotifications.removeAllListeners();
}

export async function isNotificationSupported(): Promise<boolean> {
  if (!isNativeApp()) {
    return 'Notification' in window;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Additional helpers — credential expiry, sync status, and security alerts.
// All three reuse the same scheduling primitive but log under distinct
// actionTypeIds so the listener in setupNotificationListeners can route to
// the right page on tap.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schedule a credential-expiry warning. Fires once, 1 day before expiry.
 * Use for API keys, certificates, vault recovery codes — anything that has
 * a hard expiration date. Only schedules if the expiry is >24h and <30d
 * away; everything outside that window is noise.
 */
export async function scheduleCredentialExpiryNotification(
  credentialId: string,
  credentialName: string,
  expiresAt: Date,
): Promise<boolean> {
  try {
    if (!channelAllowed('expiry')) return false;

    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return false;

    // One alert, one day before — was previously two (7d + day-of). Two
    // OS pings per credential, multiplied across a vault of API keys, was
    // the bulk of the iOS notification noise.
    const oneDayBefore = new Date(expiresAt);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    const at = oneDayBefore;
    const now = Date.now();
    if (at.getTime() <= now) return false;
    // Skip if expiry is >30 days out; rotating that early is just nagging.
    if (at.getTime() - now > 30 * 24 * 60 * 60 * 1000) return false;

    // Stable hash keyed on credential + expiry date so a rotated credential
    // with a new expiry gets a fresh id (and the old pending one is left
    // alone — cancel it explicitly from the caller if needed).
    const notificationId = stableNotificationId(
      `expiry:${credentialId}:${expiresAt.toISOString().slice(0, 10)}`,
    );
    if (alreadyScheduledThisSession(notificationId)) return false;

    if (!isNativeApp()) {
      return scheduleWebNotification(
        `${credentialName} expires tomorrow`,
        `Rotate before ${expiresAt.toLocaleDateString()} to avoid disruption.`,
        at,
      );
    }

    try { await LocalNotifications.cancel({ notifications: [{ id: notificationId }] }); } catch { /* non-fatal */ }

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title: `${credentialName} expires tomorrow`,
          body: `Rotate before ${expiresAt.toLocaleDateString()} to avoid disruption.`,
          schedule: { at, allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_notification',
          actionTypeId: 'EXPIRY_ACTION',
          extra: { credentialId, type: 'expiry' },
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Failed to schedule credential expiry notification:', error);
    return false;
  }
}

/**
 * Fire-and-forget security alert — shown immediately. Used for breach-count
 * jumps, repeated unlock failures, suspicious activity. Throttled at the
 * call site (we don't want to spam the user).
 */
export async function fireSecurityAlert(
  title: string,
  body: string,
  /** Optional dedupe seed — same seed within an hour merges into one alert. */
  dedupeKey?: string,
): Promise<boolean> {
  try {
    if (!channelAllowed('security')) return false;

    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return false;

    const id = stableNotificationId(`security:${dedupeKey ?? title}:${Math.floor(Date.now() / 3_600_000)}`);
    if (alreadyScheduledThisSession(id)) return false;

    if (!isNativeApp()) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: dedupeKey ? `security-${dedupeKey}` : 'ironvault-security',
        });
      }
      return true;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body,
          schedule: { at: new Date(Date.now() + 1_000), allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_notification',
          actionTypeId: 'SECURITY_ACTION',
          extra: { type: 'security' },
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Failed to fire security alert:', error);
    return false;
  }
}

/**
 * Surface a vault-sync failure to the OS notification shade. Only call this
 * for *failures* — don't spam every successful sync. Ideal for "we couldn't
 * push for the last 10 minutes, your changes are local-only."
 */
export async function fireVaultSyncFailure(
  reason: string,
  vaultName?: string,
): Promise<boolean> {
  try {
    if (!channelAllowed('sync')) return false;

    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) return false;

    const id = stableNotificationId(`sync-fail:${vaultName ?? 'default'}:${Math.floor(Date.now() / 3_600_000)}`);
    if (alreadyScheduledThisSession(id)) return false;
    const title = vaultName ? `${vaultName} not syncing` : 'Vault not syncing';

    if (!isNativeApp()) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body: reason,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          tag: 'ironvault-sync',
        });
      }
      return true;
    }

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body: reason,
          schedule: { at: new Date(Date.now() + 1_000), allowWhileIdle: true },
          sound: 'default',
          smallIcon: 'ic_notification',
          actionTypeId: 'SYNC_ACTION',
          extra: { type: 'sync' },
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Failed to fire sync failure alert:', error);
    return false;
  }
}
