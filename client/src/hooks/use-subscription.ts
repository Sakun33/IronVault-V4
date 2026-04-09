import { useLicense } from '@/contexts/license-context';

export type PlanType = 'free' | 'pro' | 'family';

interface PlanLimits {
  passwords: number;
  notes: number;
  subscriptions: boolean;
  expenses: boolean;
  bankStatements: boolean;
  investments: boolean;
  documents: boolean;
  apiKeys: boolean;
  reminders: number;
}

const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    passwords: 50,
    notes: 5,
    subscriptions: false,
    expenses: false,
    bankStatements: false,
    investments: false,
    documents: false,
    apiKeys: false,
    reminders: 10,
  },
  pro: {
    passwords: Infinity,
    notes: Infinity,
    subscriptions: true,
    expenses: true,
    bankStatements: true,
    investments: true,
    documents: true,
    apiKeys: true,
    reminders: Infinity,
  },
  family: {
    passwords: Infinity,
    notes: Infinity,
    subscriptions: true,
    expenses: true,
    bankStatements: true,
    investments: true,
    documents: true,
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
    monthly: 'pro',
    yearly: 'pro',
  };

  const currentPlan: PlanType = tierMap[license.tier] || 'free';
  const limits = PLAN_LIMITS[currentPlan];

  return {
    currentPlan,
    limits,
    isLoading,
    isFeatureAvailable: (feature: keyof Omit<PlanLimits, 'passwords' | 'notes' | 'reminders'>) => limits[feature] === true,
    getLimit: (type: 'passwords' | 'notes' | 'reminders') => limits[type],
    isPro: currentPlan === 'pro' || currentPlan === 'family',
  };
}
