import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { isNativeApp } from './platform';

let keyboardListeners: Array<() => void> = [];

/**
 * Sets up global keyboard layout handling for the entire app.
 *
 * Two layers cooperate:
 *  1. Capacitor `resize: 'body'` (set in capacitor.config.ts) shrinks the
 *     WKWebView body so `100dvh` already excludes the keyboard.
 *  2. This module additionally exposes the keyboard height as the CSS var
 *     `--keyboard-height` on `<html>` and toggles a `kb-open` class. Some
 *     surfaces (fixed dialogs, sticky footers) can use this for fine-tuned
 *     padding/translation, since `body` resize alone does not affect
 *     `position: fixed` elements that overlay the bottom edge.
 *
 * On the web (no Capacitor), the same vars are driven by `visualViewport`
 * so software keyboards on mobile browsers get the same treatment.
 */
export async function setupKeyboardHandling() {
  installVisualViewportFallback();

  if (!isNativeApp()) return;

  try {
    const showListener = await Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
      handleKeyboardShow(info);
    });

    const didShowListener = await Keyboard.addListener('keyboardDidShow', (info: KeyboardInfo) => {
      handleKeyboardShow(info);
    });

    const hideListener = await Keyboard.addListener('keyboardWillHide', () => {
      handleKeyboardHide();
    });

    const didHideListener = await Keyboard.addListener('keyboardDidHide', () => {
      handleKeyboardHide();
    });

    keyboardListeners.push(
      () => showListener.remove(),
      () => didShowListener.remove(),
      () => hideListener.remove(),
      () => didHideListener.remove(),
    );

    await Keyboard.setAccessoryBarVisible({ isVisible: true });
  } catch {
    /* native plugin unavailable — visualViewport fallback already wired */
  }
}

export function cleanupKeyboardHandling() {
  keyboardListeners.forEach(remove => remove());
  keyboardListeners = [];
}

function handleKeyboardShow(info: KeyboardInfo) {
  const keyboardHeight = info.keyboardHeight;
  applyKeyboardHeight(keyboardHeight);

  const activeElement = document.activeElement as HTMLElement | null;
  if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
    setTimeout(() => {
      try {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch {
        /* noop */
      }
    }, 100);
  }
}

function handleKeyboardHide() {
  applyKeyboardHeight(0);
}

function applyKeyboardHeight(px: number) {
  const root = document.documentElement;
  root.style.setProperty('--keyboard-height', `${Math.max(0, Math.round(px))}px`);
  if (px > 0) {
    root.classList.add('kb-open');
  } else {
    root.classList.remove('kb-open');
  }
}

/**
 * Fallback for web (and a safety net on native): the VisualViewport API
 * reports the on-screen-keyboard offset on iOS Safari, Android Chrome, and
 * inside the WKWebView. We diff `window.innerHeight - viewport.height` and
 * mirror it into the same `--keyboard-height` var the native listeners set.
 */
function installVisualViewportFallback() {
  if (typeof window === 'undefined') return;
  const vv = window.visualViewport;
  if (!vv) return;

  let lastApplied = -1;
  const sync = () => {
    const diff = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
    // Ignore tiny noise (URL bar nudges) under 80px — keyboards are always
    // bigger than that and we don't want every scroll repainting the layout.
    const next = diff > 80 ? diff : 0;
    if (next === lastApplied) return;
    lastApplied = next;
    applyKeyboardHeight(next);
  };

  vv.addEventListener('resize', sync);
  vv.addEventListener('scroll', sync);
  sync();
}

export async function hideKeyboard() {
  if (!isNativeApp()) return;
  try {
    await Keyboard.hide();
  } catch (error) {
  }
}

export async function showKeyboard() {
  if (!isNativeApp()) return;
  try {
    await Keyboard.show();
  } catch (error) {
  }
}
