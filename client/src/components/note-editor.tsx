import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, Pin, Trash2, MoreHorizontal, Check, Save,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List as ListBullets, ListOrdered, CheckSquare,
  Code, Minus, Tag as TagIcon, X, BookOpen, Palette, Copy as CopyIcon,
  Share2, Highlighter, Quote, Search as SearchIcon, Plus,
  RotateCcw, RotateCw, Indent, Outdent, RemoveFormatting,
  Link2, Type, ChevronDown, Info,
} from 'lucide-react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Link from '@tiptap/extension-link';
import { NoteEntry } from '@shared/schema';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { combineNotebookList, upsertNotebook, type NotebookMeta } from '@/lib/notebooks-store';
import { SlashMenu } from '@/components/slash-menu';
import { InNoteSearch } from '@/components/in-note-search';
import { setNoteEditing, setNoteDirty } from '@/lib/note-editing-guard';

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
  accountEmail?: string | null;
  knownTags?: string[];
  knownNotebooks?: string[];
  onClose: () => void;
  onSave: (payload: NoteFormPayload) => Promise<void> | void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  bottomGutterPx?: number;
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
 * Migrate legacy note HTML (saved by the old contentEditable engine) into a
 * shape TipTap can parse. The two big translations:
 *
 *  1. Old checklist rows — `<div data-todo="…"><input type=checkbox><span>…</span></div>`
 *     → grouped into `<ul data-type="taskList"><li data-type="taskItem"
 *       data-checked="true|false"><p>…</p></li></ul>`
 *
 *  2. execCommand foreColor wrappers — `<font color="…">…</font>`
 *     → `<span style="color: …">…</span>` (TipTap TextStyle/Color expects a span)
 *
 * Plain-text legacy content (no tags) is wrapped into <p> blocks per line.
 */
function migrateLegacyHtml(raw: string): string {
  if (!raw) return '<p></p>';
  if (!raw.includes('<')) {
    return raw.split('\n').map(l => l ? `<p>${escapeHtml(l)}</p>` : '<p></p>').join('') || '<p></p>';
  }

  const root = document.createElement('div');
  root.innerHTML = raw;

  // <font color="…"> → <span style="color: …">
  root.querySelectorAll('font[color]').forEach(f => {
    const span = document.createElement('span');
    const c = f.getAttribute('color');
    if (c) span.setAttribute('style', `color: ${c}`);
    while (f.firstChild) span.appendChild(f.firstChild);
    f.replaceWith(span);
  });

  // Group consecutive `[data-todo]` rows into a TipTap taskList.
  const todos = Array.from(root.querySelectorAll('[data-todo]'));
  const groups: Element[][] = [];
  let current: Element[] = [];
  for (const td of todos) {
    if (current.length === 0) { current.push(td); continue; }
    const prev = current[current.length - 1];
    if (prev.nextElementSibling === td) {
      current.push(td);
    } else {
      groups.push(current);
      current = [td];
    }
  }
  if (current.length) groups.push(current);

  for (const group of groups) {
    const ul = document.createElement('ul');
    ul.setAttribute('data-type', 'taskList');
    for (const td of group) {
      const cb = td.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const checked = !!cb?.checked || cb?.hasAttribute('checked') || td.getAttribute('data-todo') === '2';
      const span = td.querySelector('span');
      const text = (span?.textContent || td.textContent || '').replace(/​/g, '').trim();
      const li = document.createElement('li');
      li.setAttribute('data-type', 'taskItem');
      li.setAttribute('data-checked', checked ? 'true' : 'false');
      const p = document.createElement('p');
      p.textContent = text;
      li.appendChild(p);
      ul.appendChild(li);
    }
    group[0].parentNode?.insertBefore(ul, group[0]);
    for (const td of group) td.remove();
  }

  return root.innerHTML || '<p></p>';
}

function initialHtml(note: NoteEntry | null, starter?: { content?: string }): string {
  if (note) return migrateLegacyHtml(note.content || '');
  if (starter?.content) return migrateLegacyHtml(starter.content);
  return '<p></p>';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));
}

const SANITIZE_OPTS = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'h1', 'h2', 'h3',
    'ul', 'ol', 'li', 'div', 'code', 'pre', 'hr', 'blockquote', 'span', 'a',
  ],
  ALLOWED_ATTR: ['type', 'checked', 'class', 'data-type', 'data-checked', 'style', 'href', 'target', 'rel'],
  ALLOWED_CSS_PROPERTIES: ['background-color', 'color'],
};

/**
 * TipTap-powered notes editor — used as a fullscreen overlay on mobile/tablet
 * AND as the docked right pane on the desktop three-pane layout (`embedded`).
 *
 * Composition:
 *  - top bar: ← Back · Search · Pin · Share · Done · ⋯ More
 *  - formatting toolbar
 *  - title (26px bold)
 *  - body (TipTap EditorContent — ProseMirror under the hood)
 *  - footer: notebook · tags · word count · save status
 *
 * Manual save only — fires on Done, Back, swipe-back, or Cmd/Ctrl+S.
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(note?.updatedAt ? new Date(note.updatedAt) : null);
  const [saving, setSaving] = useState(false);
  const [viewerMode, setViewerMode] = useState<boolean>(!!note);
  const [searchOpen, setSearchOpen] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{ open: boolean; pos: { top: number; left: number } | null; query: string }>({ open: false, pos: null, query: '' });
  const [newNotebookOpen, setNewNotebookOpen] = useState(false);
  const [newNotebookValue, setNewNotebookValue] = useState('');
  const [notebookMenuOpen, setNotebookMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Tick state to force re-render when TipTap selection/transaction fires
  // so toolbar active-state highlights update in real time.
  const [, setStateTick] = useState(0);

  const titleRef = useRef<HTMLInputElement | null>(null);
  const lastSnapshotRef = useRef<string>('');
  const prevNoteIdRef = useRef<string | null | undefined>(undefined);
  // The portal container needs to be a real DOM element so InNoteSearch
  // and the slash menu can use it for positioning / DOM walking.
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);

  // ── TipTap editor ────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: 'Start writing…',
        emptyEditorClass: 'is-editor-empty',
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: contentHtml,
    editorProps: {
      attributes: {
        class: 'iv-rich-editor focus:outline-none',
      },
      handleKeyDown(view, event) {
        // Markdown-ish heading shortcut: # / ## / ### at start of a line + Space.
        // StarterKit's input rules already handle this, but its default behavior
        // also fires here so the block trigger is a no-op for us.
        // We intercept Tab so it indents lists (TipTap's default) instead of
        // moving focus out of the editor.
        if (event.key === 'Tab') {
          // Let TipTap handle it via list/task extensions
          return false;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      setContentHtml(html);
      // Detect slash trigger from current selection
      detectSlashTrigger(ed);
      setStateTick(t => t + 1);
    },
    onSelectionUpdate: () => {
      setStateTick(t => t + 1);
    },
    onTransaction: () => {
      setStateTick(t => t + 1);
    },
    editable: !viewerMode,
  }, [open]);

  // Push the read-only flag through whenever viewerMode toggles
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!viewerMode);
  }, [editor, viewerMode]);

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

  // Tell the rest of the app the editor is open so background sync code paths
  // (vault-context.refreshData, cloud auto-pull, auto-lock idle timer) skip
  // destructive refreshes that would otherwise unmount the editor mid-edit.
  if (open) setNoteEditing(true);
  useEffect(() => {
    if (!open) return;
    return () => setNoteEditing(false);
  }, [open]);

  // Reset all form-shaped state when the note id flips. The TipTap content
  // is re-set in a separate effect below.
  useEffect(() => {
    if (!open) {
      prevNoteIdRef.current = undefined;
      return;
    }
    const prevId = prevNoteIdRef.current;
    const currentId = note?.id ?? null;
    // null → real id (just-saved-new-note promotion): keep in-memory state,
    // just bump savedAt so the indicator updates.
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
    setTagInputOpen(false);
    setMoreMenuOpen(false);
    setSearchOpen(false);
    setSubmitted(false);
    setViewerMode(!!note);
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

  // Sync TipTap content when the loaded note changes. We pass `false` for
  // emitUpdate so this mutation doesn't fire onUpdate (which would loop and
  // stomp the snapshot on each pull).
  useEffect(() => {
    if (!open || !editor) return;
    if (editor.isFocused) return;
    const html = initialHtml(note, starter);
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id, editor]);

  // Combined notebook list (metadata + notes' strings)
  const notebookOptions = useMemo<NotebookMeta[]>(() => {
    const list = combineNotebookList(accountEmail ?? null, knownNotebooks);
    if (notebook && !list.find(n => n.name.toLowerCase() === notebook.toLowerCase())) {
      list.push({ name: notebook });
    }
    return list;
  }, [accountEmail, knownNotebooks, notebook]);

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

  // Publish dirty state to module-level guard so notes.tsx can decide whether
  // to prompt before switching to another note.
  useEffect(() => { setNoteDirty(dirty); }, [dirty]);
  useEffect(() => () => { setNoteDirty(false); }, []);

  const runSave = async () => {
    if (!editor) return;
    if (!title.trim() && !htmlToText(contentHtml).trim()) return;
    setSaving(true);
    try {
      const sanitized = DOMPurify.sanitize(editor.getHTML(), SANITIZE_OPTS);
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

  // Slash command detection from TipTap selection
  const detectSlashTrigger = (ed: Editor) => {
    const { state } = ed;
    const { from } = state.selection;
    const $from = state.doc.resolve(from);
    const lineText = $from.parent.textContent.slice(0, $from.parentOffset);
    const slashIdx = lineText.lastIndexOf('/');
    if (slashIdx === -1) {
      if (slashMenu.open) setSlashMenu({ open: false, pos: null, query: '' });
      return;
    }
    const before = lineText.slice(0, slashIdx);
    if (before && !/^\s*$/.test(before)) {
      if (slashMenu.open) setSlashMenu({ open: false, pos: null, query: '' });
      return;
    }
    const query = lineText.slice(slashIdx + 1);
    if (/[\s\n]/.test(query)) {
      if (slashMenu.open) setSlashMenu({ open: false, pos: null, query: '' });
      return;
    }
    const wrap = editorWrapperRef.current;
    if (!wrap) return;
    const dom = ed.view.coordsAtPos(from);
    const wrapRect = wrap.getBoundingClientRect();
    setSlashMenu({
      open: true,
      pos: { top: dom.bottom - wrapRect.top + 8, left: dom.left - wrapRect.left },
      query,
    });
  };

  const onSlashPicked = () => {
    if (!editor) { setSlashMenu({ open: false, pos: null, query: '' }); return; }
    const { state } = editor;
    const { from } = state.selection;
    const $from = state.doc.resolve(from);
    const lineText = $from.parent.textContent.slice(0, $from.parentOffset);
    const slashIdx = lineText.lastIndexOf('/');
    if (slashIdx !== -1) {
      const removeFrom = from - (lineText.length - slashIdx);
      editor.chain().focus().deleteRange({ from: removeFrom, to: from }).run();
    }
    setSlashMenu({ open: false, pos: null, query: '' });
  };

  // Toolbar actions ────────────────────────────────────────────────────────
  const ensureEditable = () => {
    if (viewerMode) setViewerMode(false);
  };

  const tBold = () => { ensureEditable(); editor?.chain().focus().toggleBold().run(); void hapticLight(); };
  const tItalic = () => { ensureEditable(); editor?.chain().focus().toggleItalic().run(); void hapticLight(); };
  const tUnderline = () => { ensureEditable(); editor?.chain().focus().toggleUnderline().run(); void hapticLight(); };
  const tStrike = () => { ensureEditable(); editor?.chain().focus().toggleStrike().run(); void hapticLight(); };
  const tHighlight = () => { ensureEditable(); editor?.chain().focus().toggleHighlight().run(); void hapticLight(); };
  const tCode = () => { ensureEditable(); editor?.chain().focus().toggleCodeBlock().run(); void hapticLight(); };
  const tQuote = () => { ensureEditable(); editor?.chain().focus().toggleBlockquote().run(); void hapticLight(); };
  const tBullet = () => { ensureEditable(); editor?.chain().focus().toggleBulletList().run(); void hapticLight(); };
  const tOrdered = () => { ensureEditable(); editor?.chain().focus().toggleOrderedList().run(); void hapticLight(); };
  const tTask = () => { ensureEditable(); editor?.chain().focus().toggleTaskList().run(); void hapticLight(); };
  const tHr = () => { ensureEditable(); editor?.chain().focus().setHorizontalRule().run(); void hapticLight(); };
  const tClear = () => { ensureEditable(); editor?.chain().focus().clearNodes().unsetAllMarks().run(); void hapticLight(); };
  const tUndo = () => { ensureEditable(); editor?.chain().focus().undo().run(); };
  const tRedo = () => { ensureEditable(); editor?.chain().focus().redo().run(); };
  const tIndent = () => {
    ensureEditable();
    if (!editor) return;
    if (editor.isActive('listItem') || editor.isActive('taskItem')) {
      editor.chain().focus().sinkListItem(editor.isActive('taskItem') ? 'taskItem' : 'listItem').run();
    }
  };
  const tOutdent = () => {
    ensureEditable();
    if (!editor) return;
    if (editor.isActive('listItem') || editor.isActive('taskItem')) {
      editor.chain().focus().liftListItem(editor.isActive('taskItem') ? 'taskItem' : 'listItem').run();
    }
  };
  const tHeading = (level: 1 | 2 | 3) => {
    ensureEditable();
    editor?.chain().focus().toggleHeading({ level }).run();
    void hapticLight();
  };

  const applyLink = () => {
    ensureEditable();
    if (!editor) return;
    const previous = editor.getAttributes('link').href || '';
    const input = window.prompt(previous ? 'Edit link URL (leave empty to remove):' : 'Enter URL:', previous || 'https://');
    if (input === null) return;
    const trimmed = input.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const normalized = /^(https?:|mailto:|tel:|\/)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    void hapticLight();
  };

  const applyTextColor = (hex: string) => {
    ensureEditable();
    if (!editor) return;
    if (hex === 'inherit') {
      editor.chain().focus().unsetColor().run();
    } else {
      editor.chain().focus().setColor(hex).run();
    }
    setColorPickerOpen(false);
    void hapticLight();
  };

  // Keyboard shortcuts (window-level)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === 'Escape') {
        if (slashMenu.open) { setSlashMenu({ open: false, pos: null, query: '' }); return; }
        if (colorPickerOpen) { setColorPickerOpen(false); return; }
        if (detailsOpen) { setDetailsOpen(false); return; }
        if (moreMenuOpen) { setMoreMenuOpen(false); return; }
        if (searchOpen) { setSearchOpen(false); return; }
        if (tagInputOpen) { setTagInputOpen(false); return; }
      }
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); void runSave(); return; }
      if (key === 'f') { e.preventDefault(); setSearchOpen(true); return; }
      if (key === 'k') { e.preventDefault(); applyLink(); return; }
    };
    // External save trigger — parent (notes.tsx) dispatches this when the
    // unsaved-changes dialog is confirmed with "Save". We run the normal save
    // path and emit a `notes:save-done` event so the parent can complete the
    // pending switch only after the save finishes.
    const onExternalSave = () => {
      void (async () => {
        try { await runSave(); } finally {
          try { window.dispatchEvent(new CustomEvent('notes:save-done')); } catch {}
        }
      })();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('notes:save-request', onExternalSave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('notes:save-request', onExternalSave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, moreMenuOpen, tagInputOpen, slashMenu.open, searchOpen, colorPickerOpen, detailsOpen]);

  // Close color picker when tapping outside
  useEffect(() => {
    if (!colorPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[role="menu"][aria-label="Text color"]')) return;
      if (target.closest('[aria-label="Text color"]')) return;
      setColorPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocClick, true);
    return () => document.removeEventListener('mousedown', onDocClick, true);
  }, [colorPickerOpen]);

  // ── Tag handling ─────────────────────────────────────────────────────────
  const addTag = (raw?: string) => {
    const t = (raw ?? tagInput).trim().toLowerCase().replace(/^#/, '');
    if (!t) return;
    if (!tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
    setTagAutocomplete(false);
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const onNotebookSelect = (value: string) => {
    if (value === '__new__') { setNewNotebookOpen(true); return; }
    setNotebook(value);
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

  // Tap-anywhere-in-viewer-to-edit (also opens external links in new tab)
  const handleViewerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (anchor && anchor.href) {
      e.preventDefault();
      try { window.open(anchor.href, '_blank', 'noopener,noreferrer'); } catch { /* noop */ }
      return;
    }
    if (!viewerMode) return;
    setViewerMode(false);
    requestAnimationFrame(() => editor?.commands.focus());
  };

  const accentHex = (color && NOTE_ACCENT_PALETTE.find(s => s.id === color)?.hex) || null;

  const Wrapper = embedded ? 'div' : motion.div;

  // Swipe-back-to-list gesture (iOS-style)
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
    if (dx > 70 && dy < 60) void saveAndClose();
  };

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

  // active-state helpers (re-evaluated each render via the tick state)
  const isActive = (name: string, attrs?: Record<string, unknown>) => !!editor?.isActive(name, attrs as any);

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
            <button
              type="button"
              onClick={async () => {
                setSubmitted(true);
                if (!title.trim()) { titleRef.current?.focus(); return; }
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
          {embedded && (
            <button
              type="button"
              onClick={async () => {
                setSubmitted(true);
                if (!title.trim()) { titleRef.current?.focus(); return; }
                await runSave();
              }}
              aria-label="Save note"
              title="Save (⌘S)"
              data-testid="button-editor-save"
              className="ml-1 h-9 px-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold flex items-center gap-1.5 hover:bg-emerald-600 active:bg-emerald-700 transition-colors disabled:opacity-60"
              disabled={saving || !dirty}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save'}
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
                    onClick={() => { setDetailsOpen(true); setMoreMenuOpen(false); }}
                    data-testid="button-note-details"
                    className="md:hidden w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-white/[0.06] transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" /> Note details
                  </button>
                  <div className="md:hidden h-px bg-white/[0.06] my-1" />
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

        <InNoteSearch open={searchOpen} editor={editor?.view.dom ?? null} onClose={() => setSearchOpen(false)} />
      </header>

      {accentHex && <div className="h-px w-full" style={{ background: accentHex }} aria-hidden />}

      {/* Formatting toolbar — single horizontally-scrollable row on mobile so
          the text area dominates; wraps to multi-row at md+ where vertical
          space is plentiful. Mobile users swipe sideways to reach the
          less-frequent block tools. */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-2 py-1 flex flex-nowrap overflow-x-auto scrollbar-hide items-center gap-0.5 md:flex-wrap md:overflow-visible">
          <ToolbarBtn label="Undo (⌘Z)" onClick={tUndo}><RotateCcw className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Redo (⌘⇧Z)" onClick={tRedo}><RotateCw className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Bold (⌘B)" active={isActive('bold')} onClick={tBold}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Italic (⌘I)" active={isActive('italic')} onClick={tItalic}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Underline (⌘U)" active={isActive('underline')} onClick={tUnderline}><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Strikethrough" active={isActive('strike')} onClick={tStrike}><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Highlight" active={isActive('highlight')} onClick={tHighlight}><Highlighter className="w-3.5 h-3.5" /></ToolbarBtn>
          <div className="relative flex-shrink-0">
            <ToolbarBtn label="Text color" active={colorPickerOpen} onClick={() => setColorPickerOpen(v => !v)}>
              <Type className="w-3.5 h-3.5" />
            </ToolbarBtn>
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
          <ToolbarBtn label="Link (⌘K)" active={isActive('link')} onClick={applyLink}><Link2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Heading 1" active={isActive('heading', { level: 1 })} onClick={() => tHeading(1)}><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Heading 2" active={isActive('heading', { level: 2 })} onClick={() => tHeading(2)}><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Heading 3" active={isActive('heading', { level: 3 })} onClick={() => tHeading(3)}><Heading3 className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Bullet list" active={isActive('bulletList')} onClick={tBullet}><ListBullets className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Numbered list" active={isActive('orderedList')} onClick={tOrdered}><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Checklist" active={isActive('taskList')} onClick={tTask}><CheckSquare className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Code block" active={isActive('codeBlock')} onClick={tCode}><Code className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Quote" active={isActive('blockquote')} onClick={tQuote}><Quote className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Indent (Tab)" onClick={tIndent}><Indent className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Outdent (⇧Tab)" onClick={tOutdent}><Outdent className="w-3.5 h-3.5" /></ToolbarBtn>
          <span className="w-px h-4 bg-border/60 mx-1 flex-shrink-0" aria-hidden />
          <ToolbarBtn label="Horizontal rule" onClick={tHr}><Minus className="w-3.5 h-3.5" /></ToolbarBtn>
          <ToolbarBtn label="Clear formatting" onClick={tClear}><RemoveFormatting className="w-3.5 h-3.5" /></ToolbarBtn>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto smooth-scrollbar">
        <div className="px-4 sm:px-8 pt-4 pb-3 max-w-3xl mx-auto w-full relative" ref={editorWrapperRef}>
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
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editor?.commands.focus(); } }}
          />
          {submitted && !title.trim() && (
            <p className="text-sm text-red-400 mb-2 -mt-1">Title is required</p>
          )}

          <div
            className={`note-content ${viewerMode ? 'cursor-text' : ''}`}
            onClick={viewerMode ? handleViewerClick : undefined}
            style={{ minHeight: '300px', paddingBottom: `calc(24px + ${bottomGutterPx}px)` }}
          >
            <EditorContent editor={editor} />
          </div>

          <SlashMenu
            open={slashMenu.open}
            position={slashMenu.pos}
            query={slashMenu.query}
            editor={editor}
            onClose={() => setSlashMenu({ open: false, pos: null, query: '' })}
            onCommandPicked={onSlashPicked}
          />

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

      <footer
        className="hidden md:block flex-shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-md transition-transform duration-150"
        style={{
          paddingBottom: keyboardOffset ? 0 : 'env(safe-area-inset-bottom)',
          transform: keyboardOffset ? `translateY(-${keyboardOffset}px)` : undefined,
        }}
      >
        <div className="max-w-3xl mx-auto w-full">
          {/* Single compact row on both mobile and desktop. Horizontally
              scrollable so long tag lists don't blow up the footer height.
              Word count sits inline on the right; the separate status row
              below is desktop-only. */}
          <div className="flex px-3 py-1 md:pt-1.5 md:pb-1 items-center gap-2 overflow-x-auto scrollbar-hide text-[12px] md:text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 flex-shrink-0 relative">
              <BookOpen className="w-3.5 h-3.5 opacity-60" />
              <button
                type="button"
                onClick={() => setNotebookMenuOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={notebookMenuOpen}
                aria-label="Notebook"
                data-testid="note-notebook-dropdown"
                className="inline-flex items-center gap-1 max-w-[160px] cursor-pointer hover:text-foreground transition-colors capitalize"
              >
                <span className="truncate">
                  {(() => {
                    const cur = notebookOptions.find(nb => nb.name.toLowerCase() === notebook.toLowerCase());
                    return cur ? (cur.icon ? `${cur.icon} ${cur.name}` : cur.name) : notebook;
                  })()}
                </span>
                <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${notebookMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {notebookMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setNotebookMenuOpen(false)} aria-hidden />
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      transition={{ duration: 0.14 }}
                      role="listbox"
                      aria-label="Choose notebook"
                      className="absolute left-0 bottom-full mb-1.5 z-40 w-56 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl py-1.5"
                    >
                      {notebookOptions.map(nb => {
                        const selected = nb.name.toLowerCase() === notebook.toLowerCase();
                        return (
                          <button
                            type="button"
                            key={nb.name}
                            role="option"
                            aria-selected={selected}
                            data-testid={`note-notebook-option-${nb.name.toLowerCase().replace(/\s+/g, '-')}`}
                            onClick={() => { onNotebookSelect(nb.name); setNotebookMenuOpen(false); }}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left capitalize transition-colors ${selected ? 'bg-emerald-500/10 text-emerald-300' : 'text-foreground hover:bg-white/[0.06]'}`}
                          >
                            <span className="truncate">{nb.icon ? `${nb.icon} ${nb.name}` : nb.name}</span>
                            {selected && <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />}
                          </button>
                        );
                      })}
                      <div className="my-1 h-px bg-border/40" />
                      <button
                        type="button"
                        onClick={() => { onNotebookSelect('__new__'); setNotebookMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                        data-testid="note-notebook-new"
                      >
                        <Plus className="w-3.5 h-3.5" /> New notebook…
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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
                <div className="relative flex-shrink-0 inline-flex items-center gap-0.5">
                  {/* # is auto-prepended on save — show it as a static prefix
                      so users don't try to type it themselves. */}
                  <span aria-hidden className="text-[13px] text-muted-foreground/60 select-none">#</span>
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={e => { setTagInput(e.target.value.replace(/^#+/, '')); setTagAutocomplete(true); }}
                    onFocus={() => setTagAutocomplete(true)}
                    onBlur={() => { setTimeout(() => { setTagAutocomplete(false); if (tagInput.trim()) addTag(); setTagInputOpen(false); }, 120); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                      else if (e.key === 'Escape') { e.preventDefault(); setTagInput(''); setTagInputOpen(false); }
                      else if (e.key === 'Backspace' && !tagInput && tags.length) { setTags(prev => prev.slice(0, -1)); }
                    }}
                    placeholder="add tag"
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
                <button type="button" onClick={() => setTagInputOpen(true)} className="text-[12px] md:text-[13px] text-emerald-400/90 hover:text-emerald-300 transition-colors inline-flex items-center gap-0.5 flex-shrink-0">
                  <Plus className="w-3 h-3" /> {tags.length === 0 ? 'Add tag' : 'Tag'}
                </button>
              )}
            </div>
            {/* Inline word count — mobile only; desktop has the status row below. */}
            <span className="md:hidden flex-shrink-0 text-[11px] text-muted-foreground/70 tabular-nums whitespace-nowrap pl-1">
              {wordCount}w
            </span>
          </div>
          {/* Status bar — desktop only. */}
          <div className="hidden md:flex px-3 pb-1.5 items-center justify-between text-[11px] text-muted-foreground/70 tabular-nums">
            <span>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
          </div>
        </div>
      </footer>

      {/* Mobile note-details bottom sheet — notebook, tags, word count.
          Desktop keeps everything inline in the footer above. */}
      <AnimatePresence>
        {detailsOpen && (
          <motion.div
            key="note-details-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Note details"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setDetailsOpen(false)}
              aria-hidden
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-background border-t border-border/40 px-4 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] max-h-[80vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-4" aria-hidden />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">Note details</h3>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(false)}
                  aria-label="Close"
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Notebook */}
              <div className="mb-5">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70 mb-2">Notebook</div>
                <div className="flex flex-wrap gap-1.5">
                  {notebookOptions.map(nb => {
                    const selected = nb.name.toLowerCase() === notebook.toLowerCase();
                    return (
                      <button
                        type="button"
                        key={nb.name}
                        onClick={() => setNotebook(nb.name)}
                        data-testid={`sheet-notebook-${nb.name.toLowerCase().replace(/\s+/g, '-')}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] capitalize transition-colors ${
                          selected
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                            : 'bg-white/[0.04] text-foreground border border-white/10 hover:bg-white/[0.08]'
                        }`}
                      >
                        <span className="truncate">{nb.icon ? `${nb.icon} ${nb.name}` : nb.name}</span>
                        {selected && <Check className="w-3 h-3 flex-shrink-0" />}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => { setNewNotebookOpen(true); setDetailsOpen(false); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[13px] text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 hover:bg-emerald-500/15 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> New
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="mb-5">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground/70 mb-2">Tags</div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {tags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[12px] text-foreground">
                      <TagIcon className="w-2.5 h-2.5 opacity-60" />
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove ${t}`}
                        onClick={() => removeTag(t)}
                        className="opacity-60 hover:opacity-100 ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30">
                    <span aria-hidden className="text-[12px] text-emerald-300/70 select-none">#</span>
                    <input
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value.replace(/^#+/, ''))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                        else if (e.key === 'Escape') { e.preventDefault(); setTagInput(''); }
                        else if (e.key === 'Backspace' && !tagInput && tags.length) { setTags(prev => prev.slice(0, -1)); }
                      }}
                      placeholder="add tag"
                      className="bg-transparent border-0 outline-none text-[12px] w-20 text-emerald-200 placeholder:text-emerald-300/50"
                      aria-label="Add tag"
                    />
                  </div>
                </div>
                {tagSuggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tagSuggestions.slice(0, 6).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => addTag(t)}
                        className="px-2 py-0.5 rounded-full text-[11px] text-muted-foreground hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06]"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Word count */}
              <div className="text-[12px] text-muted-foreground tabular-nums pb-2 border-b border-border/30">
                {wordCount} word{wordCount === 1 ? '' : 's'}
              </div>

              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="mt-4 w-full h-11 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (embedded) {
    if (!open) return null;
    return <Wrapper {...wrapperProps}>{editorBody}</Wrapper>;
  }

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

// ── Helpers ──────────────────────────────────────────────────────────────

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
