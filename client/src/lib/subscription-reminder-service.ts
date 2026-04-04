// Subscription Reminder Service
// Handles automatic reminders for subscription renewals, expiries, and other notifications

import { SubscriptionEntry } from '@shared/schema';

export interface SubscriptionReminder {
  id: string;
  subscriptionId: string;
  type: 'renewal' | 'expiry' | 'trial_end' | 'price_change' | 'feature_change';
  title: string;
  message: string;
  dueDate: Date;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: Date;
}

export class SubscriptionReminderService {
  private static instance: SubscriptionReminderService;
  private reminders: SubscriptionReminder[] = [];

  static getInstance(): SubscriptionReminderService {
    if (!SubscriptionReminderService.instance) {
      SubscriptionReminderService.instance = new SubscriptionReminderService();
    }
    return SubscriptionReminderService.instance;
  }

  // Generate reminders for all subscriptions
  generateReminders(subscriptions: SubscriptionEntry[]): SubscriptionReminder[] {
    const reminders: SubscriptionReminder[] = [];
    const now = new Date();

    subscriptions.forEach(subscription => {
      if (!subscription.isActive) return;

      // Renewal reminders
      if (subscription.nextBillingDate) {
        const renewalDate = new Date(subscription.nextBillingDate);
        const reminderDays = subscription.reminderDays || 7;
        const reminderDate = new Date(renewalDate.getTime() - (reminderDays * 24 * 60 * 60 * 1000));

        // Only create reminder if it's in the future and not too far ahead
        if (reminderDate > now && reminderDate < new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))) {
          reminders.push({
            id: `renewal_${subscription.id}_${reminderDate.getTime()}`,
            subscriptionId: subscription.id,
            type: 'renewal',
            title: `${subscription.name} Renewal Reminder`,
            message: `Your ${subscription.name} subscription will renew on ${renewalDate.toLocaleDateString()}. Amount: $${subscription.cost}`,
            dueDate: reminderDate,
            isRead: false,
            isDismissed: false,
            createdAt: now,
          });
        }
      }

      // Expiry reminders
      if (subscription.expiryDate) {
        const expiryDate = new Date(subscription.expiryDate);
        const reminderDate = new Date(expiryDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days before expiry

        // Only create reminder if it's in the future and not too far ahead
        if (reminderDate > now && reminderDate < new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))) {
          reminders.push({
            id: `expiry_${subscription.id}_${reminderDate.getTime()}`,
            subscriptionId: subscription.id,
            type: 'expiry',
            title: `${subscription.name} Expiry Warning`,
            message: `Your ${subscription.name} subscription will expire on ${expiryDate.toLocaleDateString()}. ${subscription.autoRenew ? 'Auto-renewal is enabled.' : 'Consider renewing manually.'}`,
            dueDate: reminderDate,
            isRead: false,
            isDismissed: false,
            createdAt: now,
          });
        }
      }

      // Price change notifications (mock - would be triggered by external events)
      if (subscription.cost > 50) { // Example: high-cost subscriptions might have price changes
        const priceChangeDate = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days from now
        reminders.push({
          id: `price_change_${subscription.id}_${priceChangeDate.getTime()}`,
          subscriptionId: subscription.id,
          type: 'price_change',
          title: `${subscription.name} Price Change Alert`,
          message: `Your ${subscription.name} subscription may have pricing changes. Current cost: $${subscription.cost}`,
          dueDate: priceChangeDate,
          isRead: false,
          isDismissed: false,
          createdAt: now,
        });
      }
    });

    this.reminders = reminders;
    return reminders;
  }

  // Get active reminders (not dismissed and due)
  getActiveReminders(): SubscriptionReminder[] {
    const now = new Date();
    return this.reminders.filter(reminder => 
      !reminder.isDismissed && 
      reminder.dueDate <= now
    );
  }

  // Get upcoming reminders (not dismissed, due within next 7 days)
  getUpcomingReminders(): SubscriptionReminder[] {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    
    return this.reminders.filter(reminder => 
      !reminder.isDismissed && 
      reminder.dueDate > now && 
      reminder.dueDate <= nextWeek
    );
  }

  // Mark reminder as read
  markAsRead(reminderId: string): void {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.isRead = true;
    }
  }

  // Dismiss reminder
  dismissReminder(reminderId: string): void {
    const reminder = this.reminders.find(r => r.id === reminderId);
    if (reminder) {
      reminder.isDismissed = true;
    }
  }

  // Get reminder count for dashboard
  getReminderCount(): { active: number; upcoming: number; total: number } {
    const active = this.getActiveReminders().length;
    const upcoming = this.getUpcomingReminders().length;
    const total = this.reminders.filter(r => !r.isDismissed).length;

    return { active, upcoming, total };
  }

  // Clear old dismissed reminders (older than 30 days)
  cleanupOldReminders(): void {
    const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    this.reminders = this.reminders.filter(reminder => 
      !reminder.isDismissed || reminder.createdAt > thirtyDaysAgo
    );
  }
}

export default SubscriptionReminderService;
