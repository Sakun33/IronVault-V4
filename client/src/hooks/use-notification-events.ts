import { useEffect, useRef } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { NotificationService } from '@/lib/notifications';
import type { SubscriptionEntry } from '@shared/schema';
import { fireSecurityAlert, fireVaultSyncFailure } from '@/native/notifications';

/**
 * Wires app-state changes to the notification center.
 *
 * - On unlock: writes a "welcome back" snapshot (deduped per-day).
 * - On weakPasswords change: writes a security nudge (deduped per-count).
 * - On cloudSyncStatus → 'synced' (transition only): writes a sync confirmation
 *   (deduped per-hour so a chatty queue doesn't flood the panel).
 * - On subscriptions change: scans for renewals at the 0/1/3-day thresholds
 *   (per-subscription dedupe handled inside NotificationService).
 *
 * The hook is intentionally fire-and-forget — it never blocks render or
 * surfaces errors. Each effect uses a ref to remember the previous value so
 * we only fire on real transitions.
 */
export function useNotificationEvents(opts: {
  userId: string;
  isUnlocked: boolean;
  passwordCount: number;
  weakPasswordCount: number;
  subscriptions: SubscriptionEntry[];
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'failed';
}) {
  const {
    userId,
    isUnlocked,
    passwordCount,
    weakPasswordCount,
    subscriptions,
    cloudSyncStatus,
  } = opts;

  const lastUnlocked = useRef<boolean>(false);
  const lastWeak = useRef<number | null>(null);
  const lastSync = useRef<typeof cloudSyncStatus>(cloudSyncStatus);

  // Welcome on unlock transition.
  useEffect(() => {
    if (!userId || userId === 'guest') return;
    if (isUnlocked && !lastUnlocked.current) {
      const upcoming = subscriptions.filter(s => {
        if (!s.isActive || !s.nextBillingDate) return false;
        const days = differenceInCalendarDays(new Date(s.nextBillingDate), new Date());
        return days >= 0 && days <= 7;
      }).length;
      NotificationService.createWelcomeBack(userId, passwordCount, upcoming).catch(() => {});
    }
    lastUnlocked.current = isUnlocked;
  }, [isUnlocked, userId, passwordCount, subscriptions]);

  // Weak-password alerts. Only fires on count *changes* (or on first non-zero).
  useEffect(() => {
    if (!userId || userId === 'guest' || !isUnlocked) return;
    if (weakPasswordCount === 0) {
      lastWeak.current = 0;
      return;
    }
    if (lastWeak.current !== weakPasswordCount) {
      NotificationService.createWeakPasswordsAlert(userId, weakPasswordCount).catch(() => {});
      // Mirror to OS notifications for material jumps (>=3 weak passwords),
      // so users see it even with the app backgrounded. The fire helper
      // throttles same-hour repeats via its dedupeKey.
      if (weakPasswordCount >= 3) {
        void fireSecurityAlert(
          'Weak passwords detected',
          `${weakPasswordCount} of your saved passwords are weak. Review and rotate them.`,
          `weak-${userId}`,
        );
      }
      lastWeak.current = weakPasswordCount;
    }
  }, [weakPasswordCount, userId, isUnlocked]);

  // Sync transitions: confirm success in-app, push OS alert on failure only.
  useEffect(() => {
    if (!userId || userId === 'guest' || !isUnlocked) return;
    if (cloudSyncStatus === 'synced' && lastSync.current !== 'synced') {
      NotificationService.createSyncSuccess(userId).catch(() => {});
    }
    if (cloudSyncStatus === 'failed' && lastSync.current !== 'failed') {
      // Only OS-notify for failures — successful syncs are silent at the OS
      // level (the in-app pill is enough). The dedupe key is per-user-per-hour.
      void fireVaultSyncFailure(
        'Your changes are saved locally but not pushed to the cloud yet.',
      );
    }
    lastSync.current = cloudSyncStatus;
  }, [cloudSyncStatus, userId, isUnlocked]);

  // Renewal scan — runs whenever the subscriptions array changes. Internally
  // deduped per (subscription, threshold).
  useEffect(() => {
    if (!userId || userId === 'guest' || !isUnlocked) return;
    if (!subscriptions.length) return;
    NotificationService.scanSubscriptionRenewals(userId, subscriptions).catch(() => {});
  }, [subscriptions, userId, isUnlocked]);
}
