/**
 * Font-scale preference. Stored as a multiplier in localStorage and
 * applied to the root element via the `--iv-font-scale` CSS variable.
 * The matching CSS rule in `index.css` reads the variable to set the
 * root font-size, so all rem-based styles in the app pick it up
 * automatically.
 */

export const FONT_SCALE_KEY = 'iv_font_scale';

/** Multiplier presets — matches 14 / 16 / 18 / 20 px at 16px base. */
export const FONT_SCALE_PRESETS = [
  { id: 'small',  label: 'Small',       px: 14, scale: 0.875 },
  { id: 'default', label: 'Default',     px: 16, scale: 1.0   },
  { id: 'large',   label: 'Large',       px: 18, scale: 1.125 },
  { id: 'xlarge',  label: 'Extra Large', px: 20, scale: 1.25  },
] as const;

export type FontScalePresetId = typeof FONT_SCALE_PRESETS[number]['id'];

export const FONT_SCALE_MIN = 0.75;
export const FONT_SCALE_MAX = 1.5;
export const FONT_SCALE_DEFAULT = 1.0;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return FONT_SCALE_DEFAULT;
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n));
}

export function readFontScale(): number {
  try {
    const raw = localStorage.getItem(FONT_SCALE_KEY);
    if (!raw) return FONT_SCALE_DEFAULT;
    const n = parseFloat(raw);
    return clamp(n);
  } catch {
    return FONT_SCALE_DEFAULT;
  }
}

export function writeFontScale(scale: number): void {
  const clamped = clamp(scale);
  try { localStorage.setItem(FONT_SCALE_KEY, String(clamped)); } catch { /* ignore */ }
  applyFontScale(clamped);
  try {
    window.dispatchEvent(new CustomEvent('iv:font-scale:changed', {
      detail: { scale: clamped },
    }));
  } catch { /* SSR / no DOM — ignore */ }
}

export function applyFontScale(scale: number): void {
  if (typeof document === 'undefined') return;
  const clamped = clamp(scale);
  document.documentElement.style.setProperty('--iv-font-scale', String(clamped));
}

/** Apply the persisted scale on app boot — call once from main.tsx. */
export function initFontScale(): void {
  applyFontScale(readFontScale());
}

export function matchPreset(scale: number): FontScalePresetId | null {
  const found = FONT_SCALE_PRESETS.find(p => Math.abs(p.scale - scale) < 0.01);
  return found?.id ?? null;
}
