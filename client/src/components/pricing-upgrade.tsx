import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLicense } from '@/contexts/license-context';
import { useToast } from '@/hooks/use-toast';
import { Crown, Shield, RotateCcw, ExternalLink, AlertCircle, RefreshCcw, Check, Clock } from 'lucide-react';
import { useBillingPackages, usePurchase } from '@/billing/useBilling';
import { isNativePlatform, getStoreName, getPlatform } from '@/billing/platform';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  PlanCard,
  PlanSkeleton,
  EntitlementBanner,
  ProCycleToggle,
  SubscriptionTermsAccordion,
  type ProCycle,
} from '@/components/paywall';

interface PricingUpgradeProps {
  isOpen: boolean;
  onClose: () => void;
}

type PaywallState = 'loading' | 'error' | 'ready' | 'purchasing' | 'entitled';
type PlanTier = 'pro' | 'lifetime';

export function PricingUpgrade({ isOpen, onClose }: PricingUpgradeProps) {
  const { license, syncEntitlements, changePlan } = useLicense();
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<ProCycle>('yearly');
  const [selectedTier, setSelectedTier] = useState<PlanTier>('pro');
  const [paywallState, setPaywallState] = useState<PaywallState>('loading');
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  const isNative = isNativePlatform();
  const platform = getPlatform();
  const storeName = getStoreName();
  
  const { 
    packages, 
    loading: packagesLoading, 
    error: packagesError,
    monthlyPackage,
    yearlyPackage,
    lifetimePackage,
    savingsPercent,
    refresh: refreshPackages,
  } = useBillingPackages();

  const { purchasing, purchase, restoring, restore, openManagement } = usePurchase();

  const hasProEntitlement = license.tier === 'pro' || license.tier === 'lifetime';
  const hasLifetimeEntitlement = license.tier === 'lifetime';
  const isSubscription = license.tier === 'pro' && license.billingCycle !== 'lifetime';

  useEffect(() => {
    if (!isOpen) return;

    if (hasProEntitlement) {
      setPaywallState('entitled');
    } else if (packagesLoading) {
      setPaywallState('loading');
      const timer = setTimeout(() => setLoadingTimeout(true), 8000);
      return () => clearTimeout(timer);
    } else if (packagesError) {
      setPaywallState('error');
    } else if (packages.length > 0) {
      setPaywallState('ready');
    }
  }, [isOpen, packagesLoading, packagesError, packages, hasProEntitlement]);

  useEffect(() => {
    if (purchasing) {
      setPaywallState('purchasing');
    } else if (!packagesLoading && !packagesError && packages.length > 0 && !hasProEntitlement) {
      setPaywallState('ready');
    }
  }, [purchasing, packagesLoading, packagesError, packages, hasProEntitlement]);

  const handlePurchase = async (packageIdentifier: string, tierName: string) => {
    if (!isNative) {
      toast({
        title: "Not Available on Web",
        description: "In-app purchases are only available on iOS and Android apps. Please download the mobile app to subscribe.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await purchase(packageIdentifier);

      if (result.success) {
        await syncEntitlements();
        
        toast({
          title: "Purchase Successful!",
          description: `You now have ${tierName} access`,
        });

        onClose();
      } else if (result.error?.userCancelled) {
        toast({
          title: "Purchase Cancelled",
          description: "You can upgrade anytime from Settings",
        });
      } else {
        throw new Error(result.error?.message || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast({
        title: "Purchase Failed",
        description: error instanceof Error ? error.message : "Please try again or contact support",
        variant: "destructive",
      });
    }
  };

  const handleRestore = async () => {
    try {
      const result = await restore();

      if (result.success) {
        await syncEntitlements();
        
        if (result.restoredCount > 0) {
          toast({
            title: "Purchases restored.",
            description: undefined,
          });
        } else {
          toast({
            title: "No purchases found for this account.",
            description: undefined,
          });
        }
      } else {
        throw new Error(result.error?.message || 'Restore failed');
      }
    } catch (error) {
      console.error('Restore error:', error);
      toast({
        title: "Could not restore purchases. Please try again.",
        description: undefined,
        variant: "destructive",
      });
    }
  };

  const handleManageSubscription = async () => {
    const opened = await openManagement();
    if (!opened) {
      toast({
        title: "Unable to Open",
        description: "Could not open subscription management",
        variant: "destructive",
      });
    }
  };

  const handleRetry = () => {
    setLoadingTimeout(false);
    refreshPackages();
  };

  const features = {
    pro: [
      'Unlimited password storage',
      'Secure notes & documents',
      'Cross-device sync',
      'Priority support',
      'Advanced security features',
      'Biometric authentication'
    ],
    lifetime: [
      'All Pro features',
      'Lifetime access',
      'One-time payment',
      'No recurring fees',
      'Priority support forever',
      'All future updates included'
    ]
  };

  const getProPriceLine = () => {
    if (billingCycle === 'monthly' && monthlyPackage) {
      return `${monthlyPackage.product.localizedPriceString}/month`;
    }
    if (billingCycle === 'yearly' && yearlyPackage) {
      return `${yearlyPackage.product.localizedPriceString}/year`;
    }
    return '...';
  };

  const getProPriceSubtext = () => {
    if (billingCycle === 'yearly' && yearlyPackage && monthlyPackage) {
      return `~${monthlyPackage.product.currencyCode} ${(yearlyPackage.product.price / 12).toFixed(2)}/month`;
    }
    return undefined;
  };

  const getLifetimePriceLine = () => {
    if (lifetimePackage) {
      return `${lifetimePackage.product.localizedPriceString} one-time`;
    }
    return '...';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Upgrade Your Plan</DialogTitle>
          <p className="text-muted-foreground">
            Choose the perfect plan for your needs
          </p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Entitled State Banner */}
          {paywallState === 'entitled' && (
            <EntitlementBanner
              mode={hasLifetimeEntitlement ? 'lifetime' : 'pro'}
              showManageButton={isSubscription}
              onManage={handleManageSubscription}
            />
          )}
          {/* Loading State with Skeleton */}
          {paywallState === 'loading' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <RefreshCcw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Fetching pricing for your region…</span>
                </div>
              </div>

              <div className="flex justify-center">
                <div className="h-10 w-64 bg-muted rounded-lg animate-pulse" />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <PlanSkeleton />
                <PlanSkeleton />
              </div>

              {loadingTimeout && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Taking longer than expected. Check your connection.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Error State */}
          {paywallState === 'error' && (
            <div className="space-y-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-semibold">We couldn't load pricing right now.</p>
                  <p className="text-sm mt-1">Check your connection and try again.</p>
                </AlertDescription>
              </Alert>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="why">
                  <AccordionTrigger className="text-sm">Why is this happening?</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    The store may be temporarily unavailable. This usually resolves within a few minutes.
                    If the problem persists, please check your internet connection or try again later.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={handleRetry} variant="default">
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
                {isNative && (
                  <Button onClick={handleRestore} variant="outline" disabled={restoring}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {restoring ? 'Restoring…' : 'Restore Purchases'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Web Platform — Local Plan Activation */}
          {!isNative && !hasProEntitlement && (
            <div className="space-y-4 py-4">
              <p className="text-center text-muted-foreground text-sm">
                Select a plan to activate it. Stripe/RevenueCat billing coming soon.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 border-primary"
                  onClick={async () => {
                    await changePlan('pro');
                    toast({ title: 'Upgraded to Pro!', description: 'All Pro features unlocked.' });
                    onClose();
                  }}
                >
                  <Crown className="w-6 h-6 text-primary" />
                  <span className="font-semibold">Activate Pro</span>
                  <span className="text-xs text-muted-foreground">Unlimited everything</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2 border-purple-500"
                  onClick={async () => {
                    await changePlan('lifetime');
                    toast({ title: 'Lifetime Access Activated!', description: 'All features unlocked forever.' });
                    onClose();
                  }}
                >
                  <Shield className="w-6 h-6 text-purple-500" />
                  <span className="font-semibold">Activate Lifetime</span>
                  <span className="text-xs text-muted-foreground">Pay once, use forever</span>
                </Button>
              </div>
            </div>
          )}

          {/* Billing Toggle for Pro Plan */}
          {(paywallState === 'ready' || paywallState === 'purchasing' || paywallState === 'entitled') && isNative && monthlyPackage && yearlyPackage && (
            <ProCycleToggle
              value={billingCycle}
              onChange={setBillingCycle}
              disabled={paywallState === 'purchasing'}
              savingsPercent={savingsPercent}
            />
          )}

          {/* Plan Cards */}
          {(paywallState === 'ready' || paywallState === 'purchasing' || paywallState === 'entitled') && (
            <div className="grid md:grid-cols-2 gap-6">
              <PlanCard
                title="Pro"
                icon={<Crown className="w-6 h-6 text-primary" />}
                badgeText="POPULAR"
                borderColor="blue"
                priceLine={getProPriceLine()}
                priceSubtext={getProPriceSubtext()}
                subtitle={
                  billingCycle === 'monthly'
                    ? 'Billed monthly. Cancel anytime.'
                    : savingsPercent && savingsPercent >= 5
                    ? 'Billed yearly. Cancel anytime. Best for long-term.'
                    : 'Billed yearly. Cancel anytime.'
                }
                bullets={features.pro}
                ctaText="Upgrade to Pro"
                footerText={isNative ? `Secure purchase via ${storeName}` : 'Available on mobile apps'}
                selected={selectedTier === 'pro'}
                isPurchasing={paywallState === 'purchasing' && selectedTier === 'pro'}
                isCurrentPlan={hasProEntitlement && !hasLifetimeEntitlement}
                disabled={!isNative}
                onSelect={() => {
                  setSelectedTier('pro');
                  const pkg = billingCycle === 'monthly' ? monthlyPackage : yearlyPackage;
                  if (pkg && !hasProEntitlement) handlePurchase(pkg.identifier, 'Pro');
                }}
              />

              <PlanCard
                title="Lifetime"
                icon={<Shield className="w-6 h-6 text-purple-500" />}
                badgeText="BEST VALUE"
                borderColor="purple"
                priceLine={getLifetimePriceLine()}
                priceSubtext="Pay once, use forever"
                subtitle="One-time purchase. Use forever."
                bullets={features.lifetime}
                ctaText="Get Lifetime Access"
                footerText={isNative ? `Secure purchase via ${storeName}` : 'Available on mobile apps'}
                selected={selectedTier === 'lifetime'}
                isPurchasing={paywallState === 'purchasing' && selectedTier === 'lifetime'}
                isCurrentPlan={hasLifetimeEntitlement}
                disabled={!isNative}
                onSelect={() => {
                  setSelectedTier('lifetime');
                  if (lifetimePackage && !hasLifetimeEntitlement) handlePurchase(lifetimePackage.identifier, 'Lifetime');
                }}
              />
            </div>
          )}

          {/* Restore Purchases */}
          {isNative && (paywallState === 'ready' || paywallState === 'purchasing' || paywallState === 'entitled' || paywallState === 'error') && (
            <div className="flex flex-col items-center gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleRestore}
                disabled={restoring || paywallState === 'purchasing'}
                className="w-full sm:w-auto min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {restoring ? 'Restoring…' : 'Restore Purchases'}
              </Button>
              <p className="text-xs text-center text-muted-foreground px-4">
                Re-sync purchases made with your {storeName === 'the App Store' ? 'App Store' : 'Google Play'} account.
              </p>
            </div>
          )}

          {/* iOS Subscription Disclosure */}
          {(paywallState === 'ready' || paywallState === 'purchasing') && (
            <SubscriptionTermsAccordion
              platform={platform}
              termsUrl="https://www.ironvault.app/terms"
              privacyUrl="https://www.ironvault.app/privacy"
            />
          )}

          {/* Trust Badges & Disclaimer */}
          {(paywallState === 'ready' || paywallState === 'purchasing' || paywallState === 'entitled') && (
            <>
              <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Shield className="w-4 h-4" />
                  {isNative ? 'Secure Payment' : 'Mobile Apps Available'}
                </div>
                {isNative && (
                  <>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4" />
                      Store Guarantee
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Crown className="w-4 h-4" />
                      Cancel Anytime
                    </div>
                  </>
                )}
              </div>

              {isNative && (
                <p className="text-xs text-center text-muted-foreground">
                  Purchases are tied to your {storeName === 'the App Store' ? 'App Store' : 'Google Play'} account. Prices may vary by region and taxes.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

