import { useState, useEffect, useCallback } from 'react';
import { getPlan, PLANS, type Plan, type PlanId } from '@/lib/plans';
import { getAccountSessionEmail } from '@/lib/account-auth';

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
  const cache: PlanCache = {
    email: email.toLowerCase().trim(),
    planId,
    fetchedAt: Date.now(),
  };
  localStorage.setItem(PLAN_CACHE_KEY, JSON.stringify(cache));
}

export function clearPlanCache(): void {
  localStorage.removeItem(PLAN_CACHE_KEY);
}

export interface PlanFeatures {
  plan: Plan;
  planId: PlanId;
  /** Max local vaults for this plan */
  localVaultLimit: number;
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
  /** Loading state while fetching from server */
  isLoading: boolean;
  /** Refetch the plan from the server */
  refresh: () => void;
}

const FREE_FEATURES: Omit<PlanFeatures, 'plan' | 'planId' | 'isLoading' | 'refresh'> = {
  localVaultLimit: 1,
  cloudSyncEnabled: false,
  familySharingEnabled: false,
  bankImportEnabled: false,
  analyticsEnabled: false,
  biometricEnabled: false,
  prioritySupportEnabled: false,
  isPaid: false,
  isLifetime: false,
};

const PAID_FEATURES: Omit<PlanFeatures, 'plan' | 'planId' | 'isLoading' | 'refresh' | 'isLifetime'> = {
  localVaultLimit: 5,
  cloudSyncEnabled: true,
  familySharingEnabled: false,
  bankImportEnabled: true,
  analyticsEnabled: true,
  biometricEnabled: true,
  prioritySupportEnabled: true,
  isPaid: true,
};

function buildFeatures(planId: PlanId): Omit<PlanFeatures, 'isLoading' | 'refresh'> {
  const plan = getPlan(planId) ?? PLANS[0];
  switch (planId) {
    case 'pro':
      return { plan, planId, ...PAID_FEATURES, isLifetime: false, localVaultLimit: plan.localVaultLimit };
    case 'family':
      return { plan, planId, ...PAID_FEATURES, isLifetime: false, familySharingEnabled: true, localVaultLimit: plan.localVaultLimit };
    case 'lifetime':
      return { plan, planId, ...PAID_FEATURES, isLifetime: true, localVaultLimit: plan.localVaultLimit };
    default:
      return { plan, planId, ...FREE_FEATURES };
  }
}

/**
 * Fetches the current user's plan from the server, caches it for 5 minutes,
 * and returns a feature set for plan gating.
 *
 * Usage:
 *   const { localVaultLimit, cloudSyncEnabled, isPaid } = usePlanFeatures();
 */
export function usePlanFeatures(): PlanFeatures {
  const [planId, setPlanId] = useState<PlanId>('free');
  const [isLoading, setIsLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    const email = getAccountSessionEmail();
    if (!email) {
      setIsLoading(false);
      return;
    }

    // Use cache if fresh
    const cached = getCachedPlan(email);
    if (cached) {
      setPlanId(cached);
      setIsLoading(false);
      return;
    }

    try {
      const resp = await fetch(`/api/crm/entitlement/${encodeURIComponent(email)}`);
      if (resp.ok) {
        const data = await resp.json();
        const serverPlan = (data.plan as PlanId) ?? 'free';
        const validPlan: PlanId = ['free', 'pro', 'family', 'lifetime'].includes(serverPlan)
          ? serverPlan
          : 'free';
        setPlanId(validPlan);
        savePlanCache(email, validPlan);
      }
    } catch {
      // Network error — fall back to cache or free
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const features = buildFeatures(planId);
  return { ...features, isLoading, refresh: fetchPlan };
}
