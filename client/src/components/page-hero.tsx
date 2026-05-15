import React from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';

export interface HeroBadge {
  icon?: React.ReactNode;
  label: string;
}

export interface PageHeroProps {
  /** Lucide icon component rendered inside the glowing circle. */
  icon: LucideIcon;
  /** Bold headline shown under the icon. */
  title: string;
  /** Muted one-liner describing the feature. */
  subtitle?: string;
  /** Pill-style trust/feature badges shown below the subtitle. */
  badges?: HeroBadge[];
  /** Primary CTA. Renders a green gradient button when provided. */
  cta?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    disabled?: boolean;
    testId?: string;
  };
  /** Secondary plain-text link rendered below the CTA. */
  secondary?: { label: string; onClick: () => void };
  /** Hex/Tailwind gradient classes for the icon halo + CTA. Defaults to emerald. */
  accent?: 'emerald' | 'sky' | 'violet' | 'rose' | 'amber';
}

const ACCENT_THEME = {
  emerald: {
    halo:   'from-emerald-500/30 via-emerald-500/10 to-transparent',
    ring:   'ring-emerald-400/30',
    icon:   'text-emerald-300',
    bg:     'from-emerald-500/20 to-teal-500/10 border-emerald-400/30',
    shadow: 'shadow-[0_0_40px_-8px_rgba(16,185,129,0.55)]',
    cta:    'from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-[0_0_24px_-4px_rgba(16,185,129,0.55)]',
  },
  sky: {
    halo:   'from-sky-500/30 via-sky-500/10 to-transparent',
    ring:   'ring-sky-400/30',
    icon:   'text-sky-300',
    bg:     'from-sky-500/20 to-cyan-500/10 border-sky-400/30',
    shadow: 'shadow-[0_0_40px_-8px_rgba(14,165,233,0.55)]',
    cta:    'from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 shadow-[0_0_24px_-4px_rgba(14,165,233,0.55)]',
  },
  violet: {
    halo:   'from-violet-500/30 via-violet-500/10 to-transparent',
    ring:   'ring-violet-400/30',
    icon:   'text-violet-300',
    bg:     'from-violet-500/20 to-fuchsia-500/10 border-violet-400/30',
    shadow: 'shadow-[0_0_40px_-8px_rgba(139,92,246,0.55)]',
    cta:    'from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 shadow-[0_0_24px_-4px_rgba(139,92,246,0.55)]',
  },
  rose: {
    halo:   'from-rose-500/30 via-rose-500/10 to-transparent',
    ring:   'ring-rose-400/30',
    icon:   'text-rose-300',
    bg:     'from-rose-500/20 to-pink-500/10 border-rose-400/30',
    shadow: 'shadow-[0_0_40px_-8px_rgba(244,63,94,0.55)]',
    cta:    'from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 shadow-[0_0_24px_-4px_rgba(244,63,94,0.55)]',
  },
  amber: {
    halo:   'from-amber-500/30 via-amber-500/10 to-transparent',
    ring:   'ring-amber-400/30',
    icon:   'text-amber-300',
    bg:     'from-amber-500/20 to-orange-500/10 border-amber-400/30',
    shadow: 'shadow-[0_0_40px_-8px_rgba(245,158,11,0.55)]',
    cta:    'from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_24px_-4px_rgba(245,158,11,0.55)]',
  },
} as const;

/**
 * HealthBridge-style hero entry: glowing icon halo, bold title + subtitle,
 * trust pills, primary emerald CTA. Used for vault-locked / first-run
 * states (API Keys, future Documents lock, etc.).
 */
export function PageHero({
  icon: Icon,
  title,
  subtitle,
  badges = [],
  cta,
  secondary,
  accent = 'emerald',
}: PageHeroProps) {
  const theme = ACCENT_THEME[accent];
  const CtaIcon = cta?.icon;
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26 }}
        className="w-full max-w-md"
      >
        {/* Icon halo — radial glow + glass tile in the centre */}
        <div className="relative w-28 h-28 mx-auto mb-6">
          <div className={`absolute inset-0 rounded-full bg-gradient-radial ${theme.halo} blur-2xl`} aria-hidden />
          <div className={`relative w-full h-full rounded-full bg-gradient-to-br ${theme.bg} border ring-1 ${theme.ring} ${theme.shadow} flex items-center justify-center`}>
            <Icon className={`w-12 h-12 ${theme.icon}`} aria-hidden />
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">{title}</h1>
        {subtitle && (
          <p className="text-sm text-white/60 mb-6 max-w-sm mx-auto leading-relaxed">{subtitle}</p>
        )}

        {badges.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-7">
            {badges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[11px] font-medium text-white/70"
              >
                {b.icon}
                {b.label}
              </span>
            ))}
          </div>
        )}

        {cta && (
          <Button
            type="button"
            onClick={cta.onClick}
            disabled={cta.disabled}
            data-testid={cta.testId}
            className={`w-full h-12 rounded-xl bg-gradient-to-r ${theme.cta} text-white font-semibold border-0 disabled:opacity-50`}
          >
            {CtaIcon && <CtaIcon className="w-5 h-5 mr-2" />}
            {cta.label}
          </Button>
        )}

        {secondary && (
          <button
            type="button"
            onClick={secondary.onClick}
            className="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            {secondary.label}
          </button>
        )}
      </motion.div>
    </div>
  );
}
