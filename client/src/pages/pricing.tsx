import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Zap, Building2, Clock, Bell } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PricingService, PricingTier } from '@/lib/pricing';
import { useCurrency } from '@/contexts/currency-context';
import { useToast } from '@/hooks/use-toast';

export default function PricingPage() {
  const { toast } = useToast();
  const { currency } = useCurrency();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [selectedTier, setSelectedTier] = useState<string>('free');
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [comingSoonPlan, setComingSoonPlan] = useState<string>('');

  // Get pricing tiers for the current currency
  const pricingTiers = PricingService.getTiersForCurrency(currency);

  const handleSelectPlan = (tier: PricingTier) => {
    if (tier.id === 'free') {
      setSelectedTier(tier.id);
      toast({
        title: "Free Plan Active",
        description: "You're on the Free plan. Enjoy IronVault!",
      });
    } else {
      // Show Coming Soon popup for paid plans
      setComingSoonPlan(tier.name);
      setShowComingSoon(true);
    }
  };

  const handleUpgrade = (tier: PricingTier) => {
    if (tier.id === 'free') return;
    setComingSoonPlan(tier.name);
    setShowComingSoon(true);
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return <Crown className="w-6 h-6" />;
      case 'pro':
        return <Zap className="w-6 h-6" />;
      case 'lifetime':
        return <Building2 className="w-6 h-6" />;
      default:
        return <Crown className="w-6 h-6" />;
    }
  };

  const getTierColor = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return 'text-muted-foreground';
      case 'pro':
        return 'text-primary';
      case 'enterprise':
        return 'text-purple-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTierBgColor = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return 'bg-muted';
      case 'pro':
        return 'bg-primary/10';
      case 'enterprise':
        return 'bg-purple-100 dark:bg-purple-900';
      default:
        return 'bg-muted';
    }
  };

  return (
    <div>
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            IronVault offers flexible pricing to fit your needs
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={`text-sm font-medium ${billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                billingCycle === 'yearly' ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-primary-foreground transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Yearly
            </span>
            {billingCycle === 'yearly' && (
              <Badge variant="secondary" className="ml-2">
                Save up to 20%
              </Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingTiers.map((tier) => {
            const price = billingCycle === 'yearly' ? tier.price.yearly : tier.price.monthly;
            const monthlyEquivalent = billingCycle === 'yearly' ? tier.price.yearly / 12 : tier.price.monthly;
            const savings = billingCycle === 'yearly' ? PricingService.calculateSavings(tier.price.monthly, tier.price.yearly) : 0;

            return (
              <Card
                key={tier.id}
                className={`relative rounded-2xl shadow-lg border-0 transition-all duration-200 hover:shadow-xl ${
                  tier.popular ? 'ring-2 ring-blue-500 scale-105' : ''
                } ${selectedTier === tier.id ? 'ring-2 ring-green-500' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4">
                  <div className={`w-16 h-16 mx-auto rounded-full ${getTierBgColor(tier.id)} flex items-center justify-center mb-4`}>
                    <div className={getTierColor(tier.id)}>
                      {getTierIcon(tier.id)}
                    </div>
                  </div>
                  
                  <CardTitle className="text-2xl font-bold text-foreground">
                    {tier.name}
                  </CardTitle>
                  
                  <p className="text-muted-foreground text-sm">
                    {tier.description}
                  </p>

                  <div className="mt-4">
                    <div className="text-4xl font-bold text-foreground">
                      {PricingService.formatPrice(price, tier.currency)}
                    </div>
                    {billingCycle === 'yearly' && (
                      <div className="text-sm text-muted-foreground">
                        {PricingService.formatPrice(monthlyEquivalent, tier.currency)}/month
                      </div>
                    )}
                    {savings > 0 && (
                      <div className="text-sm text-green-600 font-medium">
                        Save {savings}%
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-foreground text-sm">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(tier)}
                    className={`w-full rounded-xl py-3 font-medium transition-all duration-200 ${
                      tier.id === 'free'
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                        : 'bg-muted hover:bg-accent text-foreground'
                    }`}
                  >
                    {tier.id === 'free' ? 'Get Started — Free' : (
                      <span className="flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        Coming Soon
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Feature Comparison */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-8">
            Feature Comparison
          </h2>
          
          <div className="bg-card rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-foreground">
                      Features
                    </th>
                      {pricingTiers.map((tier) => (
                      <th key={tier.id} className="px-6 py-4 text-center text-sm font-medium text-foreground">
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {PricingService.getFeatureComparison(currency).map((row, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 text-sm font-medium text-foreground">
                        {row.feature}
                      </td>
                      {pricingTiers.map((tier) => (
                        <td key={tier.id} className="px-6 py-4 text-center text-sm text-muted-foreground">
                          {typeof row.tiers[tier.id] === 'boolean' ? (
                            row.tiers[tier.id] ? (
                              <Check className="w-5 h-5 text-green-500 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-red-500 mx-auto" />
                            )
                          ) : (
                            row.tiers[tier.id]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="rounded-2xl shadow-sm border-0 bg-card">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Can I change my plan anytime?
                </h3>
                <p className="text-muted-foreground">
                  Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any billing differences.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-0 bg-card">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-muted-foreground">
                  Yes! All paid plans come with a 14-day free trial. No credit card required to start.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border-0 bg-card">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-muted-foreground">
                  We accept all major credit cards, PayPal, and bank transfers for Enterprise plans.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Coming Soon Dialog */}
        <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center text-2xl font-bold">Coming Soon!</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-4 py-4">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="w-10 h-10 text-primary" />
              </div>
              <p className="text-lg font-medium text-foreground">
                The <span className="text-primary font-bold">{comingSoonPlan}</span> plan is coming soon!
              </p>
              <p className="text-muted-foreground">
                We're working hard to bring you premium features. For now, enjoy the <strong>Free plan</strong> with 50 passwords, 10 subscriptions, 10 notes, and more.
              </p>
              <p className="text-sm text-muted-foreground">
                Stay tuned for updates — we'll notify you when paid plans launch!
              </p>
              <Button
                onClick={() => setShowComingSoon(false)}
                className="w-full rounded-xl py-3 mt-4"
              >
                Got it!
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
