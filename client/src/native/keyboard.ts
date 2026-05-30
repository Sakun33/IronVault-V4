import { Keyboard, KeyboardInfo } from '@capacitor/keyboard';
import { isNativeApp } from './platform';

let keyboardListeners: Array<() => void> = [];
let domListeners: Array<() => void> = [];
let currentKeyboardHeight = 0;

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
 *
 * Additionally, this module installs a global `focusin` + `selectionchange`
 * listener that keeps the active input / caret position scrolled above the
 * keyboard. Browser auto-scroll on focus is unreliable when (a) the focused
 * element lives in a nested `overflow-y-auto` container, and (b) the user
 * continues typing past the visible bottom edge — both common in the notes
 * editor. We re-implement the scroll-into-view logic ourselves.
 */
export async function setupKeyboardHandling() {
  installVisualViewportFallback();
  installFocusAndCaretTracking();

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
  domListeners.forEach(remove => remove());
  domListeners = [];
}

function handleKeyboardShow(info: KeyboardInfo) {
  const keyboardHeight = info.keyboardHeight;
  applyKeyboardHeight(keyboardHeight);

  // Defer one frame so the layout reflects the new viewport, then scroll.
  setTimeout(() => {
    const active = document.activeElement as HTMLElement | null;
    if (isEditableElement(active)) {
      scrollEditableIntoView(active);
    }
  }, 100);
}

function handleKeyboardHide() {
  applyKeyboardHeight(0);
}

function applyKeyboardHeight(px: number) {
  const normalized = Math.max(0, Math.round(px));
  currentKeyboardHeight = normalized;
  const root = document.documentElement;
  root.style.setProperty('--keyboard-height', `${normalized}px`);
  if (normalized > 0) {
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

/**
 * Global focus + caret tracking. Browser auto-scroll is unreliable for
 * nested scroll containers (the notes editor body is an `overflow-y-auto`
 * div, not the document scroller) and never scrolls the caret inside a
 * `contenteditable` once focus is established. We patch both:
 *
 *  - `focusin`: scroll the newly-focused input / textarea / contenteditable
 *    into view, biased toward `block: center` so iOS keyboard reveal lands
 *    the field comfortably above the keyboard.
 *  - `selectionchange`: when the keyboard is open AND focus is in a
 *    contenteditable, ensure the caret rect stays above the keyboard. We
 *    walk to the nearest scroll-y ancestor and scrollBy() the delta needed
 *    to bring the caret back into view.
 */
function installFocusAndCaretTracking() {
  if (typeof document === 'undefined') return;

  const onFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (!isEditableElement(target)) return;
    // Defer so the keyboard has a chance to start opening and the
    // viewport has resized; otherwise we scroll relative to the wrong
    // visible height.
    window.setTimeout(() => scrollEditableIntoView(target), 180);
  };

  let caretSchedToken: number | null = null;
  const onSelectionChange = () => {
    if (currentKeyboardHeight <= 0) return;
    if (caretSchedToken !== null) return;
    caretSchedToken = window.requestAnimationFrame(() => {
      caretSchedToken = null;
      scrollCaretIntoView();
    });
  };

  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('selectionchange', onSelectionChange);

  domListeners.push(
    () => document.removeEventListener('focusin', onFocusIn),
    () => document.removeEventListener('selectionchange', onSelectionChange),
    () => { if (caretSchedToken !== null) cancelAnimationFrame(caretSchedToken); caretSchedToken = null; },
  );
}

function isEditableElement(el: HTMLElement | null): el is HTMLElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT') {
    // Buttons/checkboxes/etc. don't open the keyboard.
    const type = (el as HTMLInputElement).type;
    return !['button', 'submit', 'checkbox', 'radio', 'file', 'image', 'reset', 'range'].includes(type);
  }
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

function scrollEditableIntoView(el: HTMLElement) {
  try {
    // Block: 'center' biases the field comfortably above the keyboard on
    // both iOS and Android. The native call handles nested scroll parents
    // correctly because we're targeting the element itself, not a range.
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    /* noop */
  }
}

function scrollCaretIntoView() {
  const active = document.activeElement as HTMLElement | null;
  if (!active || !active.isContentEditable) return;

  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0).cloneRange();

  let rect = range.getBoundingClientRect();
  // Collapsed range at start of an empty line returns a zero-size rect on
  // some browsers — fall back to inserting a temporary marker to measure.
  if (rect.width === 0 && rect.height === 0) {
    const marker = document.createElement('span');
    marker.appendChild(document.createTextNode('​'));
    range.insertNode(marker);
    rect = marker.getBoundingClientRect();
    marker.parentNode?.removeChild(marker);
    // Restore the original collapsed selection
    try { sel.removeAllRanges(); sel.addRange(range); } catch { /* noop */ }
  }

  if (rect.width === 0 && rect.height === 0) return;

  const visibleBottom = window.innerHeight - currentKeyboardHeight;
  const margin = 32; // breathing room above the keyboard

  if (rect.bottom > visibleBottom - margin) {
    const delta = rect.bottom - (visibleBottom - margin);
    nudgeScrollAncestors(active, delta);
  } else if (rect.top < margin) {
    const delta = margin - rect.top;
    nudgeScrollAncestors(active, -delta);
  }
}

/**
 * Scroll by `delta` (positive = scroll content up) in the nearest scrollable
 * ancestor, falling back to the window. Walks up the parent chain so the
 * notes editor's `overflow-y-auto` body absorbs the scroll before the
 * document. We only nudge the first scrollable ancestor that has room;
 * scrolling multiple parents would over-shoot.
 */
function nudgeScrollAncestors(el: HTMLElement, delta: number) {
  if (Math.abs(delta) < 1) return;

  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== document.body) {
    const style = getComputedStyle(cur);
    const overflowY = style.overflowY;
    const scrollable = (overflowY === 'auto' || overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight;
    if (scrollable) {
      const before = cur.scrollTop;
      cur.scrollTo({ top: before + delta, behavior: 'smooth' });
      // If the parent could fully absorb the nudge, stop. Otherwise also
      // ask the window to pick up the slack.
      const willConsume = delta > 0
        ? cur.scrollHeight - (before + cur.clientHeight) > 0
        : before > 0;
      if (willConsume) return;
      break;
    }
    cur = cur.parentElement;
  }
  window.scrollBy({ top: delta, behavior: 'smooth' });
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
