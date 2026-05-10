import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, animate, useReducedMotion, PanInfo } from 'motion/react';
import { LucideIcon } from 'lucide-react';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { cn } from '@/lib/utils';

export interface SwipeAction {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Background colour token. Use Tailwind background utilities. */
  background: string;
  /** Optional foreground (icon + label) override. Defaults to white. */
  foreground?: string;
  onAction: () => void;
  /** Marks this action as destructive — committed when the row is dragged
   *  past the auto-commit threshold (full-width swipe, like iOS Mail). */
  destructive?: boolean;
}

interface SwipeRowProps {
  children: React.ReactNode;
  /** Trailing actions revealed by a left-swipe. Order = right-to-left. */
  actions?: SwipeAction[];
  /** Disable gesture entirely (e.g. while a parent is in selection mode). */
  disabled?: boolean;
  className?: string;
  /** Render touch viewports always; or also on desktop pointer devices. */
  alwaysOn?: boolean;
}

const ACTION_WIDTH = 76;
const COMMIT_THRESHOLD_RATIO = 0.6;

function useIsTouchViewport(alwaysOn?: boolean): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(() => {
    if (alwaysOn) return true;
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 1024px)').matches || ('ontouchstart' in window);
  });
  useEffect(() => {
    if (alwaysOn) return;
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 1024px)');
    const onChange = () => setIsTouch(mql.matches || ('ontouchstart' in window));
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [alwaysOn]);
  return isTouch;
}

/**
 * iOS Mail / Notes style swipe row. Left-swipe reveals up to three trailing
 * actions; a long swipe past 60% of the row width auto-commits the first
 * destructive action. Snap-open at the action stack; snap-closed otherwise.
 *
 * On desktop this becomes a no-op wrapper so keyboard users keep their flows.
 */
export function SwipeRow({ children, actions, disabled, className, alwaysOn }: SwipeRowProps) {
  const reducedMotion = useReducedMotion();
  const isTouch = useIsTouchViewport(alwaysOn);
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalActions = actions?.length ?? 0;
  const stackWidth = totalActions * ACTION_WIDTH;
  const destructive = actions?.find((a) => a.destructive);

  const close = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 380, damping: 32 });
    setOpen(false);
    setConfirming(false);
  }, [x]);

  const snapOpen = useCallback(() => {
    animate(x, -stackWidth, { type: 'spring', stiffness: 380, damping: 32 });
    setOpen(true);
  }, [x, stackWidth]);

  // Tap-anywhere-to-close: when the row is open, intercept the next tap
  // outside the action stack and snap it shut, matching iOS behaviour.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const node = containerRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) close();
    };
    window.addEventListener('pointerdown', onPointer);
    return () => window.removeEventListener('pointerdown', onPointer);
  }, [open, close]);

  if (!isTouch || disabled || !actions || actions.length === 0 || reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  const onDrag = (_e: unknown, info: PanInfo) => {
    if (!destructive) return;
    const rowWidth = containerRef.current?.offsetWidth ?? 0;
    const past = info.offset.x <= -(rowWidth * COMMIT_THRESHOLD_RATIO);
    if (past !== confirming) {
      setConfirming(past);
      if (past) void hapticLight();
    }
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const rowWidth = containerRef.current?.offsetWidth ?? 0;
    const commit = destructive && info.offset.x <= -(rowWidth * COMMIT_THRESHOLD_RATIO);
    if (commit && destructive) {
      void hapticMedium();
      animate(x, -rowWidth, { type: 'spring', stiffness: 320, damping: 28 });
      setConfirming(false);
      setTimeout(() => {
        destructive.onAction();
        x.set(0);
        setOpen(false);
      }, 160);
      return;
    }
    if (info.offset.x <= -stackWidth * 0.5 || (info.velocity.x < -300 && info.offset.x < -10)) {
      snapOpen();
    } else {
      close();
    }
  };

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', className)}>
      {/* Action stack — fixed-width buttons stacked right-to-left behind the row. */}
      <div className="absolute inset-y-0 right-0 flex" aria-hidden={!open}>
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.id}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                void hapticLight();
                close();
                a.onAction();
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 select-none',
                'text-[11px] font-medium tracking-wide',
                a.background,
                a.foreground ?? 'text-white'
              )}
              style={{ width: ACTION_WIDTH }}
              aria-label={a.label}
            >
              <Icon className="w-5 h-5" />
              <span className="leading-none">{a.label}</span>
            </button>
          );
        })}
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -stackWidth - 24, right: 0 }}
        dragElastic={{ left: 0.05, right: 0 }}
        dragMomentum={false}
        style={{ x }}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onClick={() => { if (open) close(); }}
        className={cn(
          'relative bg-card touch-pan-y',
          confirming && destructive && 'shadow-[inset_0_0_0_2px_rgba(220,38,38,0.4)]'
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
