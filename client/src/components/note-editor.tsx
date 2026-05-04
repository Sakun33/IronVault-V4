import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, Pin, Trash2, MoreHorizontal, Check, Save,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List as ListBullets, ListOrdered, CheckSquare,
  Code, Minus, Tag as TagIcon, Plus, X,
} from 'lucide-react';
import { NoteEntry, NOTE_NOTEBOOKS } from '@shared/schema';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

// Per-note accent palette. Same swatches as the list cards so the editor's
// header strip matches what the user picked.
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
  /** When editing an existing note, pass it. When creating a new one, pass null. */
  note: NoteEntry | null;
  /** Optional starter content for new notes (e.g. from a template). */
  starter?: { content?: string; notebook?: string };
  defaultNotebook?: string;
  onClose: () => void;
  onSave: (payload: NoteFormPayload) => Promise<void> | void;
  onDelete?: () => void;
  /** Hint to the layout: avoid the bottom-tabs gutter on mobile. */
  bottomGutterPx?: number;
}

// Lightweight HTML → plain text for word counts. Avoids importing
// DOMPurify just to count.
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
 * Full-screen note editor. ContentEditable-based; we don't pull in TipTap /
 * Quill / ProseMirror. Formatting goes through `document.execCommand` (still
 * the most reliable cross-browser path for contentEditable, deprecated tag
 * notwithstanding) and a couple of custom helpers for checkbox + divider.
 *
 * The editor is presentational: it receives a note and an `onSave` callback.
 * Save is debounced 1.5s after the last edit, and the parent decides what
 * "save" means (vault.addNote vs vault.updateNote). The component reports
 * the dirty/saving/saved state via the status bar at the bottom.
 */
export function NoteEditor({
  open,
  note,
  starter,
  defaultNotebook = 'personal',
  onClose,
  onSave,
  onDelete,
  bottomGutterPx = 0,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [notebook, setNotebook] = useState(note?.notebook ?? defaultNotebook);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [color, setColor] = useState<string | undefined>(note?.color);
  const [contentHtml, setContentHtml] = useState<string>(() => initialHtml(note, starter));
  const [tagInput, setTagInput] = useState('');
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [headingCycle, setHeadingCycle] = useState(0); // 0 = none, 1 = h1, 2 = h2, 3 = h3
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(note?.updatedAt ? new Date(note.updatedAt) : null);
  const [saving, setSaving] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const lastSnapshotRef = useRef<string>(''); // last successfully saved snapshot
  const saveTimerRef = useRef<number | null>(null);

  // Reset state when the note prop changes (open a different note)
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
    lastSnapshotRef.current = serializeForCompare({ title: note?.title ?? '', html, notebook: note?.notebook ?? defaultNotebook, tags: note?.tags ?? [], isPinned: note?.isPinned ?? false, color: note?.color });
    // Defer focus until the editor has actually mounted; on a brand-new note
    // we focus the title, when editing we drop the cursor at the end of the
    // body so the user can keep writing where they left off.
    requestAnimationFrame(() => {
      if (!note) titleRef.current?.focus();
      else editorRef.current?.focus();
    });
  }, [open, note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the editable div's innerHTML on note change (we don't drive
  // contentEditable from React state on every keystroke — that wrecks the
  // selection — but we do reset it when the underlying note changes).
  useEffect(() => {
    if (!open || !editorRef.current) return;
    if (editorRef.current.innerHTML !== contentHtml) {
      editorRef.current.innerHTML = contentHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id]);

  // Existing notebooks for the picker — combines schema-defaults + any
  // notebook a tag-merged note might have.
  const notebookOptions = useMemo(() => {
    const set = new Set<string>(NOTE_NOTEBOOKS);
    if (notebook) set.add(notebook);
    return Array.from(set);
  }, [notebook]);

  const wordCount = useMemo(() => {
    const text = htmlToText(contentHtml);
    return text ? text.split(' ').filter(Boolean).length : 0;
  }, [contentHtml]);
  const charCount = useMemo(() => htmlToText(contentHtml).length, [contentHtml]);

  // Dirty check — compare a stable serialized snapshot
  const currentSnapshot = useMemo(
    () => serializeForCompare({ title, html: contentHtml, notebook, tags, isPinned, color }),
    [title, contentHtml, notebook, tags, isPinned, color],
  );
  const dirty = currentSnapshot !== lastSnapshotRef.current;

  // Debounced autosave: 1.5s after the last edit, fire onSave. We don't
  // autosave a brand-new note until it has a non-empty title or body — that
  // would litter the vault with empty drafts.
  useEffect(() => {
    if (!open || !dirty) return;
    if (!title.trim() && !htmlToText(contentHtml).trim()) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void runSave();
    }, 1500);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, dirty, open]);

  // Save on close — flush any pending autosave so the user never loses an
  // edit by tapping Back too quickly.
  useEffect(() => {
    if (!open) return;
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (dirty && (title.trim() || htmlToText(contentHtml).trim())) {
        void runSave();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cmd+S, Cmd+B/I/U, Cmd+Shift+L shortcuts on desktop
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        void runSave();
        return;
      }
      if (key === 'b') { e.preventDefault(); applyFormat('bold'); return; }
      if (key === 'i') { e.preventDefault(); applyFormat('italic'); return; }
      if (key === 'u') { e.preventDefault(); applyFormat('underline'); return; }
      if (e.shiftKey && key === 'l') { e.preventDefault(); applyFormat('insertUnorderedList'); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runSave = async () => {
    if (!title.trim() && !htmlToText(contentHtml).trim()) return; // skip empty
    setSaving(true);
    try {
      const sanitized = DOMPurify.sanitize(contentHtml, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'div', 'code', 'pre', 'hr', 'input', 'span'],
        ALLOWED_ATTR: ['type', 'checked', 'class', 'data-todo'],
      });
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
    } catch {
      // surfaced by parent toast
    } finally {
      setSaving(false);
    }
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
    } catch { /* noop — execCommand not available */ }
    setActiveFormats(next);
  };

  const applyFormat = (cmd: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    try { document.execCommand(cmd, false, value); } catch { /* noop */ }
    syncEditorState();
    void hapticLight();
  };

  const cycleHeading = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const next = (headingCycle + 1) % 4; // 0 → H1 → H2 → H3 → 0
    const block = next === 0 ? 'P' : `H${next}`;
    try { document.execCommand('formatBlock', false, block); } catch { /* noop */ }
    setHeadingCycle(next);
    syncEditorState();
  };

  const insertChecklistItem = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const html = '<div data-todo="1"><input type="checkbox" class="iv-todo-check" />&nbsp;<span></span></div><p><br/></p>';
    try { document.execCommand('insertHTML', false, html); } catch { /* noop */ }
    syncEditorState();
  };

  const insertDivider = () => {
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
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Markdown-ish shortcut: type `# ` at the start of a line → H2
    if (e.key === ' ' && editorRef.current) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const text = range.startContainer.textContent || '';
      if (text === '#' || text === '##' || text === '###') {
        e.preventDefault();
        const level = text.length;
        // Clear the # marker and apply the heading
        range.startContainer.textContent = '';
        try {
          document.execCommand('formatBlock', false, `H${Math.min(3, level + 1)}`);
        } catch { /* noop */ }
        setHeadingCycle(Math.min(3, level + 1));
        syncEditorState();
      }
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (!t) return;
    if (tags.includes(t)) { setTagInput(''); return; }
    setTags(prev => [...prev, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const accentHex = (color && NOTE_ACCENT_PALETTE.find(s => s.id === color)?.hex) || NOTE_ACCENT_PALETTE[0].hex;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="note-editor"
          className="fixed inset-0 z-[180] flex flex-col bg-background"
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          role="dialog"
          aria-modal="true"
          aria-label={note ? `Editing ${note.title}` : 'New note'}
        >
          {/* Color accent rail */}
          <div className="h-1 w-full" style={{ background: accentHex }} aria-hidden />

          {/* Top bar */}
          <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06] bg-background/80 backdrop-blur-md">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="h-9 w-9 rounded-xl flex items-center justify-center hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setIsPinned(p => !p); void hapticLight(); }}
                aria-label={isPinned ? 'Unpin note' : 'Pin note'}
                aria-pressed={isPinned}
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${isPinned ? 'bg-amber-500/15 text-amber-300' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'}`}
              >
                <Pin className={`w-4 h-4 ${isPinned ? 'fill-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setShowColorPicker(v => !v)}
                aria-label="More options"
                className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Color picker dropdown — anchored to the More button */}
          <AnimatePresence>
            {showColorPicker && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.14 }}
                className="absolute right-3 top-12 z-[5] glass-card p-3 flex items-center gap-2 shadow-lg"
              >
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">Accent</span>
                {NOTE_ACCENT_PALETTE.map(s => {
                  const active = (color ?? null) === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Accent ${s.name}`}
                      aria-pressed={active}
                      onClick={() => { setColor(prev => prev === s.id ? undefined : s.id); }}
                      className={`relative h-5 w-5 rounded-full transition-transform ${active ? 'scale-110 ring-2 ring-white/40 ring-offset-1 ring-offset-background' : 'hover:scale-110'}`}
                      style={{ background: s.hex }}
                    />
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto smooth-scrollbar">
            <div className="px-4 sm:px-6 pt-4 pb-3 max-w-3xl mx-auto w-full">
              <input
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Untitled"
                className="w-full bg-transparent border-0 outline-none text-2xl sm:text-3xl font-bold tracking-tight placeholder:text-muted-foreground/30 focus:placeholder:text-muted-foreground/20 pb-2 border-b border-transparent focus:border-emerald-400/30 transition-colors"
                aria-label="Note title"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
              />

              {/* Notebook + tags row */}
              <div className="mt-3 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentHex }} />
                  <select
                    value={notebook}
                    onChange={e => setNotebook(e.target.value)}
                    aria-label="Notebook"
                    className="bg-transparent border-0 outline-none text-foreground/90 cursor-pointer hover:text-foreground transition-colors"
                  >
                    {notebookOptions.map(nb => (
                      <option key={nb} value={nb} className="bg-background">{nb}</option>
                    ))}
                  </select>
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="inline-flex items-center gap-1 flex-wrap">
                  {tags.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-[11px] text-foreground"
                    >
                      <TagIcon className="w-2.5 h-2.5 opacity-60" />
                      {t}
                      <button
                        type="button"
                        aria-label={`Remove ${t}`}
                        onClick={() => removeTag(t)}
                        className="opacity-50 hover:opacity-100"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                      if (e.key === 'Backspace' && !tagInput && tags.length) { setTags(prev => prev.slice(0, -1)); }
                    }}
                    onBlur={() => { if (tagInput.trim()) addTag(); }}
                    placeholder={tags.length ? 'add tag' : '+ add tag'}
                    className="bg-transparent border-0 outline-none text-[11px] w-20 placeholder:text-muted-foreground/50"
                    aria-label="Add tag"
                  />
                </span>
              </div>

              {/* Editor */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                role="textbox"
                aria-label="Note body"
                aria-multiline="true"
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onKeyUp={sampleActiveFormats}
                onMouseUp={sampleActiveFormats}
                onFocus={sampleActiveFormats}
                spellCheck
                className="iv-rich-editor mt-5 min-h-[40vh] outline-none prose dark:prose-invert prose-sm sm:prose-base max-w-none prose-p:my-2 prose-headings:tracking-tight prose-h1:mt-4 prose-h2:mt-3 prose-h3:mt-2 prose-li:my-0.5"
                data-placeholder="Start writing… use the toolbar below or type # to add headings."
                style={{ paddingBottom: `calc(120px + ${bottomGutterPx}px)` }}
              />
            </div>
          </div>

          {/* Sticky toolbar — bottom on mobile, sticks above the keyboard via
              env(keyboard-inset-height) on supporting browsers, otherwise sits
              above the bottom-tabs gutter. */}
          <div
            className="sticky bottom-0 z-[2] bg-background/85 backdrop-blur-xl border-t border-white/[0.06]"
            style={{ paddingBottom: `max(env(safe-area-inset-bottom), 0px)` }}
          >
            <div className="max-w-3xl mx-auto w-full px-2 py-1.5 flex items-center gap-1 overflow-x-auto smooth-scrollbar">
              <ToolbarBtn label="Bold (⌘B)" active={activeFormats.has('bold')} onClick={() => applyFormat('bold')}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Italic (⌘I)" active={activeFormats.has('italic')} onClick={() => applyFormat('italic')}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Underline (⌘U)" active={activeFormats.has('underline')} onClick={() => applyFormat('underline')}><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Strikethrough" active={activeFormats.has('strike')} onClick={() => applyFormat('strikeThrough')}><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>
              <span className="w-px h-5 bg-white/10 mx-0.5" aria-hidden />
              <ToolbarBtn
                label={`Heading ${headingCycle === 0 ? '(off)' : `H${headingCycle}`}`}
                active={headingCycle > 0}
                onClick={cycleHeading}
              >
                {headingCycle === 1 ? <Heading1 className="w-3.5 h-3.5" />
                  : headingCycle === 2 ? <Heading2 className="w-3.5 h-3.5" />
                  : headingCycle === 3 ? <Heading3 className="w-3.5 h-3.5" />
                  : <Heading2 className="w-3.5 h-3.5" />}
              </ToolbarBtn>
              <ToolbarBtn label="Bullet list (⌘⇧L)" active={activeFormats.has('ul')} onClick={() => applyFormat('insertUnorderedList')}><ListBullets className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Numbered list" active={activeFormats.has('ol')} onClick={() => applyFormat('insertOrderedList')}><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Checklist" onClick={insertChecklistItem}><CheckSquare className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Code" onClick={() => applyFormat('formatBlock', 'PRE')}><Code className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Divider" onClick={insertDivider}><Minus className="w-3.5 h-3.5" /></ToolbarBtn>

              {/* Color picker — small swatches at the right */}
              <span className="ml-auto flex items-center gap-1 pl-2 pr-1 flex-shrink-0">
                {NOTE_ACCENT_PALETTE.map(s => {
                  const active = (color ?? null) === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Accent ${s.name}`}
                      aria-pressed={active}
                      onClick={() => setColor(prev => prev === s.id ? undefined : s.id)}
                      className={`h-3 w-3 rounded-full transition-all ${active ? 'ring-2 ring-white/50 ring-offset-1 ring-offset-background scale-125' : 'opacity-70 hover:opacity-100'}`}
                      style={{ background: s.hex }}
                    />
                  );
                })}
              </span>
            </div>

            {/* Status bar */}
            <div className="max-w-3xl mx-auto w-full px-3 py-1.5 flex items-center gap-3 text-[11px] text-muted-foreground border-t border-white/[0.04]">
              <span className="tabular-nums">{wordCount} word{wordCount === 1 ? '' : 's'}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="tabular-nums hidden xs:inline sm:inline">{charCount} char{charCount === 1 ? '' : 's'}</span>
              <span className="ml-auto inline-flex items-center gap-1.5">
                {saving ? (
                  <>
                    <Save className="w-3 h-3 text-amber-400 animate-pulse" />
                    <span>Saving…</span>
                  </>
                ) : dirty ? (
                  <>
                    <Save className="w-3 h-3 text-amber-400" />
                    <span>Unsaved</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Saved{savedAt ? ` · ${timeAgoShort(savedAt)}` : ''}</span>
                  </>
                )}
              </span>
              {onDelete && note && (
                <button
                  type="button"
                  onClick={() => { void hapticLight(); onDelete(); }}
                  aria-label="Delete note"
                  className="h-6 w-6 -mr-1 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToolbarBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault() /* keep focus + selection */}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={!!active}
      className={`min-w-[36px] h-9 px-2 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
        active
          ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
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
    // Convert plain text → simple paragraphs so the rich editor has block
    // structure to format against.
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
