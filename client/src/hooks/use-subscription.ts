import { useLicense } from '@/contexts/license-context';

export type PlanType = 'free' | 'pro' | 'family';

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
    monthly: 'pro',
    yearly: 'pro',
  };

  const currentPlan: PlanType = tierMap[license.tier] || 'free';
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
