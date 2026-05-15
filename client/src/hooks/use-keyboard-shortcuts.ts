import { useEffect } from 'react';

type ShortcutHandlers = {
  /** Cmd/Ctrl+K — open command palette / global search. */
  onSearch?: () => void;
  /** Cmd/Ctrl+N — create new item (page decides what "new" means). */
  onNew?: () => void;
  /** Cmd/Ctrl+L — lock vault. */
  onLock?: () => void;
  /** Cmd/Ctrl+G — open password generator. */
  onGenerator?: () => void;
  /** Escape — close the topmost overlay (modal, palette, search). */
  onEscape?: () => void;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
};

/**
 * Global keyboard shortcuts. Each handler is optional; only bound shortcuts
 * fire. Cmd (Mac) and Ctrl (Win/Linux) are both treated as the modifier so
 * the same chord works cross-platform.
 *
 * Behaviour notes:
 * - Cmd/Ctrl+N and Cmd/Ctrl+L would otherwise trigger the browser's
 *   "new window" / "focus address bar" — preventDefault is essential.
 * - Escape always fires, even from inside an input, so the user can dismiss
 *   the active overlay without having to blur first. The other shortcuts
 *   suppress themselves when the user is typing into a real field.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (key === 'escape') {
        if (handlers.onEscape) {
          handlers.onEscape();
        }
        return;
      }

      if (!mod) return;
      // Don't hijack typing inside inputs / contenteditable for "new" / "lock"
      // / "generator". Cmd/Ctrl+K stays bound because users expect global
      // search from anywhere.
      const typing = isEditableTarget(e.target);

      if (key === 'k' && handlers.onSearch) {
        e.preventDefault();
        handlers.onSearch();
        return;
      }
      if (typing) return;

      if (key === 'n' && handlers.onNew) {
        e.preventDefault();
        handlers.onNew();
        return;
      }
      if (key === 'l' && handlers.onLock) {
        e.preventDefault();
        handlers.onLock();
        return;
      }
      if (key === 'g' && handlers.onGenerator) {
        e.preventDefault();
        handlers.onGenerator();
        return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers.onSearch, handlers.onNew, handlers.onLock, handlers.onGenerator, handlers.onEscape]);
}
