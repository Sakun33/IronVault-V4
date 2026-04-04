export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'subscription' | 'payment' | 'security';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionText?: string;
  userId: string;
  metadata?: Record<string, any>;
}

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
    
    // Store in localStorage for persistence
    this.saveNotifications();
    
    return newNotification;
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
      localStorage.setItem('securevault_notifications', JSON.stringify(this.notifications));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  }

  private static savePreferences(): void {
    try {
      localStorage.setItem('securevault_notification_preferences', JSON.stringify(this.preferences));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  }

  private static loadNotifications(): void {
    try {
      const stored = localStorage.getItem('securevault_notifications');
      if (stored) {
        this.notifications = JSON.parse(stored).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  private static loadPreferences(): void {
    try {
      const stored = localStorage.getItem('securevault_notification_preferences');
      if (stored) {
        this.preferences = JSON.parse(stored);
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
      const apiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_API_URL) || '';
      const endpoint = apiUrl ? `${apiUrl}/api/crm/notifications/${crmUserId}` : `/api/crm/notifications/${crmUserId}`;
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
    // Also fetch CRM notifications on init
    this.fetchCrmNotifications();
  }
}
