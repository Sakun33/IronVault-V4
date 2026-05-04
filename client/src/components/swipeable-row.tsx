import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { hapticLight, hapticMedium } from '@/lib/haptics';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete?: () => void;
  /** ARIA label for the reveal-delete affordance, falls back to "Delete". */
  deleteLabel?: string;
  /** Disable the gesture entirely (e.g. while a parent is in selection mode). */
  disabled?: boolean;
  className?: string;
}

const REVEAL_PX = 80;          // distance the delete button takes when fully open
const COMMIT_THRESHOLD = -60;  // past this, release = trigger delete

// Tracks the viewport once across the app. The gesture is mobile-only — on
// desktop and tablet we render children unchanged so power users keep their
// keyboard + click flows.
function useIsTouchViewport(): boolean {
  const [isTouch, setIsTouch] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isTouch;
}

/**
 * Reveals a destructive action when the user swipes the row leftward on
 * touch viewports. Release past the commit threshold fires `onDelete`;
 * release earlier snaps back. No-op on desktop or when disabled.
 */
export function SwipeableRow({ children, onDelete, deleteLabel = 'Delete', disabled, className }: SwipeableRowProps) {
  const reducedMotion = useReducedMotion();
  const isTouch = useIsTouchViewport();
  const x = useMotionValue(0);
  const [confirming, setConfirming] = useState(false);

  // Cross-fade the delete background as the row slides.
  const bgOpacity = useTransform(x, [-REVEAL_PX, -10, 0], [1, 0.4, 0]);
  // Pulse the trash icon as the threshold approaches — subtle scale up that
  // makes the "you're past commit" point feel real on the finger.
  const iconScale = useTransform(x, [COMMIT_THRESHOLD - 10, COMMIT_THRESHOLD, 0], [1.18, 1.06, 0.94]);

  // Skip the gesture wiring entirely on desktop or when disabled — children
  // render as if this wrapper weren't here. Keeps tab-key flows intact.
  if (!isTouch || disabled || !onDelete || reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative overflow-hidden ${className ?? ''}`}>
      {/* Destructive backdrop revealed by the swipe. Sits behind the row. */}
      <motion.div
        aria-hidden
        style={{ opacity: bgOpacity }}
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-5 bg-gradient-to-l from-red-600 via-red-600/70 to-transparent"
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 text-white">
          <Trash2 className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">{confirming ? 'Release' : deleteLabel}</span>
        </motion.div>
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -REVEAL_PX, right: 0 }}
        dragElastic={{ left: 0.05, right: 0 }}
        dragMomentum={false}
        style={{ x }}
        onDrag={(_e, info) => {
          // Quiet "you've crossed the commit line" feedback so the user
          // knows release will trigger delete. Throttled by toggling local
          // state — actual haptic only fires on the transition.
          const past = info.offset.x <= COMMIT_THRESHOLD;
          if (past !== confirming) {
            setConfirming(past);
            if (past) void hapticLight();
          }
        }}
        onDragEnd={(_e, info) => {
          if (info.offset.x <= COMMIT_THRESHOLD) {
            void hapticMedium();
            // Snap closed first so the row doesn't appear "stuck open" while
            // the parent confirms the deletion (e.g. dialog).
            animate(x, 0, { type: 'spring', stiffness: 380, damping: 32 });
            setConfirming(false);
            onDelete();
          } else {
            animate(x, 0, { type: 'spring', stiffness: 380, damping: 32 });
            setConfirming(false);
          }
        }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
}
