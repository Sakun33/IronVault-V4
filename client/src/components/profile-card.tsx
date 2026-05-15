import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

interface ProfileCardProps {
  email: string | null | undefined;
  /** Display name. Falls back to the local-part of email when missing. */
  name?: string | null;
  /** Plan label, e.g. "PRO" / "FREE" / "LIFETIME". Rendered as a pill. */
  plan?: string;
  /** Optional click handler — adds a chevron on the right. */
  onClick?: () => void;
}

function initial(name: string | null | undefined, email: string | null | undefined): string {
  const src = (name?.trim() || email?.trim() || '?').replace(/[^A-Za-z0-9]/g, '');
  return src.charAt(0).toUpperCase() || '?';
}

function planTheme(plan?: string): { bg: string; text: string; ring: string } {
  const p = (plan || '').toLowerCase();
  if (p === 'pro' || p === 'premium')   return { bg: 'bg-emerald-500/20', text: 'text-emerald-300', ring: 'ring-emerald-400/30' };
  if (p === 'lifetime')                 return { bg: 'bg-amber-500/20',   text: 'text-amber-300',   ring: 'ring-amber-400/30' };
  if (p === 'family')                   return { bg: 'bg-violet-500/20',  text: 'text-violet-300',  ring: 'ring-violet-400/30' };
  if (p === 'team' || p === 'business') return { bg: 'bg-sky-500/20',     text: 'text-sky-300',     ring: 'ring-sky-400/30' };
  return { bg: 'bg-white/10', text: 'text-white/60', ring: 'ring-white/15' };
}

/**
 * Top-of-page profile card for Settings (and any other personal-context
 * surface): glass card with an avatar circle, name, email, and a plan
 * badge. Click handler turns the whole card into a chevron-tipped button.
 */
export function ProfileCard({ email, name, plan, onClick }: ProfileCardProps) {
  const fallbackName = name?.trim() || (email ? email.split('@')[0] : 'You');
  const theme = planTheme(plan);
  const Comp: any = onClick ? 'button' : 'div';
  const compProps = onClick
    ? { type: 'button' as const, onClick, 'data-testid': 'profile-card' }
    : { 'data-testid': 'profile-card' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <Comp
        {...compProps}
        className={
          'w-full flex items-center gap-4 p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.08] ' +
          (onClick ? 'hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors text-left' : '')
        }
      >
        <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xl font-bold shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] flex-shrink-0">
          {initial(name, email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15px] font-semibold text-foreground truncate">{fallbackName}</span>
            {plan && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ring-1 ${theme.bg} ${theme.text} ${theme.ring}`}
                aria-label={`Plan: ${plan}`}
              >
                {plan}
              </span>
            )}
          </div>
          {email && (
            <div className="text-[12px] text-muted-foreground truncate mt-0.5">{email}</div>
          )}
        </div>
        {onClick && <ChevronRight className="w-5 h-5 text-muted-foreground/50 flex-shrink-0" />}
      </Comp>
    </motion.div>
  );
}
