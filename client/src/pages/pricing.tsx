import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Users, Shield, Infinity as InfinityIcon } from 'lucide-react';
import { useLicense } from '@/contexts/license-context';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { PLANS, planPriceLabel, type PlanId } from '@/lib/plans';

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

const PLAN_ICONS: Record<PlanId, typeof Crown> = {
  free: Shield,
  pro: Zap,
  family: Users,
  lifetime: InfinityIcon,
};

const PLAN_ICON_COLORS: Record<PlanId, string> = {
  free: 'text-muted-foreground',
  pro: 'text-primary',
  family: 'text-purple-600',
  lifetime: 'text-amber-500',
};

const PLAN_ICON_BG: Record<PlanId, string> = {
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
        const res = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: razorpayPlan, email: accountEmail }),
        });
        if (!res.ok) throw new Error('Failed to create order');
        const { orderId, amount, currency, keyId } = await res.json();

        const planName = PLANS.find(p => p.id === id)?.name || id;
        const options = {
          key: keyId,
          amount,
          currency,
          name: 'IronVault',
          description: `IronVault ${planName} Plan`,
          order_id: orderId,
          handler: async (response: any) => {
            const verifyRes = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
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
          prefill: { email: accountEmail || '' },
          theme: { color: '#4f46e5' },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch {
        toast({ title: 'Failed to initiate payment', description: 'Please try again.', variant: 'destructive' });
      }
      return;
    }

    try {
      await changePlan(id);
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
        {PLANS.map((plan) => {
          const Icon = PLAN_ICONS[plan.id];
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
                  disabled={btn.disabled || isLoading}
                  className={`w-full rounded-xl ${btn.className}`}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {btn.label}
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
