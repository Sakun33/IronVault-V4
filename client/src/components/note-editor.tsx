import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, Pin, Trash2, MoreHorizontal, Check, Save,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List as ListBullets, ListOrdered, CheckSquare,
  Code, Minus, Tag as TagIcon, X, BookOpen, Palette, Copy as CopyIcon,
  Share2, Highlighter, Quote, Search as SearchIcon, Plus, Sparkles,
  RotateCcw, RotateCw, Indent, Outdent, RemoveFormatting,
  Link2, Type,
} from 'lucide-react';
import { NoteEntry } from '@shared/schema';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { combineNotebookList, upsertNotebook, type NotebookMeta } from '@/lib/notebooks-store';
import { SlashMenu, SLASH_COMMANDS } from '@/components/slash-menu';
import { InNoteSearch } from '@/components/in-note-search';
import { setNoteEditing } from '@/lib/note-editing-guard';
import { toast } from '@/hooks/use-toast';

export const NOTE_ACCENT_PALETTE: Array<{ id: string; name: string; hex: string }> = [
  { id: 'emerald', name: 'Emerald', hex: '#10b981' },
  { id: 'sky',     name: 'Sky',     hex: '#0ea5e9' },
  { id: 'violet',  name: 'Violet',  hex: '#8b5cf6' },
  { id: 'amber',   name: 'Amber',   hex: '#f59e0b' },
  { id: 'rose',    name: 'Rose',    hex: '#f43f5e' },
  { id: 'slate',   name: 'Gray',    hex: '#64748b' },
];

const NOTE_TEXT_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Default', hex: 'inherit' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Sky',     hex: '#0ea5e9' },
  { name: 'Violet',  hex: '#8b5cf6' },
  { name: 'Amber',   hex: '#f59e0b' },
  { name: 'Rose',    hex: '#f43f5e' },
  { name: 'Red',     hex: '#ef4444' },
  { name: 'Slate',   hex: '#94a3b8' },
];

export type NoteFormPayload = Pick<NoteEntry, 'title' | 'content' | 'notebook' | 'tags' | 'isPinned' | 'color'>;

interface NoteEditorProps {
  open: boolean;
  note: NoteEntry | null;
  starter?: { content?: string; notebook?: string };
  defaultNotebook?: string;
  /** Email used to namespace notebook metadata in localStorage. */
  accountEmail?: string | null;
  /** All known tags from the user's notes — drives the autocomplete. */
  knownTags?: string[];
  /** Notebook strings used by existing notes — combined with localStorage metadata. */
  knownNotebooks?: string[];
  onClose: () => void;
  onSave: (payload: NoteFormPayload) => Promise<void> | void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  bottomGutterPx?: number;
  /** When true, render in a docked pane (no x-slide animation, no fixed-position overlay). */
  embedded?: boolean;
}

function htmlToText(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

function timeAgoShort(date: Date | string | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}

/**
 * Notes editor — used as a fullscreen overlay on mobile/tablet AND as the
 * docked right pane on the desktop three-pane layout (`embedded` flag).
 *
 * Composition:
 * - top bar: ← Back · Search · Pin · Share · ⋯ More
 * - notebook + tag row (small, muted)
 * - title (26px bold, no border)
 * - body (contentEditable, 16px / 1.7)
 * - 2-row formatting toolbar pinned to the bottom (mobile) or top (desktop)
 *
 * Viewer mode is toggled via the More menu — when true, the body becomes
 * non-editable and renders the saved HTML; checkboxes are still
 * interactive (tap to toggle, autosave fires).
 */
export function NoteEditor({
  open,
  note,
  starter,
  defaultNotebook = 'personal',
  accountEmail,
  knownTags = [],
  knownNotebooks = [],
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  bottomGutterPx = 0,
  embedded = false,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [notebook, setNotebook] = useState(note?.notebook ?? defaultNotebook);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [color, setColor] = useState<string | undefined>(note?.color);
  const [contentHtml, setContentHtml] = useState<string>(() => initialHtml(note, starter));
  const [tagInput, setTagInput] = useState('');
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [tagAutocomplete, setTagAutocomplete] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [headingCycle, setHeadingCycle] = useState(0);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(note?.updatedAt ? new Date(note.updatedAt) : null);
  const [saving, setSaving] = useState(false);
  const [viewerMode, setViewerMode] = useState<boolean>(!!note); // existing notes open in view mode
  const [searchOpen, setSearchOpen] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{ open: boolean; pos: { top: number; left: number } | null; query: string }>({ open: false, pos: null, query: '' });
  const [newNotebookOpen, setNewNotebookOpen] = useState(false);
  const [newNotebookValue, setNewNotebookValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  // Selection range cached when opening the color picker — DOM popovers steal
  // the selection on iOS Safari, so we restore it before applying the color.
  const colorPickerRangeRef = useRef<Range | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const lastSnapshotRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);
  // Tracks the note?.id we last fully reset state for. Lets us detect the
  // "new note just got promoted to a real id via autosave" transition
  // (null → real) and skip the destructive state reset that would otherwise
  // flip viewerMode from edit → view mid-typing — the user-facing
  // "editor closes after a few seconds" bug.
  const prevNoteIdRef = useRef<string | null | undefined>(undefined);

  // Lift the bottom toolbar above the soft keyboard on mobile (visualViewport)
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (!open || embedded) return;
    const vv = (typeof window !== 'undefined' && window.visualViewport) || null;
    if (!vv) return;
    const update = () => {
      const intrusion = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(intrusion > 40 ? Math.round(intrusion) : 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open, embedded]);

  // Tell the rest of the app the editor is open so background sync code
  // paths (vault-context.refreshData, cloud auto-pull, auto-lock idle
  // timer) can skip destructive refreshes that would otherwise unmount
  // or reset the editor mid-edit. We set the flag SYNCHRONOUSLY during
  // render (not in a useEffect) so the very first render — before any
  // paint — already has the guard active; otherwise a sync that landed
  // in the same microtask as the editor mount could still slip through.
  // The cleanup useEffect below clears it on unmount.
  if (open) setNoteEditing(true);
  useEffect(() => {
    if (!open) return;
    return () => setNoteEditing(false);
  }, [open]);

  // Reset all the form-shaped state (title / notebook / tags / pin / color
  // / contentHtml) when the note id flips. The DOM-side innerHTML sync is
  // handled by the useLayoutEffect below — that one runs synchronously
  // after commit and is the actual fix for "body shows truncated content
  // on reopen".
  useEffect(() => {
    if (!open) {
      prevNoteIdRef.current = undefined;
      return;
    }
    const prevId = prevNoteIdRef.current;
    const currentId = note?.id ?? null;
    // Save-promotion detection: prev id was null (new-note session) and we
    // now have a real id from a successful autosave. The editor's in-memory
    // state already matches what got saved (runSave just wrote it), so a
    // reset here would flip viewerMode true mid-typing and destroy the
    // user's session. Bump the savedAt indicator and bail.
    if (prevId === null && currentId !== null) {
      prevNoteIdRef.current = currentId;
      if (note?.updatedAt) setSavedAt(new Date(note.updatedAt));
      return;
    }
    prevNoteIdRef.current = currentId;
    setTitle(note?.title ?? '');
    setNotebook(note?.notebook ?? defaultNotebook);
    setTags(note?.tags ?? []);
    setIsPinned(note?.isPinned ?? false);
    setColor(note?.color);
    const html = initialHtml(note, starter);
    setContentHtml(html);
    setSavedAt(note?.updatedAt ? new Date(note.updatedAt) : null);
    setHeadingCycle(0);
    setTagInputOpen(false);
    setMoreMenuOpen(false);
    setSearchOpen(false);
    setSubmitted(false);
    setViewerMode(!!note); // existing → view, new → edit
    lastSnapshotRef.current = serializeForCompare({
      title: note?.title ?? '',
      html,
      notebook: note?.notebook ?? defaultNotebook,
      tags: note?.tags ?? [],
      isPinned: note?.isPinned ?? false,
      color: note?.color,
    });
    requestAnimationFrame(() => {
      if (!note) titleRef.current?.focus();
    });
  }, [open, note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // SYNCHRONOUS contentEditable population. Runs only when the editor
  // opens or the note id changes (i.e. switching to a different note).
  //
  // We deliberately do NOT depend on note?.updatedAt or note?.content.
  // Those change every time autosave commits — the parent re-renders
  // with `setEditingNote({...prev, ...payload, updatedAt: new Date()})`
  // (or, after the linked notes.tsx fix, the note prop ref is stable
  // across saves). Either way, re-running this effect on save is wrong:
  // the editor's local state already matches what was just saved, and
  // mutating el.innerHTML mid-edit drops focus on iOS, dismisses the
  // keyboard, and looks to the user like the editor "closed".
  //
  // Cloud pull / duplicate / undo paths that change a note out from
  // under the user are already gated by `isNoteEditing()` while the
  // editor is open, so we don't need updatedAt to catch them — they
  // can only land after the editor closes, and reopening it goes
  // through the id-change path here.
  useLayoutEffect(() => {
    if (!open) return;
    const el = editorRef.current;
    if (!el) return;
    if (typeof document !== 'undefined' && document.activeElement === el) return;
    // QA-R2 H8: re-sanitize on read. Saves go through DOMPurify in
    // runSave(), but a vault that was imported from another build (or an
    // older client whose sanitizer rule-set differed) could carry HTML
    // that doesn't match our current allow-list. Running through
    // DOMPurify on every load means we never feed unvetted markup back
    // into the contentEditable surface, even if the storage layer is
    // somehow compromised. Same allow-list as runSave so round-trips
    // are stable.
    const raw = initialHtml(note, starter);
    const html = DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'div', 'code', 'pre', 'hr', 'blockquote', 'input', 'span', 'a', 'font'],
      ALLOWED_ATTR: ['type', 'checked', 'class', 'data-todo', 'style', 'href', 'target', 'rel', 'color'],
      ALLOWED_CSS_PROPERTIES: ['background-color', 'color'],
    });
    if (el.innerHTML !== html) el.innerHTML = html;
    const isEmpty = (el.textContent || '').trim() === '';
    if (isEmpty) el.setAttribute('data-empty', 'true');
    else el.removeAttribute('data-empty');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id]);

  // Combined notebook list (metadata + notes' strings)
  const notebookOptions = useMemo<NotebookMeta[]>(() => {
    const list = combineNotebookList(accountEmail ?? null, knownNotebooks);
    if (notebook && !list.find(n => n.name.toLowerCase() === notebook.toLowerCase())) {
      list.push({ name: notebook });
    }
    return list;
  }, [accountEmail, knownNotebooks, notebook]);

  // Tag autocomplete suggestions
  const tagSuggestions = useMemo(() => {
    if (!tagInput.trim()) return knownTags.filter(t => !tags.includes(t)).slice(0, 8);
    const q = tagInput.toLowerCase().replace(/^#/, '');
    return knownTags
      .filter(t => t.toLowerCase().includes(q) && !tags.includes(t))
      .slice(0, 8);
  }, [tagInput, knownTags, tags]);

  const wordCount = useMemo(() => {
    const text = htmlToText(contentHtml);
    return text ? text.split(' ').filter(Boolean).length : 0;
  }, [contentHtml]);

  const currentSnapshot = useMemo(
    () => serializeForCompare({ title, html: contentHtml, notebook, tags, isPinned, color }),
    [title, contentHtml, notebook, tags, isPinned, color],
  );
  const dirty = currentSnapshot !== lastSnapshotRef.current;

  // Autosave removed by request — save now only fires on Done button,
  // Back button, swipe-back, or Cmd/Ctrl+S. The "Unsaved" → "Saving"
  // flicker during typing was distracting and could race with closing.
  // saveTimerRef is kept so any in-flight timer from a stale render is
  // still cleared safely (and to make this comment block resilient to
  // future reintroduction).

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (slashMenu.open) { setSlashMenu({ open: false, pos: null, query: '' }); return; }
        if (colorPickerOpen) { setColorPickerOpen(false); return; }
        if (moreMenuOpen) { setMoreMenuOpen(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        if (tagInputOpen) { setTagInputOpen(false); return; }
      }
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); void runSave(); return; }
      if (key === 'f') { e.preventDefault(); setSearchOpen(true); return; }
      if (key === 'b') { e.preventDefault(); applyFormat('bold'); return; }
      if (key === 'i') { e.preventDefault(); applyFormat('italic'); return; }
      if (key === 'u') { e.preventDefault(); applyFormat('underline'); return; }
      if (key === 'z' && e.shiftKey) { e.preventDefault(); applyFormat('redo'); return; }
      if (key === 'y') { e.preventDefault(); applyFormat('redo'); return; }
      if (key === 'z' && !e.shiftKey) { e.preventDefault(); applyFormat('undo'); return; }
      if (key === 'k') { e.preventDefault(); applyLink(); return; }
      if (e.shiftKey && key === '7') { e.preventDefault(); applyFormat('insertOrderedList'); return; }
      if (e.shiftKey && key === '8') { e.preventDefault(); applyFormat('insertUnorderedList'); return; }
      if (e.shiftKey && key === '9') { e.preventDefault(); insertChecklistItem(); return; }
      if (e.shiftKey && key === 'l') { e.preventDefault(); applyFormat('insertUnorderedList'); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, moreMenuOpen, tagInputOpen, slashMenu.open, searchOpen, colorPickerOpen]);

  // Close the color picker when the user taps outside of it.
  useEffect(() => {
    if (!colorPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[role="menu"][aria-label="Text color"]')) return;
      if (target.closest('[aria-label="Text color"]')) return;
      setColorPickerOpen(false);
      colorPickerRangeRef.current = null;
    };
    document.addEventListener('mousedown', onDocClick, true);
    return () => document.removeEventListener('mousedown', onDocClick, true);
  }, [colorPickerOpen]);

  const runSave = async () => {
    if (!title.trim() && !htmlToText(contentHtml).trim()) return;
    setSaving(true);
    try {
      const sanitized = DOMPurify.sanitize(contentHtml, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'div', 'code', 'pre', 'hr', 'blockquote', 'input', 'span', 'a', 'font'],
        ALLOWED_ATTR: ['type', 'checked', 'class', 'data-todo', 'style', 'href', 'target', 'rel', 'color'],
        ALLOWED_CSS_PROPERTIES: ['background-color', 'color'],
      });
      // Persist notebook metadata so empty notebooks still appear in the list
      if (accountEmail && notebook) upsertNotebook(accountEmail, notebook);
      await onSave({
        title: title.trim() || 'Untitled',
        content: sanitized,
        notebook,
        tags,
        isPinned,
        color,
      });
      lastSnapshotRef.current = currentSnapshot;
      setSavedAt(new Date());
      void hapticSuccess();
    } catch { /* parent toast */ }
    finally { setSaving(false); }
  };

  // Format helpers ──────────────────────────────────────────────────────────
  const sampleActiveFormats = () => {
    if (!editorRef.current) return;
    const next = new Set<string>();
    try {
      if (document.queryCommandState('bold')) next.add('bold');
      if (document.queryCommandState('italic')) next.add('italic');
      if (document.queryCommandState('underline')) next.add('underline');
      if (document.queryCommandState('strikeThrough')) next.add('strike');
      if (document.queryCommandState('insertUnorderedList')) next.add('ul');
      if (document.queryCommandState('insertOrderedList')) next.add('ol');
    } catch { /* unsupported */ }
    setActiveFormats(next);
  };

  const applyFormat = (cmd: string, value?: string) => {
    if (viewerMode) setViewerMode(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    try { document.execCommand(cmd, false, value); } catch { /* noop */ }
    syncEditorState();
    void hapticLight();
  };

  const applyHeading = (level: 0 | 1 | 2 | 3) => {
    if (viewerMode) setViewerMode(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    const block = level === 0 ? 'P' : `H${level}`;
    try { document.execCommand('formatBlock', false, block); } catch { /* noop */ }
    setHeadingCycle(level);
    syncEditorState();
  };

  const applyHighlight = () => {
    if (viewerMode) setViewerMode(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    // Remove existing highlight wrapper if the selection is fully inside one
    const parent = range.commonAncestorContainer.parentElement;
    if (parent && parent.tagName === 'MARK') {
      const text = parent.textContent || '';
      const tn = document.createTextNode(text);
      parent.replaceWith(tn);
    } else {
      const mark = document.createElement('mark');
      mark.appendChild(range.extractContents());
      range.insertNode(mark);
    }
    syncEditorState();
  };

  const applyQuote = () => {
    if (viewerMode) setViewerMode(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    try { document.execCommand('formatBlock', false, 'BLOCKQUOTE'); } catch { /* noop */ }
    syncEditorState();
  };

  const insertChecklistItem = () => {
    if (viewerMode) setViewerMode(false);
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    // Build the checklist row imperatively so we can put the caret INSIDE
    // the empty <span> — execCommand('insertHTML') leaves the caret after
    // the inserted block, which dropped users into a sibling <p> and made
    // typing skip the checklist row entirely.
    const div = document.createElement('div');
    div.setAttribute('data-todo', '1');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'iv-todo-check';
    const span = document.createElement('span');
    span.appendChild(document.createTextNode('​')); // zero-width so the caret has a position
    div.appendChild(cb);
    div.appendChild(document.createTextNode(' '));
    div.appendChild(span);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      // If caret is inside an empty paragraph, replace it. Otherwise insert
      // after the closest block-level ancestor.
      let block: Node | null = range.startContainer;
      while (block && block !== ed) {
        if (block.nodeType === 1) {
          const tag = (block as HTMLElement).tagName;
          if (tag === 'P' || tag === 'DIV' || tag === 'LI' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'BLOCKQUOTE' || tag === 'PRE') break;
        }
        block = block.parentNode;
      }
      if (block && block !== ed) {
        const blockEl = block as HTMLElement;
        const text = (blockEl.textContent || '').trim();
        if (!text && blockEl.tagName === 'P') {
          blockEl.replaceWith(div);
        } else {
          blockEl.parentNode?.insertBefore(div, blockEl.nextSibling);
        }
      } else {
        ed.appendChild(div);
      }
    } else {
      ed.appendChild(div);
    }

    // Place caret inside the empty span (after the zero-width char)
    try {
      const r = document.createRange();
      r.selectNodeContents(span);
      r.collapse(false);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
    } catch { /* noop */ }
    syncEditorState();
  };

  const insertDivider = () => {
    if (viewerMode) setViewerMode(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    try { document.execCommand('insertHTML', false, '<hr/><p><br/></p>'); } catch { /* noop */ }
    syncEditorState();
  };

  const applyLink = () => {
    if (viewerMode) setViewerMode(false);
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    // Detect existing anchor at caret so we can edit/remove instead of nesting.
    let node: Node | null = range.startContainer;
    let existing: HTMLAnchorElement | null = null;
    while (node && node !== ed) {
      if (node.nodeType === 1 && (node as HTMLElement).tagName === 'A') {
        existing = node as HTMLAnchorElement;
        break;
      }
      node = node.parentNode;
    }
    const current = existing?.getAttribute('href') ?? '';
    const input = window.prompt(existing ? 'Edit link URL (leave empty to remove):' : 'Enter URL:', current || 'https://');
    if (input === null) return; // cancelled
    const trimmed = input.trim();
    // Empty → unlink
    if (!trimmed) {
      try { document.execCommand('unlink', false); } catch { /* noop */ }
      syncEditorState();
      return;
    }
    // Normalize bare domains to https://
    const normalized = /^(https?:|mailto:|tel:|\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    if (existing) {
      existing.setAttribute('href', normalized);
      existing.setAttribute('target', '_blank');
      existing.setAttribute('rel', 'noopener noreferrer');
    } else if (sel.isCollapsed) {
      // No selection → insert the URL as visible text
      const a = document.createElement('a');
      a.href = normalized;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = normalized;
      range.insertNode(a);
      // Place caret after the inserted link
      const r = document.createRange();
      r.setStartAfter(a);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      try { document.execCommand('createLink', false, normalized); } catch { /* noop */ }
      // Promote target/rel for security on the freshly created anchor.
      const created = ed.querySelector(`a[href="${cssEscape(normalized)}"]`);
      if (created) {
        created.setAttribute('target', '_blank');
        created.setAttribute('rel', 'noopener noreferrer');
      }
    }
    syncEditorState();
    void hapticLight();
  };

  const applyTextColor = (hex: string) => {
    if (viewerMode) setViewerMode(false);
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    // Restore the selection cached when the popover was opened (iOS).
    const cached = colorPickerRangeRef.current;
    if (cached) {
      try {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(cached);
      } catch { /* noop */ }
    }
    if (hex === 'inherit') {
      // Reset color WITHOUT killing bold/italic/underline. Walk the
      // selection contents and strip inline color styles + drop empty
      // <font> wrappers. removeFormat is too aggressive — it'd flatten
      // bold/italic in the same range too.
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        const frag = r.cloneContents();
        const wrap = document.createElement('div');
        wrap.appendChild(frag);
        const stripColor = (n: Node) => {
          if (n.nodeType === 1) {
            const el = n as HTMLElement;
            if (el.style && el.style.color) el.style.color = '';
            if (el.tagName === 'FONT' && el.hasAttribute('color')) el.removeAttribute('color');
            for (const c of Array.from(el.childNodes)) stripColor(c);
            const noAttrs = el.attributes.length === 0;
            const isWrapper = el.tagName === 'FONT' || el.tagName === 'SPAN';
            if (noAttrs && isWrapper && el.parentNode) {
              while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
              el.parentNode.removeChild(el);
            }
          } else {
            for (const c of Array.from(n.childNodes)) stripColor(c);
          }
        };
        stripColor(wrap);
        r.deleteContents();
        const out = document.createDocumentFragment();
        while (wrap.firstChild) out.appendChild(wrap.firstChild);
        r.insertNode(out);
      }
    } else {
      try { document.execCommand('styleWithCSS', false, 'true'); } catch { /* noop */ }
      try { document.execCommand('foreColor', false, hex); } catch { /* noop */ }
    }
    setColorPickerOpen(false);
    colorPickerRangeRef.current = null;
    syncEditorState();
    void hapticLight();
  };

  const openColorPicker = () => {
    if (viewerMode) setViewerMode(false);
    const ed = editorRef.current;
    if (!ed) return;
    // Cache the current selection BEFORE the popover takes focus
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      colorPickerRangeRef.current = sel.getRangeAt(0).cloneRange();
    } else {
      colorPickerRangeRef.current = null;
    }
    setColorPickerOpen(v => !v);
  };

  const applyBeautify = () => {
    if (viewerMode) setViewerMode(false);
    const ed = editorRef.current;
    if (!ed) return;
    ed.focus();
    const before = ed.innerHTML;
    const after = beautifyContent(before);
    if (after !== before) {
      ed.innerHTML = after;
      const isEmpty = (ed.textContent || '').trim() === '';
      if (isEmpty) ed.setAttribute('data-empty', 'true');
      else ed.removeAttribute('data-empty');
      syncEditorState();
      void hapticSuccess();
      toast({ title: 'Formatted!', description: 'Note cleaned up.', duration: 1800 });
    } else {
      toast({ title: 'Already tidy', description: 'No changes needed.', duration: 1500 });
    }
  };

  const syncEditorState = () => {
    if (!editorRef.current) return;
    setContentHtml(editorRef.current.innerHTML);
    sampleActiveFormats();
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const el = editorRef.current;
    setContentHtml(el.innerHTML);
    // Drive the placeholder via a JS-set data attribute so it never lingers
    // when the contentEditable produces structures the CSS :has() selector
    // can't match (e.g. an empty <p><br/></p> sibling next to the typed
    // content paragraph, which iOS WebKit can leave behind on paste).
    const isEmpty = (el.textContent || '').trim() === '';
    if (isEmpty) el.setAttribute('data-empty', 'true');
    else el.removeAttribute('data-empty');
    detectSlashTrigger();
  };

  // Slash command detection: when the user types "/" at the start of a line,
  // open the menu and track the typed query for filtering.
  const detectSlashTrigger = () => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      if (slashMenu.open) setSlashMenu({ open: false, pos: null, query: '' });
      return;
    }
    const range = sel.getRangeAt(0);
    if (!ed.contains(range.startContainer)) return;
    const text = (range.startContainer.textContent || '').slice(0, range.startOffset);
    const slashIdx = text.lastIndexOf('/');
    // Only trigger when "/" is at the start of the line (no preceding non-space)
    if (slashIdx === -1) {
      if (slashMenu.open) setSlashMenu({ open: false, pos: null, query: '' });
      return;
    }
    const before = text.slice(0, slashIdx);
    if (before && !/^\s*$/.test(before)) {
      if (slashMenu.open) setSlashMenu({ open: false, pos: null, query: '' });
      return;
    }
    const query = text.slice(slashIdx + 1);
    if (/[\s\n]/.test(query)) {
      if (slashMenu.open) setSlashMenu({ open: false, pos: null, query: '' });
      return;
    }
    // Position menu under the caret
    const caretRect = range.getBoundingClientRect();
    const editorRect = ed.getBoundingClientRect();
    const top = caretRect.bottom - editorRect.top + 8;
    const left = caretRect.left - editorRect.left;
    setSlashMenu({ open: true, pos: { top, left }, query });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Tab / Shift+Tab → indent / outdent
    if (e.key === 'Tab' && !slashMenu.open) {
      e.preventDefault();
      if (e.shiftKey) {
        try { document.execCommand('outdent', false); } catch { /* noop */ }
      } else {
        try { document.execCommand('indent', false); } catch { /* noop */ }
      }
      syncEditorState();
      return;
    }

    // Markdown shortcut: `# `, `## `, `### ` at start of a line → heading
    if (e.key === ' ' && editorRef.current && !slashMenu.open) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const text = range.startContainer.textContent || '';
      if (text === '#' || text === '##' || text === '###') {
        e.preventDefault();
        const level = text.length;
        range.startContainer.textContent = '';
        try { document.execCommand('formatBlock', false, `H${Math.min(3, level + 1)}`); } catch {}
        setHeadingCycle(Math.min(3, level + 1) as 0 | 1 | 2 | 3);
        syncEditorState();
        return;
      }
    }

    // Enter inside a checklist row: create a NEW checkbox row (or exit on
    // empty row). Without this the browser inserts a <br> inside the same
    // row, so multiple typed items end up stacked on a single checkbox
    // line — the user-reported "items all on one line" bug.
    if (e.key === 'Enter' && !e.shiftKey && !slashMenu.open && editorRef.current) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      let n: Node | null = range.startContainer;
      let todoEl: HTMLElement | null = null;
      while (n && n !== editorRef.current) {
        if (n.nodeType === 1 && (n as HTMLElement).hasAttribute && (n as HTMLElement).hasAttribute('data-todo')) {
          todoEl = n as HTMLElement;
          break;
        }
        n = n.parentNode;
      }
      if (todoEl) {
        e.preventDefault();
        // Use the WHOLE row's text (excluding the input) so we don't fall
        // through when iOS WebKit leaks typed characters into a sibling
        // text node of the span — the cause of the "Enter doesn't make a
        // new line" bug. Strip zero-widths before deciding empty vs full.
        const cb = todoEl.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
        const checked = !!cb?.checked || !!cb?.hasAttribute('checked');
        const fullText = (todoEl.textContent || '').replace(/​/g, '').replace(/^\s+|\s+$/g, '');
        if (!fullText) {
          // Empty row → exit checklist, replace with empty paragraph
          const p = document.createElement('p');
          p.appendChild(document.createElement('br'));
          todoEl.replaceWith(p);
          const r = document.createRange();
          r.setStart(p, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        } else {
          // Normalize the existing row so all its text lives inside the
          // span — guards against iOS leakage and ensures saved HTML
          // round-trips through the DOMPurify allow-list.
          const span = todoEl.querySelector('span');
          const spanText = (span?.textContent || '').replace(/​/g, '');
          if (!span || spanText !== fullText) {
            todoEl.innerHTML = '';
            const fixCb = document.createElement('input');
            fixCb.type = 'checkbox';
            fixCb.className = 'iv-todo-check';
            if (checked) fixCb.setAttribute('checked', '');
            const fixedSpan = document.createElement('span');
            fixedSpan.textContent = fullText;
            todoEl.appendChild(fixCb);
            todoEl.appendChild(document.createTextNode(' '));
            todoEl.appendChild(fixedSpan);
          }
          // Create a new empty checklist row after this one
          const newDiv = document.createElement('div');
          newDiv.setAttribute('data-todo', '0');
          const newCb = document.createElement('input');
          newCb.type = 'checkbox';
          newCb.className = 'iv-todo-check';
          const newSpan = document.createElement('span');
          newSpan.appendChild(document.createTextNode('​'));
          newDiv.appendChild(newCb);
          newDiv.appendChild(document.createTextNode(' '));
          newDiv.appendChild(newSpan);
          todoEl.parentNode?.insertBefore(newDiv, todoEl.nextSibling);
          const r = document.createRange();
          r.selectNodeContents(newSpan);
          r.collapse(false);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        syncEditorState();
        return;
      }
    }
  };

  const onSlashPicked = () => {
    // Remove the typed "/query" before the menu was opened
    const ed = editorRef.current;
    if (ed) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const text = range.startContainer.textContent || '';
        const slashIdx = text.slice(0, range.startOffset).lastIndexOf('/');
        if (slashIdx !== -1 && range.startContainer.nodeType === Node.TEXT_NODE) {
          const before = text.slice(0, slashIdx);
          const after = text.slice(range.startOffset);
          (range.startContainer as Text).textContent = before + after;
          range.setStart(range.startContainer, before.length);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
    setSlashMenu({ open: false, pos: null, query: '' });
    syncEditorState();
  };

  // Tag handling ───────────────────────────────────────────────────────────
  const addTag = (raw?: string) => {
    const t = (raw ?? tagInput).trim().toLowerCase().replace(/^#/, '');
    if (!t) return;
    if (!tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
    setTagAutocomplete(false);
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  // Notebook switch (with "Create new")
  const onNotebookSelect = (value: string) => {
    if (value === '__new__') {
      setNewNotebookOpen(true);
      return;
    }
    setNotebook(value);
  };

  // Toggle a checkbox in viewer mode without going to edit
  const handleViewerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox') {
      // Capture the new state, persist it
      requestAnimationFrame(() => {
        const ed = editorRef.current;
        if (!ed) return;
        // Sync the input's checked attribute to the DOM so saved HTML reflects it
        ed.querySelectorAll('input[type="checkbox"]').forEach(cb => {
          if ((cb as HTMLInputElement).checked) cb.setAttribute('checked', '');
          else cb.removeAttribute('checked');
        });
        setContentHtml(ed.innerHTML);
      });
      return;
    }
    // Anchor tap in viewer mode → open the URL externally instead of
    // switching into edit mode (where it would become a no-op).
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && anchor.href) {
      e.preventDefault();
      try { window.open(anchor.href, '_blank', 'noopener,noreferrer'); } catch { /* noop */ }
      return;
    }
    // Tap anywhere else in the viewer → switch to edit mode
    if (!viewerMode) return;
    setViewerMode(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const handleShare = async () => {
    const text = `${title.trim() || 'Untitled'}\n\n${htmlToText(contentHtml)}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: title.trim() || 'Note', text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch { /* user cancelled */ }
  };

  const accentHex = (color && NOTE_ACCENT_PALETTE.find(s => s.id === color)?.hex) || null;

  // Wrapper outer container differs between fullscreen + embedded (3-pane).
  // The mobile fullscreen overlay also reserves the iOS safe-area inset at
  // the top so the back button + title aren't tucked behind the notch.
  const Wrapper = embedded ? 'div' : motion.div;

  // Swipe-back-to-list gesture (iOS-style edge pan). Only fires for swipes
  // that start within the first 36px from the left edge so we don't fight
  // the editor's own horizontal scroll inside code blocks. A 70px-or-more
  // horizontal travel with predominantly horizontal motion triggers close.
  const swipeRef = useRef<{ x: number; y: number; tracking: boolean } | null>(null);
  const handleSwipeStart = (e: React.TouchEvent) => {
    if (embedded) return;
    const t = e.touches[0];
    if (!t) return;
    swipeRef.current = { x: t.clientX, y: t.clientY, tracking: t.clientX < 36 };
  };
  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (embedded || !swipeRef.current?.tracking) { swipeRef.current = null; return; }
    const t = e.changedTouches[0];
    if (!t) { swipeRef.current = null; return; }
    const dx = t.clientX - swipeRef.current.x;
    const dy = Math.abs(t.clientY - swipeRef.current.y);
    swipeRef.current = null;
    if (dx > 70 && dy < 60) {
      void saveAndClose();
    }
  };

  // Save (if dirty + has content) then close. Used by Back button and swipe-back.
  const saveAndClose = async () => {
    if (dirty && (title.trim() || htmlToText(contentHtml).trim())) {
      try { await runSave(); } catch {}
    }
    onClose();
  };

  const wrapperProps = embedded
    ? { className: 'flex flex-col h-full bg-background' }
    : ({
        key: 'note-editor',
        className: 'fixed inset-0 z-[180] flex flex-col bg-background pt-[env(safe-area-inset-top)]',
        initial: { x: '100%', opacity: 0.6 },
        animate: { x: 0, opacity: 1 },
        exit: { x: '100%', opacity: 0 },
        transition: { type: 'spring' as const, stiffness: 320, damping: 32 },
        role: 'dialog' as const,
        'aria-modal': 'true' as const,
        'aria-label': note ? `Editing ${note.title}` : 'New note',
        onTouchStart: handleSwipeStart,
        onTouchEnd: handleSwipeEnd,
      } as any);

  const editorBody = (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between gap-1 px-2 py-2 bg-background relative">
        <div className="relative flex items-center gap-1">
          {!embedded && (
            <button
              type="button"
              onClick={() => { void saveAndClose(); }}
              aria-label="Back to notes"
              data-testid="button-editor-back"
              className="h-10 px-2.5 rounded-xl flex items-center gap-1 text-foreground hover:bg-white/[0.06] transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Notes</span>
            </button>
          )}
          {!embedded && <SaveDot saving={saving} dirty={dirty} savedAt={savedAt} />}
          {embedded && (
            <span className="inline-flex items-center gap-2 px-2 text-[11px] text-muted-foreground/80">
              {saving ? (
                <><Save className="w-3 h-3 text-amber-400 animate-pulse" /> Saving…</>
              ) : dirty ? (
                <><Save className="w-3 h-3 text-amber-400" /> Unsaved</>
              ) : savedAt ? (
                <><Check className="w-3 h-3 text-emerald-400" /> Saved · {timeAgoShort(savedAt)}</>
              ) : null}
            </span>
          )}
        </div>
        <span className="sr-only" aria-live="polite">
          {saving ? 'Saving' : dirty ? 'Unsaved changes' : 'All changes saved'}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Find in note"
            title="Find in note (⌘F)"
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <SearchIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => { setIsPinned(p => !p); void hapticLight(); }}
            aria-label={isPinned ? 'Unpin note' : 'Pin note'}
            aria-pressed={isPinned}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${isPinned ? 'text-amber-300' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'}`}
          >
            <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-400' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
          {!embedded && (
            // Explicit Done button for mobile — saves immediately and closes.
            // Autosave already covers most cases, but a visible action gives
            // the user confidence and a clean way out of the editor.
            <button
              type="button"
              onClick={async () => {
                setSubmitted(true);
                if (!title.trim()) {
                  titleRef.current?.focus();
                  return;
                }
                await runSave();
                onClose();
              }}
              aria-label="Save and close"
              data-testid="button-editor-done"
              className="ml-1 h-10 px-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-60"
              disabled={saving}
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMoreMenuOpen(v => !v); }}
              aria-label="More options"
              aria-expanded={moreMenuOpen}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${moreMenuOpen ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {moreMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl py-2"
                >
                  <button
                    type="button"
                    onClick={() => { setViewerMode(v => !v); setMoreMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground hover:bg-white/[0.06] transition-colors"
                  >
                    <span>{viewerMode ? 'Edit note' : 'View only'}</span>
                    {viewerMode ? <span className="text-emerald-300 text-xs">Viewing</span> : null}
                  </button>
                  <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                    <Palette className="w-3 h-3" /> Accent color
                  </div>
                  <div className="px-3 pb-2 flex items-center gap-2">
                    {NOTE_ACCENT_PALETTE.map(s => {
                      const active = (color ?? null) === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          aria-label={`Accent ${s.name}`}
                          aria-pressed={active}
                          onClick={() => setColor(prev => prev === s.id ? undefined : s.id)}
                          className={`relative h-5 w-5 rounded-full transition-transform ${active ? 'scale-110 ring-2 ring-white/40 ring-offset-2 ring-offset-background' : 'hover:scale-110 opacity-90'}`}
                          style={{ background: s.hex }}
                        />
                      );
                    })}
                  </div>
                  <div className="h-px bg-white/[0.06] my-1" />
                  {onDuplicate && (
                    <button
                      type="button"
                      onClick={() => { onDuplicate(); setMoreMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-white/[0.06] transition-colors"
                    >
                      <CopyIcon className="w-3.5 h-3.5" /> Duplicate
                    </button>
                  )}
                  {onDelete && note && (
                    <button
                      type="button"
                      onClick={() => { onDelete(); setMoreMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete note
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Find-in-note panel */}
        <InNoteSearch open={searchOpen} editor={editorRef.current} onClose={() => setSearchOpen(false)} />
      </header>

      {/* Color rail under top bar */}
      {accentHex && <div className="h-px w-full" style={{ background: accentHex }} aria-hidden />}

      {/* Formatting toolbar — fixed BELOW the header, never scrolls away.
          One row of buttons that horizontally scrolls if it overflows. */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-2 py-1 flex items-center gap-0.5 overflow-x-auto smooth-scrollbar scrollbar-hide">
          <ToolbarBtn label="Undo (⌘Z)" onClick={() => applyFormat('undo')}><RotateCcw className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Redo (⌘⇧Z)" onClick={() => applyFormat('redo')}><RotateCw className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Bold (⌘B)" active={activeFormats.has('bold')} onClick={() => applyFormat('bold')}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Italic (⌘I)" active={activeFormats.has('italic')} onClick={() => applyFormat('italic')}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Underline (⌘U)" active={activeFormats.has('underline')} onClick={() => applyFormat('underline')}><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Strikethrough" active={activeFormats.has('strike')} onClick={() => applyFormat('strikeThrough')}><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Highlight" onClick={applyHighlight}><Highlighter className="w-3.5 h-3.5" /></ToolbarBtn>
          <div className="relative flex-shrink-0">
            <ToolbarBtn label="Text color" active={colorPickerOpen} onClick={openColorPicker}><Type className="w-3.5 h-3.5" /></ToolbarBtn>
            <AnimatePresence>
              {colorPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.14 }}
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-1/2 -translate-x-1/2 top-10 z-30 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl p-2 grid grid-cols-4 gap-1.5"
                  role="menu"
                  aria-label="Text color"
                >
                  {NOTE_TEXT_COLORS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      aria-label={c.name}
                      title={c.name}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => applyTextColor(c.hex)}
                      className="h-7 w-7 rounded-md border border-white/10 flex items-center justify-center transition-transform hover:scale-110"
                      style={{ background: c.hex === 'inherit' ? 'transparent' : c.hex }}
                    >
                      {c.hex === 'inherit' && <RemoveFormatting className="w-3 h-3 text-muted-foreground" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <ToolbarBtn label="Link (⌘K)" onClick={applyLink}><Link2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Heading 1" active={headingCycle === 1} onClick={() => applyHeading(headingCycle === 1 ? 0 : 1)}><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Heading 2" active={headingCycle === 2} onClick={() => applyHeading(headingCycle === 2 ? 0 : 2)}><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Heading 3" active={headingCycle === 3} onClick={() => applyHeading(headingCycle === 3 ? 0 : 3)}><Heading3 className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Bullet list (⌘⇧8)" active={activeFormats.has('ul')} onClick={() => applyFormat('insertUnorderedList')}><ListBullets className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Numbered list (⌘⇧7)" active={activeFormats.has('ol')} onClick={() => applyFormat('insertOrderedList')}><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Checklist (⌘⇧9)" onClick={insertChecklistItem}><CheckSquare className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Code block" onClick={() => applyFormat('formatBlock', 'PRE')}><Code className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Quote" onClick={applyQuote}><Quote className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Indent (Tab)" onClick={() => applyFormat('indent')}><Indent className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Outdent (⇧Tab)" onClick={() => applyFormat('outdent')}><Outdent className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Horizontal rule" onClick={insertDivider}><Minus className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Clear formatting" onClick={() => applyFormat('removeFormat')}><RemoveFormatting className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Beautify" onClick={applyBeautify}><Sparkles className="w-3.5 h-3.5" /></ToolbarBtn>
        </div>
      </div>

      {/* Body — only this section scrolls */}
      <div className="flex-1 min-h-0 overflow-y-auto smooth-scrollbar">
        <div className="px-4 sm:px-8 pt-4 pb-3 max-w-3xl mx-auto w-full relative">
          {/* Title */}
          <input
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled"
            aria-label="Note title"
            aria-invalid={submitted && !title.trim()}
            className={`w-full bg-transparent border-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 text-[26px] sm:text-[28px] font-bold tracking-tight text-foreground placeholder:text-muted-foreground/30 leading-tight pb-3 rounded-md ${
              submitted && !title.trim() ? 'ring-1 ring-red-400/60 px-2 -mx-2' : ''
            }`}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
          />
          {submitted && !title.trim() && (
            <p className="text-sm text-red-400 mb-2 -mt-1">Title is required</p>
          )}

          {/* Body */}
          <div
            ref={editorRef}
            contentEditable={!viewerMode}
            suppressContentEditableWarning
            role="textbox"
            aria-label="Note body"
            aria-multiline="true"
            onInput={handleEditorInput}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={sampleActiveFormats}
            onMouseUp={sampleActiveFormats}
            onFocus={sampleActiveFormats}
            onClick={viewerMode ? handleViewerClick : undefined}
            spellCheck={!viewerMode}
            className={`iv-rich-editor note-content outline-none border-none focus:outline-none focus-visible:outline-none ${viewerMode ? 'cursor-text' : ''}`}
            data-placeholder={viewerMode ? '' : 'Start writing…'}
            // Toolbar is now above the body, so we no longer need the
            // 96px ghost gutter at the bottom of the editable area —
            // just keep enough breathing room above the footer.
            style={{ minHeight: '300px', paddingBottom: `calc(24px + ${bottomGutterPx}px)` }}
          />

          <SlashMenu
            open={slashMenu.open}
            position={slashMenu.pos}
            query={slashMenu.query}
            editor={editorRef.current}
            onClose={() => setSlashMenu({ open: false, pos: null, query: '' })}
            onCommandPicked={onSlashPicked}
          />

          {/* "Create new notebook" inline form */}
          <AnimatePresence>
            {newNotebookOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.16 }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-3 py-2">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
                  <input
                    autoFocus
                    value={newNotebookValue}
                    onChange={e => setNewNotebookValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const name = newNotebookValue.trim();
                        if (!name) return;
                        if (accountEmail) upsertNotebook(accountEmail, name);
                        setNotebook(name);
                        setNewNotebookValue('');
                        setNewNotebookOpen(false);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setNewNotebookOpen(false);
                        setNewNotebookValue('');
                      }
                    }}
                    placeholder="Notebook name"
                    className="bg-transparent border-0 outline-none text-sm flex-1 text-foreground placeholder:text-muted-foreground/50"
                    aria-label="New notebook name"
                  />
                  <button
                    type="button"
                    onClick={() => { setNewNotebookOpen(false); setNewNotebookValue(''); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >Cancel</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer — notebook, tags, word count, save status. Fixed at the
          bottom of the editor; lifts above the iOS soft keyboard via the
          same visualViewport offset the toolbar used to use. */}
      <footer
        className="flex-shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-md transition-transform duration-150"
        style={{
          paddingBottom: keyboardOffset ? 0 : 'env(safe-area-inset-bottom)',
          transform: keyboardOffset ? `translateY(-${keyboardOffset}px)` : undefined,
        }}
      >
        <div className="max-w-3xl mx-auto w-full">
          {/* Top line: notebook + tags */}
          <div className="px-3 pt-1.5 pb-1 flex items-center gap-2 overflow-x-auto scrollbar-hide text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 flex-shrink-0">
              <BookOpen className="w-3.5 h-3.5 opacity-60" />
              <select
                value={notebook}
                onChange={e => onNotebookSelect(e.target.value)}
                aria-label="Notebook"
                className="bg-transparent border-0 outline-none cursor-pointer hover:text-foreground transition-colors capitalize"
              >
                {notebookOptions.map(nb => (
                  <option key={nb.name} value={nb.name} className="bg-background">
                    {nb.icon ? `${nb.icon} ${nb.name}` : nb.name}
                  </option>
                ))}
                <option value="__new__" className="bg-background text-emerald-300">+ New notebook…</option>
              </select>
            </span>
            <span className="w-px h-4 bg-border/60 flex-shrink-0" aria-hidden />
            <div className="flex items-center gap-1 flex-1 min-w-0 relative">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-foreground flex-shrink-0">
                  <TagIcon className="w-2.5 h-2.5 opacity-60" />
                  {t}
                  <button type="button" aria-label={`Remove ${t}`} onClick={() => removeTag(t)} className="opacity-50 hover:opacity-100">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {tagInputOpen ? (
                <div className="relative flex-shrink-0">
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={e => { setTagInput(e.target.value); setTagAutocomplete(true); }}
                    onFocus={() => setTagAutocomplete(true)}
                    onBlur={() => { setTimeout(() => { setTagAutocomplete(false); if (tagInput.trim()) addTag(); setTagInputOpen(false); }, 120); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                      else if (e.key === 'Escape') { e.preventDefault(); setTagInput(''); setTagInputOpen(false); }
                      else if (e.key === 'Backspace' && !tagInput && tags.length) { setTags(prev => prev.slice(0, -1)); }
                    }}
                    placeholder="tag"
                    className="bg-transparent border-0 outline-none text-[13px] w-24 placeholder:text-muted-foreground/50"
                    aria-label="Add tag"
                  />
                  {tagAutocomplete && tagSuggestions.length > 0 && (
                    <div className="absolute right-0 bottom-7 z-10 min-w-[140px] rounded-lg border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl py-1">
                      {tagSuggestions.map(t => (
                        <button
                          key={t}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
                          className="w-full text-left px-2.5 py-1 text-xs text-foreground hover:bg-white/[0.06]"
                        >
                          #{t}
                        </button>
                      ))}
                      {tagInput.trim() && !knownTags.includes(tagInput.trim().toLowerCase().replace(/^#/, '')) && (
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); addTag(); }}
                          className="w-full text-left px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                        >
                          + Create "{tagInput.trim().toLowerCase().replace(/^#/, '')}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => setTagInputOpen(true)} className="text-[13px] text-emerald-400/90 hover:text-emerald-300 transition-colors inline-flex items-center gap-0.5 flex-shrink-0">
                  <Plus className="w-3 h-3" /> {tags.length === 0 ? 'Add tag' : 'Tag'}
                </button>
              )}
            </div>
          </div>
          {/* Bottom line: word count + save status */}
          <div className="px-3 pb-1.5 flex items-center justify-between text-[11px] text-muted-foreground/70 tabular-nums">
            <span>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
            <span className="inline-flex items-center gap-1">
              {saving ? (
                <><Save className="w-3 h-3 text-amber-400 animate-pulse" /> Saving…</>
              ) : dirty ? (
                <><Save className="w-3 h-3 text-amber-400" /> Unsaved</>
              ) : savedAt ? (
                <><Check className="w-3 h-3 text-emerald-400" /> Saved · {timeAgoShort(savedAt)}</>
              ) : null}
            </span>
          </div>
        </div>
      </footer>
    </>
  );

  if (embedded) {
    if (!open) return null;
    return <Wrapper {...wrapperProps}>{editorBody}</Wrapper>;
  }

  // Portal the fullscreen overlay to <body>. The page tree (notes.tsx,
  // vault context, motion ancestors) can re-render freely without ever
  // unmounting the editor — which was the root cause of the "editor
  // closes mid-typing" reports. Closing is now strictly user-driven
  // (Back / Done / Escape / explicit delete).
  if (typeof document === 'undefined') {
    return (
      <AnimatePresence>
        {open && <Wrapper {...wrapperProps}>{editorBody}</Wrapper>}
      </AnimatePresence>
    );
  }
  return createPortal(
    <AnimatePresence>
      {open && <Wrapper {...wrapperProps}>{editorBody}</Wrapper>}
    </AnimatePresence>,
    document.body,
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SaveDot({ saving, dirty, savedAt }: { saving: boolean; dirty: boolean; savedAt: Date | null }) {
  const [showCheck, setShowCheck] = useState(false);
  const lastSavedAtRef = useRef<number | null>(savedAt?.getTime() ?? null);
  useEffect(() => {
    if (!savedAt) return;
    const stamp = savedAt.getTime();
    if (lastSavedAtRef.current === stamp) return;
    lastSavedAtRef.current = stamp;
    setShowCheck(true);
    const t = setTimeout(() => setShowCheck(false), 1200);
    return () => clearTimeout(t);
  }, [savedAt]);

  if (saving) return <span aria-hidden className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />;
  if (dirty) return <span aria-hidden className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-amber-400" />;
  if (showCheck) {
    return (
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="absolute -right-0.5 -top-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center"
      >
        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
      </motion.span>
    );
  }
  return null;
}

function ToolbarBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={!!active}
      className={`min-w-[36px] h-9 px-2 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${
        active
          ? 'bg-emerald-500/15 text-emerald-300'
          : 'text-muted-foreground/85 hover:text-foreground hover:bg-white/[0.06]'
      }`}
    >
      {children}
    </button>
  );
}

function initialHtml(note: NoteEntry | null, starter?: { content?: string }): string {
  if (note) {
    const raw = note.content || '';
    if (raw.includes('<')) return raw;
    return raw.split('\n').map(line => line ? `<p>${escapeHtml(line)}</p>` : '<p><br/></p>').join('');
  }
  if (starter?.content) {
    const raw = starter.content;
    if (raw.includes('<')) return raw;
    return raw.split('\n').map(line => line ? `<p>${escapeHtml(line)}</p>` : '<p><br/></p>').join('');
  }
  return '<p><br/></p>';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));
}

function cssEscape(s: string): string {
  if (typeof (window as any).CSS !== 'undefined' && (window as any).CSS.escape) {
    return (window as any).CSS.escape(s);
  }
  return s.replace(/[^a-zA-Z0-9_-]/g, c => `\\${c}`);
}

/**
 * Clean up note content: trim whitespace runs, drop empty paragraphs, and
 * convert markdown-ish text patterns (`- foo`, `1. foo`, `[ ] foo`) to
 * proper HTML lists / checklists. Demotes stray H1s after the first to
 * H2 so headings have a single document title.
 */
export function beautifyContent(html: string): string {
  const root = document.createElement('div');
  root.innerHTML = html || '';

  const isBlankBlock = (el: Element): boolean => {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag !== 'P' && tag !== 'DIV') return false;
    if (el.querySelector('img,input,br + *')) return false;
    if (el.querySelector('img,input')) return false;
    const text = (el.textContent || '').replace(/​| /g, '').trim();
    return text === '';
  };

  // Collapse runs of empty <p>/<div> blocks to at most one
  const collapseEmpty = () => {
    const kids = Array.from(root.children);
    let prevBlank = false;
    for (const el of kids) {
      const blank = isBlankBlock(el);
      if (blank && prevBlank) el.remove();
      prevBlank = blank;
    }
  };
  collapseEmpty();

  // Convert plain-text patterns at the start of paragraphs into lists/todos
  const ulRe = /^[-*•]\s+(.+)$/;
  const olRe = /^\d+[.)]\s+(.+)$/;
  const todoRe = /^\[([ xX]?)\]\s+(.+)$/;

  const kids = Array.from(root.childNodes);
  const out: Node[] = [];
  let i = 0;
  while (i < kids.length) {
    const node = kids[i];
    if (node.nodeType === 1 && (node as Element).tagName === 'P') {
      const text = (node.textContent || '').replace(/​/g, '').trim();
      if (ulRe.test(text)) {
        const ul = document.createElement('ul');
        while (i < kids.length) {
          const cur = kids[i];
          if (cur.nodeType !== 1 || (cur as Element).tagName !== 'P') break;
          const t = (cur.textContent || '').replace(/​/g, '').trim();
          const m = t.match(ulRe);
          if (!m) break;
          const li = document.createElement('li');
          li.textContent = m[1].trim();
          ul.appendChild(li);
          i++;
        }
        if (ul.children.length > 0) { out.push(ul); continue; }
      }
      if (olRe.test(text)) {
        const ol = document.createElement('ol');
        while (i < kids.length) {
          const cur = kids[i];
          if (cur.nodeType !== 1 || (cur as Element).tagName !== 'P') break;
          const t = (cur.textContent || '').replace(/​/g, '').trim();
          const m = t.match(olRe);
          if (!m) break;
          const li = document.createElement('li');
          li.textContent = m[1].trim();
          ol.appendChild(li);
          i++;
        }
        if (ol.children.length > 0) { out.push(ol); continue; }
      }
      if (todoRe.test(text)) {
        while (i < kids.length) {
          const cur = kids[i];
          if (cur.nodeType !== 1 || (cur as Element).tagName !== 'P') break;
          const t = (cur.textContent || '').replace(/​/g, '').trim();
          const m = t.match(todoRe);
          if (!m) break;
          const div = document.createElement('div');
          div.setAttribute('data-todo', '1');
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'iv-todo-check';
          if (m[1] === 'x' || m[1] === 'X') cb.setAttribute('checked', '');
          const span = document.createElement('span');
          span.textContent = m[2].trim();
          div.appendChild(cb);
          div.appendChild(document.createTextNode(' '));
          div.appendChild(span);
          out.push(div);
          i++;
        }
        continue;
      }
      // Single-paragraph case: split inline comma-separated todo lines like
      // "[ ] eggs, [ ] cheese, [ ] dal" — common after pasting.
      const inlineTodoRe = /\[([ xX]?)\]\s*([^\[]+?)(?=,?\s*\[|$)/g;
      const matches = [...text.matchAll(inlineTodoRe)];
      if (matches.length >= 2) {
        for (const m of matches) {
          const div = document.createElement('div');
          div.setAttribute('data-todo', '1');
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.className = 'iv-todo-check';
          if (m[1] === 'x' || m[1] === 'X') cb.setAttribute('checked', '');
          const span = document.createElement('span');
          span.textContent = m[2].replace(/^[,\s]+|[,\s]+$/g, '');
          div.appendChild(cb);
          div.appendChild(document.createTextNode(' '));
          div.appendChild(span);
          out.push(div);
        }
        i++;
        continue;
      }
    }
    out.push(node);
    i++;
  }
  root.innerHTML = '';
  for (const n of out) root.appendChild(n);

  // Demote stray H1s after the first to H2 (single document title)
  const h1s = Array.from(root.querySelectorAll('h1'));
  for (let j = 1; j < h1s.length; j++) {
    const h2 = document.createElement('h2');
    h2.innerHTML = h1s[j].innerHTML;
    h1s[j].replaceWith(h2);
  }

  // Trim leading/trailing blank blocks
  while (root.firstChild && root.firstChild.nodeType === 1 && isBlankBlock(root.firstChild as Element)) {
    root.removeChild(root.firstChild);
  }
  while (root.lastChild && root.lastChild.nodeType === 1 && isBlankBlock(root.lastChild as Element)) {
    root.removeChild(root.lastChild);
  }

  // Collapse multi-space runs inside text nodes
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    textNodes.push(cur as Text);
    cur = walker.nextNode();
  }
  for (const t of textNodes) {
    if (!t.nodeValue) continue;
    const collapsed = t.nodeValue.replace(/[ \t]{2,}/g, ' ');
    if (collapsed !== t.nodeValue) t.nodeValue = collapsed;
  }

  return root.innerHTML || '<p><br/></p>';
}

function serializeForCompare(snap: { title: string; html: string; notebook: string; tags: string[]; isPinned: boolean; color: string | undefined }): string {
  return JSON.stringify({
    t: snap.title,
    c: snap.html,
    n: snap.notebook,
    g: [...snap.tags].sort(),
    p: snap.isPinned,
    k: snap.color || null,
  });
}
