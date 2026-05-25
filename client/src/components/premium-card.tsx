import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PremiumAccent =
  | 'sky' | 'cyan' | 'emerald' | 'violet' | 'fuchsia'
  | 'amber' | 'orange' | 'rose' | 'indigo' | 'slate';

const ACCENT_BORDER: Record<PremiumAccent, string> = {
  sky:      'before:bg-gradient-to-b before:from-sky-400 before:to-cyan-500',
  cyan:     'before:bg-gradient-to-b before:from-cyan-400 before:to-sky-500',
  emerald:  'before:bg-gradient-to-b before:from-emerald-400 before:to-teal-500',
  violet:   'before:bg-gradient-to-b before:from-violet-400 before:to-fuchsia-500',
  fuchsia:  'before:bg-gradient-to-b before:from-fuchsia-400 before:to-pink-500',
  amber:    'before:bg-gradient-to-b before:from-amber-400 before:to-orange-500',
  orange:   'before:bg-gradient-to-b before:from-orange-400 before:to-amber-500',
  rose:     'before:bg-gradient-to-b before:from-rose-400 before:to-pink-500',
  indigo:   'before:bg-gradient-to-b before:from-indigo-400 before:to-blue-500',
  slate:    'before:bg-gradient-to-b before:from-slate-400 before:to-slate-500',
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
          // Surface — same translucency in both themes; the gradient overlay
          // gives the depth without needing different backgrounds.
          'bg-gradient-to-br from-black/[0.03] to-black/[0.01]',
          'dark:from-white/[0.06] dark:to-white/[0.02]',
          'backdrop-blur-2xl',
          'border border-black/[0.06] dark:border-white/[0.1]',
          'rounded-3xl shadow-xl shadow-black/[0.04] dark:shadow-black/40',
          // 4px left border accent — ::before pseudo-element so children stay
          // unaffected and the corner radius is preserved.
          'before:absolute before:inset-y-0 before:left-0 before:w-1',
          ACCENT_BORDER[accent],
          'pl-1', // visual indent so content doesn't sit under the border
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
