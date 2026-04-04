import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
  large?: boolean;
  sticky?: boolean;
}

export function PageHeader({
  title,
  subtitle,
  badge,
  onBack,
  actions,
  className,
  large = false,
  sticky = true,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'bg-background border-b border-border',
        'pt-[env(safe-area-inset-top)] px-4',
        sticky && 'sticky top-0 z-40',
        className
      )}
    >
      <div className="flex items-center justify-between py-3">
        {onBack ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        ) : (
          <div className="w-9" />
        )}

        <div className="flex-1 flex items-center justify-center gap-2">
          <h1
            className={cn(
              'font-semibold text-foreground text-center',
              large ? 'text-xl' : 'text-lg'
            )}
          >
            {title}
          </h1>
          {badge !== undefined && (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-semibold bg-primary/10 text-primary rounded-full">
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {actions}
        </div>
      </div>

      {subtitle && (
        <div className="pb-3 text-center">
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      )}
    </header>
  );
}

interface LargePageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  scrolled?: boolean;
}

export function LargePageHeader({
  title,
  subtitle,
  actions,
  className,
  scrolled = false,
}: LargePageHeaderProps) {
  return (
    <header
      className={cn(
        'bg-background transition-all duration-300',
        'pt-[env(safe-area-inset-top)] px-4',
        'sticky top-0 z-40',
        scrolled && 'border-b border-border',
        className
      )}
    >
      <div className="flex items-end justify-between py-4">
        <div className="flex-1">
          <h1
            className={cn(
              'font-bold text-foreground transition-all duration-300',
              scrolled ? 'text-2xl' : 'text-4xl'
            )}
          >
            {title}
          </h1>
          {subtitle && !scrolled && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        {actions && (
          <div className="flex items-center gap-1 ml-4">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
