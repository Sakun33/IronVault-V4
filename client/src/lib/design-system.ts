import type { Variants, Transition } from 'motion/react';

// ── Glassmorphism presets ──────────────────────────────────────────────────
// Tailwind class strings — compose via cn() in components. Tuned for dark
// mode first; the white-channel alphas are low enough that they read as
// translucent glass on light backgrounds too.
export const glass = {
  base: 'backdrop-blur-xl bg-white/5 border border-white/10',
  card: 'backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)]',
  cardHover: 'hover:bg-white/10 hover:border-white/20 transition-colors duration-200',
  surface: 'backdrop-blur-2xl bg-background/60 border-r border-white/10',
  input: 'backdrop-blur-md bg-white/5 border border-white/10 focus-visible:border-emerald-400/50 focus-visible:ring-2 focus-visible:ring-emerald-400/30 transition-all duration-200',
  ghostHover: 'hover:backdrop-blur-md hover:bg-white/5',
} as const;

// ── Gradient presets ───────────────────────────────────────────────────────
export const gradient = {
  emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500',
  emeraldHover: 'hover:from-emerald-400 hover:to-teal-400',
  emeraldGlow: 'shadow-[0_8px_24px_-6px_rgba(16,185,129,0.55)] hover:shadow-[0_12px_32px_-6px_rgba(16,185,129,0.7)]',
  border: 'before:absolute before:inset-0 before:rounded-[inherit] before:p-px before:[background:linear-gradient(135deg,rgba(16,185,129,0.5),rgba(20,184,166,0.25),transparent)] before:[mask:linear-gradient(#000,#000)_content-box,linear-gradient(#000,#000)] before:[mask-composite:exclude] before:pointer-events-none',
  text: 'bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent',
} as const;

// ── Motion easing / spring physics ─────────────────────────────────────────
export const easing = {
  smooth: [0.22, 1, 0.36, 1] as [number, number, number, number],
  spring: { type: 'spring' as const, stiffness: 320, damping: 26, mass: 0.6 },
  springSoft: { type: 'spring' as const, stiffness: 260, damping: 30, mass: 0.8 },
};

// ── Animation presets ──────────────────────────────────────────────────────
export const motionPresets = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.25, ease: easing.smooth },
  },
  slideUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 12 },
    transition: { duration: 0.32, ease: easing.smooth },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.96 },
    transition: easing.spring,
  },
  hoverLift: {
    whileHover: { y: -2, transition: easing.spring },
    whileTap: { scale: 0.97, transition: { duration: 0.08 } },
  },
  hoverPress: {
    whileHover: { scale: 1.02, transition: easing.spring },
    whileTap: { scale: 0.97, transition: { duration: 0.08 } },
  },
  pulse: {
    animate: { scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] },
    transition: { duration: 2.4, repeat: Infinity, ease: easing.smooth as any },
  },
} as const;

// ── Stagger helpers ────────────────────────────────────────────────────────
export const staggerContainer = (gap = 0.04): Variants => ({
  initial: {},
  animate: { transition: { staggerChildren: gap } },
});

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easing.smooth } as Transition },
};
