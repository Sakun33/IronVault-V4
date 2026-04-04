import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      )}

      {action && (
        <Button onClick={action.onClick} className="rounded-xl">
          {action.label}
        </Button>
      )}
    </div>
  );
}

interface EmptySearchStateProps {
  query: string;
  onClear?: () => void;
  className?: string;
}

export function EmptySearchState({ query, onClear, className }: EmptySearchStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-12 px-6',
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2">
        No results found
      </h3>

      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        We couldn't find anything matching "{query}"
      </p>

      {onClear && (
        <Button variant="outline" onClick={onClear} className="rounded-xl">
          Clear Search
        </Button>
      )}
    </div>
  );
}
