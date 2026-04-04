import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronRight, LucideIcon } from 'lucide-react';

interface ListRowProps {
  icon?: LucideIcon;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  badge?: string | number;
  chevron?: boolean;
  onClick?: () => void;
  className?: string;
  active?: boolean;
}

export function ListRow({
  icon: Icon,
  iconColor,
  iconBackground = 'bg-accent',
  title,
  subtitle,
  rightContent,
  badge,
  chevron = true,
  onClick,
  className,
  active = false,
}: ListRowProps) {
  const content = (
    <>
      {Icon && (
        <div className={cn('p-2.5 rounded-xl shrink-0', iconBackground)}>
          <Icon className={cn('w-5 h-5', iconColor || 'text-foreground')} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-foreground leading-tight truncate">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {subtitle}
          </div>
        )}
      </div>

      {badge !== undefined && (
        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 text-xs font-semibold bg-primary/10 text-primary rounded-full shrink-0">
          {badge}
        </span>
      )}

      {rightContent && <div className="shrink-0">{rightContent}</div>}

      {chevron && !rightContent && (
        <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
      )}
    </>
  );

  if (onClick) {
    return (
      <Button
        variant="ghost"
        className={cn(
          'w-full flex items-center gap-3 p-3 h-auto text-left rounded-xl',
          'min-h-[44px] hover:bg-accent transition-colors',
          active && 'bg-accent',
          className
        )}
        onClick={onClick}
      >
        {content}
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-xl min-h-[44px]',
        active && 'bg-accent',
        className
      )}
    >
      {content}
    </div>
  );
}

interface ListSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ListSection({ title, children, className }: ListSectionProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {title && (
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
          {title}
        </h3>
      )}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface ListDividerProps {
  label?: string;
  className?: string;
}

export function ListDivider({ label, className }: ListDividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3 py-2 px-3', className)}>
        <div className="h-px bg-border flex-1" />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="h-px bg-border flex-1" />
      </div>
    );
  }

  return <div className={cn('h-px bg-border mx-3', className)} />;
}
