import { useLicense } from '@/contexts/license-context';
import { usePlan, planService } from '@/lib/plan-service';

export type PlanType = 'free' | 'pro' | 'family';

interface PlanLimits {
  passwords: number;
  notes: number;
  subscriptions: boolean;
  subscriptionLimit: number;
  expenses: boolean;
  bankStatements: boolean;
  investments: boolean;
  documents: boolean;
  documentLimit: number;
  apiKeys: boolean;
  reminders: number;
}

/**
 * Backwards-compatible plan hook. Internally just reads from `planService` so
 * every consumer sees the same answer no matter which hook they call.
 *
 * The license-context isLoading flag is preserved so existing consumers that
 * gate on it (loading skeletons, etc.) keep working.
 */
export function useSubscription() {
  const { isLoading } = useLicense();
  const plan = usePlan();

  const currentPlan: PlanType =
    plan.tier === 'family' ? 'family' :
    plan.isPaid ? 'pro' :
    'free';

  // Build limits from the central plan-service so the numbers can never drift
  // from the rest of the app.
  const limits: PlanLimits = {
    passwords: plan.getLimit('passwords'),
    notes: plan.getLimit('notes'),
    subscriptions: true,
    subscriptionLimit: plan.getLimit('subscriptions'),
    expenses: plan.isPaid,
    bankStatements: plan.isPaid,
    investments: plan.isPaid,
    documents: true,
    documentLimit: plan.getLimit('documents'),
    apiKeys: plan.isPaid,
    reminders: plan.getLimit('reminders'),
  };

  return {
    currentPlan,
    limits,
    isLoading,
    isFeatureAvailable: (feature: keyof Omit<PlanLimits, 'passwords' | 'notes' | 'reminders' | 'subscriptionLimit' | 'documentLimit'>) => limits[feature] === true,
    getLimit: (type: 'passwords' | 'notes' | 'reminders' | 'subscriptionLimit' | 'documentLimit') => {
      if (type === 'subscriptionLimit') return planService.getLimit('subscriptions');
      if (type === 'documentLimit') return planService.getLimit('documents');
      return planService.getLimit(type);
    },
    isPro: plan.isPaid,
  };
}
