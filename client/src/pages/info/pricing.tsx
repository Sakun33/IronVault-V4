import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InfoLayout } from '@/components/info-layout';
import { Check, X, Shield, Crown, Rocket } from 'lucide-react';
import { useCurrency } from '@/contexts/currency-context';
import { useMemo } from 'react';

export default function PricingPage() {
  const { currency, setCurrency, currencies, convertCurrency } = useCurrency();

  // Base prices in INR (as requested)
  const basePricesINR = {
    free: 0,
    monthly: 199,
    yearly: 1999,
  };

  // Helper function to format price with proper rounding
  const formatPrice = (amountINR: number) => {
    // Convert from INR to selected currency
    const converted = convertCurrency(amountINR, 'INR', currency);
    const rounded = Math.round(converted);
    const symbol = currencies.find(c => c.code === currency)?.symbol || '₹';
    
    if (rounded === 0) {
      return `${symbol}0`;
    }
    
    return `${symbol}${rounded.toLocaleString()}`;
  };

  // Recalculate prices when currency changes
  const plans = useMemo(() => {
    return [
      {
        name: "Free",
        icon: Shield,
        monthlyPrice: formatPrice(basePricesINR.free),
        yearlyPrice: formatPrice(basePricesINR.free),
        description: "Perfect for personal use with essential features",
        color: "blue",
        features: [
          { name: "Unlimited Passwords", included: true },
          { name: "Unlimited Subscriptions", included: true },
          { name: "Unlimited Notes", included: true },
          { name: "Basic Expense Tracking", included: true },
          { name: "Basic Reminders", included: true },
          { name: "AES-256 Encryption", included: true },
          { name: "Offline-First", included: true },
          { name: "Import/Export", included: true },
          { name: "Dark/Light Mode", included: true },
          { name: "Browser Extension", included: true },
          { name: "Advanced Bank Analysis", included: false },
          { name: "Investment Portfolio", included: false },
          { name: "Document Management", included: false },
          { name: "API Keys Vault", included: false },
          { name: "Cloud Sync", included: false },
          { name: "Priority Support", included: false },
        ]
      },
      {
        name: "Pro",
        icon: Crown,
        monthlyPrice: formatPrice(basePricesINR.monthly),
        yearlyPrice: formatPrice(basePricesINR.yearly),
        description: "Unlock all features for power users",
        color: "purple",
        popular: true,
        features: [
          { name: "Everything in Free", included: true },
          { name: "Advanced Bank Statement Analysis", included: true },
          { name: "Investment Portfolio Tracking", included: true },
          { name: "Document Management (Encrypted)", included: true },
          { name: "API Keys Vault", included: true },
          { name: "Unlimited Document Storage", included: true },
          { name: "Advanced Analytics", included: true },
          { name: "Custom Categories", included: true },
          { name: "Rich Text Editor", included: true },
          { name: "Goal Tracking", included: true },
          { name: "Cloud Sync (Encrypted)", included: true },
          { name: "Priority Email Support", included: true },
          { name: "Early Access to Features", included: true },
        ]
      },
      {
        name: "Enterprise",
        icon: Rocket,
        monthlyPrice: "Custom",
        yearlyPrice: "Custom",
        description: "For teams and organizations",
        color: "orange",
        features: [
          { name: "Everything in Pro", included: true },
          { name: "Team Management", included: true },
          { name: "Shared Vaults", included: true },
          { name: "Admin Console", included: true },
          { name: "SSO Integration", included: true },
          { name: "Advanced Security Controls", included: true },
          { name: "Audit Logs", included: true },
          { name: "Custom Retention Policies", included: true },
          { name: "Dedicated Support", included: true },
          { name: "Custom Integrations", included: true },
          { name: "SLA Guarantee", included: true },
          { name: "On-Premise Deployment (Optional)", included: true },
        ]
      }
    ];
  }, [currency, formatPrice]);

  const getColorClasses = (color: string, popular?: boolean) => {
    if (popular) {
      return {
        border: "border-purple-500 dark:border-purple-400",
        bg: "bg-purple-50 dark:bg-purple-950",
        iconBg: "bg-purple-600",
        badge: "bg-purple-600",
        button: "bg-purple-600 hover:bg-purple-700",
      };
    }
    const colors: { [key: string]: any } = {
      blue: {
        border: "border-border",
        bg: "bg-card",
        iconBg: "bg-primary",
        button: "bg-primary hover:bg-primary/90",
      },
      orange: {
        border: "border-border",
        bg: "bg-card",
        iconBg: "bg-orange-600",
        button: "bg-orange-600 hover:bg-orange-700",
      },
    };
    return colors[color] || colors.blue;
  };

  return (
    <InfoLayout title="Pricing">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-foreground">
            Simple, Transparent Pricing
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Choose the plan that's right for you. All plans include offline-first architecture 
            and military-grade encryption.
          </p>
          
          {/* Currency Selector */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="text-sm text-muted-foreground">Currency:</span>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.code} ({curr.symbol})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pricing Note */}
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  Simple, Transparent Pricing
                </h3>
                <p className="text-xs text-muted-foreground italic">
                  * Prices shown are estimates and will be converted to your local currency at market exchange rates when payment is processed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, idx) => {
            const colors = getColorClasses(plan.color, plan.popular);
            const Icon = plan.icon;
            
            return (
              <Card key={idx} className={`relative ${colors.border} ${colors.bg}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className={`${colors.badge} text-primary-foreground text-xs font-bold px-3 py-1 rounded-full`}>
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 ${colors.iconBg} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                    </div>
                  </div>
                  
                  {/* Pricing Options */}
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Monthly</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">
                          {plan.monthlyPrice}
                        </span>
                        {plan.monthlyPrice !== "Custom" && plan.monthlyPrice !== formatPrice(0) && (
                          <span className="text-muted-foreground text-sm">/ month</span>
                        )}
                        {plan.monthlyPrice === formatPrice(0) && (
                          <span className="text-muted-foreground text-sm">forever</span>
                        )}
                      </div>
                    </div>
                    
                    {plan.yearlyPrice !== "Custom" && plan.yearlyPrice !== formatPrice(0) && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-1">Yearly</div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-foreground">
                            {plan.yearlyPrice}
                          </span>
                          <span className="text-muted-foreground text-sm">/ year</span>
                          <span className="text-primary text-xs font-semibold ml-2">
                            Save 17%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-3">
                    {plan.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <Button 
                    className={`w-full mb-6 ${colors.button} text-primary-foreground`}
                    size="lg"
                  >
                    {plan.name === "Enterprise" ? "Contact Sales" : plan.name === "Pro" ? "Upgrade to Pro" : "Get Started Free"}
                  </Button>
                  
                  <div className="space-y-3">
                    {plan.features.map((feature, featureIdx) => (
                      <div key={featureIdx} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${feature.included ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold text-foreground mb-2">
                When will pricing take effect?
              </h4>
              <p className="text-sm text-muted-foreground">
                Pricing details are displayed in the app before any purchase. Early adopters receive special pricing benefits.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">
                How many devices can I use?
              </h4>
              <p className="text-sm text-muted-foreground">
                Pricing is per device. You can use IronVault on multiple devices, and each device requires a separate subscription. 
                However, you can export/import your vault data between devices for free.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">
                Can I upgrade or downgrade my plan?
              </h4>
              <p className="text-sm text-muted-foreground">
                Yes, you'll be able to upgrade or downgrade your plan at any time once paid plans are available. 
                Changes will be prorated based on your billing cycle.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">
                What happens to my data if I downgrade?
              </h4>
              <p className="text-sm text-muted-foreground">
                Your data remains yours. If you downgrade from Pro to Free, you'll retain read-only access to 
                Pro features (like documents and investments) but won't be able to add new items. You can always 
                export your complete data.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">
                Is there a refund policy?
              </h4>
              <p className="text-sm text-muted-foreground">
                Yes, we'll offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, 
                contact us within 30 days for a full refund.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-2">
                What payment methods do you accept?
              </h4>
              <p className="text-sm text-muted-foreground">
                We'll accept all major credit cards, debit cards, and PayPal. Enterprise customers can arrange 
                for invoicing.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Enterprise CTA */}
        <Card className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950 dark:to-red-950 border-orange-200 dark:border-orange-800">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold text-foreground">
                Need Enterprise Solutions?
              </h3>
              <p className="text-foreground max-w-2xl mx-auto">
                Get in touch with our team to discuss custom requirements, volume pricing, 
                and dedicated support for your organization.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a href="/contact">
                  <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white">
                    Contact Sales
                  </Button>
                </a>
                <a href="/docs">
                  <Button size="lg" variant="outline">
                    View Documentation
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </InfoLayout>
  );
}
