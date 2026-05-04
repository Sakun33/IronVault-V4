import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, Pin, Trash2, MoreHorizontal, Check, Save,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading2, List as ListBullets, ListOrdered, CheckSquare,
  Code, Minus, Tag as TagIcon, X, BookOpen, Palette, Copy as CopyIcon,
  Share2,
} from 'lucide-react';
import { NoteEntry, NOTE_NOTEBOOKS } from '@shared/schema';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

// Per-note accent palette — kept in sync with the list cards.
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
  onClose: () => void;
  onSave: (payload: NoteFormPayload) => Promise<void> | void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  bottomGutterPx?: number;
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
 * Evernote-style full-screen note editor.
 *
 * Visual contract:
 * - Top bar: ← back · ↗ share · ⋯ more (with color picker, duplicate, delete)
 * - Notebook + tag row: small, muted, just below the bar
 * - Title: large 28px, no border, no underline, plain placeholder
 * - Body: contentEditable, 16px, leading-1.65, generous spacing
 * - Bottom: minimal formatting strip — small icons (28px), muted until used
 * - Status: tiny "Saved" / "Saving" / "Unsaved" indicator inline in the top
 *   bar, not a dedicated bar
 *
 * The editor is presentational: it receives a note and an `onSave` callback.
 * Save is debounced 1.5s after the last edit. The component reports its
 * dirty state via the inline indicator in the top bar.
 */
export function NoteEditor({
  open,
  note,
  starter,
  defaultNotebook = 'personal',
  onClose,
  onSave,
  onDelete,
  onDuplicate,
  bottomGutterPx = 0,
}: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [notebook, setNotebook] = useState(note?.notebook ?? defaultNotebook);
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [isPinned, setIsPinned] = useState(note?.isPinned ?? false);
  const [color, setColor] = useState<string | undefined>(note?.color);
  const [contentHtml, setContentHtml] = useState<string>(() => initialHtml(note, starter));
  const [tagInput, setTagInput] = useState('');
  const [tagInputOpen, setTagInputOpen] = useState(false);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [headingCycle, setHeadingCycle] = useState(0);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(note?.updatedAt ? new Date(note.updatedAt) : null);
  const [saving, setSaving] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);
  const lastSnapshotRef = useRef<string>('');
  const saveTimerRef = useRef<number | null>(null);

  // Reset state when the note changes (open a different one)
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
      else editorRef.current?.focus();
    });
  }, [open, note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync editable div's innerHTML when the underlying note changes
  useEffect(() => {
    if (!open || !editorRef.current) return;
    if (editorRef.current.innerHTML !== contentHtml) {
      editorRef.current.innerHTML = contentHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id]);

  const notebookOptions = useMemo(() => {
    const set = new Set<string>(NOTE_NOTEBOOKS);
    if (notebook) set.add(notebook);
    return Array.from(set);
  }, [notebook]);

  const wordCount = useMemo(() => {
    const text = htmlToText(contentHtml);
    return text ? text.split(' ').filter(Boolean).length : 0;
  }, [contentHtml]);

  const currentSnapshot = useMemo(
    () => serializeForCompare({ title, html: contentHtml, notebook, tags, isPinned, color }),
    [title, contentHtml, notebook, tags, isPinned, color],
  );
  const dirty = currentSnapshot !== lastSnapshotRef.current;

  // Debounced autosave — 1.5s after the last edit. Skip empty drafts.
  useEffect(() => {
    if (!open || !dirty) return;
    if (!title.trim() && !htmlToText(contentHtml).trim()) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => { void runSave(); }, 1500);
    return () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, dirty, open]);

  // Flush on unmount/close
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
        if (moreMenuOpen) { setMoreMenuOpen(false); return; }
        if (tagInputOpen) { setTagInputOpen(false); return; }
      }
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); void runSave(); return; }
      if (key === 'b') { e.preventDefault(); applyFormat('bold'); return; }
      if (key === 'i') { e.preventDefault(); applyFormat('italic'); return; }
      if (key === 'u') { e.preventDefault(); applyFormat('underline'); return; }
      if (e.shiftKey && key === 'l') { e.preventDefault(); applyFormat('insertUnorderedList'); return; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, moreMenuOpen, tagInputOpen]);

  const runSave = async () => {
    if (!title.trim() && !htmlToText(contentHtml).trim()) return;
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
    } catch { /* parent toast */ }
    finally { setSaving(false); }
  };

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
    if (!editorRef.current) return;
    editorRef.current.focus();
    try { document.execCommand(cmd, false, value); } catch { /* noop */ }
    syncEditorState();
    void hapticLight();
  };

  const cycleHeading = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const next = (headingCycle + 1) % 4;
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
    // Markdown shortcut: `# `, `## `, `### ` at start of a line → heading
    if (e.key === ' ' && editorRef.current) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const text = range.startContainer.textContent || '';
      if (text === '#' || text === '##' || text === '###') {
        e.preventDefault();
        const level = text.length;
        range.startContainer.textContent = '';
        try { document.execCommand('formatBlock', false, `H${Math.min(3, level + 1)}`); } catch {}
        setHeadingCycle(Math.min(3, level + 1));
        syncEditorState();
      }
    }
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (!t) return;
    if (!tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));

  const accentHex = (color && NOTE_ACCENT_PALETTE.find(s => s.id === color)?.hex) || null;

  // Native share — falls back to clipboard
  const handleShare = async () => {
    const text = `${title.trim() || 'Untitled'}\n\n${htmlToText(contentHtml)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: title.trim() || 'Note', text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch { /* user cancelled */ }
  };

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
          {/* Top bar — Evernote style: back, share, more */}
          <header className="flex items-center justify-between gap-2 px-2 py-2 border-b border-border/40 bg-background">
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Inline saved indicator — tiny, lives in the title-bar gutter so
                it doesn't need its own row */}
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground/70">
              {saving ? (
                <><Save className="w-3 h-3 text-amber-400 animate-pulse" />Saving…</>
              ) : dirty ? (
                <><Save className="w-3 h-3 text-amber-400" />Unsaved</>
              ) : (
                <><Check className="w-3 h-3 text-emerald-400" />Saved{savedAt ? ` · ${timeAgoShort(savedAt)}` : ''}</>
              )}
            </span>

            <div className="flex items-center gap-0.5">
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
          </header>

          {/* Color accent — thin line under the top bar (replaces the loud rail) */}
          {accentHex && <div className="h-px w-full" style={{ background: accentHex }} aria-hidden />}

          {/* Body — clean writing surface */}
          <div className="flex-1 min-h-0 overflow-y-auto smooth-scrollbar">
            <div className="px-4 sm:px-8 pt-5 pb-3 max-w-3xl mx-auto w-full">
              {/* Notebook + tag row — small, muted, content-focused */}
              <div className="flex items-center justify-between gap-2 mb-4 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 opacity-60" />
                  <select
                    value={notebook}
                    onChange={e => setNotebook(e.target.value)}
                    aria-label="Notebook"
                    className="bg-transparent border-0 outline-none cursor-pointer hover:text-foreground transition-colors capitalize"
                  >
                    {notebookOptions.map(nb => (
                      <option key={nb} value={nb} className="bg-background">{nb}</option>
                    ))}
                  </select>
                </span>

                <div className="flex items-center gap-1 flex-wrap justify-end min-w-0">
                  {tags.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[11px] text-foreground"
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
                  {tagInputOpen ? (
                    <input
                      autoFocus
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onBlur={() => { if (tagInput.trim()) addTag(); setTagInputOpen(false); }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
                        else if (e.key === 'Escape') { setTagInput(''); setTagInputOpen(false); }
                        else if (e.key === 'Backspace' && !tagInput && tags.length) { setTags(prev => prev.slice(0, -1)); }
                      }}
                      placeholder="tag"
                      className="bg-transparent border-0 outline-none text-[13px] w-20 placeholder:text-muted-foreground/50"
                      aria-label="Add tag"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTagInputOpen(true)}
                      className="text-[13px] text-emerald-400/90 hover:text-emerald-300 transition-colors"
                    >
                      {tags.length === 0 ? '+ Add tag' : '+ Tag'}
                    </button>
                  )}
                </div>
              </div>

              {/* Title */}
              <input
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Title"
                aria-label="Note title"
                className="w-full bg-transparent border-0 outline-none text-[28px] sm:text-[32px] font-bold tracking-tight text-foreground placeholder:text-muted-foreground/30 leading-tight pb-3"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editorRef.current?.focus(); } }}
              />

              {/* Body */}
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
                className="iv-rich-editor min-h-[55vh] outline-none prose dark:prose-invert max-w-none prose-p:my-2 prose-p:leading-[1.65] prose-headings:tracking-tight prose-h1:mt-5 prose-h2:mt-4 prose-h3:mt-3 prose-li:my-0.5 prose-li:leading-[1.6]"
                data-placeholder="Start writing…"
                style={{ paddingBottom: `calc(96px + ${bottomGutterPx}px)`, fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Minimal formatting strip at the bottom — small icons, muted by
              default, lights up only for the active format. */}
          <div
            className="sticky bottom-0 z-[2] bg-background/95 backdrop-blur-md border-t border-border/40"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="max-w-3xl mx-auto w-full px-2 py-1 flex items-center gap-0.5 overflow-x-auto smooth-scrollbar">
              <ToolbarBtn label="Bold" active={activeFormats.has('bold')} onClick={() => applyFormat('bold')}><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Italic" active={activeFormats.has('italic')} onClick={() => applyFormat('italic')}><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Underline" active={activeFormats.has('underline')} onClick={() => applyFormat('underline')}><UnderlineIcon className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Strikethrough" active={activeFormats.has('strike')} onClick={() => applyFormat('strikeThrough')}><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>
              <span className="w-px h-4 bg-border/60 mx-1" aria-hidden />
              <ToolbarBtn
                label={`Heading${headingCycle === 0 ? '' : ` H${headingCycle}`}`}
                active={headingCycle > 0}
                onClick={cycleHeading}
              >
                <Heading2 className="w-3.5 h-3.5" />
              </ToolbarBtn>
              <ToolbarBtn label="Bullet list" active={activeFormats.has('ul')} onClick={() => applyFormat('insertUnorderedList')}><ListBullets className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Numbered list" active={activeFormats.has('ol')} onClick={() => applyFormat('insertOrderedList')}><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Checklist" onClick={insertChecklistItem}><CheckSquare className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Code block" onClick={() => applyFormat('formatBlock', 'PRE')}><Code className="w-3.5 h-3.5" /></ToolbarBtn>
              <ToolbarBtn label="Divider" onClick={insertDivider}><Minus className="w-3.5 h-3.5" /></ToolbarBtn>

              {/* Compact word count at the right edge */}
              <span className="ml-auto text-[10px] text-muted-foreground/55 tabular-nums pr-2 flex-shrink-0 sm:hidden">
                {saving ? 'saving…' : dirty ? 'unsaved' : 'saved'} · {wordCount}w
              </span>
              <span className="hidden sm:inline ml-auto text-[10px] text-muted-foreground/55 tabular-nums pr-2 flex-shrink-0">
                {wordCount} word{wordCount === 1 ? '' : 's'}
              </span>
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
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={!!active}
      className={`min-w-[28px] h-7 px-1.5 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${
        active
          ? 'bg-emerald-500/15 text-emerald-300'
          : 'text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.06]'
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
