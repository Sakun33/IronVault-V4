import React from 'react';
import { useLicense } from '@/contexts/license-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Lock } from 'lucide-react';

interface FeatureGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onUpgrade?: () => void;
}

/**
 * FeatureGate component that conditionally renders children based on license tier.
 * If feature is not accessible, shows fallback or upgrade prompt.
 */
export function FeatureGate({ feature, children, fallback, onUpgrade }: FeatureGateProps) {
  const { checkFeatureAccess } = useLicense();
  
  const hasAccess = checkFeatureAccess(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Card className="border-2 border-dashed border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
          <Crown className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
          <p className="text-muted-foreground">
            This feature requires a Pro or Lifetime subscription
          </p>
        </div>
        <Button 
          onClick={onUpgrade}
          className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade Now
        </Button>
      </CardContent>
    </Card>
  );
}

interface LimitGateProps {
  section: string;
  currentCount: number;
  children: React.ReactNode;
  onUpgrade?: () => void;
}

/**
 * LimitGate component that checks if user has reached their limit for a section.
 * Shows upgrade prompt if limit reached.
 */
export function LimitGate({ section, currentCount, children, onUpgrade }: LimitGateProps) {
  const { checkLimit, license } = useLicense();
  
  const withinLimit = checkLimit(section, currentCount);

  if (withinLimit) {
    return <>{children}</>;
  }

  const limit = (license.limits as any)[section] || 0;

  return (
    <Card className="border-2 border-dashed border-primary/50 bg-primary/10">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Limit Reached</h3>
          <p className="text-muted-foreground">
            You've reached your limit of {limit} {section} on the {license.tier} plan
          </p>
        </div>
        <Button 
          onClick={onUpgrade}
          className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
        >
          <Crown className="w-4 h-4 mr-2" />
          Upgrade for Unlimited
        </Button>
      </CardContent>
    </Card>
  );
}
