import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader - Sticky header for mobile pages
 * 
 * Responsibilities:
 * - Sticky positioning at top
 * - Safe area padding for notch/Dynamic Island
 * - Consistent height (--header-height: 56px)
 * - Back button navigation
 * - Title + optional subtitle
 * - Right-side actions
 * - Never overlaps content
 */
export function PageHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions,
  badge,
  className
}: PageHeaderProps) {
  const [, navigate] = useLocation();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-10',
        'bg-background/95 backdrop-blur-lg',
        'border-b border-border',
        'pt-[calc(env(safe-area-inset-top)+12px)] pb-3 px-4',
        className
      )}
    >
      <div className="flex items-center gap-3 min-h-[44px]">
        {/* Back button */}
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="shrink-0"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Title section */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-title-sm text-foreground font-semibold truncate">
              {title}
            </h1>
            {badge && <div className="shrink-0">{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-caption text-muted-foreground truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

interface LargePageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * LargePageHeader - iOS-style large header that shrinks on scroll
 * 
 * Use for main navigation pages (Dashboard, Passwords, etc.)
 */
export function LargePageHeader({
  title,
  subtitle,
  actions,
  className
}: LargePageHeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-10',
        'bg-background/95 backdrop-blur-lg',
        'border-b border-border',
        'pt-[calc(env(safe-area-inset-top)+16px)] pb-4 px-4',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-title-lg text-foreground font-bold">
            {title}
          </h1>
          {subtitle && (
            <p className="text-body text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
