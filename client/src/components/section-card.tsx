import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface SectionCardProps {
  /** Section header — rendered uppercase, wide-tracked, muted. */
  title: string;
  /** Optional accent icon next to the title. */
  icon?: LucideIcon;
  /** Optional right-side trailing content (e.g. a Pro badge, count). */
  trailing?: React.ReactNode;
  /** Card body. */
  children: React.ReactNode;
  /** Override className for the outer card container. */
  className?: string;
  /** Optional bottom helper text shown under the card. */
  footer?: React.ReactNode;
}

/**
 * HealthBridge-style grouped settings card: uppercase muted header sits
 * OUTSIDE the card, the card itself is a glass tile with rounded-2xl
 * corners and a subtle border. Used by the redesigned settings page and
 * any other section that wants the same visual rhythm.
 */
export function SectionCard({
  title, icon: Icon, trailing, children, className, footer,
}: SectionCardProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-white/40 font-semibold flex items-center gap-1.5">
          {Icon && <Icon className="w-3 h-3" />}
          {title}
        </h2>
        {trailing && <div className="text-[11px] text-white/40">{trailing}</div>}
      </div>
      <div
        className={
          'rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] overflow-hidden divide-y divide-white/[0.06] ' +
          (className ?? '')
        }
      >
        {children}
      </div>
      {footer && <div className="text-[11px] text-white/40 px-1">{footer}</div>}
    </section>
  );
}

interface SettingRowProps {
  icon?: LucideIcon;
  /** Optional tailwind colour class for the icon tile (e.g. text-emerald-300). */
  iconColor?: string;
  /** Optional tailwind background class for the icon tile. */
  iconBg?: string;
  title: string;
  description?: string;
  /** Right-side control — toggle, chevron, value, etc. */
  trailing?: React.ReactNode;
  /** Click handler for the whole row. */
  onClick?: () => void;
  /** Renders as a button when true (keyboard focus, hover state). */
  interactive?: boolean;
  testId?: string;
  className?: string;
}

/** Single row inside a SectionCard. Icon tile + title + description + trailing. */
export function SettingRow({
  icon: Icon,
  iconColor = 'text-emerald-300',
  iconBg = 'bg-emerald-500/15',
  title,
  description,
  trailing,
  onClick,
  interactive,
  testId,
  className,
}: SettingRowProps) {
  const isButton = interactive || !!onClick;
  const Comp: any = isButton ? 'button' : 'div';
  const buttonProps = isButton ? { type: 'button' as const, onClick, 'data-testid': testId } : { 'data-testid': testId };
  return (
    <Comp
      {...buttonProps}
      className={
        'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ' +
        (isButton ? 'hover:bg-white/[0.04] active:bg-white/[0.06] ' : '') +
        (className ?? '')
      }
    >
      {Icon && (
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-white truncate">{title}</div>
        {description && (
          <div className="text-[12px] text-white/50 truncate">{description}</div>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </Comp>
  );
}
