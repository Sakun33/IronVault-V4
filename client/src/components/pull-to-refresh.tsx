import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'motion/react';
import { RefreshCw, ArrowDown } from 'lucide-react';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  /** Pull distance, in pixels, that arms the refresh. */
  threshold?: number;
  className?: string;
}

const MAX_PULL = 120;

/**
 * Touch pull-to-refresh. Tracks vertical drag from the top of the container
 * and fires `onRefresh` when the user releases past the threshold. Mobile-
 * only viewport gating happens at the call site (`<div className="lg:hidden">`)
 * — the gesture itself just guards against accidental triggers when the
 * container is already scrolled.
 */
export function PullToRefresh({ onRefresh, children, threshold = 64, className }: PullToRefreshProps) {
  const reduced = useReducedMotion();
  const y = useMotionValue(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [armed, setArmed] = useState(false);
  const armedAtRef = useRef(false);

  // Indicator transforms — opacity ramps in once a small drag has happened,
  // and the icon rotates as the pull approaches the trigger threshold.
  const indicatorOpacity = useTransform(y, [0, threshold * 0.4, threshold], [0, 0.7, 1]);
  const indicatorRotate = useTransform(y, [0, threshold], [0, 180]);

  return (
    <motion.div
      className={`relative ${className ?? ''}`}
      drag="y"
      dragDirectionLock
      dragConstraints={{ top: 0, bottom: MAX_PULL }}
      dragElastic={0.4}
      style={{ y }}
      onDragStart={() => {
        // Bail out of the gesture if the user is already scrolled — pull-to-
        // refresh should only fire from the top of the page.
        if (window.scrollY > 0) {
          // We can't actually cancel the drag mid-flight from this hook, but
          // setting armed=false skips the refresh on release.
          armedAtRef.current = false;
        }
      }}
      onDrag={(_e, info) => {
        if (window.scrollY > 0) return;
        const past = info.offset.y > threshold;
        if (past !== armed) {
          setArmed(past);
          armedAtRef.current = past;
          if (past && !reduced) void hapticLight();
        }
      }}
      onDragEnd={async () => {
        if (armedAtRef.current && !isRefreshing && window.scrollY === 0) {
          setIsRefreshing(true);
          // Hold the indicator at the trigger row while we refresh.
          animate(y, threshold, { type: 'spring', stiffness: 320, damping: 28 });
          try {
            await onRefresh();
            void hapticSuccess();
          } catch { /* surfaced by caller */ }
          setIsRefreshing(false);
        }
        animate(y, 0, { type: 'spring', stiffness: 320, damping: 28 });
        setArmed(false);
        armedAtRef.current = false;
      }}
    >
      {/* Indicator perched above the content; transforms with the drag */}
      <motion.div
        aria-hidden
        style={{ opacity: indicatorOpacity, top: -threshold + 16 }}
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-md border border-white/10 text-xs text-foreground"
      >
        {isRefreshing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-300" />
            <span>Refreshing…</span>
          </>
        ) : (
          <>
            <motion.span style={{ rotate: indicatorRotate }} className="inline-flex">
              <ArrowDown className={`w-3.5 h-3.5 transition-colors ${armed ? 'text-emerald-300' : 'text-muted-foreground'}`} />
            </motion.span>
            <span className={armed ? 'text-emerald-300' : 'text-muted-foreground'}>
              {armed ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </>
        )}
      </motion.div>

      {children}
    </motion.div>
  );
}
