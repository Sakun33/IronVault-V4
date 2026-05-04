import { useState, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFormDefaults } from '@/hooks/use-form-defaults';
import { useSubscription } from '@/hooks/use-subscription';
import { useVault } from '@/contexts/vault-context';
import { NoteEntry, NOTE_NOTEBOOKS } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Search, Pin, Calendar, StickyNote, ChevronDown, ChevronRight,
  LayoutTemplate, Lightbulb, ListTodo, Users, Target, PenLine, Sparkles, FileText,
  CheckSquare, LayoutGrid, List as ListIcon, MoreHorizontal, Copy as CopyIcon,
  Trash2, Pin as PinIcon, Tag,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { ListSkeleton } from '@/components/list-skeleton';
import { NoteEditor, NOTE_ACCENT_PALETTE, type NoteFormPayload } from '@/components/note-editor';

// ── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

// Strip markdown syntax so card previews render clean text instead of
// "## Heading **bold** 1. item". Order matters: handle compound patterns
// (bold/italic, links, images) before single-character markers (* _).
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')           // fenced code blocks
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')        // headings (#### Title)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')    // images — drop entirely
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // links — keep label
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')       // **bold**
    .replace(/__([^_\n]+)__/g, '$1')           // __bold__
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2') // *italic*
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1$2')   // _italic_
    .replace(/~~([^~\n]+)~~/g, '$1')           // ~~strike~~
    .replace(/`([^`\n]+)`/g, '$1')             // `inline code`
    .replace(/^\s*[-*+]\s+/gm, '')             // - bullet
    .replace(/^\s*\d+\.\s+/gm, '')             // 1. numbered
    .replace(/^\s*>\s+/gm, '')                 // > blockquote
    .replace(/^[-*_]{3,}\s*$/gm, '')           // --- horizontal rule
    .replace(/<[^>]+>/g, '')                   // any HTML tag that slipped through
    .replace(/\s*\n+\s*/g, ' ')                // collapse newlines + surrounding ws
    .replace(/\s{2,}/g, ' ')                   // run-on whitespace
    .trim();
}

function getPreview(content: string, max = 200): string {
  // First strip HTML (notes saved by the rich editor), then strip any
  // markdown the user typed (legacy notes or copy/pasted Obsidian content).
  const html = content.includes('<') ? stripHtml(content) : content;
  const text = stripMarkdown(html);
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

function timeAgoShort(date: Date | string | undefined): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

const NOTEBOOK_DEFAULT_COLORS: Record<string, string> = {
  personal: '#6366f1',
  work:     '#0ea5e9',
  ideas:    '#f59e0b',
  finance:  '#10b981',
  health:   '#ec4899',
  travel:   '#8b5cf6',
  Default:  '#94a3b8',
};

function accentFor(note: Pick<NoteEntry, 'color' | 'notebook'>): string {
  if (note.color) {
    const swatch = NOTE_ACCENT_PALETTE.find(s => s.id === note.color);
    if (swatch) return swatch.hex;
  }
  return NOTEBOOK_DEFAULT_COLORS[note.notebook] ?? NOTEBOOK_DEFAULT_COLORS.Default;
}

type SortKey = 'updated' | 'created' | 'alpha';

// ── Page ───────────────────────────────────────────────────────────────────

export default function Notes() {
  const reducedMotion = useReducedMotion();
  const { notes, addNote, updateNote, deleteNote, bulkDeleteNotes, isLoading } = useVault();
  const { toast } = useToast();
  const { getLimit, isPro } = useSubscription();
  const { lastNotebook, saveNotebook } = useFormDefaults();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNotebook, setSelectedNotebook] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortKey>('updated');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteEntry | null>(null);
  const [starterContent, setStarterContent] = useState<string | undefined>(undefined);
  const [starterNotebook, setStarterNotebook] = useState<string | undefined>(undefined);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ note: NoteEntry; x: number; y: number } | null>(null);

  const [view, setView] = useState<'grid' | 'list'>(() => {
    if (typeof window === 'undefined') return 'grid';
    return (localStorage.getItem('iv_notes_view') as 'grid' | 'list') || 'grid';
  });
  useEffect(() => { try { localStorage.setItem('iv_notes_view', view); } catch {} }, [view]);

  // Built-in templates — same surface as before, just wired to the new editor
  const NOTE_TEMPLATES = useMemo(() => ([
    { id: 'grocery',  name: 'Grocery List',     icon: ListTodo, notebook: 'personal', content: 'Grocery List\n\nProduce:\n- \n\nDairy:\n- \n\nMeat / Protein:\n- \n\nPantry:\n- \n\nOther:\n- ' },
    { id: 'meeting',  name: 'Meeting Notes',     icon: Users,    notebook: 'work',     content: `Meeting Notes\n\nDate: ${new Date().toLocaleDateString()}\nAttendees: \n\nAgenda:\n1. \n\nKey Points:\n- \n\nAction Items:\n- ` },
    { id: 'todo',     name: 'Daily Tasks',       icon: ListTodo, notebook: 'personal', content: `Tasks for ${new Date().toLocaleDateString()}\n\nMust Do:\n- \n\nShould Do:\n- \n\nNice to Have:\n- ` },
    { id: 'journal',  name: 'Daily Journal',     icon: PenLine,  notebook: 'personal', content: `Journal — ${new Date().toLocaleDateString()}\n\nHow I'm feeling:\n\nWhat happened today:\n\nGrateful for:\n1. \n2. \n3. \n\nTomorrow's priorities:\n- ` },
    { id: 'recipe',   name: 'Recipe',            icon: FileText, notebook: 'personal', content: 'Recipe: \n\nServings: \nPrep Time: \nCook Time: \n\nIngredients:\n- \n\nInstructions:\n1. \n2. \n3. \n\nNotes:\n' },
    { id: 'travel',   name: 'Travel Checklist',  icon: Target,   notebook: 'travel',   content: 'Travel Packing\n\nDestination: \nDates: \n\nDocuments:\n- Passport\n- ID\n- Tickets\n\nClothing:\n- \n\nToiletries:\n- \n\nElectronics:\n- Charger\n- ' },
    { id: 'project',  name: 'Project Plan',      icon: Sparkles, notebook: 'work',     content: 'Project: \n\nObjective:\n\nMilestones:\n- Phase 1: \n- Phase 2: \n- Phase 3: \n\nRisks:\n- \n\nNotes:\n' },
    { id: 'contacts', name: 'Contact Info',      icon: Users,    notebook: 'personal', content: 'Contact\n\nName: \nCompany: \nRole: \nPhone: \nEmail: \n\nNotes:\n' },
    { id: 'ideas',    name: 'Ideas',             icon: Lightbulb,notebook: 'ideas',    content: 'Ideas\n\n- \n- \n- \n' },
    { id: 'blank',    name: 'Blank Note',        icon: FileText, notebook: 'personal', content: '' },
  ]), []);

  // Filter + sort
  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return notes.filter(note => {
      if (showPinnedOnly && !note.isPinned) return false;
      if (selectedNotebook !== 'all' && note.notebook !== selectedNotebook) return false;
      if (q) {
        const hay = `${note.title} ${stripHtml(note.content || '')} ${(note.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, searchQuery, selectedNotebook, showPinnedOnly]);

  const sortedNotes = useMemo(() => {
    const sorted = [...filteredNotes];
    sorted.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'alpha') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return sorted;
  }, [filteredNotes, sortBy]);

  const selection = useMultiSelect(sortedNotes);

  // Notebook tabs surface — schema defaults plus any notebook a saved note actually uses
  const notebookTabs = useMemo(() => {
    const used = new Set<string>(NOTE_NOTEBOOKS);
    notes.forEach(n => n.notebook && used.add(n.notebook));
    return ['all', ...Array.from(used)];
  }, [notes]);

  // ── Editor lifecycle ─────────────────────────────────────────────────────
  const openNewNote = (template?: typeof NOTE_TEMPLATES[number]) => {
    if (!isPro && notes.length >= getLimit('notes')) {
      toast({ title: 'Limit reached', description: 'Upgrade to Pro for unlimited notes.', variant: 'destructive' });
      return;
    }
    setEditingNote(null);
    setStarterContent(template?.content);
    setStarterNotebook(template?.notebook || lastNotebook || 'personal');
    setEditorOpen(true);
    setShowTemplatesModal(false);
  };
  const openExistingNote = (note: NoteEntry) => {
    setEditingNote(note);
    setStarterContent(undefined);
    setStarterNotebook(undefined);
    setEditorOpen(true);
  };
  const closeEditor = () => {
    setEditorOpen(false);
    // Defer clearing — keeps animations clean
    setTimeout(() => {
      setEditingNote(null);
      setStarterContent(undefined);
      setStarterNotebook(undefined);
    }, 240);
  };

  // Save handler — adds for new, updates for existing
  const handleSave = async (payload: NoteFormPayload) => {
    if (editingNote) {
      await updateNote(editingNote.id, payload);
      // Re-stamp editingNote so the editor's "saved" state stays accurate
      setEditingNote(prev => prev ? { ...prev, ...payload, updatedAt: new Date() } as NoteEntry : prev);
    } else {
      await addNote(payload);
      saveNotebook(payload.notebook);
      // After the first save, the editor stays open but logically becomes
      // an existing note. The vault context will surface the new entry —
      // we close the editor; the user can re-open from the list.
      // (Avoids the complication of looking up the just-created id.)
      setEditorOpen(false);
    }
  };

  // Delete (called from editor or context menu / confirm dialog)
  const handleDeleteRequest = (id: string, title: string) => setDeleteTarget({ id, title });
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNote(deleteTarget.id);
      toast({ title: 'Note deleted' });
      if (editorOpen && editingNote?.id === deleteTarget.id) closeEditor();
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  // Pin/unpin
  const togglePin = async (note: NoteEntry) => {
    try { await updateNote(note.id, { isPinned: !note.isPinned }); }
    catch { toast({ title: 'Pin failed', variant: 'destructive' }); }
  };

  // Duplicate
  const duplicateNote = async (note: NoteEntry) => {
    try {
      await addNote({
        title: `${note.title} (copy)`,
        content: note.content,
        notebook: note.notebook,
        tags: [...(note.tags || [])],
        isPinned: false,
        color: note.color,
      });
      toast({ title: 'Note duplicated' });
    } catch {
      toast({ title: 'Duplicate failed', variant: 'destructive' });
    }
  };

  // Bulk delete (from selection bar)
  const handleBulkDelete = async () => {
    const ids = Array.from(selection.selectedIds);
    if (ids.length === 0) return;
    const removed = await bulkDeleteNotes(ids);
    selection.exitSelectionMode();
    toast({
      title: removed === ids.length ? 'Notes deleted' : 'Some notes could not be deleted',
      description: `${removed} of ${ids.length} removed.`,
      variant: removed === ids.length ? 'default' : 'destructive',
    });
  };

  // Context menu — long-press / right-click on a card
  const longPressTimer = useRef<number | null>(null);
  const startLongPress = (note: NoteEntry, e: React.TouchEvent) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    const touch = e.touches[0];
    longPressTimer.current = window.setTimeout(() => {
      setContextMenu({ note, x: touch.clientX, y: touch.clientY });
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  useEffect(() => {
    if (!contextMenu) return;
    const onClick = () => setContextMenu(null);
    const onScroll = () => setContextMenu(null);
    document.addEventListener('click', onClick);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [contextMenu]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Notes</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {notes.length} note{notes.length === 1 ? '' : 's'}
            {!isPro && notes.length > 0 && ` · ${notes.length}/${getLimit('notes')} used`}
            {sortedNotes.length !== notes.length && notes.length > 0 && ` · ${sortedNotes.length} matching`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatesModal(true)}
            className="hidden sm:inline-flex rounded-xl"
          >
            <LayoutTemplate className="w-3.5 h-3.5 mr-1" /> Templates
          </Button>
          <Button
            size="sm"
            onClick={() => openNewNote()}
            disabled={!isPro && notes.length >= getLimit('notes')}
            data-testid="button-add-note"
            className="cta-tap-pulse"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            {!isPro && notes.length >= getLimit('notes') ? 'Upgrade' : 'New Note'}
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 w-4 h-4 pointer-events-none" />
        <Input
          data-testid="input-notes-search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search notes, tags, or content…"
          className="pl-10 h-11 rounded-xl text-[15px]"
        />
      </div>

      {/* Notebook tabs — own row, horizontally scrollable on mobile, hidden
          scrollbar so the row stays clean. Negative margins so the scroll
          area can bleed past the page padding without clipping the chips. */}
      <div className="-mx-4 sm:mx-0">
        <div
          className="flex items-center gap-2 overflow-x-auto px-4 sm:px-0 pb-1 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`.iv-notes-tabs::-webkit-scrollbar { display: none; }`}</style>
          {notebookTabs.map(tab => {
            const active = selectedNotebook === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedNotebook(tab)}
                className={`iv-notes-tabs relative text-xs px-4 py-2 rounded-full border whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200'
                    : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="notesNotebookTab"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    className="absolute inset-0 rounded-full bg-emerald-500/12 ring-1 ring-emerald-400/30 -z-[1]"
                  />
                )}
                {tab === 'all' ? 'All' : tab}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setShowPinnedOnly(v => !v)}
            className={`iv-notes-tabs text-xs px-4 py-2 rounded-full border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              showPinnedOnly
                ? 'border-amber-400/50 bg-amber-500/10 text-amber-300'
                : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground'
            }`}
          >
            <Pin className={`w-3 h-3 ${showPinnedOnly ? 'fill-amber-400' : ''}`} /> Pinned
          </button>
        </div>
      </div>

      {/* Sort + view toggle — single row, sort on left, toggle on right */}
      <div className="flex items-center justify-between gap-2">
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="h-8 w-auto min-w-[128px] text-xs rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="updated">Newest first</SelectItem>
            <SelectItem value="created">Oldest first</SelectItem>
            <SelectItem value="alpha">A → Z</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md p-0.5 flex-shrink-0">
          <button
            type="button"
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors ${view === 'grid' ? 'bg-emerald-500/15 text-emerald-300' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors ${view === 'list' ? 'bg-emerald-500/15 text-emerald-300' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ListIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {isLoading && notes.length === 0 ? (
        <ListSkeleton rows={5} showHeader={false} />
      ) : sortedNotes.length === 0 ? (
        <EmptyState
          isFiltered={notes.length > 0}
          onCreate={() => openNewNote()}
          onClearFilters={() => { setSelectedNotebook('all'); setSearchQuery(''); setShowPinnedOnly(false); }}
        />
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {view === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="columns-2 lg:columns-3 gap-3 [column-fill:_balance]"
            >
              <AnimatePresence>
                {sortedNotes.map(note => (
                  <NoteGridCard
                    key={note.id}
                    note={note}
                    selected={selection.isSelected(note.id)}
                    selectionMode={selection.isSelectionMode}
                    reduceMotion={!!reducedMotion}
                    onClick={() => {
                      if (selection.isSelectionMode) selection.toggle(note.id);
                      else openExistingNote(note);
                    }}
                    onToggleSelect={() => selection.toggle(note.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ note, x: e.clientX, y: e.clientY });
                    }}
                    onTouchStart={(e) => startLongPress(note, e)}
                    onTouchEnd={cancelLongPress}
                    onTouchMove={cancelLongPress}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
            >
              <Card className={`rounded-2xl shadow-sm border-border/50 overflow-hidden ${selection.isSelectionMode ? 'pb-20' : ''}`}>
                <AnimatePresence>
                  {sortedNotes.map((note, idx) => (
                    <NoteListRow
                      key={note.id}
                      note={note}
                      isLast={idx === sortedNotes.length - 1}
                      selected={selection.isSelected(note.id)}
                      selectionMode={selection.isSelectionMode}
                      onClick={() => {
                        if (selection.isSelectionMode) selection.toggle(note.id);
                        else openExistingNote(note);
                      }}
                      onToggleSelect={() => selection.toggle(note.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ note, x: e.clientX, y: e.clientY });
                      }}
                    />
                  ))}
                </AnimatePresence>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Templates modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" /> Templates
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid grid-cols-2 gap-3">
            {NOTE_TEMPLATES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openNewNote(t)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:border-emerald-400/40 hover:bg-emerald-500/5 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{t.notebook}</p>
                  </div>
                </button>
              );
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-note">
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">&ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted.</p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" data-testid="button-confirm-delete-note" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            key="ctx"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="fixed z-[170] glass-card shadow-xl py-1 min-w-[180px]"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 220),
              left: Math.min(contextMenu.x, window.innerWidth - 200),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextItem icon={PinIcon} label={contextMenu.note.isPinned ? 'Unpin' : 'Pin'} onClick={() => { void togglePin(contextMenu.note); setContextMenu(null); }} />
            <ContextItem icon={CopyIcon} label="Duplicate" onClick={() => { void duplicateNote(contextMenu.note); setContextMenu(null); }} />
            <div className="h-px bg-white/[0.08] mx-2 my-1" />
            <ContextItem icon={Trash2} label="Delete" danger onClick={() => { handleDeleteRequest(contextMenu.note.id, contextMenu.note.title); setContextMenu(null); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection bar */}
      {selection.isSelectionMode && (
        <SelectionBar
          selectedCount={selection.selectedCount}
          totalCount={sortedNotes.length}
          allSelected={selection.allSelected}
          itemLabel="note"
          onSelectAll={selection.selectAll}
          onClear={selection.clearSelection}
          onCancel={selection.exitSelectionMode}
          onDelete={handleBulkDelete}
        />
      )}

      {/* Editor — full screen */}
      <NoteEditor
        open={editorOpen}
        note={editingNote}
        starter={starterContent ? { content: starterContent, notebook: starterNotebook } : undefined}
        defaultNotebook={starterNotebook || lastNotebook || 'personal'}
        onClose={closeEditor}
        onSave={handleSave}
        onDelete={editingNote ? () => handleDeleteRequest(editingNote.id, editingNote.title) : undefined}
        bottomGutterPx={96}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function EmptyState({ isFiltered, onCreate, onClearFilters }: { isFiltered: boolean; onCreate: () => void; onClearFilters: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4"
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-5">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent blur-2xl" aria-hidden />
        <div className="relative w-full h-full rounded-3xl glass-card flex items-center justify-center">
          <StickyNote className="w-9 h-9 sm:w-10 sm:h-10 text-emerald-300" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-1.5">
        {isFiltered ? 'No notes match your filters' : 'No notes yet'}
      </h2>
      <p className="text-sm text-muted-foreground/80 mb-5 max-w-sm">
        {isFiltered
          ? 'Try a different search term, clear the filters, or start a new note.'
          : 'Capture ideas, drafts, and thoughts in a place only you can read.'}
      </p>
      {isFiltered ? (
        <Button variant="outline" onClick={onClearFilters}>Clear filters</Button>
      ) : (
        <Button onClick={onCreate} data-testid="button-create-first-note" className="cta-tap-pulse">
          <Plus className="w-4 h-4 mr-1" /> Create your first encrypted note
        </Button>
      )}
    </motion.div>
  );
}

interface CardProps {
  note: NoteEntry;
  selected: boolean;
  selectionMode: boolean;
  reduceMotion: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
}

function NoteGridCard({ note, selected, selectionMode, reduceMotion, onClick, onToggleSelect, onContextMenu, onTouchStart, onTouchEnd, onTouchMove }: CardProps) {
  const accent = accentFor(note);
  const preview = getPreview(note.content || '', 240);
  // Hide the notebook pill for the implicit "Default" / empty value — those
  // chips just add visual noise. Show pills only for user-meaningful notebooks.
  const notebookLabel = note.notebook && note.notebook.toLowerCase() !== 'default' ? note.notebook : null;

  return (
    <motion.div
      layout
      data-testid={`note-card-${note.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      whileHover={reduceMotion ? undefined : { y: -2, boxShadow: `0 14px 36px -12px ${accent}66` }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      className={`group relative mb-4 break-inside-avoid glass-card cursor-pointer overflow-hidden rounded-xl ${selected ? 'ring-2 ring-emerald-400/40' : ''}`}
    >
      <div className="h-[3px] w-full" style={{ background: accent }} aria-hidden />
      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <h3
            className="text-[16px] font-semibold text-foreground flex-1 leading-snug line-clamp-2 break-words"
            data-testid={`note-title-${note.id}`}
          >
            {note.title || 'Untitled'}
          </h3>
          {note.isPinned && (
            <Pin className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0 mt-1.5" />
          )}
        </div>
        {preview && (
          <div className="relative">
            <p
              data-testid={`note-content-${note.id}`}
              className="text-[13px] text-muted-foreground/80 leading-[1.55] line-clamp-4 sm:line-clamp-5 break-words"
            >
              {preview}
            </p>
            {/* Soft fade-out at the bottom of the preview so long content
                doesn't end on a hard cutoff. Pointer-events:none keeps the
                whole card clickable. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[var(--card-bg-stop,rgba(13,18,28,0.85))] to-transparent dark:from-[rgba(13,18,28,0.85)]"
              style={{ background: 'linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%)' }}
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
          <span className="text-[11px] text-muted-foreground/60 tabular-nums">{timeAgoShort(note.updatedAt)}</span>
          {notebookLabel && (
            <span
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium lowercase px-2 py-0.5 rounded-full"
              style={{ background: `${accent}14`, color: `${accent}cc`, border: `1px solid ${accent}26` }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: accent }} />
              <span className="truncate max-w-[80px] sm:max-w-[100px]">{notebookLabel}</span>
            </span>
          )}
        </div>

        {selectionMode && (
          <div className="absolute top-2.5 left-2.5 z-[1]" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
            <SelectionCheckbox checked={selected} onChange={onToggleSelect} label={`Select ${note.title}`} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface ListRowProps {
  note: NoteEntry;
  isLast: boolean;
  selected: boolean;
  selectionMode: boolean;
  onClick: () => void;
  onToggleSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}
function NoteListRow({ note, isLast, selected, selectionMode, onClick, onToggleSelect, onContextMenu }: ListRowProps) {
  const accent = accentFor(note);
  const preview = getPreview(note.content || '', 110);
  return (
    <motion.button
      layout
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      whileTap={{ scale: 0.995 }}
      data-testid={`note-card-${note.id}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors ${!isLast ? 'border-b border-white/[0.06]' : ''} ${selected ? 'bg-emerald-500/5' : ''}`}
    >
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: accent }} />
      {selectionMode && (
        <div onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
          <SelectionCheckbox checked={selected} onChange={onToggleSelect} label={`Select ${note.title}`} />
        </div>
      )}
      <div className="flex-shrink-0 flex flex-col items-center gap-1">
        <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
        {note.isPinned && <Pin className="w-3 h-3 fill-amber-400 text-amber-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[16px] font-semibold text-foreground truncate leading-snug" data-testid={`note-title-${note.id}`}>
          {note.title || 'Untitled'}
        </div>
        {preview && (
          <div className="text-[13px] text-muted-foreground/80 truncate mt-1" data-testid={`note-content-${note.id}`}>
            {preview}
          </div>
        )}
        <div className="text-[11px] text-muted-foreground/55 mt-1">{timeAgoShort(note.updatedAt)}</div>
      </div>
      {!selectionMode && <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />}
    </motion.button>
  );
}

function ContextItem({ icon: Icon, label, onClick, danger }: { icon: React.ElementType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-foreground hover:bg-white/[0.06]'}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
