import { useState, useRef, useEffect, useCallback } from 'react';
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
const RESISTANCE = 0.5; // 1.0 = follow finger, 0.5 = half-distance after threshold

/**
 * Touch pull-to-refresh.
 *
 * Implementation note: an earlier version used Framer Motion's `drag="y"`
 * which sets `touch-action: pan-x` on the wrapped element — that quietly
 * blocks the native page scroll, so users couldn't reach content below the
 * fold (the dashboard scroll regression). This version uses raw touch
 * events instead and only calls `preventDefault()` while the user is
 * actively pulling down from the top, so the rest of the time native
 * scrolling works exactly as it would without us.
 */
export function PullToRefresh({ onRefresh, children, threshold = 64, className }: PullToRefreshProps) {
  const reduced = useReducedMotion();
  const y = useMotionValue(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [armed, setArmed] = useState(false);

  // Tracks an in-flight gesture without triggering re-renders on every move
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const armedRef = useRef(false);

  // Indicator transforms — opacity ramps in once a small drag has happened,
  // and the icon rotates as the pull approaches the trigger threshold.
  const indicatorOpacity = useTransform(y, [0, threshold * 0.4, threshold], [0, 0.7, 1]);
  const indicatorRotate = useTransform(y, [0, threshold], [0, 180]);

  const finishGesture = useCallback(async () => {
    const wasArmed = armedRef.current;
    pullingRef.current = false;
    startYRef.current = null;
    armedRef.current = false;

    if (wasArmed && !isRefreshing) {
      setIsRefreshing(true);
      // Hold the indicator at the trigger row while we refresh
      animate(y, threshold, { type: 'spring', stiffness: 320, damping: 28 });
      try {
        await onRefresh();
        void hapticSuccess();
      } catch { /* surfaced by caller */ }
      setIsRefreshing(false);
    }
    animate(y, 0, { type: 'spring', stiffness: 320, damping: 28 });
    setArmed(false);
  }, [isRefreshing, threshold, y, onRefresh]);

  // Touch handlers — attached imperatively so we can pass passive: false on
  // touchmove without React's synthetic event normalization stripping it.
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (reduced) return; // Don't intercept touch at all under reduced motion
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only arm when we're at the very top of the page. If the user has
      // scrolled at all, we let native scroll handle the gesture.
      if (window.scrollY > 0) return;
      if (e.touches.length !== 1) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const currentY = e.touches[0].clientY;
      const delta = currentY - startYRef.current;

      if (delta <= 0) {
        // User is scrolling up, not pulling down — bail and let native
        // scroll continue.
        if (pullingRef.current) {
          pullingRef.current = false;
          y.set(0);
        }
        return;
      }

      // Re-check scroll position; the user may have started at top but
      // scrolled by another input (e.g. a sticky header click).
      if (window.scrollY > 0) {
        if (pullingRef.current) {
          pullingRef.current = false;
          y.set(0);
        }
        return;
      }

      // We're actively pulling down from the top — block native scroll
      // bounce so our indicator stays in place.
      if (e.cancelable) e.preventDefault();
      pullingRef.current = true;

      // Apply resistance past threshold so the gesture has a clear "limit"
      let pull = delta;
      if (pull > threshold) pull = threshold + (pull - threshold) * RESISTANCE;
      pull = Math.min(pull, MAX_PULL);
      y.set(pull);

      const past = pull > threshold;
      if (past !== armedRef.current) {
        armedRef.current = past;
        setArmed(past);
        if (past) void hapticLight();
      }
    };

    const onTouchEnd = () => {
      if (!pullingRef.current && startYRef.current === null) return;
      void finishGesture();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [reduced, threshold, y, finishGesture]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {/* Indicator perched above the content; transforms with the drag */}
      <motion.div
        aria-hidden
        style={{ opacity: indicatorOpacity, y, top: -threshold + 16 }}
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

      <motion.div style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
