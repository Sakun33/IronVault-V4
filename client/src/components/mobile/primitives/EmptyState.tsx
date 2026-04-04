import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: React.ReactElement<LucideIcon>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * EmptyState - Standardized empty state component
 * 
 * Critical: Must NOT be position:fixed to allow modals to cover it
 * 
 * Features:
 * - Large muted icon (80×80)
 * - Title (text-title-sm)
 * - Optional description
 * - Optional primary action button
 * - Centered layout
 * - In document flow (not fixed)
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'px-6 py-12 text-center',
        'min-h-[400px]',
        className
      )}
    >
      {/* Icon */}
      <div className="text-muted-foreground/50 mb-6">
        {React.cloneElement(icon, { 
          size: 80,
          strokeWidth: 1.5,
          'aria-hidden': 'true'
        } as any)}
      </div>

      {/* Title */}
      <h2 className="text-title-sm font-semibold text-foreground mb-2">
        {title}
      </h2>

      {/* Description */}
      {description && (
        <p className="text-body text-muted-foreground max-w-sm mb-6">
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
}

interface EmptyStateInlineProps {
  icon: React.ReactElement<LucideIcon>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * EmptyStateInline - Compact empty state for smaller containers
 */
export function EmptyStateInline({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateInlineProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'px-6 py-8 text-center',
        className
      )}
    >
      <div className="text-muted-foreground/50 mb-3">
        {React.cloneElement(icon, { 
          size: 48,
          strokeWidth: 1.5,
          'aria-hidden': 'true'
        } as any)}
      </div>

      <h3 className="text-body font-medium text-foreground mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-caption text-muted-foreground mb-4">
          {description}
        </p>
      )}

      {action && <div>{action}</div>}
    </div>
  );
}
