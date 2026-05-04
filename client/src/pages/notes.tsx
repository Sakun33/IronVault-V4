import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormDefaults } from '@/hooks/use-form-defaults';
import { useSubscription } from '@/hooks/use-subscription';
import { useVault } from '@/contexts/vault-context';
import { NoteEntry, NOTE_NOTEBOOKS } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, X as CloseIcon, MoreHorizontal, ListFilter, ChevronDown,
  Pin, StickyNote, LayoutTemplate, Trash2, Copy as CopyIcon, CheckSquare,
  Lightbulb, ListTodo, Users, Target, PenLine, Sparkles, FileText,
  LayoutGrid, List as ListIcon,
} from 'lucide-react';
import { format, isToday, isYesterday, startOfDay, isThisWeek } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { ListSkeleton } from '@/components/list-skeleton';
import { NoteEditor, NOTE_ACCENT_PALETTE, type NoteFormPayload } from '@/components/note-editor';
import { hapticLight } from '@/lib/haptics';

// ── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1$2')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getPreview(content: string, max = 200): string {
  const html = content.includes('<') ? stripHtml(content) : content;
  const text = stripMarkdown(html);
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
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

function accentFor(note: Pick<NoteEntry, 'color' | 'notebook'>): string | null {
  if (note.color) {
    const swatch = NOTE_ACCENT_PALETTE.find(s => s.id === note.color);
    if (swatch) return swatch.hex;
  }
  // Don't paint a left rail for the implicit "Default" / unselected notebook
  // — Evernote-style cleanliness: only show an accent when the user picked one.
  const nb = note.notebook || '';
  if (!nb || nb.toLowerCase() === 'default') return null;
  return NOTEBOOK_DEFAULT_COLORS[nb] ?? null;
}

type SortKey = 'updated' | 'created' | 'alpha';

// Group notes by relative date label ("Today", "Yesterday", "This week",
// then a specific calendar day) so the list reads like a journal index.
function groupNotesByDate(notes: NoteEntry[], sortBy: SortKey): Array<{ label: string; key: string; notes: NoteEntry[] }> {
  if (sortBy === 'alpha') return [{ label: 'All notes', key: 'alpha', notes }];
  const groups = new Map<string, { label: string; sortStamp: number; notes: NoteEntry[] }>();
  for (const note of notes) {
    const ref = sortBy === 'created' ? new Date(note.createdAt) : new Date(note.updatedAt);
    const dayStart = startOfDay(ref).getTime();
    let label: string;
    let key: string;
    if (isToday(ref)) {
      label = 'Today'; key = 'today';
    } else if (isYesterday(ref)) {
      label = 'Yesterday'; key = 'yesterday';
    } else if (isThisWeek(ref, { weekStartsOn: 1 })) {
      label = 'This week'; key = 'thisweek';
    } else {
      label = format(ref, 'MMMM d, yyyy');
      key = String(dayStart);
    }
    const existing = groups.get(key);
    if (existing) existing.notes.push(note);
    else groups.set(key, { label, sortStamp: dayStart, notes: [note] });
  }
  // Sort groups by recency (Today → Yesterday → This week → older days desc)
  // and notes within a group also descending.
  return Array.from(groups.values())
    .sort((a, b) => b.sortStamp - a.sortStamp)
    .map(g => ({ label: g.label, key: g.label, notes: g.notes }));
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote, bulkDeleteNotes, isLoading } = useVault();
  const { toast } = useToast();
  const { getLimit, isPro } = useSubscription();
  const { lastNotebook, saveNotebook } = useFormDefaults();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
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
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  // Grid view kept as a secondary mode but the default is the date-grouped list
  const [view, setView] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    const stored = localStorage.getItem('iv_notes_view');
    return stored === 'grid' ? 'grid' : 'list';
  });
  useEffect(() => { try { localStorage.setItem('iv_notes_view', view); } catch {} }, [view]);

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

  const notebookOptions = useMemo(() => {
    const used = new Set<string>(NOTE_NOTEBOOKS);
    notes.forEach(n => n.notebook && used.add(n.notebook));
    return ['all', ...Array.from(used)];
  }, [notes]);

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
      if (sortBy === 'created') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'alpha') return (a.title || '').localeCompare(b.title || '');
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return sorted;
  }, [filteredNotes, sortBy]);

  const groupedNotes = useMemo(() => groupNotesByDate(sortedNotes, sortBy), [sortedNotes, sortBy]);

  const selection = useMultiSelect(sortedNotes);

  // Editor lifecycle ────────────────────────────────────────────────────────
  const openNewNote = (template?: typeof NOTE_TEMPLATES[number]) => {
    if (!isPro && notes.length >= getLimit('notes')) {
      toast({ title: 'Limit reached', description: 'Upgrade to Pro for unlimited notes.', variant: 'destructive' });
      return;
    }
    void hapticLight();
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
    setTimeout(() => {
      setEditingNote(null);
      setStarterContent(undefined);
      setStarterNotebook(undefined);
    }, 240);
  };

  const handleSave = async (payload: NoteFormPayload) => {
    if (editingNote) {
      await updateNote(editingNote.id, payload);
      setEditingNote(prev => prev ? { ...prev, ...payload, updatedAt: new Date() } as NoteEntry : prev);
    } else {
      await addNote(payload);
      saveNotebook(payload.notebook);
      setEditorOpen(false);
    }
  };

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

  const togglePin = async (note: NoteEntry) => {
    try { await updateNote(note.id, { isPinned: !note.isPinned }); }
    catch { toast({ title: 'Pin failed', variant: 'destructive' }); }
  };

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

  // Long-press for context menu on touch
  const longPressTimer = useRef<number | null>(null);
  const startLongPress = (note: NoteEntry, e: React.TouchEvent) => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    const touch = e.touches[0];
    longPressTimer.current = window.setTimeout(() => {
      void hapticLight();
      setContextMenu({ note, x: touch.clientX, y: touch.clientY });
    }, 450);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };
  useEffect(() => {
    if (!contextMenu && !headerMenuOpen && !filterMenuOpen) return;
    const onClick = () => { setContextMenu(null); setHeaderMenuOpen(false); setFilterMenuOpen(false); };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [contextMenu, headerMenuOpen, filterMenuOpen]);

  const upgradeBlocked = !isPro && notes.length >= getLimit('notes');

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Top bar — minimal, content-focused */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Notes</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen(v => !v)}
            aria-label="Search notes"
            aria-pressed={searchOpen}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${searchOpen ? 'bg-emerald-500/15 text-emerald-300' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'}`}
          >
            <Search className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilterMenuOpen(v => !v); setHeaderMenuOpen(false); }}
              aria-label="Filter and sort"
              aria-expanded={filterMenuOpen}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${filterMenuOpen ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'}`}
            >
              <ListFilter className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {filterMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-11 z-30 w-60 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl py-2"
                >
                  <MenuLabel>Notebook</MenuLabel>
                  <div className="max-h-44 overflow-y-auto smooth-scrollbar">
                    {notebookOptions.map(nb => (
                      <MenuOption
                        key={nb}
                        active={selectedNotebook === nb}
                        onClick={() => setSelectedNotebook(nb)}
                      >
                        {nb === 'all' ? 'All notebooks' : nb}
                      </MenuOption>
                    ))}
                  </div>
                  <div className="h-px bg-white/[0.06] my-1" />
                  <MenuLabel>Sort</MenuLabel>
                  <MenuOption active={sortBy === 'updated'} onClick={() => setSortBy('updated')}>Newest first</MenuOption>
                  <MenuOption active={sortBy === 'created'} onClick={() => setSortBy('created')}>Oldest first</MenuOption>
                  <MenuOption active={sortBy === 'alpha'} onClick={() => setSortBy('alpha')}>A → Z</MenuOption>
                  <div className="h-px bg-white/[0.06] my-1" />
                  <MenuOption
                    active={showPinnedOnly}
                    onClick={() => setShowPinnedOnly(v => !v)}
                  >
                    <span className="flex items-center gap-2">
                      <Pin className={`w-3 h-3 ${showPinnedOnly ? 'fill-amber-400 text-amber-400' : ''}`} />
                      Pinned only
                    </span>
                  </MenuOption>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setHeaderMenuOpen(v => !v); setFilterMenuOpen(false); }}
              aria-label="More options"
              aria-expanded={headerMenuOpen}
              className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${headerMenuOpen ? 'bg-white/[0.08] text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'}`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {headerMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.14 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-11 z-30 w-48 rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl py-1.5"
                >
                  <MenuOption onClick={() => { setShowTemplatesModal(true); }}>
                    <span className="flex items-center gap-2"><LayoutTemplate className="w-3.5 h-3.5" /> Templates</span>
                  </MenuOption>
                  <MenuOption onClick={() => selection.enterSelectionMode()}>
                    <span className="flex items-center gap-2"><CheckSquare className="w-3.5 h-3.5" /> Select notes</span>
                  </MenuOption>
                  <div className="h-px bg-white/[0.06] my-1" />
                  <MenuLabel>View</MenuLabel>
                  <MenuOption active={view === 'list'} onClick={() => setView('list')}>
                    <span className="flex items-center gap-2"><ListIcon className="w-3.5 h-3.5" /> List</span>
                  </MenuOption>
                  <MenuOption active={view === 'grid'} onClick={() => setView('grid')}>
                    <span className="flex items-center gap-2"><LayoutGrid className="w-3.5 h-3.5" /> Grid</span>
                  </MenuOption>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Search bar — only when toggled */}
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            key="search"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="relative pt-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 w-4 h-4 pointer-events-none" />
              <Input
                data-testid="input-notes-search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search notes…"
                className="pl-10 pr-10 h-11 rounded-xl text-[15px]"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active-filter strip — single quiet line that mirrors the menu state */}
      {(selectedNotebook !== 'all' || showPinnedOnly || sortBy !== 'updated') && (
        <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-muted-foreground/80">
          {selectedNotebook !== 'all' && (
            <ActiveFilterChip label={selectedNotebook} onClear={() => setSelectedNotebook('all')} />
          )}
          {showPinnedOnly && <ActiveFilterChip label="pinned only" onClear={() => setShowPinnedOnly(false)} />}
          {sortBy !== 'updated' && (
            <ActiveFilterChip
              label={sortBy === 'created' ? 'oldest first' : 'A→Z'}
              onClear={() => setSortBy('updated')}
            />
          )}
        </div>
      )}

      {/* Body */}
      {isLoading && notes.length === 0 ? (
        <ListSkeleton rows={6} showHeader={false} />
      ) : sortedNotes.length === 0 ? (
        <EmptyState
          isFiltered={notes.length > 0}
          onCreate={() => openNewNote()}
          onClearFilters={() => { setSelectedNotebook('all'); setSearchQuery(''); setShowPinnedOnly(false); }}
        />
      ) : view === 'list' ? (
        <DateGroupedList
          groups={groupedNotes}
          selection={selection}
          onOpen={openExistingNote}
          onContextMenu={(note, x, y) => setContextMenu({ note, x, y })}
          onLongPressStart={startLongPress}
          onLongPressCancel={cancelLongPress}
        />
      ) : (
        <GridView
          notes={sortedNotes}
          selection={selection}
          onOpen={openExistingNote}
          onContextMenu={(note, x, y) => setContextMenu({ note, x, y })}
          onLongPressStart={startLongPress}
          onLongPressCancel={cancelLongPress}
        />
      )}

      {/* Floating action button — emerald, bottom-right, sits above mobile bottom-tabs */}
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => openNewNote()}
        disabled={upgradeBlocked}
        aria-label={upgradeBlocked ? 'Upgrade to add more notes' : 'New note'}
        data-testid="button-new-note-fab"
        className={`fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] lg:bottom-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_12px_32px_-6px_rgba(16,185,129,0.7)] hover:shadow-[0_16px_40px_-6px_rgba(16,185,129,0.85)] z-30 flex items-center justify-center disabled:opacity-50`}
      >
        <Plus className="w-6 h-6" strokeWidth={2.4} />
      </motion.button>

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
          <DialogHeader><DialogTitle>Delete note?</DialogTitle></DialogHeader>
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
            className="fixed z-[170] rounded-xl border border-white/10 bg-background/95 backdrop-blur-xl shadow-xl py-1 min-w-[180px]"
            style={{
              top: Math.min(contextMenu.y, window.innerHeight - 220),
              left: Math.min(contextMenu.x, window.innerWidth - 200),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextItem icon={Pin} label={contextMenu.note.isPinned ? 'Unpin' : 'Pin'} onClick={() => { void togglePin(contextMenu.note); setContextMenu(null); }} />
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

      {/* Editor */}
      <NoteEditor
        open={editorOpen}
        note={editingNote}
        starter={starterContent ? { content: starterContent, notebook: starterNotebook } : undefined}
        defaultNotebook={starterNotebook || lastNotebook || 'personal'}
        onClose={closeEditor}
        onSave={handleSave}
        onDelete={editingNote ? () => handleDeleteRequest(editingNote.id, editingNote.title) : undefined}
        onDuplicate={editingNote ? () => duplicateNote(editingNote) : undefined}
        bottomGutterPx={96}
      />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ListProps {
  groups: Array<{ label: string; key: string; notes: NoteEntry[] }>;
  selection: ReturnType<typeof useMultiSelect<NoteEntry>>;
  onOpen: (note: NoteEntry) => void;
  onContextMenu: (note: NoteEntry, x: number, y: number) => void;
  onLongPressStart: (note: NoteEntry, e: React.TouchEvent) => void;
  onLongPressCancel: () => void;
}
function DateGroupedList({ groups, selection, onOpen, onContextMenu, onLongPressStart, onLongPressCancel }: ListProps) {
  return (
    <div>
      <AnimatePresence initial={false}>
        {groups.map(group => (
          <motion.section
            key={group.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="pt-3"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 pb-2">
              {group.label}
            </h2>
            <div role="list" className="border-t border-border/50">
              <AnimatePresence>
                {group.notes.map(note => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    selected={selection.isSelected(note.id)}
                    selectionMode={selection.isSelectionMode}
                    onClick={() => {
                      if (selection.isSelectionMode) selection.toggle(note.id);
                      else onOpen(note);
                    }}
                    onContextMenu={(e) => { e.preventDefault(); onContextMenu(note, e.clientX, e.clientY); }}
                    onTouchStart={(e) => onLongPressStart(note, e)}
                    onTouchEnd={onLongPressCancel}
                    onTouchMove={onLongPressCancel}
                    onToggleSelect={() => selection.toggle(note.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface RowProps {
  note: NoteEntry;
  selected: boolean;
  selectionMode: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onToggleSelect: () => void;
}
function NoteRow({ note, selected, selectionMode, onClick, onContextMenu, onTouchStart, onTouchEnd, onTouchMove, onToggleSelect }: RowProps) {
  const accent = accentFor(note);
  const preview = getPreview(note.content || '', 160);
  return (
    <motion.button
      layout
      type="button"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
      transition={{ duration: 0.16 }}
      whileTap={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
      data-testid={`note-card-${note.id}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      className={`relative w-full flex items-start gap-3 py-4 pr-2 text-left border-b border-border/40 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors ${selected ? 'bg-emerald-500/[0.06]' : ''} ${accent ? 'pl-3' : 'pl-1'}`}
    >
      {accent && (
        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: accent }} />
      )}
      {selectionMode && (
        <div className="pt-0.5" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
          <SelectionCheckbox checked={selected} onChange={onToggleSelect} label={`Select ${note.title}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h3
            data-testid={`note-title-${note.id}`}
            className="text-[15px] font-semibold text-foreground leading-snug truncate flex-1"
          >
            {note.title || 'Untitled'}
          </h3>
          {note.isPinned && (
            <Pin className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0 mt-0.5" />
          )}
        </div>
        {preview && (
          <p
            data-testid={`note-content-${note.id}`}
            className="text-[13px] text-muted-foreground/80 leading-[1.55] line-clamp-2 mt-1 break-words"
          >
            {preview}
          </p>
        )}
      </div>
    </motion.button>
  );
}

interface GridProps {
  notes: NoteEntry[];
  selection: ReturnType<typeof useMultiSelect<NoteEntry>>;
  onOpen: (note: NoteEntry) => void;
  onContextMenu: (note: NoteEntry, x: number, y: number) => void;
  onLongPressStart: (note: NoteEntry, e: React.TouchEvent) => void;
  onLongPressCancel: () => void;
}
function GridView({ notes, selection, onOpen, onContextMenu, onLongPressStart, onLongPressCancel }: GridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
      <AnimatePresence>
        {notes.map(note => {
          const accent = accentFor(note);
          const preview = getPreview(note.content || '', 220);
          const selected = selection.isSelected(note.id);
          return (
            <motion.button
              key={note.id}
              type="button"
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.16 } }}
              transition={{ duration: 0.16 }}
              whileTap={{ scale: 0.99 }}
              data-testid={`note-card-${note.id}`}
              onClick={() => {
                if (selection.isSelectionMode) selection.toggle(note.id);
                else onOpen(note);
              }}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu(note, e.clientX, e.clientY); }}
              onTouchStart={(e) => onLongPressStart(note, e)}
              onTouchEnd={onLongPressCancel}
              onTouchMove={onLongPressCancel}
              className={`relative text-left rounded-xl border border-border/50 bg-card hover:border-border hover:shadow-sm transition-all p-4 min-h-[140px] flex flex-col ${selected ? 'ring-2 ring-emerald-400/40' : ''}`}
            >
              {accent && (
                <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{ background: accent }} />
              )}
              <div className="flex items-start gap-2 mb-1.5">
                <h3
                  data-testid={`note-title-${note.id}`}
                  className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2 flex-1 break-words"
                >
                  {note.title || 'Untitled'}
                </h3>
                {note.isPinned && <Pin className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0 mt-1" />}
              </div>
              {preview && (
                <p
                  data-testid={`note-content-${note.id}`}
                  className="text-[12px] text-muted-foreground/80 leading-[1.55] line-clamp-4 break-words"
                >
                  {preview}
                </p>
              )}
              <div className="mt-auto pt-3 text-[11px] text-muted-foreground/55">
                {format(new Date(note.updatedAt), 'MMM d')}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ isFiltered, onCreate, onClearFilters }: { isFiltered: boolean; onCreate: () => void; onClearFilters: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="flex flex-col items-center justify-center py-20 text-center px-4"
    >
      <StickyNote className="w-10 h-10 text-muted-foreground/40 mb-4" strokeWidth={1.5} />
      <h2 className="text-base sm:text-lg font-semibold text-foreground mb-1">
        {isFiltered ? 'No notes match' : 'No notes yet'}
      </h2>
      <p className="text-sm text-muted-foreground/70 mb-5 max-w-xs">
        {isFiltered
          ? 'Try a different search or clear the filters.'
          : 'Tap the + button to create your first encrypted note.'}
      </p>
      {isFiltered ? (
        <Button variant="outline" size="sm" onClick={onClearFilters}>Clear filters</Button>
      ) : (
        <Button size="sm" onClick={onCreate} data-testid="button-create-first-note">
          <Plus className="w-3.5 h-3.5 mr-1" /> New note
        </Button>
      )}
    </motion.div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
      {children}
    </div>
  );
}

function MenuOption({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-sm text-left flex items-center justify-between transition-colors ${
        active ? 'text-emerald-300 bg-emerald-500/10' : 'text-foreground hover:bg-white/[0.06]'
      }`}
    >
      <span className="capitalize">{children}</span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
    </button>
  );
}

function ActiveFilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 hover:border-emerald-400/40 hover:bg-emerald-500/5 transition-colors lowercase"
    >
      {label}
      <CloseIcon className="w-2.5 h-2.5" />
    </button>
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
