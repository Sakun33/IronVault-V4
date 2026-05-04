import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, Pin, Trash2, MoreHorizontal, Check, Save,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List as ListBullets, ListOrdered, CheckSquare,
  Code, Minus, Tag as TagIcon, X, BookOpen, Palette, Copy as CopyIcon,
  Share2, Highlighter, Quote, Search as SearchIcon, Plus,
} from 'lucide-react';
import { NoteEntry } from '@shared/schema';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { combineNotebookList, upsertNotebook, type NotebookMeta } from '@/lib/notebooks-store';
import { SlashMenu, SLASH_COMMANDS } from '@/components/slash-menu';
import { InNoteSearch } from '@/components/in-note-search';
import { setNoteEditing } from '@/lib/note-editing-guard';

export const NOTE_ACCENT_PALETTE: Array<{ id: string; name: string; hex: string }> = [
  { id: 'emerald', name: 'Emerald', hex: '#10b981' },
  { id: 'sky',     name: 'Sky',     hex: '#0ea5e9' },
  { id: 'violet',  name: 'Violet',  hex: '#8b5cf6' },
  { id: 'amber',   name: 'Amber',   hex: '#f59e0b' },
  { id: 'rose',    name: 'Rose',    hex: '#f43f5e' },
  { id: 'slate',   name: 'Gray',    hex: '#64748b' },
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

  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const lastSnapshotRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);

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
  // paths (vault-context.refreshData, cloud auto-pull) can skip
  // destructive refreshes that would otherwise unmount or reset the editor
  // mid-edit. Cleared on unmount AND when `open` flips false.
  useEffect(() => {
    if (!open) return;
    setNoteEditing(true);
    return () => setNoteEditing(false);
  }, [open]);

  // Reset all the form-shaped state (title / notebook / tags / pin / color
  // / contentHtml) when the note id flips. The DOM-side innerHTML sync is
  // handled by the useLayoutEffect below — that one runs synchronously
  // after commit and is the actual fix for "body shows truncated content
  // on reopen".
  useEffect(() => {
    if (!open) return;
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

  // SYNCHRONOUS contentEditable population. Runs after every commit where
  // a relevant prop changed, BEFORE the browser paints — so the user
  // never sees a blank/half-populated body. Two important guards:
  //   1) Skip when the user is currently typing (focus is on the editor)
  //      so we never clobber an in-progress edit.
  //   2) Trigger on note.id AND note.updatedAt so reopening the same id
  //      after an external save (cloud pull, duplicate, undo) re-syncs.
  // Without this, the previous rAF-based approach raced with motion.div's
  // enter animation and sometimes left the body showing whatever short
  // string the editor had been wiped to mid-session ("Shddh", etc.).
  useLayoutEffect(() => {
    if (!open) return;
    const el = editorRef.current;
    if (!el) return;
    if (typeof document !== 'undefined' && document.activeElement === el) return;
    const html = initialHtml(note, starter);
    if (el.innerHTML !== html) el.innerHTML = html;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id, note?.updatedAt, note?.content]);

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

  // 3-second debounced autosave
  useEffect(() => {
    if (!open || !dirty) return;
    if (!title.trim() && !htmlToText(contentHtml).trim()) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => { void runSave(); }, 3000);
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, dirty, open]);

  // Flush on close/unmount
  useEffect(() => {
    if (!open) return;
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (dirty && (title.trim() || htmlToText(contentHtml).trim())) void runSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (slashMenu.open) { setSlashMenu({ open: false, pos: null, query: '' }); return; }
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
      if (e.shiftKey && key === '7') { e.preventDefault(); applyFormat('insertOrderedList'); return; }
      if (e.shiftKey && key === '8') { e.preventDefault(); applyFormat('insertUnorderedList'); return; }
      if (e.shiftKey && key === '9') { e.preventDefault(); insertChecklistItem(); return; }
      if (e.shiftKey && key === 'l') { e.preventDefault(); applyFormat('insertUnorderedList'); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, moreMenuOpen, tagInputOpen, slashMenu.open, searchOpen]);

  const runSave = async () => {
    if (!title.trim() && !htmlToText(contentHtml).trim()) return;
    setSaving(true);
    try {
      const sanitized = DOMPurify.sanitize(contentHtml, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'div', 'code', 'pre', 'hr', 'blockquote', 'input', 'span'],
        ALLOWED_ATTR: ['type', 'checked', 'class', 'data-todo', 'style'],
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
    if (!editorRef.current) return;
    editorRef.current.focus();
    const html = '<div data-todo="1"><input type="checkbox" class="iv-todo-check" />&nbsp;<span></span></div><p><br/></p>';
    try { document.execCommand('insertHTML', false, html); } catch { /* noop */ }
    syncEditorState();
  };

  const insertDivider = () => {
    if (viewerMode) setViewerMode(false);
    if (!editorRef.current) return;
    editorRef.current.focus();
    try { document.execCommand('insertHTML', false, '<hr/><p><br/></p>'); } catch { /* noop */ }
    syncEditorState();
  };

  const syncEditorState = () => {
    if (!editorRef.current) return;
    setContentHtml(editorRef.current.innerHTML);
    sampleActiveFormats();
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    setContentHtml(editorRef.current.innerHTML);
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
      } as any);

  const editorBody = (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between gap-1 px-2 py-2 border-b border-border/40 bg-background relative">
        <div className="relative flex items-center gap-1">
          {!embedded && (
            <button
              type="button"
              onClick={onClose}
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
              onClick={async () => { await runSave(); onClose(); }}
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
      <div className="flex-shrink-0 border-b border-border/40 bg-background">
        <div className="px-2 py-1 flex items-center gap-0.5 overflow-x-auto smooth-scrollbar">
          <ToolbarBtn label="Bold (⌘B)" active={activeFormats.has('bold')} onClick={() => applyFormat('bold')}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Italic (⌘I)" active={activeFormats.has('italic')} onClick={() => applyFormat('italic')}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Underline (⌘U)" active={activeFormats.has('underline')} onClick={() => applyFormat('underline')}><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Strikethrough" active={activeFormats.has('strike')} onClick={() => applyFormat('strikeThrough')}><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Highlight" onClick={applyHighlight}><Highlighter className="w-3.5 h-3.5" /></ToolbarBtn>
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
          <ToolbarBtn label="Divider" onClick={insertDivider}><Minus className="w-3.5 h-3.5" /></ToolbarBtn>
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
            className="w-full bg-transparent border-0 outline-none text-[26px] sm:text-[28px] font-bold tracking-tight text-foreground placeholder:text-muted-foreground/30 leading-tight pb-3"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
          />

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
            className={`iv-rich-editor note-content ${viewerMode ? 'cursor-text' : ''}`}
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

  return (
    <AnimatePresence>
      {open && <Wrapper {...wrapperProps}>{editorBody}</Wrapper>}
    </AnimatePresence>
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
