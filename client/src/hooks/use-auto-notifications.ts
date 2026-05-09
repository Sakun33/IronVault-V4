import { useEffect } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { NotificationService } from '@/lib/notifications';
import { PasswordGenerator } from '@/lib/password-generator';
import type { PasswordEntry, SubscriptionEntry } from '@shared/schema';

// Dedup keys live in localStorage so a notification fires at most once per
// (subscription, day-bucket) or (vault-state, day) combo. Cleared on a fresh
// day so subsequent renewals can fire again.
const DEDUP_KEY = 'iv_auto_notif_fired_v1';
const RENEWAL_BUCKETS = [1, 3, 7] as const;

interface FiredMap {
  date: string;            // YYYY-MM-DD — buckets reset daily
  ids: Record<string, true>;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadFired(): FiredMap {
  try {
    const raw = localStorage.getItem(DEDUP_KEY);
    if (!raw) return { date: todayKey(), ids: {} };
    const parsed = JSON.parse(raw) as FiredMap;
    if (parsed.date !== todayKey()) return { date: todayKey(), ids: {} };
    return parsed;
  } catch {
    return { date: todayKey(), ids: {} };
  }
}

function saveFired(map: FiredMap): void {
  try {
    localStorage.setItem(DEDUP_KEY, JSON.stringify(map));
  } catch {
    /* quota — non-fatal */
  }
}

interface UseAutoNotificationsArgs {
  userId: string | null;
  subscriptions: SubscriptionEntry[];
  passwords: PasswordEntry[];
  enabled?: boolean;
}

/**
 * Generates in-app notifications for:
 *   1. Subscription renewals at 1 / 3 / 7 days out (deduped per day per sub)
 *   2. Weak password counts (deduped daily)
 *
 * Runs once when the dashboard mounts (or when underlying data changes).
 * No network — purely local. Notifications surface in the bell panel via
 * NotificationService.
 */
export function useAutoNotifications({
  userId,
  subscriptions,
  passwords,
  enabled = true,
}: UseAutoNotificationsArgs): void {
  useEffect(() => {
    if (!enabled || !userId) return;
    const fired = loadFired();

    // ── Subscription renewals ─────────────────────────────────────────────
    for (const sub of subscriptions) {
      if (!sub.isActive || !sub.nextBillingDate) continue;
      const days = differenceInCalendarDays(new Date(sub.nextBillingDate), new Date());
      if (days < 0) continue;
      const bucket = RENEWAL_BUCKETS.find(b => b === days);
      if (bucket === undefined) continue;
      const dedupKey = `sub:${sub.id}:${bucket}`;
      if (fired.ids[dedupKey]) continue;
      NotificationService.createSubscriptionReminder(userId, sub.name || 'subscription', bucket);
      fired.ids[dedupKey] = true;
    }

    // ── Weak password alert ──────────────────────────────────────────────
    let weakCount = 0;
    for (const p of passwords) {
      if (!p.password) continue;
      const { level } = PasswordGenerator.calculateStrength(p.password);
      if (level === 'weak') weakCount++;
    }
    if (weakCount > 0) {
      const dedupKey = `weak:${weakCount}`;
      if (!fired.ids[dedupKey]) {
        NotificationService.createSecurityAlert(
          userId,
          `${weakCount} weak password${weakCount > 1 ? 's' : ''} detected. Tap Passwords → Weak to strengthen them.`,
        );
        fired.ids[dedupKey] = true;
      }
    }

    saveFired(fired);
  }, [userId, subscriptions, passwords, enabled]);
}
