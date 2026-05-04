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
 */
let editing = false;

export function setNoteEditing(v: boolean): void {
  editing = v;
}

export function isNoteEditing(): boolean {
  return editing;
}
