// Notebook metadata is stored in localStorage, scoped per account email so
// renaming on Device A doesn't bleed metadata into Device B's session. The
// notes themselves carry the notebook name string in their encrypted vault
// — this store only adds optional metadata (icon, order) and remembers
// "empty" notebooks the user created before adding any notes to them.

export interface NotebookMeta {
  name: string;
  icon?: string;     // emoji
  order?: number;
}

const KEY_PREFIX = 'iv_notebooks_v1';

function emailSuffix(email: string | null | undefined): string {
  if (!email) return 'guest';
  return email.toLowerCase().trim().replace(/[^a-z0-9_@.-]/g, '_');
}

function key(email: string | null | undefined): string {
  return `${KEY_PREFIX}_${emailSuffix(email)}`;
}

export function loadNotebookMeta(email: string | null | undefined): NotebookMeta[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n): n is NotebookMeta => !!n && typeof n.name === 'string');
  } catch {
    return [];
  }
}

export function saveNotebookMeta(email: string | null | undefined, list: NotebookMeta[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key(email), JSON.stringify(list));
  } catch { /* quota; harmless to drop */ }
}

export function upsertNotebook(email: string | null | undefined, name: string, patch: Partial<NotebookMeta> = {}): NotebookMeta[] {
  const list = loadNotebookMeta(email);
  const idx = list.findIndex(n => n.name.toLowerCase() === name.toLowerCase());
  if (idx === -1) {
    list.push({ name, ...patch });
  } else {
    list[idx] = { ...list[idx], ...patch, name: list[idx].name };
  }
  saveNotebookMeta(email, list);
  return list;
}

export function renameNotebook(email: string | null | undefined, oldName: string, newName: string): NotebookMeta[] {
  const list = loadNotebookMeta(email);
  const idx = list.findIndex(n => n.name.toLowerCase() === oldName.toLowerCase());
  if (idx === -1) {
    list.push({ name: newName });
  } else {
    list[idx] = { ...list[idx], name: newName };
  }
  saveNotebookMeta(email, list);
  return list;
}

export function removeNotebookMeta(email: string | null | undefined, name: string): NotebookMeta[] {
  const list = loadNotebookMeta(email).filter(n => n.name.toLowerCase() !== name.toLowerCase());
  saveNotebookMeta(email, list);
  return list;
}

// Combine the localStorage metadata with whatever notebook strings the
// notes themselves declare. Returned in stable order: metadata-defined order
// first, then any extra strings from notes alphabetically.
export function combineNotebookList(
  email: string | null | undefined,
  notebookStringsFromNotes: string[],
): NotebookMeta[] {
  const meta = loadNotebookMeta(email);
  const seen = new Set(meta.map(m => m.name.toLowerCase()));
  const extras = Array.from(new Set(
    notebookStringsFromNotes
      .map(s => s.trim())
      .filter(s => !!s && !seen.has(s.toLowerCase())),
  )).sort();
  return [...meta, ...extras.map(name => ({ name }))];
}
