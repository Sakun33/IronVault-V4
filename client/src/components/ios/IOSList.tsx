import React from 'react';
import { ChevronRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * iOS Settings-style grouped list. Use as:
 *
 *   <IOSGroup label="Wi-Fi">
 *     <IOSItem icon={Wifi} title="Home" trailing="Connected" chevron />
 *   </IOSGroup>
 *
 * Sections are rounded-corner cards on a tinted background, each row
 * separated by an inset hairline divider. Matches the iOS 17 Settings app.
 */

interface IOSGroupProps {
  /** Optional uppercase header above the card. */
  label?: React.ReactNode;
  /** Optional caption below the card. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Inset content (use when the group sits in a section that already has padding). */
  inset?: boolean;
}

export function IOSGroup({ label, footer, children, className, inset }: IOSGroupProps) {
  return (
    <section className={cn('w-full', inset ? '' : 'px-4', className)}>
      {label && (
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80 px-3 pb-1.5">
          {label}
        </h3>
      )}
      <div className={cn(
        'rounded-2xl bg-card overflow-hidden',
        'shadow-[0_1px_0_rgba(0,0,0,0.04)] border border-border/50',
      )}>
        {React.Children.map(children, (child, idx) => {
          if (!child) return null;
          return (
            <>
              {idx > 0 && (
                <div aria-hidden className="h-px bg-border/60 ml-[60px]" />
              )}
              {child}
            </>
          );
        })}
      </div>
      {footer && (
        <p className="text-[12px] leading-snug text-muted-foreground/80 px-4 pt-1.5">
          {footer}
        </p>
      )}
    </section>
  );
}

interface IOSItemProps {
  icon?: LucideIcon;
  iconBackground?: string;
  iconColor?: string;
  /** Render an avatar / initials block instead of an icon. */
  avatar?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-side single-line value (truncates). Mutually exclusive with `trailing`. */
  value?: React.ReactNode;
  /** Right-side rich content (e.g. switch + chevron). */
  trailing?: React.ReactNode;
  chevron?: boolean;
  badge?: React.ReactNode;
  destructive?: boolean;
  onClick?: () => void;
  className?: string;
  /** Forces tap target without showing a chevron (e.g. notes preview). */
  hideChevron?: boolean;
  active?: boolean;
  testId?: string;
}

export function IOSItem({
  icon: Icon,
  iconBackground = 'bg-muted',
  iconColor = 'text-foreground',
  avatar,
  title,
  subtitle,
  value,
  trailing,
  chevron,
  badge,
  destructive,
  onClick,
  className,
  hideChevron,
  active,
  testId,
}: IOSItemProps) {
  const showChevron = chevron && !hideChevron && !trailing;
  const Wrapper: any = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left min-h-[56px]',
        onClick && 'active:bg-muted/60 hover:bg-muted/40 transition-colors',
        active && 'bg-muted/40',
        className,
      )}
    >
      {avatar ? (
        <div className="shrink-0">{avatar}</div>
      ) : Icon ? (
        <span className={cn('w-7 h-7 rounded-md flex items-center justify-center shrink-0', iconBackground)}>
          <Icon className={cn('w-[18px] h-[18px]', iconColor)} />
        </span>
      ) : null}

      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-[15px] leading-snug truncate',
          destructive ? 'text-destructive font-medium' : 'text-foreground',
        )}>
          {title}
        </div>
        {subtitle && (
          <div className="text-[13px] leading-snug text-muted-foreground truncate mt-0.5">
            {subtitle}
          </div>
        )}
      </div>

      {badge && (
        <span className="shrink-0">{badge}</span>
      )}

      {value !== undefined && value !== null && value !== '' && (
        <span className="shrink-0 text-[15px] text-muted-foreground/90 max-w-[45%] truncate text-right">
          {value}
        </span>
      )}

      {trailing && <span className="shrink-0">{trailing}</span>}

      {showChevron && (
        <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
      )}
    </Wrapper>
  );
}

interface IOSSectionHeaderProps {
  title: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

/** A date-bucket header for chronological lists ("May 9, 2025", "Today"). */
export function IOSSectionHeader({ title, trailing, className }: IOSSectionHeaderProps) {
  return (
    <div className={cn('flex items-end justify-between px-5 pt-3 pb-1.5', className)}>
      <h3 className="text-[13px] font-semibold text-foreground/80">{title}</h3>
      {trailing && <span className="text-[12px] text-muted-foreground">{trailing}</span>}
    </div>
  );
}

/**
 * Page background tint for iOS Settings-style screens — slightly off the
 * card colour so the rounded cards visually float. Use as the wrapper
 * around an IOSPage's scroll content.
 */
export function IOSScreen({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-full bg-muted/30 dark:bg-muted/15 pb-8', className)}>
      <div className="space-y-5 pt-3">
        {children}
      </div>
    </div>
  );
}
