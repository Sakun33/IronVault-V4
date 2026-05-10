import React, { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence, useMotionValue, animate, PanInfo, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { X, LucideIcon } from 'lucide-react';
import type { SectionItem } from './MoreSheet';
import { hapticLight } from '@/lib/haptics';

interface HamburgerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: SectionItem[];
  /** Optional header content (logo + brand) rendered at the top of the drawer. */
  header?: React.ReactNode;
  /** Optional footer content (account info, theme toggle) rendered above safe area. */
  footer?: React.ReactNode;
}

const DRAWER_WIDTH_VW = 84; // ~iOS Mail / Slack drawer width

const groupOrder: Array<SectionItem['group']> = ['vault', 'finance', 'tools', 'account'];
const groupLabels: Record<SectionItem['group'], string> = {
  vault: 'Vault',
  finance: 'Finance',
  tools: 'Tools',
  account: 'Account',
};

/**
 * iOS-style left-slide hamburger drawer. Replaces the older bottom-sheet
 * "MoreSheet" trigger. Supports drag-to-close, escape-to-close, backdrop
 * tap-to-close, and grouped section listing.
 */
export function HamburgerDrawer({ open, onOpenChange, sections, header, footer }: HamburgerDrawerProps) {
  const reducedMotion = useReducedMotion();
  const [, setLocation] = useLocation();
  const x = useMotionValue(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Reset position when opening so subsequent drags begin at zero.
  useEffect(() => {
    if (open) x.set(0);
  }, [open, x]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleDragEnd = (_e: unknown, info: PanInfo) => {
    const past = info.offset.x < -100 || info.velocity.x < -400;
    if (past) {
      onOpenChange(false);
    } else {
      animate(x, 0, { type: 'spring', stiffness: 360, damping: 32 });
    }
  };

  const handleNavigate = (item: SectionItem) => {
    onOpenChange(false);
    void hapticLight();
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      setLocation(item.href);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  };

  const grouped = groupOrder.map((g) => ({
    group: g,
    items: sections.filter((s) => s.group === g),
  })).filter((g) => g.items.length > 0);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] lg:hidden" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onClick={() => onOpenChange(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.aside
            ref={drawerRef}
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 36 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.05, right: 0 }}
            dragMomentum={false}
            style={{ x, width: `${DRAWER_WIDTH_VW}vw`, maxWidth: 360 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'absolute top-0 bottom-0 left-0',
              'bg-background/95 backdrop-blur-2xl',
              'shadow-[10px_0_40px_rgba(0,0,0,0.25)]',
              'flex flex-col',
              'pt-[env(safe-area-inset-top)]',
              'pb-[env(safe-area-inset-bottom)]',
            )}
          >
            <div className="flex flex-col h-full w-full">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                <div className="flex-1 min-w-0">{header}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-9 w-9 rounded-xl"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Sections */}
              <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 space-y-5">
                {grouped.map(({ group, items }) => (
                  <div key={group} className="space-y-1">
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80 px-3 mb-1">
                      {groupLabels[group]}
                    </h3>
                    <div className="rounded-2xl bg-muted/40 dark:bg-muted/20 border border-border/40 overflow-hidden">
                      {items.map((item, idx) => (
                        <DrawerRow
                          key={item.id}
                          item={item}
                          isFirst={idx === 0}
                          isLast={idx === items.length - 1}
                          onClick={() => handleNavigate(item)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Footer */}
              {footer && (
                <div className="border-t border-border/40 px-4 py-3">
                  {footer}
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function DrawerRow({
  item,
  isFirst,
  isLast,
  onClick,
}: {
  item: SectionItem;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
}) {
  const Icon: LucideIcon = item.icon;
  return (
    <>
      {!isFirst && <div className="h-px bg-border/50 ml-12" aria-hidden />}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 px-3.5 py-2.5 text-left',
          'active:bg-muted/70 hover:bg-muted/60 transition-colors',
          isFirst && 'rounded-t-2xl',
          isLast && 'rounded-b-2xl',
        )}
      >
        <span className={cn('w-7 h-7 rounded-md flex items-center justify-center', item.color ? 'bg-current/10' : 'bg-muted-foreground/10', item.color)}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 text-[15px] font-medium text-foreground truncate">{item.label}</span>
        {item.id === 'security-health' && item.count != null && item.count > 0 ? (
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 ring-1 ring-red-500/30">
            {item.count > 99 ? '99+' : item.count}
          </span>
        ) : item.count != null ? (
          <span className="text-[12px] text-muted-foreground tabular-nums">{item.count}</span>
        ) : null}
      </button>
    </>
  );
}
