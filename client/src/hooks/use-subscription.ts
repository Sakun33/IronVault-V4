import { useLicense } from '@/contexts/license-context';

export type PlanType = 'free' | 'pro' | 'family';

/** Read the plan id written by usePlanFeatures from the CRM /entitlement
 *  endpoint. Used as a secondary source so feature gating still works
 *  when license-context's syncFromServer hasn't completed yet — common
 *  on native, where the cloud token lands a beat after the page mounts. */
function readPlanCache(): 'free' | 'pro' | 'family' | 'lifetime' | 'pro_family_member' | null {
  try {
    const raw = localStorage.getItem('iv_plan_cache');
    if (!raw) return null;
    const cache = JSON.parse(raw) as { planId?: string };
    const id = cache?.planId;
    if (id === 'free' || id === 'pro' || id === 'family' || id === 'lifetime' || id === 'pro_family_member') return id;
    return null;
  } catch {
    return null;
  }
}

interface PlanLimits {
  passwords: number;
  notes: number;
  subscriptions: boolean;
  subscriptionLimit: number;  // max subscriptions; Infinity = unlimited
  expenses: boolean;
  bankStatements: boolean;
  investments: boolean;
  documents: boolean;
  documentLimit: number;      // max documents; Infinity = unlimited
  apiKeys: boolean;
  reminders: number;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    passwords: 50,
    notes: 10,         // SRS: Free = 10 notes
    subscriptions: true,
    subscriptionLimit: 10, // SRS: Free = 10 subscriptions
    expenses: false,
    bankStatements: false,
    investments: false,
    documents: true,
    documentLimit: 5,  // SRS: Free = 5 documents
    apiKeys: false,
    reminders: 10,
  },
  pro: {
    passwords: Infinity,
    notes: Infinity,
    subscriptions: true,
    subscriptionLimit: Infinity,
    expenses: true,
    bankStatements: true,
    investments: true,
    documents: true,
    documentLimit: Infinity,
    apiKeys: true,
    reminders: Infinity,
  },
  family: {
    passwords: Infinity,
    notes: Infinity,
    subscriptions: true,
    subscriptionLimit: Infinity,
    expenses: true,
    bankStatements: true,
    investments: true,
    documents: true,
    documentLimit: Infinity,
    apiKeys: true,
    reminders: Infinity,
  },
};

export function useSubscription() {
  const { license, isLoading } = useLicense();

  // Map license tier to PlanType — pro/family/lifetime all unlock pro-level features
  const tierMap: Record<string, PlanType> = {
    free: 'free',
    pro: 'pro',
    family: 'family',
    lifetime: 'pro',
    pro_family_member: 'pro',
    monthly: 'pro',
    yearly: 'pro',
  };

  // license-context updates from the CRM via syncFromServer, which can lag
  // the initial render on native. Cross-check the iv_plan_cache (written by
  // usePlanFeatures) so a Lifetime user never momentarily sees free-tier
  // gating just because the license blob hasn't been re-persisted yet.
  const cachedPlan = readPlanCache();
  const cachedMapped: PlanType | null = cachedPlan ? (tierMap[cachedPlan] || 'free') : null;
  const licenseMapped: PlanType = tierMap[license.tier] || 'free';
  // Whichever side reports paid status wins. We never demote to free based
  // on the cache — only upgrade.
  const currentPlan: PlanType =
    licenseMapped !== 'free' ? licenseMapped : (cachedMapped && cachedMapped !== 'free' ? cachedMapped : 'free');
  const limits = PLAN_LIMITS[currentPlan];

  return {
    currentPlan,
    limits,
    isLoading,
    isFeatureAvailable: (feature: keyof Omit<PlanLimits, 'passwords' | 'notes' | 'reminders' | 'subscriptionLimit' | 'documentLimit'>) => limits[feature] === true,
    getLimit: (type: 'passwords' | 'notes' | 'reminders' | 'subscriptionLimit' | 'documentLimit') => limits[type] as number,
    isPro: currentPlan === 'pro' || currentPlan === 'family',
  };
}
