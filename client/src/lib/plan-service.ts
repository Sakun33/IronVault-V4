// THE SINGLE SOURCE OF TRUTH for plan status across the entire app.
// Every component that needs plan info should read from here. No exceptions.
//
// Why a service singleton instead of a context: plan checks happen all over the app —
// inside non-React modules (storage, vault-context async paths, import handlers) — and
// React Context can't be read from those code paths. The service is observable so any
// React component can subscribe via usePlan() and re-render on tier changes.
//
// Design rules:
//   - Persist tier to localStorage so it's available before the entitlement endpoint
//     responds on the next app open (prevents the "free flash" for paid users).
//   - Never demote on cache: only an authoritative server response moves a paid user
//     to free. The cache is a floor, not a ceiling.
//   - Notify subscribers on every change so all dependent UI re-renders.
//
// All the legacy hooks (useLicense, useSubscription, usePlanFeatures) now read from
// this service so that the app has a single source of truth even though the legacy
// import paths still work.

import { useEffect, useState } from 'react';

export type PlanTier = 'free' | 'pro' | 'family' | 'lifetime' | 'pro_family_member';

const PLAN_TIER_KEY = 'iv_plan_tier';
const LEGACY_CACHE_KEY = 'iv_plan_cache';

// Source-of-truth free-plan limits. Mirrors plans.ts definitions.
// Free expenses / investments / bankStatements are 0 (not 20/5/2) to match the
// PLAN_CAPABILITIES.FREE entitlement in /lib/entitlements/types.ts: those whole
// features are gated off on Free, and any incidentally created rows should be
// rejected at the boundary, not silently allowed up to a soft cap.
const FREE_LIMITS: Record<string, number> = {
  passwords: 50,
  notes: 10,
  subscriptions: 10,
  expenses: 0,
  documents: 5,
  apiKeys: 0,
  reminders: 10,
  investments: 0,
  bankStatements: 0,
  vaults: 1,
  storageMB: 50,
  goals: 3,
};

function normalizeTier(input: unknown): PlanTier {
  const raw = String(input ?? '').toLowerCase().trim();
  if (raw === 'pro' || raw === 'lifetime' || raw === 'family' || raw === 'pro_family_member') {
    return raw;
  }
  // Map server aliases — "premium" historically meant "pro" in the CRM data.
  if (raw === 'premium' || raw === 'monthly' || raw === 'yearly') return 'pro';
  return 'free';
}

class PlanService {
  private _tier: PlanTier = 'free';
  private _initialized = false;
  private _listeners: Set<() => void> = new Set();

  get tier(): PlanTier { return this._tier; }
  get isPaid(): boolean { return this._tier !== 'free'; }
  /** Pro/Lifetime/Family/Family-member all have pro-level access. */
  get isPro(): boolean { return this._tier !== 'free'; }
  get isLifetime(): boolean { return this._tier === 'lifetime'; }
  get isFamily(): boolean { return this._tier === 'family'; }
  get initialized(): boolean { return this._initialized; }

  /** Per-resource limit. Returns Infinity for paid plans. */
  getLimit(resource: string): number {
    if (this.isPaid) return Infinity;
    return FREE_LIMITS[resource] ?? 10;
  }

  /** Returns true if adding `delta` more of `resource` would exceed the free limit.
   *  Always returns false for paid plans. */
  wouldExceedLimit(resource: string, current: number, delta: number = 1): boolean {
    if (this.isPaid) return false;
    return (current + delta) > this.getLimit(resource);
  }

  /** Headroom (remaining capacity) for `resource`. Infinity on paid plans. */
  getHeadroom(resource: string, current: number): number {
    if (this.isPaid) return Infinity;
    return Math.max(0, this.getLimit(resource) - current);
  }

  /** Authoritative setter — call from license-context after server response.
   *  Pass `{ authoritative: true }` only when the source is the server or an
   *  explicit user upgrade/downgrade. Stale IDB reads must use the default
   *  (non-authoritative) so a Lifetime user can't be silently demoted to free
   *  when their device was previously logged into a free account. The cache
   *  is a floor, not a ceiling. */
  setTier(tier: unknown, opts: { authoritative?: boolean } = {}): void {
    const normalized = normalizeTier(tier);
    const isDemotion = this._tier !== 'free' && normalized === 'free';
    if (isDemotion && !opts.authoritative) {
      // Refuse to demote paid → free without an authoritative source.
      return;
    }
    const changed = normalized !== this._tier || !this._initialized;
    this._tier = normalized;
    this._initialized = true;
    try { localStorage.setItem(PLAN_TIER_KEY, normalized); } catch {}
    if (changed) this._notify();
  }

  /** Restore from localStorage. Call once at module load and after each login. */
  restoreFromCache(): void {
    try {
      // 1. Try the new explicit tier key.
      const cached = localStorage.getItem(PLAN_TIER_KEY);
      if (cached) {
        this._tier = normalizeTier(cached);
        this._initialized = true;
        return;
      }
      // 2. Back-compat: legacy iv_plan_cache used by the old usePlanFeatures hook.
      const legacy = localStorage.getItem(LEGACY_CACHE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy) as { planId?: string };
        if (parsed?.planId) {
          this._tier = normalizeTier(parsed.planId);
          this._initialized = true;
        }
      }
    } catch { /* ignore */ }
  }

  /** Reset on logout — back to free, clear persisted state. */
  reset(): void {
    this._tier = 'free';
    this._initialized = false;
    try {
      localStorage.removeItem(PLAN_TIER_KEY);
      localStorage.removeItem(LEGACY_CACHE_KEY);
    } catch {}
    this._notify();
  }

  subscribe(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  private _notify(): void {
    this._listeners.forEach(fn => {
      try { fn(); } catch {}
    });
  }
}

export const planService = new PlanService();

// Restore immediately on module load so the very first render uses the cached tier.
planService.restoreFromCache();

/**
 * React hook — subscribe to plan changes. Returns the singleton so consumers can
 * destructure `tier`, `isPaid`, `isPro`, `isLifetime`, `getLimit`, etc.
 */
export function usePlan(): PlanService {
  const [, forceUpdate] = useState(0);
  useEffect(() => planService.subscribe(() => forceUpdate(n => n + 1)), []);
  return planService;
}
