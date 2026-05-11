import { apiBase } from '@/native/platform';

export interface Notification {
  id: string;
  type:
    | 'info'
    | 'success'
    | 'warning'
    | 'error'
    | 'subscription'
    | 'payment'
    | 'security'
    | 'achievement'
    | 'sync'
    | 'welcome';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
  userId: string;
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'iv_notifications';
const LEGACY_STORAGE_KEY = 'securevault_notifications';
const PREFS_KEY = 'iv_notification_preferences';
const LEGACY_PREFS_KEY = 'securevault_notification_preferences';
const MAX_NOTIFICATIONS = 50;

export interface NotificationPreferences {
  userId: string;
  email: boolean;
  push: boolean;
  inApp: boolean;
  subscriptionReminders: boolean;
  paymentNotifications: boolean;
  securityAlerts: boolean;
  marketingEmails: boolean;
}

export class NotificationService {
  private static notifications: Notification[] = [];
  private static preferences: NotificationPreferences[] = [];

  static async createNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false,
    };

    this.notifications.push(newNotification);

    // Cap aggressively at MAX_NOTIFICATIONS — keep newest, drop oldest first.
    if (this.notifications.length > MAX_NOTIFICATIONS) {
      this.notifications = this.notifications
        .slice()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, MAX_NOTIFICATIONS);
    }

    // Store in localStorage for persistence
    this.saveNotifications();

    // Nudge listening UI (notification-center) to refresh without waiting on
    // its 30s tick. No-op outside the browser.
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('iv:notifications-updated'));
      }
    } catch { /* non-fatal */ }

    return newNotification;
  }

  /**
   * Dedupe-friendly variant of createNotification. If a notification with the
   * same `userId + type + dedupeKey` already exists within the dedupe window
   * (default 24h), no new notification is created and the existing one is
   * returned. Useful for event-driven helpers (welcome, sync-success,
   * security-score-changed) that fire on every login or every sync but
   * shouldn't spam the panel.
   */
  static async createOrSkip(
    notification: Omit<Notification, 'id' | 'timestamp' | 'read'>,
    dedupeKey: string,
    windowMs: number = 24 * 60 * 60 * 1000,
  ): Promise<Notification | null> {
    const now = Date.now();
    const existing = this.notifications.find(n =>
      n.userId === notification.userId &&
      n.type === notification.type &&
      n.metadata?.dedupeKey === dedupeKey &&
      (now - new Date(n.timestamp).getTime()) < windowMs,
    );
    if (existing) return null;
    return this.createNotification({
      ...notification,
      metadata: { ...(notification.metadata || {}), dedupeKey },
    });
  }

  static async getNotifications(userId: string, limit?: number): Promise<Notification[]> {
    const userNotifications = this.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? userNotifications.slice(0, limit) : userNotifications;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return this.notifications.filter(n => n.userId === userId && !n.read).length;
  }

  static async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.saveNotifications();
    }
  }

  static async markAllAsRead(userId: string): Promise<void> {
    this.notifications
      .filter(n => n.userId === userId)
      .forEach(n => n.read = true);
    this.saveNotifications();
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    this.notifications = this.notifications.filter(n => n.id !== notificationId);
    this.saveNotifications();
  }

  static async clearAllNotifications(userId: string): Promise<void> {
    this.notifications = this.notifications.filter(n => n.userId !== userId);
    this.saveNotifications();
  }

  // Notification creation helpers
  static async createSubscriptionReminder(userId: string, subscriptionName: string, daysUntilRenewal: number): Promise<Notification> {
    return this.createNotification({
      type: 'subscription',
      title: 'Subscription Renewal Reminder',
      message: `Your ${subscriptionName} subscription will renew in ${daysUntilRenewal} day${daysUntilRenewal !== 1 ? 's' : ''}`,
      userId,
      metadata: { subscriptionName, daysUntilRenewal },
    });
  }

  /**
   * Scan a list of subscriptions and create renewal-reminder notifications for
   * any that fall on the 3-day, 1-day, or 0-day mark. Idempotent per
   * subscription+threshold (dedupes by metadata.subscriptionName + threshold)
   * so the same subscription doesn't generate duplicates if the user revisits
   * the dashboard multiple times in a day.
   *
   * Pass any object with `name`, `nextBillingDate`, and `isActive`.
   */
  static async scanSubscriptionRenewals(
    userId: string,
    subscriptions: Array<{ name: string; nextBillingDate?: string | Date | null; isActive?: boolean }>,
  ): Promise<number> {
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) return 0;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    let created = 0;

    for (const sub of subscriptions) {
      if (!sub.name || !sub.nextBillingDate || sub.isActive === false) continue;
      const due = new Date(sub.nextBillingDate);
      if (Number.isNaN(due.getTime())) continue;
      // Calendar-day diff so a renewal "tomorrow morning" still hits the 1-day
      // threshold even if it's <24h away in real time.
      const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
      const todayMidnight = new Date().setHours(0, 0, 0, 0);
      const days = Math.round((dueMidnight - todayMidnight) / dayMs);
      if (days !== 0 && days !== 1 && days !== 3) continue;

      // Dedupe: same subscription+threshold within the last 24h.
      const dupe = this.notifications.find(n =>
        n.type === 'subscription' &&
        n.userId === userId &&
        n.metadata?.subscriptionName === sub.name &&
        n.metadata?.daysUntilRenewal === days &&
        (now - new Date(n.timestamp).getTime()) < dayMs,
      );
      if (dupe) continue;

      await this.createSubscriptionReminder(userId, sub.name, days);
      created++;
    }
    return created;
  }

  /**
   * Drop read notifications older than `maxAgeDays` (default 7) and cap the
   * total store at `maxCount` (default 100, oldest first). Called on init so
   * the bell panel doesn't accumulate cruft over months of use.
   */
  static cleanupOldNotifications(maxAgeDays: number = 7, maxCount: number = MAX_NOTIFICATIONS): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const before = this.notifications.length;

    // Drop old, already-read notifications.
    this.notifications = this.notifications.filter(n => {
      const ts = new Date(n.timestamp).getTime();
      if (n.read && ts < cutoff) return false;
      return true;
    });

    // Cap total — keep newest.
    if (this.notifications.length > maxCount) {
      this.notifications = this.notifications
        .slice()
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxCount);
    }

    const removed = before - this.notifications.length;
    if (removed > 0) this.saveNotifications();
    return removed;
  }

  static async createPaymentSuccess(userId: string, amount: number, currency: string): Promise<Notification> {
    return this.createNotification({
      type: 'success',
      title: 'Payment Successful',
      message: `Your payment of ${currency} ${amount} has been processed successfully`,
      userId,
      metadata: { amount, currency },
    });
  }

  static async createPaymentFailed(userId: string, amount: number, currency: string): Promise<Notification> {
    return this.createNotification({
      type: 'error',
      title: 'Payment Failed',
      message: `Your payment of ${currency} ${amount} could not be processed. Please update your payment method`,
      userId,
      metadata: { amount, currency },
    });
  }

  static async createSecurityAlert(userId: string, message: string): Promise<Notification> {
    return this.createNotification({
      type: 'security',
      title: 'Security Alert',
      message,
      userId,
    });
  }

  /**
   * Reconcile a set of currently-active security alerts with the notification
   * store. Each alert needs a stable `key` so a recurring condition (e.g.
   * "weak passwords detected") doesn't accumulate duplicates. Alerts no longer
   * present are automatically marked read so the unread badge tracks the
   * live security state rather than historical noise.
   *
   * Routes the dashboard's in-memory criticalAlerts list (+ breach scan
   * results) into the notification center so the bell badge reflects every
   * outstanding security concern, not just the CRM-driven ones.
   */
  static async syncSecurityAlerts(
    userId: string,
    alerts: Array<{ key: string; title: string; message: string; actionUrl?: string }>,
  ): Promise<void> {
    const activeKeys = new Set(alerts.map(a => `security-alert:${a.key}`));

    let changed = false;
    for (const n of this.notifications) {
      if (n.userId !== userId) continue;
      const dk = n.metadata?.dedupeKey;
      if (typeof dk !== 'string' || !dk.startsWith('security-alert:')) continue;
      // Alert resolved — mark as read so it stops contributing to badge.
      if (!activeKeys.has(dk) && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) this.saveNotifications();

    for (const a of alerts) {
      await this.createOrSkip(
        {
          type: 'security',
          title: a.title,
          message: a.message,
          userId,
          actionUrl: a.actionUrl,
          actionText: a.actionUrl ? 'Open' : undefined,
        },
        `security-alert:${a.key}`,
        7 * 24 * 60 * 60 * 1000, // 7-day window — re-surfaces if user dismissed earlier in the week
      );
    }
  }

  static async createPlanUpgrade(userId: string, newPlan: string): Promise<Notification> {
    return this.createNotification({
      type: 'success',
      title: 'Plan Upgraded',
      message: `You've successfully upgraded to the ${newPlan} plan`,
      userId,
      metadata: { newPlan },
    });
  }

  static async createTrialExpiring(userId: string, daysLeft: number): Promise<Notification> {
    return this.createNotification({
      type: 'warning',
      title: 'Trial Expiring Soon',
      message: `Your free trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Upgrade now to continue using all features`,
      userId,
      metadata: { daysLeft },
    });
  }

  static async createTrialStarted(userId: string): Promise<Notification> {
    return this.createNotification({
      type: 'success',
      title: 'Trial Started',
      message: 'Your 7-day free trial has started. Enjoy all premium features!',
      userId,
      metadata: { trialDays: 7 },
    });
  }

  /**
   * Welcome on login. Includes a brief snapshot — password count + upcoming
   * renewals — so the user gets value the moment they open the panel.
   * Deduped per-day so it doesn't fire on every refresh.
   */
  static async createWelcomeBack(
    userId: string,
    passwordCount: number,
    upcomingRenewals: number,
  ): Promise<Notification | null> {
    const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const renewalLine = upcomingRenewals > 0
      ? `${upcomingRenewals} upcoming renewal${upcomingRenewals !== 1 ? 's' : ''}`
      : 'no upcoming renewals';
    return this.createOrSkip(
      {
        type: 'welcome',
        title: 'Welcome back!',
        message: `${passwordCount} password${passwordCount !== 1 ? 's' : ''} stored, ${renewalLine}.`,
        userId,
        metadata: { passwordCount, upcomingRenewals },
      },
      `welcome:${todayKey}`,
    );
  }

  /**
   * Fired by the security-health page when weak passwords are detected.
   * Deduped on `count` so the same total doesn't surface twice in 24h, but
   * a worsening score will re-notify.
   */
  static async createWeakPasswordsAlert(
    userId: string,
    count: number,
  ): Promise<Notification | null> {
    if (count <= 0) return null;
    return this.createOrSkip(
      {
        type: 'security',
        title: 'Passwords need strengthening',
        message: `${count} password${count !== 1 ? 's' : ''} are weak or reused. Tap to review.`,
        userId,
        actionUrl: '/security-health',
        actionText: 'Review now',
        metadata: { count },
      },
      `weak-passwords:${count}`,
    );
  }

  /**
   * Sync success — light-touch confirmation. Deduped per-hour so a chatty
   * sync queue doesn't fill the panel.
   */
  static async createSyncSuccess(userId: string): Promise<Notification | null> {
    const hourKey = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
    return this.createOrSkip(
      {
        type: 'sync',
        title: 'Vault synced',
        message: 'Your vault is up to date across all devices.',
        userId,
      },
      `sync:${hourKey}`,
      60 * 60 * 1000,
    );
  }

  /**
   * Fired when the security score crosses a meaningful threshold (default
   * +/-5). Deduped on `score` so the same value doesn't notify repeatedly.
   */
  static async createSecurityScoreChange(
    userId: string,
    score: number,
    direction: 'improved' | 'declined',
  ): Promise<Notification | null> {
    return this.createOrSkip(
      {
        type: direction === 'improved' ? 'achievement' : 'warning',
        title: direction === 'improved'
          ? `Security score improved to ${score}!`
          : `Security score dropped to ${score}`,
        message: direction === 'improved'
          ? 'Great work — your vault is more secure than before.'
          : 'Tap to see what changed and how to recover.',
        userId,
        actionUrl: '/security-health',
        actionText: direction === 'improved' ? 'See details' : 'Review',
        metadata: { score, direction },
      },
      `security-score:${score}:${direction}`,
    );
  }

  /**
   * Achievement badge unlocked. The Security Health page already paints a
   * row of badges — this surfaces the unlock event into the notification
   * panel so it's discoverable later.
   */
  static async createAchievementUnlocked(
    userId: string,
    badgeId: string,
    badgeName: string,
    description: string,
  ): Promise<Notification | null> {
    return this.createOrSkip(
      {
        type: 'achievement',
        title: `Badge unlocked: ${badgeName}`,
        message: description,
        userId,
        metadata: { badgeId, badgeName },
      },
      `achievement:${badgeId}`,
      // One badge unlock = lifetime dedupe (effectively).
      365 * 24 * 60 * 60 * 1000,
    );
  }

  // Preferences management
  static async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    return this.preferences.find(p => p.userId === userId) || null;
  }

  static async updatePreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    const existingIndex = this.preferences.findIndex(p => p.userId === userId);
    
    if (existingIndex >= 0) {
      this.preferences[existingIndex] = { ...this.preferences[existingIndex], ...preferences };
    } else {
      this.preferences.push({
        userId,
        email: true,
        push: true,
        inApp: true,
        subscriptionReminders: true,
        paymentNotifications: true,
        securityAlerts: true,
        marketingEmails: false,
        ...preferences,
      });
    }
    
    this.savePreferences();
  }

  // Storage methods
  private static saveNotifications(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  }

  private static savePreferences(): void {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  private static loadNotifications(): void {
    try {
      // Prefer the new key. If only the legacy key is present, migrate
      // exactly once and clear the old slot.
      let raw = localStorage.getItem(STORAGE_KEY);
      let migrated = false;
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          raw = legacy;
          migrated = true;
        }
      }
      if (raw) {
        this.notifications = JSON.parse(raw).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      }
      if (migrated) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notifications));
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  private static loadPreferences(): void {
    try {
      let raw = localStorage.getItem(PREFS_KEY);
      let migrated = false;
      if (!raw) {
        const legacy = localStorage.getItem(LEGACY_PREFS_KEY);
        if (legacy) {
          raw = legacy;
          migrated = true;
        }
      }
      if (raw) {
        this.preferences = JSON.parse(raw);
      }
      if (migrated) {
        localStorage.setItem(PREFS_KEY, JSON.stringify(this.preferences));
        localStorage.removeItem(LEGACY_PREFS_KEY);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  }

  private static generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Fetch CRM notifications from backend and merge into local store
  static async fetchCrmNotifications(): Promise<void> {
    const crmUserId = localStorage.getItem('crmUserId');
    if (!crmUserId) return;

    try {
      const apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_API_URL) || apiBase();
      const endpoint = `${apiUrl}/api/crm/notifications/${crmUserId}`;
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();
      if (!data?.notifications?.length) return;

      // Map CRM notification types to local types
      const typeMap: Record<string, Notification['type']> = {
        ticket_update: 'info',
        ticket_closed: 'success',
        subscription_upgrade: 'success',
        subscription_downgrade: 'warning',
        subscription_change: 'info',
        info: 'info',
      };

      let hasNew = false;
      for (const n of data.notifications) {
        const crmId = `crm_${n.id}`;
        if (!this.notifications.find(existing => existing.id === crmId)) {
          this.notifications.push({
            id: crmId,
            type: typeMap[n.type] || 'info',
            title: n.title,
            message: n.message || '',
            timestamp: new Date(n.created_at),
            read: n.read || false,
            userId: 'current-user',
          });
          hasNew = true;
        }
      }
      if (hasNew) this.saveNotifications();
    } catch (error) {
      // Non-critical — silent fail
    }
  }

  // Initialize the service
  static initialize(): void {
    this.loadNotifications();
    this.loadPreferences();
    // Auto-prune so the bell panel doesn't accumulate cruft. Read items >7d
    // old are dropped; total store capped at 100.
    this.cleanupOldNotifications();
    // Also fetch CRM notifications on init
    this.fetchCrmNotifications();
  }
}
