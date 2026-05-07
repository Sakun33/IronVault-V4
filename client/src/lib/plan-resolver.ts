/**
 * Plan-resolver — thin compatibility layer over `planService`.
 *
 * Existing call sites pass `license.tier` to isPaidTier / isLifetimeTier.
 * Those call sites still work, but the answer is now derived from the
 * single-source-of-truth `planService` so different consumers can never
 * disagree on whether the user is paid.
 *
 * Always upgrade-only: if the caller's license.tier disagrees with planService,
 * we resolve to whichever side reports a paid tier. We never demote based on
 * stale caches.
 */
import { planService } from './plan-service';

export type ResolvedTier = 'free' | 'pro' | 'family' | 'lifetime' | 'pro_family_member';

export function readPlanCacheTier(): ResolvedTier | null {
  // Kept for back-compat; prefer planService.tier directly in new code.
  const t = planService.tier;
  return t === 'free' ? null : t;
}

const PAID = new Set(['pro', 'family', 'lifetime', 'pro_family_member', 'monthly', 'yearly']);

export function isPaidTier(licenseTier: string): boolean {
  if (PAID.has(licenseTier)) return true;
  return planService.isPaid;
}

export function isLifetimeTier(licenseTier: string): boolean {
  if (licenseTier === 'lifetime') return true;
  return planService.isLifetime;
}
