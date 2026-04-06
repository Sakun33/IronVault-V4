import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Zap, Users, Shield } from 'lucide-react';
import { useLicense } from '@/contexts/license-context';
import { useToast } from '@/hooks/use-toast';

type PlanTier = 'free' | 'pro' | 'family' | 'lifetime';

const plans: {
  id: PlanTier;
  name: string;
  price: string | null;
  priceLabel: string;
  description: string;
  icon: typeof Crown;
  iconColor: string;
  iconBg: string;
  badge: string | null;
  features: string[];
}[] = [
  {
    id: 'free',
    name: 'Free',
    price: null,
    priceLabel: 'Free',
    description: 'Basic essentials',
    icon: Shield,
    iconColor: 'text-muted-foreground',
    iconBg: 'bg-muted',
    badge: null,
    features: [
      'Up to 50 passwords',
      'Up to 5 secure notes',
      '10 reminders',
      '1 device',
      'End-to-end encryption',
      'Password generator',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹149',
    priceLabel: '₹149/mo',
    description: 'For power users',
    icon: Zap,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    badge: 'Most Popular',
    features: [
      'Unlimited passwords',
      'Unlimited notes',
      'Unlimited reminders',
      'Subscriptions tracker',
      'Expense tracking',
      'Bank statements',
      'Investments & goals',
      'Documents vault',
      'API key manager',
      'Unlimited devices',
    ],
  },
  {
    id: 'family',
    name: 'Family',
    price: '₹299',
    priceLabel: '₹299/mo',
    description: 'For the whole family',
    icon: Users,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    badge: null,
    features: [
      'Everything in Pro',
      'Up to 6 members',
      'Shared vaults',
      'Family dashboard',
      'Individual accounts',
      'Priority support',
    ],
  },
];

export default function PricingPage() {
  const { license, changePlan, isLoading } = useLicense();
  const { toast } = useToast();

  const currentTier = license.tier;

  const handleSelectPlan = async (tier: PlanTier) => {
    if (tier === currentTier) return;

    try {
      await changePlan(tier);
      const planName = plans.find(p => p.id === tier)?.name || tier;
      if (tier === 'free') {
        toast({ title: 'Downgraded to Free', description: 'You are now on the Free plan.' });
      } else {
        toast({ title: `Upgraded to ${planName}!`, description: 'All features unlocked.' });
      }
    } catch {
      toast({ title: 'Failed to change plan', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const getButtonProps = (planId: PlanTier) => {
    const tierOrder: PlanTier[] = ['free', 'pro', 'family', 'lifetime'];
    const currentIdx = tierOrder.indexOf(currentTier as PlanTier);
    const planIdx = tierOrder.indexOf(planId);

    if (planId === currentTier || (currentTier === 'lifetime' && planId === 'pro')) {
      return { label: 'Current Plan', disabled: true, className: 'bg-muted text-muted-foreground' };
    }
    if (planIdx < currentIdx) {
      return { label: 'Downgrade', disabled: false, className: 'bg-muted/50 text-foreground hover:bg-muted' };
    }
    return { label: `Upgrade to ${plans.find(p => p.id === planId)?.name}`, disabled: false, className: 'bg-primary text-primary-foreground hover:bg-primary/90' };
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Choose Your Plan</h1>
        <p className="text-muted-foreground">Simple pricing. Upgrade when you need more.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const Icon = plan.icon;
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
                <div className={`w-14 h-14 mx-auto rounded-full ${plan.iconBg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-7 h-7 ${plan.iconColor}`} />
                </div>
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="mt-3">
                  <span className="text-3xl font-bold text-foreground">{plan.priceLabel}</span>
                  {plan.price && (
                    <span className="text-sm text-muted-foreground ml-1">· billed monthly</span>
                  )}
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
        Plans activate instantly. Billing via Stripe/RevenueCat coming soon.
      </p>
    </div>
  );
}
