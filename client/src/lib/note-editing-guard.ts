/**
 * Single source of truth for "is the user actively editing a note right now?"
 *
 * Background sync and refresh code paths (vault-context.refreshData,
 * use-cloud-auto-sync's pull, etc.) check this flag before destructively
 * touching local state. When the flag is true, those paths skip — the editor
 * is the source of truth while it's open, and a mid-edit refresh would either
 * close the editor outright (when the user's note isn't in the just-pulled
 * cloud blob) or rewrite the editor's note prop and disrupt typing.
 *
 * NoteEditor sets the flag on mount and clears it on unmount via a useEffect.
 *
 * Safety net: a 30-minute auto-reset timer guarantees this flag can never
 * permanently block sync — if the editor's cleanup somehow fails to fire
 * (portal teardown race, hot-reload bug, etc.), the flag still resets after
 * half an hour so cloud sync resumes. Calls to `setNoteEditing(true)` reset
 * the timer, keeping it sliding while the user is actively typing. Every
 * state change is logged so a stuck-true flag can be diagnosed from the
 * browser console.
 */
const SAFETY_TIMEOUT_MS = 30 * 60 * 1000;

let editing = false;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

function clearSafety(): void {
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
}

export function setNoteEditing(v: boolean): void {
  if (editing === v) return; // idempotent — no log churn on re-renders
  editing = v;
  console.info(`[NOTE-GUARD] editing=${v}`);
  clearSafety();
  if (v) {
    safetyTimer = setTimeout(() => {
      console.warn('[NOTE-GUARD] 30-min safety reset — flag was stuck true');
      editing = false;
      safetyTimer = null;
    }, SAFETY_TIMEOUT_MS);
  }
}

export function isNoteEditing(): boolean {
  return editing;
}

/** Force-clear the flag. Used by route-change listeners and the periodic
 *  safety net so an unmount race can't permanently disable cloud sync. */
export function resetNoteEditing(): void {
  if (editing) {
    console.warn('[NOTE-GUARD] resetNoteEditing() called — flag was true');
  }
  editing = false;
  clearSafety();
}
