import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PremiumAccent =
  | 'sky' | 'cyan' | 'emerald' | 'violet' | 'fuchsia'
  | 'amber' | 'orange' | 'rose' | 'indigo' | 'slate';

// `after:` variants for the colored left edge — kept as a static map so
// Tailwind JIT picks them up during build (dynamic string assembly would
// be purged). The `before:` pseudo is reserved for the top highlight rim.
const ACCENT_AFTER: Record<PremiumAccent, string> = {
  sky:      'after:bg-gradient-to-b after:from-sky-400 after:to-cyan-500',
  cyan:     'after:bg-gradient-to-b after:from-cyan-400 after:to-sky-500',
  emerald:  'after:bg-gradient-to-b after:from-emerald-400 after:to-teal-500',
  violet:   'after:bg-gradient-to-b after:from-violet-400 after:to-fuchsia-500',
  fuchsia:  'after:bg-gradient-to-b after:from-fuchsia-400 after:to-pink-500',
  amber:    'after:bg-gradient-to-b after:from-amber-400 after:to-orange-500',
  orange:   'after:bg-gradient-to-b after:from-orange-400 after:to-amber-500',
  rose:     'after:bg-gradient-to-b after:from-rose-400 after:to-pink-500',
  indigo:   'after:bg-gradient-to-b after:from-indigo-400 after:to-blue-500',
  slate:    'after:bg-gradient-to-b after:from-slate-400 after:to-slate-500',
};

const ACCENT_ICON_BG: Record<PremiumAccent, string> = {
  sky:      'bg-gradient-to-br from-sky-500 to-cyan-600',
  cyan:     'bg-gradient-to-br from-cyan-500 to-sky-600',
  emerald:  'bg-gradient-to-br from-emerald-500 to-teal-600',
  violet:   'bg-gradient-to-br from-violet-500 to-fuchsia-600',
  fuchsia:  'bg-gradient-to-br from-fuchsia-500 to-pink-600',
  amber:    'bg-gradient-to-br from-amber-500 to-orange-600',
  orange:   'bg-gradient-to-br from-orange-500 to-amber-600',
  rose:     'bg-gradient-to-br from-rose-500 to-pink-600',
  indigo:   'bg-gradient-to-br from-indigo-500 to-blue-600',
  slate:    'bg-gradient-to-br from-slate-500 to-slate-700',
};

const ACCENT_GLOW: Record<PremiumAccent, string> = {
  sky:     'shadow-sky-500/30',
  cyan:    'shadow-cyan-500/30',
  emerald: 'shadow-emerald-500/30',
  violet:  'shadow-violet-500/30',
  fuchsia: 'shadow-fuchsia-500/30',
  amber:   'shadow-amber-500/30',
  orange:  'shadow-orange-500/30',
  rose:    'shadow-rose-500/30',
  indigo:  'shadow-indigo-500/30',
  slate:   'shadow-slate-500/20',
};

export interface PremiumCardProps extends HTMLAttributes<HTMLDivElement> {
  accent: PremiumAccent;
  children: ReactNode;
}

/**
 * Premium glass card with a 4px gradient left border and theme-aware surface.
 * Works in light and dark mode: `bg-black/[0.03] dark:bg-white/[0.06]` over a
 * heavy backdrop blur gives both themes the same translucent feel without
 * crushing legibility in light mode.
 */
export const PremiumCard = forwardRef<HTMLDivElement, PremiumCardProps>(
  function PremiumCard({ accent, className, children, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden',
          // HealthBridge-style depth: layered gradient surface that responds
          // to elevation. Slightly stronger top-edge highlight gives the
          // card a subtle "lift" against the deep-navy background.
          'bg-gradient-to-br from-black/[0.04] to-black/[0.01]',
          'dark:from-white/[0.07] dark:to-white/[0.015]',
          'backdrop-blur-2xl backdrop-saturate-150',
          'border border-black/[0.07] dark:border-white/[0.09]',
          'rounded-3xl',
          'shadow-[0_10px_36px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_18px_50px_-16px_rgba(0,0,0,0.70)]',
          // Inset top-edge highlight — gives the glass that subtle "wet"
          // sheen that HealthBridge cards have. Subtle in light mode, more
          // pronounced in dark.
          'before:absolute before:inset-x-0 before:top-0 before:h-px',
          'before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent',
          'dark:before:via-white/15',
          // 4px left border accent — second ::after pseudo for the colored
          // edge so we don't lose the top highlight.
          'after:absolute after:inset-y-0 after:left-0 after:w-1',
          ACCENT_AFTER[accent],
          'pl-1', // visual indent so content doesn't sit under the border
          'transition-transform duration-300 ease-out',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

export interface PremiumIconProps extends HTMLAttributes<HTMLDivElement> {
  accent: PremiumAccent;
  children: ReactNode;
  /** Size in px — default 44. */
  size?: number;
}

/**
 * 44px (default) gradient icon circle that pairs with PremiumCard. Pass a
 * Lucide icon as the child — sized at half the circle diameter.
 */
export const PremiumIcon = forwardRef<HTMLDivElement, PremiumIconProps>(
  function PremiumIcon({ accent, className, children, size = 44, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl flex items-center justify-center flex-shrink-0 text-white shadow-lg',
          ACCENT_ICON_BG[accent],
          ACCENT_GLOW[accent],
          className,
        )}
        style={{ width: size, height: size }}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
