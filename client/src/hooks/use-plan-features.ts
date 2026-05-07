import { useState, useEffect, useCallback } from 'react';
import { getPlan, PLANS, type Plan, type PlanId } from '@/lib/plans';
import { getAccountSessionEmail } from '@/lib/account-auth';
import { apiBase } from '@/native/platform';
import { planService } from '@/lib/plan-service';

const PLAN_CACHE_KEY = 'iv_plan_cache';
const PLAN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PlanCache {
  email: string;
  planId: PlanId;
  fetchedAt: number;
}

function getCachedPlan(email: string): PlanId | null {
  try {
    const raw = localStorage.getItem(PLAN_CACHE_KEY);
    if (!raw) return null;
    const cache: PlanCache = JSON.parse(raw);
    if (cache.email !== email.toLowerCase().trim()) return null;
    if (Date.now() - cache.fetchedAt > PLAN_CACHE_TTL_MS) return null;
    return cache.planId;
  } catch {
    return null;
  }
}

export function savePlanCache(email: string, planId: PlanId): void {
  // Don't poison the cache with 'free' if planService already knows the user is
  // paid — that cache would be re-read on next mount and try to demote (blocked
  // by planService guard, but it'd still flap state). Cache writes are NOT
  // authoritative: they're a CRM-fetch result that may be stale or wrong.
  if (planId === 'free' && planService.isPaid) {
    try {
      // eslint-disable-next-line no-console
      console.warn(
        `[savePlanCache] Refusing to cache 'free' over current paid tier '${planService.tier}' for ${email}`,
      );
    } catch { /* ignore */ }
    return;
  }
  const cache: PlanCache = {
    email: email.toLowerCase().trim(),
    planId,
    fetchedAt: Date.now(),
  };
  localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(cache));
  // Mirror into the central plan service so non-React consumers see the tier
  // the moment the CRM endpoint resolves — even before license-context runs
  // syncFromServer. Non-authoritative — guard rejects rank decreases.
  planService.setTier(planId, { reason: 'save-plan-cache' });
}

export function clearPlanCache(): void {
  localStorage.removeItem(PLAN_CACHE_KEY);
  // Don't reset planService here — license-context's loadLicense will set the
  // authoritative tier from IDB right after this. Resetting would briefly flash
  // free even for paid users.
}

export interface PlanFeatures {
  plan: Plan;
  planId: PlanId;
  /** Max TOTAL vaults (local + cloud combined) for this plan */
  vaultLimit: number;
  /** Whether cloud sync is allowed */
  cloudSyncEnabled: boolean;
  /** Whether family sharing is allowed */
  familySharingEnabled: boolean;
  /** Whether bank statement import (OCR) is allowed */
  bankImportEnabled: boolean;
  /** Whether expense analytics are enabled */
  analyticsEnabled: boolean;
  /** Whether biometric auth is allowed */
  biometricEnabled: boolean;
  /** Whether priority support is active */
  prioritySupportEnabled: boolean;
  /** True for any paid plan */
  isPaid: boolean;
  /** True for lifetime plan */
  isLifetime: boolean;
  /** Whether web app access is enabled (paid plans only — web requires cloud/paid) */
  webAppEnabled: boolean;
  /** Loading state while fetching from server */
  isLoading: boolean;
  /** Refetch the plan from the server */
  refresh: () => void;
}

const FREE_FEATURES: Omit<PlanFeatures, 'plan' | 'planId' | 'isLoading' | 'refresh'> = {
  vaultLimit: 1,
  cloudSyncEnabled: false,
  familySharingEnabled: false,
  bankImportEnabled: false,
  analyticsEnabled: false,
  biometricEnabled: false,
  prioritySupportEnabled: false,
  isPaid: false,
  isLifetime: false,
  webAppEnabled: false,
};

const PAID_FEATURES: Omit<PlanFeatures, 'plan' | 'planId' | 'isLoading' | 'refresh' | 'isLifetime'> = {
  vaultLimit: 5,
  cloudSyncEnabled: true,
  familySharingEnabled: false,
  bankImportEnabled: true,
  analyticsEnabled: true,
  biometricEnabled: true,
  prioritySupportEnabled: true,
  isPaid: true,
  webAppEnabled: true,
};

function buildFeatures(planId: PlanId): Omit<PlanFeatures, 'isLoading' | 'refresh'> {
  const plan = getPlan(planId) ?? PLANS[0];
  switch (planId) {
    case 'pro':
      return { plan, planId, ...PAID_FEATURES, isLifetime: false, vaultLimit: plan.vaultLimit };
    case 'family':
      return { plan, planId, ...PAID_FEATURES, isLifetime: false, familySharingEnabled: true, vaultLimit: plan.vaultLimit };
    case 'lifetime':
      return { plan, planId, ...PAID_FEATURES, isLifetime: true, vaultLimit: plan.vaultLimit };
    case 'pro_family_member':
      return { plan, planId, ...PAID_FEATURES, isLifetime: false, familySharingEnabled: false, vaultLimit: plan.vaultLimit };
    default:
      return { plan, planId, ...FREE_FEATURES };
  }
}

/**
 * Fetches the current user's plan from the server, caches it for 5 minutes,
 * and returns a feature set for plan gating.
 *
 * Usage:
 *   const { vaultLimit, cloudSyncEnabled, isPaid } = usePlanFeatures();
 */
export function usePlanFeatures(): PlanFeatures {
  // Initialize from planService so the very first render is correct even before
  // the network fetch completes — this is what eliminates the "free flash" for
  // paid users on app reload. We NEVER set planId from network/cache results
  // directly; the only source of truth is planService.tier, mirrored via the
  // subscription below. That way the planService demotion-guard becomes the
  // single point that decides whether a tier change reaches the UI.
  const [planId, setPlanId] = useState<PlanId>(() => {
    const tier = planService.tier;
    return (['free', 'pro', 'family', 'lifetime', 'pro_family_member'].includes(tier)
      ? tier as PlanId
      : 'free');
  });
  const [isLoading, setIsLoading] = useState(true);

  // Re-render when planService changes from any other code path (license-context
  // sync, logout, server response). This is the ONLY place planId gets updated
  // from inside the hook — fetchPlan never calls setPlanId directly.
  useEffect(() => planService.subscribe(() => {
    const tier = planService.tier;
    const next: PlanId = (['free', 'pro', 'family', 'lifetime', 'pro_family_member'].includes(tier)
      ? tier as PlanId
      : 'free');
    setPlanId(next);
  }), []);

  const fetchPlan = useCallback(async () => {
    const email = getAccountSessionEmail();
    if (!email) {
      setIsLoading(false);
      return;
    }

    // Use cache if fresh. Push through planService so the demotion guard
    // applies — a stale cache row saying 'free' for a known-paid user is
    // rejected (cache is non-authoritative).
    const cached = getCachedPlan(email);
    if (cached) {
      planService.setTier(cached, { reason: 'plan-cache-fresh' });
      setIsLoading(false);
      return;
    }

    try {
      // QA-R2 C2: server now requires Bearer auth on /api/crm/entitlement/:id
      // (own row only, or ADMIN_API_KEY).
      const cloudToken = localStorage.getItem('iv_cloud_token');
      if (!cloudToken) {
        // P0 FIX: don't lock in 'free' silently — keep isLoading=true so the
        // gating UI shows a loading state, and re-attempt when the token
        // becomes available (the storage listener below picks it up the
        // moment auth-context calls storeCloudToken).
        return;
      }
      const resp = await fetch(`${apiBase()}/api/crm/entitlement/${encodeURIComponent(email)}`, {
        headers: { 'Authorization': `Bearer ${cloudToken}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const serverPlan = (data.plan as PlanId) ?? 'free';
        const validPlan: PlanId = ['free', 'pro', 'family', 'lifetime', 'pro_family_member'].includes(serverPlan)
          ? serverPlan as PlanId
          : 'free';
        savePlanCache(email, validPlan);
        // Server entitlement IS authoritative — this endpoint is the explicit
        // source of truth the user described. Allowed to demote.
        planService.setTier(validPlan, { authoritative: true, reason: 'server-entitlement-fetch' });
      }
    } catch {
      // Network error — fall back to cache or free
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
    // P0 FIX: re-run fetchPlan when the cloud token appears in localStorage.
    // Storage events don't fire in the same tab that wrote the value, so we
    // also poll with a short backoff for ~5s right after mount — covers the
    // common "auth-context just stored the token, plan-features mounted
    // before that landed" race.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'iv_cloud_token' && e.newValue) fetchPlan();
    };
    window.addEventListener('storage', onStorage);
    let attempts = 0;
    const tick = setInterval(() => {
      attempts++;
      if (attempts > 5) { clearInterval(tick); return; }
      if (localStorage.getItem('iv_cloud_token')) {
        clearInterval(tick);
        fetchPlan();
      }
    }, 1000);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(tick);
    };
  }, [fetchPlan]);

  const features = buildFeatures(planId);
  return { ...features, isLoading, refresh: fetchPlan };
}
