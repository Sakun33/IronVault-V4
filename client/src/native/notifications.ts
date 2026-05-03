import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { isNativeApp } from './platform';

export interface NotificationSettings {
  remindersEnabled: boolean;
  renewalsEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

let notificationsPermissionGranted = false;

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
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        return false;
      }
    }

    if (!isNativeApp()) {
      return scheduleWebNotification(title, body, scheduledAt);
    }

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
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        return false;
      }
    }

    const threeDaysBefore = new Date(renewalDate);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

    const notificationId = parseInt(subscriptionId.replace(/\D/g, '').slice(0, 8)) || Math.floor(Math.random() * 1000000);

    if (!isNativeApp()) {
      return scheduleWebNotification(
        `${subscriptionName} Renewal`,
        `Renews in 3 days for ${amount}`,
        threeDaysBefore
      );
    }

    const options: ScheduleOptions = {
      notifications: [
        {
          id: notificationId,
          title: `${subscriptionName} Renewal Coming Up`,
          body: `Your subscription renews in 3 days for ${amount}`,
          schedule: {
            at: threeDaysBefore,
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
        {
          id: notificationId + 1,
          title: `${subscriptionName} Renews Today`,
          body: `Your subscription renews today for ${amount}`,
          schedule: {
            at: renewalDate,
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
