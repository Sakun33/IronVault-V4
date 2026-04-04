import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, RefreshCcw } from 'lucide-react';

export interface PlanCardProps {
  title: string;
  icon?: React.ReactNode;
  badgeText?: string;
  badgeClassName?: string;
  priceLine: string;
  priceSubtext?: string;
  subtitle: string;
  bullets: string[];
  ctaText?: string;
  ctaIcon?: React.ReactNode;
  ctaClassName?: string;
  footerText?: string;
  selected?: boolean;
  disabled?: boolean;
  isCurrentPlan?: boolean;
  isPurchasing?: boolean;
  onSelect?: () => void;
  borderColor?: 'blue' | 'purple';
}

export function PlanCard({
  title,
  icon,
  badgeText,
  badgeClassName,
  priceLine,
  priceSubtext,
  subtitle,
  bullets,
  ctaText,
  ctaIcon,
  ctaClassName,
  footerText,
  selected = false,
  disabled = false,
  isCurrentPlan = false,
  isPurchasing = false,
  onSelect,
  borderColor = 'blue',
}: PlanCardProps) {
  const borderColors = {
    blue: selected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-900' : 'border-blue-300 dark:border-blue-800',
    purple: selected ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-900' : 'border-purple-300 dark:border-purple-800',
  };

  const defaultBadgeColors = {
    blue: 'bg-primary',
    purple: 'bg-gradient-to-r from-purple-500 to-pink-500',
  };

  const defaultCtaColors = {
    blue: 'bg-primary hover:bg-primary/90',
    purple: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
  };

  return (
    <Card className={`border-2 shadow-lg relative overflow-hidden transition-all ${borderColors[borderColor]}`}>
      {badgeText && (
        <div className={`absolute top-0 right-0 text-white px-4 py-1 text-xs font-bold rounded-bl-lg ${
          badgeClassName || defaultBadgeColors[borderColor]
        }`}>
          {badgeText}
        </div>
      )}

      <CardHeader className="pb-4 pt-6">
        {icon && (
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <CardTitle className="text-2xl">{title}</CardTitle>
          </div>
        )}
        {!icon && <CardTitle className="text-2xl mb-2">{title}</CardTitle>}

        <CardDescription className="text-sm">
          {subtitle}
        </CardDescription>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">
              {priceLine}
            </span>
          </div>
          {priceSubtext && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              {priceSubtext}
            </p>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2.5">
          {bullets.map((bullet, index) => (
            <li key={index} className="flex items-start gap-2.5">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>

        <Button
          className={`w-full h-12 text-base ${ctaClassName || defaultCtaColors[borderColor]}`}
          onClick={onSelect}
          disabled={disabled || isCurrentPlan}
        >
          {isCurrentPlan ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Current Plan
            </>
          ) : isPurchasing && selected ? (
            <>
              <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              {ctaIcon}
              {ctaText || 'Select Plan'}
            </>
          )}
        </Button>

        {footerText && (
          <p className="text-xs text-center text-muted-foreground min-h-[44px] flex items-center justify-center">
            {footerText}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
