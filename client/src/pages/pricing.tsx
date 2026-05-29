import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Users, Shield, Infinity as InfinityIcon } from 'lucide-react';
import { useLicense } from '@/contexts/license-context';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { PLANS, planPriceLabel, type PlanId } from '@/lib/plans';
import { apiBase } from '@/native/platform';

declare global {
  interface Window { Razorpay: any; }
}

const RAZORPAY_PLAN_CODES: Partial<Record<PlanId, string>> = {
  pro: 'pro_monthly',
  family: 'pro_family',
  lifetime: 'lifetime',
};

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.Razorpay !== 'undefined') { resolve(); return; }
    const timeout = setTimeout(() => reject(new Error('Razorpay load timeout')), 10000);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => { clearTimeout(timeout); resolve(); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Razorpay failed to load')); };
    document.head.appendChild(script);
  });
}

// Only the self-serve plans (free/pro/family/lifetime) render on this page.
// team/business/pro_family_member are filtered out before reaching the .map
// below — see the filter in the render. Using `Partial` here lets the type
// system reflect that and prevents the lookup from being assumed total.
const PLAN_ICONS: Partial<Record<PlanId, typeof Crown>> = {
  free: Shield,
  pro: Zap,
  family: Users,
  lifetime: InfinityIcon,
};

const PLAN_ICON_COLORS: Partial<Record<PlanId, string>> = {
  free: 'text-muted-foreground',
  pro: 'text-primary',
  family: 'text-purple-600',
  lifetime: 'text-amber-500',
};

const PLAN_ICON_BG: Partial<Record<PlanId, string>> = {
  free: 'bg-muted',
  pro: 'bg-primary/10',
  family: 'bg-purple-100 dark:bg-purple-900/30',
  lifetime: 'bg-amber-100 dark:bg-amber-900/30',
};

export default function PricingPage() {
  const { license, changePlan, isLoading } = useLicense();
  const { toast } = useToast();
  const { accountEmail } = useAuth();

  const currentTier = license.tier;

  const handleSelectPlan = async (id: PlanId) => {
    if (id === currentTier) return;

    const razorpayPlan = RAZORPAY_PLAN_CODES[id];
    if (id !== 'free' && razorpayPlan) {
      try {
        await loadRazorpay();
        // /api/payments/create-order requires Bearer auth (cloud JWT). Without
        // it the server 401s and the user sees a generic checkout failure.
        const cloudToken = localStorage.getItem('iv_cloud_token');
        if (!cloudToken) {
          toast({ title: 'Sign in again', description: 'Please sign out and back in to upgrade.', variant: 'destructive' });
          return;
        }
        const res = await fetch(`${apiBase()}/api/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cloudToken}` },
          body: JSON.stringify({ plan: razorpayPlan, email: accountEmail }),
        });
        if (!res.ok) {
          let errMsg = `Order creation failed (HTTP ${res.status})`;
          try {
            const errBody = await res.json();
            if (errBody?.error) errMsg = errBody.error;
          } catch {}
          console.error('[Razorpay] create-order failed:', res.status, errMsg);
          throw new Error(errMsg);
        }
        const orderData = await res.json();
        const { orderId, amount, currency, keyId } = orderData;
        if (!orderId || !amount || !currency || !keyId) {
          console.error('[Razorpay] malformed order response:', orderData);
          throw new Error('Order response missing required fields');
        }

        const planName = PLANS.find(p => p.id === id)?.name || id;
        const options = {
          key: keyId,
          amount,
          currency,
          name: 'IronVault',
          description: `IronVault ${planName} Plan`,
          order_id: orderId,
          handler: async (response: any) => {
            const verifyRes = await fetch(`${apiBase()}/api/payments/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cloudToken}` },
              body: JSON.stringify({ ...response, plan: razorpayPlan, email: accountEmail }),
            });
            const result = await verifyRes.json();
            if (result.success) {
              toast({ title: `Upgraded to ${planName}!`, description: 'All features unlocked. Refreshing…' });
              setTimeout(() => window.location.reload(), 1500);
            } else {
              toast({ title: 'Payment verification failed', description: 'Contact support if amount was deducted.', variant: 'destructive' });
            }
          },
          modal: {
            ondismiss: () => {
              console.log('[Razorpay] checkout dismissed by user');
            },
          },
          prefill: { email: accountEmail || '' },
          theme: { color: '#4f46e5' },
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', (resp: any) => {
          console.error('[Razorpay] payment.failed:', resp?.error);
          toast({
            title: 'Payment failed',
            description: resp?.error?.description || 'Please try again or use a different method.',
            variant: 'destructive',
          });
        });
        rzp.open();
      } catch (err: any) {
        const msg = err?.message || 'Please try again.';
        console.error('[Razorpay] checkout error:', msg);
        toast({ title: 'Failed to initiate payment', description: msg, variant: 'destructive' });
      }
      return;
    }

    try {
      // changePlan's signature is the narrower self-serve plan union; the
      // filter on the render path ensures `id` is one of these in practice.
      await changePlan(id as 'free' | 'pro' | 'family' | 'lifetime');
      const planName = PLANS.find(p => p.id === id)?.name || id;
      if (id === 'free') {
        toast({ title: 'Downgraded to Free', description: 'You are now on the Free plan.' });
      } else {
        toast({ title: `Upgraded to ${planName}!`, description: 'All features unlocked.' });
      }
    } catch {
      toast({ title: 'Failed to change plan', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const getButtonProps = (planId: PlanId) => {
    const tierOrder: PlanId[] = ['free', 'pro', 'family', 'lifetime'];
    const currentIdx = tierOrder.indexOf(currentTier as PlanId);
    const planIdx = tierOrder.indexOf(planId);
    const plan = PLANS.find(p => p.id === planId)!;

    if (!plan.available) {
      return { label: 'Coming Soon', disabled: true, className: 'bg-muted text-muted-foreground' };
    }
    if (planId === currentTier || (currentTier === 'lifetime' && planId === 'pro')) {
      return { label: 'Current Plan', disabled: true, className: 'bg-muted text-muted-foreground' };
    }
    if (planIdx < currentIdx) {
      return { label: 'Downgrade', disabled: false, className: 'bg-muted/50 text-foreground hover:bg-muted' };
    }
    return { label: `Upgrade to ${plan.name}`, disabled: false, className: 'bg-primary text-primary-foreground hover:bg-primary/90' };
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">Simple pricing. Upgrade when you need more.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-5xl mx-auto">
        {PLANS.filter(plan => {
          // Only render plans we have icon styling for — team/business are
          // sales-led plans shown on the marketing pricing page, not the
          // self-serve upgrade flow. Without this guard, PLAN_ICONS[plan.id]
          // is undefined and React crashes on `<undefined />`.
          if (!(plan.id in PLAN_ICONS)) return false;
          // Hide internal/invitee-only plan from public pricing.
          if (plan.id === 'pro_family_member') return false;
          // If the user is already on Lifetime, hide Family — it's a sideways
          // (different feature shape) rather than an upgrade and showing it as
          // a "Downgrade" button is just confusing. Family users see the rest
          // of the cards but their Family card renders as Current via isCurrent.
          if (currentTier === 'lifetime' && plan.id === 'family') return false;
          // If the user is already on Family, hide Lifetime as a "downgrade".
          // (Lifetime is single-seat; Family seats remain a step up.)
          // Keep all other plans visible.
          return true;
        }).map((plan) => {
          // Filter guarantees `plan.id` is one of the keys in PLAN_ICONS, so
          // the icon/colors/bg lookups below are non-null.
          const Icon = PLAN_ICONS[plan.id]!;
          const btn = getButtonProps(plan.id);
          const isCurrent = plan.id === currentTier;
          return (
            <Card
              key={plan.id}
              className={`relative rounded-2xl border-border/50 ${
                plan.id === 'pro' ? 'ring-2 ring-primary' : ''
              } ${isCurrent ? 'ring-2 ring-green-500' : ''}`}
            >
              {(plan.badge || isCurrent) && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className={isCurrent ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}>
                    {isCurrent ? 'Current' : plan.badge}
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-4 pt-8">
                <div className={`w-14 h-14 mx-auto rounded-full ${PLAN_ICON_BG[plan.id]} flex items-center justify-center mb-3`}>
                  <Icon className={`w-7 h-7 ${PLAN_ICON_COLORS[plan.id]}`} />
                </div>
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-foreground">{planPriceLabel(plan)}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  disabled={btn.disabled}
                  className={`w-full rounded-xl ${btn.className}`}
                  onClick={() => handleSelectPlan(plan.id)}
                  data-testid={`button-choose-${plan.id}`}
                >
                  {isLoading && !btn.disabled ? 'Choose Plan' : btn.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        All prices in Indian Rupees (INR). Pro Family launches Q3 2026. Secure payments via Razorpay.
      </p>
    </div>
  );
}
