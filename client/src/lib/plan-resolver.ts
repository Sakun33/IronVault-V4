/**
 * Centralised, race-free plan resolution.
 *
 * The license object in license-context is hydrated from a chain of async
 * sources (localStorage → CRM /entitlement → server-side license blob).
 * Until that chain settles, `license.tier` can read 'free' for users who
 * are actually on a paid plan — and any UI gate that reads `license.tier`
 * directly will flicker an "Upgrade to Pro" button at a Lifetime user.
 *
 * usePlanFeatures() writes the authoritative plan into localStorage under
 * `iv_plan_cache` the moment it lands. Treat that cache as a fallback:
 * if the license blob still says 'free' but the cache says 'lifetime',
 * the user is on Lifetime — never demote on the cache, only upgrade.
 */
export type ResolvedTier = 'free' | 'pro' | 'family' | 'lifetime' | 'pro_family_member';

export function readPlanCacheTier(): ResolvedTier | null {
  try {
    const raw = localStorage.getItem('iv_plan_cache');
    if (!raw) return null;
    const cache = JSON.parse(raw) as { planId?: string };
    const id = cache?.planId;
    if (
      id === 'free' || id === 'pro' || id === 'family' ||
      id === 'lifetime' || id === 'pro_family_member'
    ) {
      return id;
    }
    return null;
  } catch {
    return null;
  }
}

/** Returns true if the resolved tier grants paid-tier (Pro or higher) features.
 *  Pass the current license.tier; this function cross-checks the plan cache
 *  so a Lifetime user with a stale license blob still resolves to paid. */
export function isPaidTier(licenseTier: string): boolean {
  const paid = (t: string | null) =>
    t === 'pro' || t === 'family' || t === 'lifetime' || t === 'pro_family_member' ||
    t === 'monthly' || t === 'yearly';
  if (paid(licenseTier)) return true;
  const cached = readPlanCacheTier();
  if (cached && paid(cached)) return true;
  return false;
}

/** Same as above but specifically detects Lifetime — used by UI that
 *  shows a "Lifetime Unlocked" badge or hides upgrade CTAs entirely. */
export function isLifetimeTier(licenseTier: string): boolean {
  if (licenseTier === 'lifetime') return true;
  const cached = readPlanCacheTier();
  return cached === 'lifetime';
}
