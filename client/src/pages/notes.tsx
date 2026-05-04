import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useFormDefaults } from '@/hooks/use-form-defaults';
import { useSubscription } from '@/hooks/use-subscription';
import { useVault } from '@/contexts/vault-context';
import { useAuth } from '@/contexts/auth-context';
import { NoteEntry } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, X as CloseIcon, MoreHorizontal, ListFilter, ChevronRight, ChevronLeft,
  Pin, StickyNote, LayoutTemplate, Trash2, Copy as CopyIcon, CheckSquare,
  Lightbulb, ListTodo, Users, Target, PenLine, Sparkles, FileText,
  LayoutGrid, List as ListIcon, BookOpen, Hash, Pencil,
  ShoppingCart, ChefHat, Plane,
} from 'lucide-react';
import { format, isToday, isYesterday, startOfDay, isThisWeek } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { ListSkeleton } from '@/components/list-skeleton';
import { NoteEditor, NOTE_ACCENT_PALETTE, type NoteFormPayload } from '@/components/note-editor';
import { hapticLight } from '@/lib/haptics';
import {
  combineNotebookList, upsertNotebook, renameNotebook as renameNotebookMeta,
  removeNotebookMeta, type NotebookMeta,
} from '@/lib/notebooks-store';

// ── Helpers ────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  if (!html) return '';
  // Convert block-level closers and <br> to newlines BEFORE extracting text,
  // otherwise consecutive headings/paragraphs collapse together (e.g.
  // "<h2>Concepts</h2><h3>Laws</h3>" → "ConceptsLaws") which then defeats
  // the line-anchored markdown regex below.
  const withBreaks = html
    .replace(/<\/(p|div|h[1-6]|li|blockquote|pre|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const tmp = document.createElement('div');
  tmp.innerHTML = withBreaks;
  return tmp.textContent || tmp.innerText || '';
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    // Headings: catch both line-anchored AND mid-string `###` that survived
    // an HTML strip where block separators were lost.
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1$2')
    .replace(/~~([^~\n]+)~~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/(^|\s)[-*+]\s+/g, '$1')
    // Ordered list markers: line-anchored OR mid-string
    .replace(/(^|\s)\d+\.\s+/g, '$1')
    .replace(/^\s*>\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function getPlainPreview(content: string, max = 220): string {
  const html = content.includes('<') ? stripHtml(content) : content;
  const text = stripMarkdown(html);
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

const NOTEBOOK_DEFAULT_COLORS: Record<string, string> = {
  personal: '#6366f1', work: '#0ea5e9', ideas: '#f59e0b',
  finance: '#10b981', health: '#ec4899', travel: '#8b5cf6', Default: '#94a3b8',
};

function accentFor(note: Pick<NoteEntry, 'color' | 'notebook'>): string | null {
  if (note.color) {
    const swatch = NOTE_ACCENT_PALETTE.find(s => s.id === note.color);
    if (swatch) return swatch.hex;
  }
  const nb = note.notebook || '';
  if (!nb || nb.toLowerCase() === 'default') return null;
  return NOTEBOOK_DEFAULT_COLORS[nb] ?? null;
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
    return d.toLocaleDateString();
  } catch { return ''; }
}

type SortKey = 'updated' | 'created' | 'alpha';

// Group notes by relative day for the date-section list view
function groupNotesByDate(notes: NoteEntry[], sortBy: SortKey): Array<{ label: string; key: string; notes: NoteEntry[] }> {
  if (sortBy === 'alpha') return [{ label: 'All notes', key: 'alpha', notes }];
  const groups = new Map<string, { label: string; sortStamp: number; notes: NoteEntry[] }>();
  for (const note of notes) {
    const ref = sortBy === 'created' ? new Date(note.createdAt) : new Date(note.updatedAt);
    const dayStart = startOfDay(ref).getTime();
    let label: string;
    let key: string;
    if (isToday(ref)) { label = 'Today'; key = 'today'; }
    else if (isYesterday(ref)) { label = 'Yesterday'; key = 'yesterday'; }
    else if (isThisWeek(ref, { weekStartsOn: 1 })) { label = 'This week'; key = 'thisweek'; }
    else { label = format(ref, 'MMMM d, yyyy'); key = String(dayStart); }
    const existing = groups.get(key);
    if (existing) existing.notes.push(note);
    else groups.set(key, { label, sortStamp: dayStart, notes: [note] });
  }
  return Array.from(groups.values())
    .sort((a, b) => b.sortStamp - a.sortStamp)
    .map(g => ({ label: g.label, key: g.label, notes: g.notes }));
}

// Highlight search matches inside a plain-text preview snippet. Returns
// nodes for direct rendering — keeps the parent component simple.
function highlightSnippet(text: string, query: string): React.ReactNode {
  const q = query.trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const out: React.ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lower.indexOf(needle, cursor);
    if (idx === -1) { out.push(text.slice(cursor)); break; }
    if (idx > cursor) out.push(text.slice(cursor, idx));
    out.push(<mark key={idx} className="iv-snippet-hit">{text.slice(idx, idx + needle.length)}</mark>);
    cursor = idx + needle.length;
  }
  return out;
}

// Detect viewport width buckets via media query — drives 1/2/3-pane layout
function useViewportTier(): 'mobile' | 'tablet' | 'desktop' {
  const [tier, setTier] = useState<'mobile' | 'tablet' | 'desktop'>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w >= 1024) return 'desktop';
    if (w >= 768) return 'tablet';
    return 'mobile';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const w = window.innerWidth;
      setTier(w >= 1024 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile');
    };
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return tier;
}

// ── Built-in templates ────────────────────────────────────────────────────
// Template registry — 10 pre-built note shapes covering the most common
// "I need to dump structured info into a note" cases. Helper makes a
// single empty checklist row so we don't keep repeating the verbose
// data-todo HTML below.
const _todoRow = `<div data-todo="1"><input type="checkbox" class="iv-todo-check"/>&nbsp;<span></span></div>`;
const NOTE_TEMPLATES: Array<{ id: string; name: string; description: string; icon: React.ElementType; notebook: string; content: string }> = [
  { id: 'blank', name: 'Quick Note', description: 'Just a title to start writing', icon: Lightbulb, notebook: 'personal', content: '' },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Date, attendees, agenda, action items',
    icon: Users,
    notebook: 'work',
    content: `<h2>Meeting Notes</h2><p><strong>Date:</strong> ${new Date().toLocaleDateString()}<br/><strong>Attendees:</strong> </p><h3>Agenda</h3><ol><li></li></ol><h3>Discussion Points</h3><ul><li></li></ul><h3>Action Items</h3>${_todoRow}${_todoRow}<h3>Next Steps</h3><p></p>`,
  },
  {
    id: 'todo',
    name: 'To-Do List',
    description: 'Daily checklist',
    icon: ListTodo,
    notebook: 'personal',
    content: `<h2>Tasks for ${new Date().toLocaleDateString()}</h2>${_todoRow}${_todoRow}${_todoRow}${_todoRow}${_todoRow}`,
  },
  {
    id: 'journal',
    name: 'Daily Journal',
    description: 'Mood, gratitude, reflections',
    icon: PenLine,
    notebook: 'personal',
    content: `<h2>Journal · ${new Date().toLocaleDateString()}</h2><h3>Mood</h3><p></p><h3>Today I'm grateful for</h3><ol><li></li><li></li><li></li></ol><h3>What happened today</h3><p></p><h3>Tomorrow I want to</h3><ul><li></li></ul>`,
  },
  {
    id: 'project',
    name: 'Project Plan',
    description: 'Goal, timeline, milestones, risks',
    icon: Sparkles,
    notebook: 'work',
    content: `<h2>Project</h2><p><strong>Project Name:</strong> </p><h3>Goal</h3><p></p><h3>Timeline</h3><p></p><h3>Milestones</h3>${_todoRow}${_todoRow}${_todoRow}<h3>Resources</h3><ul><li></li></ul><h3>Risks</h3><ul><li></li></ul>`,
  },
  {
    id: 'shopping',
    name: 'Shopping List',
    description: 'Store + checklist by category',
    icon: ShoppingCart,
    notebook: 'personal',
    content: `<h2>Shopping List</h2><p><strong>Store:</strong> </p><h3>Produce</h3>${_todoRow}${_todoRow}<h3>Pantry</h3>${_todoRow}${_todoRow}<h3>Household</h3>${_todoRow}`,
  },
  {
    id: 'recipe',
    name: 'Recipe',
    description: 'Ingredients + step-by-step instructions',
    icon: ChefHat,
    notebook: 'personal',
    content: `<h2>Recipe Name</h2><p><strong>Servings:</strong> &nbsp;·&nbsp; <strong>Prep Time:</strong> &nbsp;·&nbsp; <strong>Cook Time:</strong> </p><h3>Ingredients</h3><ul><li></li><li></li><li></li></ul><h3>Instructions</h3><ol><li></li><li></li><li></li></ol>`,
  },
  {
    id: 'travel',
    name: 'Travel Plan',
    description: 'Destination, dates, itinerary, packing',
    icon: Plane,
    notebook: 'travel',
    content: `<h2>Trip to </h2><p><strong>Dates:</strong> &nbsp;·&nbsp; <strong>Destination:</strong> </p><h3>Flight Details</h3><p></p><h3>Hotel</h3><p></p><h3>Itinerary</h3><p><strong>Day 1</strong></p><ul><li></li></ul><p><strong>Day 2</strong></p><ul><li></li></ul><h3>Packing List</h3>${_todoRow}${_todoRow}${_todoRow}`,
  },
  {
    id: 'reading',
    name: 'Book Notes',
    description: 'Key ideas, quotes, takeaways',
    icon: BookOpen,
    notebook: 'ideas',
    content: `<h2>Book Title</h2><p><strong>Author:</strong> </p><h3>Key Ideas</h3><ul><li></li></ul><h3>Favorite Quotes</h3><blockquote></blockquote><h3>My Takeaways</h3><p></p>`,
  },
  {
    id: 'review',
    name: 'Weekly Review',
    description: 'Wins, lessons, next week',
    icon: Target,
    notebook: 'work',
    content: `<h2>Weekly Review · ${format(new Date(), 'MMM d, yyyy')}</h2><h3>This Week's Wins</h3><ul><li></li></ul><h3>Challenges</h3><ul><li></li></ul><h3>Lessons</h3><ul><li></li></ul><h3>Next Week Goals</h3><ol><li></li></ol>`,
  },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote, bulkDeleteNotes, isLoading } = useVault();
  const { toast } = useToast();
  const { getLimit, isPro } = useSubscription();
  const { lastNotebook, saveNotebook } = useFormDefaults();
  const { accountEmail } = useAuth();
  const tier = useViewportTier();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
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
  const [renameNotebookTarget, setRenameNotebookTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteNotebookTarget, setDeleteNotebookTarget] = useState<string | null>(null);
  const [leftPaneCollapsed, setLeftPaneCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('iv_notes_leftpane_collapsed') === '1';
  });
  useEffect(() => { try { localStorage.setItem('iv_notes_leftpane_collapsed', leftPaneCollapsed ? '1' : '0'); } catch {} }, [leftPaneCollapsed]);

  // Always default to flat list — Evernote-style. Users want clean rows
  // grouped by date, not a masonry grid. Grid mode is opt-in via the menu
  // and never persisted; revisiting the page returns to list.
  const [view, setView] = useState<'list' | 'grid'>('list');
  useEffect(() => {
    // One-shot cleanup of any pre-existing 'grid' preference written by
    // earlier builds — harmless if nothing's there.
    try { localStorage.removeItem('iv_notes_view'); } catch {}
  }, []);

  // Debounced search query for filtering
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // Notebooks list — combined metadata + strings used by notes
  const notebooks = useMemo<NotebookMeta[]>(() => {
    const fromNotes = Array.from(new Set(notes.map(n => n.notebook).filter(Boolean) as string[]));
    return combineNotebookList(accountEmail ?? null, fromNotes);
  }, [accountEmail, notes]);
  const notebookCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) {
      const k = (n.notebook || 'Default').toLowerCase();
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [notes]);

  // Tag list with frequencies
  const tagFrequencies = useMemo(() => {
    const map = new Map<string, number>();
    for (const note of notes) for (const t of (note.tags || [])) map.set(t, (map.get(t) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [notes]);
  const knownTags = useMemo(() => tagFrequencies.map(([t]) => t), [tagFrequencies]);

  // Filter + sort
  const filteredNotes = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return notes.filter(note => {
      if (showPinnedOnly && !note.isPinned) return false;
      if (selectedNotebook !== 'all' && (note.notebook || 'Default').toLowerCase() !== selectedNotebook.toLowerCase()) return false;
      if (selectedTag && !(note.tags || []).includes(selectedTag)) return false;
      if (q) {
        const hay = `${note.title} ${stripHtml(note.content || '')} ${(note.tags || []).join(' ')} ${note.notebook || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, debouncedQuery, selectedNotebook, selectedTag, showPinnedOnly]);

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
  // QA-R2 H5: hijack the browser back button so it closes the editor
  // instead of navigating away from /notes entirely. We push a marker
  // history entry when the editor opens and listen for popstate; if the
  // marker is popped we close the editor instead of letting wouter route
  // away. The closeEditor() helper below pops the marker if it's still on
  // the stack, so an explicit Done/Back tap stays in sync with the URL.
  const editorHashPushedRef = useRef(false);
  const pushEditorHistoryMarker = () => {
    if (typeof window === 'undefined' || editorHashPushedRef.current) return;
    try {
      window.history.pushState({ ivEditor: true }, '');
      editorHashPushedRef.current = true;
    } catch { /* noop */ }
  };
  const popEditorHistoryMarker = () => {
    if (typeof window === 'undefined' || !editorHashPushedRef.current) return;
    editorHashPushedRef.current = false;
    try {
      if (window.history.state?.ivEditor) window.history.back();
    } catch { /* noop */ }
  };
  useEffect(() => {
    const onPop = () => {
      // The browser already popped the entry by the time popstate fires —
      // clear the ref and just close the editor in React state.
      if (editorHashPushedRef.current) {
        editorHashPushedRef.current = false;
        setEditorOpen(false);
        setTimeout(() => {
          setEditingNote(null);
          setStarterContent(undefined);
          setStarterNotebook(undefined);
        }, 240);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

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
    pushEditorHistoryMarker();
  };
  const openExistingNote = (note: NoteEntry) => {
    setEditingNote(note);
    setStarterContent(undefined);
    setStarterNotebook(undefined);
    setEditorOpen(true);
    pushEditorHistoryMarker();
  };
  const closeEditor = () => {
    popEditorHistoryMarker();
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
      const created = await addNote(payload);
      saveNotebook(payload.notebook);
      setEditingNote(created);
    }
  };

  const handleDeleteRequest = (id: string, title: string) => setDeleteTarget({ id, title });
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNote(deleteTarget.id);
      toast({ variant: 'success', title: 'Note deleted' });
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

  // Notebook CRUD
  const beginRenameNotebook = (name: string) => { setRenameNotebookTarget(name); setRenameValue(name); };
  const commitRenameNotebook = async () => {
    if (!renameNotebookTarget || !renameValue.trim()) { setRenameNotebookTarget(null); return; }
    const newName = renameValue.trim();
    const oldName = renameNotebookTarget;
    if (newName.toLowerCase() === oldName.toLowerCase()) { setRenameNotebookTarget(null); return; }
    renameNotebookMeta(accountEmail ?? null, oldName, newName);
    // Bulk-update all notes that used the old notebook name
    const affected = notes.filter(n => (n.notebook || '').toLowerCase() === oldName.toLowerCase());
    for (const n of affected) await updateNote(n.id, { notebook: newName });
    if (selectedNotebook.toLowerCase() === oldName.toLowerCase()) setSelectedNotebook(newName);
    toast({ variant: 'success', title: 'Notebook renamed', description: `${affected.length} note${affected.length === 1 ? '' : 's'} updated.` });
    setRenameNotebookTarget(null);
  };
  const confirmDeleteNotebook = async () => {
    if (!deleteNotebookTarget) return;
    const target = deleteNotebookTarget;
    removeNotebookMeta(accountEmail ?? null, target);
    const affected = notes.filter(n => (n.notebook || '').toLowerCase() === target.toLowerCase());
    for (const n of affected) await updateNote(n.id, { notebook: 'Default' });
    if (selectedNotebook.toLowerCase() === target.toLowerCase()) setSelectedNotebook('all');
    toast({ title: 'Notebook deleted', description: `${affected.length} note${affected.length === 1 ? '' : 's'} moved to Default.` });
    setDeleteNotebookTarget(null);
  };

  // Long-press / context menu
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

  // We intentionally do NOT auto-sync `editingNote` against `notes` when
  // the underlying array changes. The editor is the source of truth while
  // it's open; isNoteEditing() in vault-context + use-cloud-auto-sync now
  // blocks any background refresh that would otherwise rewrite or delete
  // the note out from under the user. Closing the editor (or explicitly
  // deleting from the More menu) is the only way to leave the editor.

  // ── Layout components ────────────────────────────────────────────────────
  const isThreePane = tier === 'desktop';
  const isTwoPane = tier === 'tablet';

  // Shared dialogs / menus / context menu — rendered alongside every layout
  // so the Templates picker, delete confirm, notebook rename, notebook
  // delete confirm, and the long-press context menu all actually mount.
  const dialogs = (
    <>
      {/* Templates modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" /> Templates
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NOTE_TEMPLATES.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openNewNote(t)}
                  className="flex items-start gap-3 p-3 rounded-xl border border-white/10 bg-white/[0.03] hover:border-emerald-400/40 hover:bg-emerald-500/5 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </button>
              );
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Delete note confirm */}
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

      {/* Rename notebook */}
      <Dialog open={!!renameNotebookTarget} onOpenChange={(open) => { if (!open) setRenameNotebookTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Rename notebook</DialogTitle></DialogHeader>
          <DialogBody className="space-y-2">
            <p className="text-xs text-muted-foreground">All notes currently in &ldquo;{renameNotebookTarget}&rdquo; will be moved to the new name.</p>
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder="New name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void commitRenameNotebook(); } }}
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameNotebookTarget(null)}>Cancel</Button>
            <Button onClick={commitRenameNotebook} disabled={!renameValue.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete notebook confirm */}
      <Dialog open={!!deleteNotebookTarget} onOpenChange={(open) => { if (!open) setDeleteNotebookTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete notebook?</DialogTitle></DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Notes in &ldquo;{deleteNotebookTarget}&rdquo; will be moved to the Default notebook. The notes themselves are not deleted.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNotebookTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteNotebook}>Delete notebook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Long-press / right-click context menu */}
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
    </>
  );

  const headerBlock = (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-0">
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
                <MenuLabel>Sort</MenuLabel>
                <MenuOption active={sortBy === 'updated'} onClick={() => setSortBy('updated')}>Newest first</MenuOption>
                <MenuOption active={sortBy === 'created'} onClick={() => setSortBy('created')}>Oldest first</MenuOption>
                <MenuOption active={sortBy === 'alpha'} onClick={() => setSortBy('alpha')}>A → Z</MenuOption>
                <div className="h-px bg-white/[0.06] my-1" />
                <MenuOption active={showPinnedOnly} onClick={() => setShowPinnedOnly(v => !v)}>
                  <span className="flex items-center gap-2">
                    <Pin className={`w-3 h-3 ${showPinnedOnly ? 'fill-amber-400 text-amber-400' : ''}`} /> Pinned only
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
                <MenuOption onClick={() => setShowTemplatesModal(true)}>
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
  );

  const searchBlock = (
    <AnimatePresence initial={false}>
      {searchOpen && (
        <motion.div
          key="search"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden px-4 sm:px-0"
        >
          <div className="relative pt-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 w-4 h-4 pointer-events-none" />
            <Input
              data-testid="input-notes-search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search title, body, tags…"
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
  );

  const activeFilterChips = (selectedNotebook !== 'all' || selectedTag || showPinnedOnly || sortBy !== 'updated') && (
    <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-muted-foreground/80 px-4 sm:px-0">
      {selectedNotebook !== 'all' && <ActiveFilterChip label={selectedNotebook} onClear={() => setSelectedNotebook('all')} />}
      {selectedTag && <ActiveFilterChip label={`#${selectedTag}`} onClear={() => setSelectedTag(null)} />}
      {showPinnedOnly && <ActiveFilterChip label="pinned only" onClear={() => setShowPinnedOnly(false)} />}
      {sortBy !== 'updated' && <ActiveFilterChip label={sortBy === 'created' ? 'oldest first' : 'A→Z'} onClear={() => setSortBy('updated')} />}
    </div>
  );

  const notesListContent = isLoading && notes.length === 0 ? (
    <ListSkeleton rows={6} showHeader={false} />
  ) : sortedNotes.length === 0 ? (
    <EmptyState
      isFiltered={notes.length > 0}
      onCreate={() => openNewNote()}
      onClearFilters={() => { setSelectedNotebook('all'); setSelectedTag(null); setSearchQuery(''); setShowPinnedOnly(false); }}
    />
  ) : view === 'list' ? (
    <DateGroupedList
      groups={groupedNotes}
      activeId={isThreePane || isTwoPane ? editingNote?.id : undefined}
      query={debouncedQuery}
      selection={selection}
      onOpen={openExistingNote}
      onContextMenu={(note, x, y) => setContextMenu({ note, x, y })}
      onLongPressStart={startLongPress}
      onLongPressCancel={cancelLongPress}
    />
  ) : (
    <GridView
      notes={sortedNotes}
      activeId={isThreePane || isTwoPane ? editingNote?.id : undefined}
      query={debouncedQuery}
      selection={selection}
      onOpen={openExistingNote}
      onContextMenu={(note, x, y) => setContextMenu({ note, x, y })}
      onLongPressStart={startLongPress}
      onLongPressCancel={cancelLongPress}
    />
  );

  // ── Desktop master-detail layout ─────────────────────────────────────────
  // True 2-panel: ~320px notes list on the left + flex-1 editor on the right.
  // Both panes stay mounted; clicking a row swaps the right pane to the new
  // note. The editor is never unmounted on selection change so its local
  // typing state survives across notes — and crucially across any cloud
  // sync refresh that happens in the background.
  if (isThreePane) {
    return (
      <div className="flex flex-col h-full -mx-6 -my-6">
        <div className="flex-1 min-h-0 flex">
          {/* LEFT pane — list + filters */}
          <section className="w-[340px] flex-shrink-0 border-r border-border/40 bg-background flex flex-col">
            <div className="px-4 pt-5 pb-2 space-y-2.5 border-b border-border/40 bg-background">
              {headerBlock}
              {searchBlock}
              {(notebooks.length > 0 || tagFrequencies.length > 0) && (
                <div className="-mx-1 px-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                  <FilterChip label="All" active={selectedNotebook === 'all' && !selectedTag} onClick={() => { setSelectedNotebook('all'); setSelectedTag(null); }} />
                  {notebooks.map(nb => (
                    <FilterChip
                      key={nb.name}
                      label={nb.icon ? `${nb.icon} ${nb.name}` : nb.name}
                      count={notebookCounts[nb.name.toLowerCase()] ?? 0}
                      active={selectedNotebook.toLowerCase() === nb.name.toLowerCase()}
                      onClick={() => { setSelectedNotebook(nb.name); setSelectedTag(null); }}
                    />
                  ))}
                  {tagFrequencies.length > 0 && <span className="w-px h-5 bg-border/50 mx-1 flex-shrink-0" aria-hidden />}
                  {tagFrequencies.slice(0, 8).map(([tag, count]) => (
                    <FilterChip
                      key={`tag-${tag}`}
                      label={`#${tag}`}
                      count={count}
                      active={selectedTag === tag}
                      onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
                    />
                  ))}
                </div>
              )}
              {activeFilterChips}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 truncate">
                  {selectedTag ? `#${selectedTag}` : selectedNotebook === 'all' ? 'All Notes' : selectedNotebook}
                  <span className="ml-1.5 text-muted-foreground/40">· {sortedNotes.length}</span>
                </span>
                <Button size="sm" onClick={() => openNewNote()} disabled={upgradeBlocked} className="cta-tap-pulse h-7 px-3 text-xs flex-shrink-0">
                  <Plus className="w-3 h-3 mr-1" /> New
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto smooth-scrollbar px-2">
              {notesListContent}
            </div>
          </section>

          {/* RIGHT pane — editor or empty state. Always mounted. */}
          <section className="flex-1 min-w-0 bg-background overflow-hidden">
            {editorOpen || !!editingNote ? (
              <NoteEditor
                open={editorOpen}
                note={editingNote}
                starter={starterContent ? { content: starterContent, notebook: starterNotebook } : undefined}
                defaultNotebook={starterNotebook || lastNotebook || 'personal'}
                accountEmail={accountEmail}
                knownTags={knownTags}
                knownNotebooks={notebooks.map(n => n.name)}
                onClose={closeEditor}
                onSave={handleSave}
                onDelete={editingNote ? () => handleDeleteRequest(editingNote.id, editingNote.title) : undefined}
                onDuplicate={editingNote ? () => duplicateNote(editingNote) : undefined}
                bottomGutterPx={0}
                embedded
              />
            ) : (
              <DesktopEditorEmpty onCreate={() => openNewNote()} disabled={upgradeBlocked} />
            )}
          </section>
        </div>

        {dialogs}
        {selection.isSelectionMode && (
          <SelectionBar
            selectedCount={selection.selectedCount}
            totalCount={sortedNotes.length}
            allSelected={selection.allSelected}
            itemLabel="note"
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
            onExit={selection.exitSelectionMode}
            onBulkDelete={handleBulkDelete}
          />
        )}
      </div>
    );
  }

  // ── Two-pane (tablet) ────────────────────────────────────────────────────
  if (isTwoPane) {
    return (
      <div className="flex flex-col h-full -mx-6 -my-6">
        <div className="px-6 pt-6 pb-3 space-y-3 border-b border-border/40 bg-background">
          {headerBlock}
          {searchBlock}
          {activeFilterChips}
        </div>
        <div className="flex-1 min-h-0 flex">
          <section className="w-[320px] flex-shrink-0 border-r border-border/40 bg-background overflow-y-auto smooth-scrollbar">
            <div className="px-3 pt-3 pb-2 sticky top-0 bg-background/95 backdrop-blur-md border-b border-border/40 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {selectedTag ? `#${selectedTag}` : selectedNotebook === 'all' ? 'All Notes' : selectedNotebook}
                <span className="ml-1.5 text-muted-foreground/40">· {sortedNotes.length}</span>
              </span>
              <Button size="sm" onClick={() => openNewNote()} disabled={upgradeBlocked} className="cta-tap-pulse h-7 px-2.5 text-xs">
                <Plus className="w-3 h-3 mr-1" /> New
              </Button>
            </div>
            {/* Tablet filter rail — compact horizontal scroll */}
            <div className="px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-hide border-b border-border/30 bg-background">
              <FilterChip label="All" active={selectedNotebook === 'all' && !selectedTag} onClick={() => { setSelectedNotebook('all'); setSelectedTag(null); }} />
              {notebooks.slice(0, 8).map(nb => (
                <FilterChip key={nb.name} label={nb.name} active={selectedNotebook.toLowerCase() === nb.name.toLowerCase()} onClick={() => { setSelectedNotebook(nb.name); setSelectedTag(null); }} />
              ))}
            </div>
            <div className="px-2">{notesListContent}</div>
          </section>
          <section className="flex-1 min-w-0 bg-background">
            {editingNote || editorOpen ? (
              <NoteEditor
                open={editorOpen}
                note={editingNote}
                starter={starterContent ? { content: starterContent, notebook: starterNotebook } : undefined}
                defaultNotebook={starterNotebook || lastNotebook || 'personal'}
                accountEmail={accountEmail}
                knownTags={knownTags}
                knownNotebooks={notebooks.map(n => n.name)}
                onClose={closeEditor}
                onSave={handleSave}
                onDelete={editingNote ? () => handleDeleteRequest(editingNote.id, editingNote.title) : undefined}
                onDuplicate={editingNote ? () => duplicateNote(editingNote) : undefined}
                embedded
              />
            ) : (
              <DesktopEditorEmpty onCreate={() => openNewNote()} disabled={upgradeBlocked} />
            )}
          </section>
        </div>
        {dialogs}
        {selection.isSelectionMode && (
          <SelectionBar
            selectedCount={selection.selectedCount}
            totalCount={sortedNotes.length}
            allSelected={selection.allSelected}
            itemLabel="note"
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
            onExit={selection.exitSelectionMode}
            onBulkDelete={handleBulkDelete}
          />
        )}
      </div>
    );
  }

  // ── Mobile single-pane ───────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {headerBlock}
      {searchBlock}
      {/* Mobile horizontal notebook rail */}
      {notebooks.length > 0 && (
        <div className="-mx-4">
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-hide">
            <FilterChip label="All" active={selectedNotebook === 'all' && !selectedTag} onClick={() => { setSelectedNotebook('all'); setSelectedTag(null); }} />
            {notebooks.map(nb => (
              <FilterChip
                key={nb.name}
                label={nb.icon ? `${nb.icon} ${nb.name}` : nb.name}
                count={notebookCounts[nb.name.toLowerCase()] ?? 0}
                active={selectedNotebook.toLowerCase() === nb.name.toLowerCase()}
                onClick={() => { setSelectedNotebook(nb.name); setSelectedTag(null); }}
              />
            ))}
            {tagFrequencies.length > 0 && <span className="w-px h-5 bg-border/50 mx-1" aria-hidden />}
            {tagFrequencies.slice(0, 6).map(([tag, count]) => (
              <FilterChip
                key={`tag-${tag}`}
                label={`#${tag}`}
                count={count}
                active={selectedTag === tag}
                onClick={() => setSelectedTag(prev => prev === tag ? null : tag)}
              />
            ))}
          </div>
        </div>
      )}
      {activeFilterChips}
      {notesListContent}

      {/* FAB */}
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
        className="fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] lg:bottom-6 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-[0_12px_32px_-6px_rgba(16,185,129,0.7)] hover:shadow-[0_16px_40px_-6px_rgba(16,185,129,0.85)] z-30 flex items-center justify-center disabled:opacity-50"
      >
        <Plus className="w-6 h-6" strokeWidth={2.4} />
      </motion.button>

      <NoteEditor
        open={editorOpen}
        note={editingNote}
        starter={starterContent ? { content: starterContent, notebook: starterNotebook } : undefined}
        defaultNotebook={starterNotebook || lastNotebook || 'personal'}
        accountEmail={accountEmail}
        knownTags={knownTags}
        knownNotebooks={notebooks.map(n => n.name)}
        onClose={closeEditor}
        onSave={handleSave}
        onDelete={editingNote ? () => handleDeleteRequest(editingNote.id, editingNote.title) : undefined}
        onDuplicate={editingNote ? () => duplicateNote(editingNote) : undefined}
        bottomGutterPx={96}
      />

      {dialogs}
      {selection.isSelectionMode && (
        <SelectionBar
          selectedCount={selection.selectedCount}
          totalCount={sortedNotes.length}
          allSelected={selection.allSelected}
          itemLabel="note"
          onSelectAll={selection.selectAll}
          onClear={selection.clear}
          onExit={selection.exitSelectionMode}
          onBulkDelete={handleBulkDelete}
        />
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface ListProps {
  groups: Array<{ label: string; key: string; notes: NoteEntry[] }>;
  activeId?: string;
  query: string;
  selection: ReturnType<typeof useMultiSelect<NoteEntry>>;
  onOpen: (note: NoteEntry) => void;
  onContextMenu: (note: NoteEntry, x: number, y: number) => void;
  onLongPressStart: (note: NoteEntry, e: React.TouchEvent) => void;
  onLongPressCancel: () => void;
}
function DateGroupedList({ groups, activeId, query, selection, onOpen, onContextMenu, onLongPressStart, onLongPressCancel }: ListProps) {
  return (
    <div>
      {groups.map(group => (
        <section key={group.key} className="pt-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 pb-2">
            {group.label}
          </h2>
          <div role="list" className="border-t border-border/40">
            <AnimatePresence>
              {group.notes.map(note => (
                <NoteRow
                  key={note.id}
                  note={note}
                  active={note.id === activeId}
                  query={query}
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
        </section>
      ))}
    </div>
  );
}

interface RowProps {
  note: NoteEntry;
  active?: boolean;
  query: string;
  selected: boolean;
  selectionMode: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  onToggleSelect: () => void;
}
function NoteRow({ note, active, query, selected, selectionMode, onClick, onContextMenu, onTouchStart, onTouchEnd, onTouchMove, onToggleSelect }: RowProps) {
  const accent = accentFor(note);
  const preview = getPlainPreview(note.content || '', 160);
  const tagsToShow = (note.tags || []).slice(0, 2);
  const extraTags = (note.tags?.length || 0) - tagsToShow.length;
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
      className={`relative w-full flex items-start gap-3 py-3.5 pr-2 text-left border-b border-border/40 hover:bg-white/[0.03] active:bg-white/[0.05] transition-colors ${selected ? 'bg-emerald-500/[0.06]' : ''} ${active ? 'bg-emerald-500/[0.08]' : ''} ${accent ? 'pl-3' : 'pl-2'}`}
    >
      {accent && <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: accent }} />}
      {selectionMode && (
        <div className="pt-0.5" onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}>
          <SelectionCheckbox checked={selected} onChange={onToggleSelect} label={`Select ${note.title}`} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h3 data-testid={`note-title-${note.id}`} className="text-[15px] font-semibold text-foreground leading-snug truncate flex-1">
            {query ? highlightSnippet(note.title || 'Untitled', query) : (note.title || 'Untitled')}
          </h3>
          {note.isPinned && <Pin className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0 mt-0.5" />}
        </div>
        {preview && (
          <p data-testid={`note-content-${note.id}`} className="text-[13px] text-muted-foreground/80 leading-[1.55] line-clamp-2 mt-1 break-words">
            {query ? highlightSnippet(preview, query) : preview}
          </p>
        )}
        {(tagsToShow.length > 0) && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {tagsToShow.map(t => (
              <span key={t} className="inline-flex items-center text-[10px] text-emerald-300/80 bg-emerald-500/[0.06] px-1.5 py-0.5 rounded-full">
                #{t}
              </span>
            ))}
            {extraTags > 0 && <span className="text-[10px] text-muted-foreground/50">+{extraTags}</span>}
          </div>
        )}
      </div>
    </motion.button>
  );
}

interface GridProps {
  notes: NoteEntry[];
  activeId?: string;
  query: string;
  selection: ReturnType<typeof useMultiSelect<NoteEntry>>;
  onOpen: (note: NoteEntry) => void;
  onContextMenu: (note: NoteEntry, x: number, y: number) => void;
  onLongPressStart: (note: NoteEntry, e: React.TouchEvent) => void;
  onLongPressCancel: () => void;
}
function GridView({ notes, activeId, query, selection, onOpen, onContextMenu, onLongPressStart, onLongPressCancel }: GridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
      <AnimatePresence>
        {notes.map(note => {
          const accent = accentFor(note);
          const preview = getPlainPreview(note.content || '', 220);
          const selected = selection.isSelected(note.id);
          const isActive = note.id === activeId;
          const tagsToShow = (note.tags || []).slice(0, 2);
          const extraTags = (note.tags?.length || 0) - tagsToShow.length;
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
              onClick={() => { if (selection.isSelectionMode) selection.toggle(note.id); else onOpen(note); }}
              onContextMenu={(e) => { e.preventDefault(); onContextMenu(note, e.clientX, e.clientY); }}
              onTouchStart={(e) => onLongPressStart(note, e)}
              onTouchEnd={onLongPressCancel}
              onTouchMove={onLongPressCancel}
              className={`relative text-left rounded-xl border bg-card hover:border-border hover:shadow-sm transition-all p-4 min-h-[140px] flex flex-col ${selected ? 'ring-2 ring-emerald-400/40' : ''} ${isActive ? 'border-emerald-400/60 ring-1 ring-emerald-400/30' : 'border-border/50'}`}
            >
              {accent && <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r" style={{ background: accent }} />}
              <div className="flex items-start gap-2 mb-1.5">
                <h3 data-testid={`note-title-${note.id}`} className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2 flex-1 break-words">
                  {query ? highlightSnippet(note.title || 'Untitled', query) : (note.title || 'Untitled')}
                </h3>
                {note.isPinned && <Pin className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0 mt-1" />}
              </div>
              {preview && (
                <p data-testid={`note-content-${note.id}`} className="text-[12px] text-muted-foreground/80 leading-[1.55] line-clamp-4 break-words">
                  {query ? highlightSnippet(preview, query) : preview}
                </p>
              )}
              {tagsToShow.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {tagsToShow.map(t => (
                    <span key={t} className="inline-flex text-[9px] text-emerald-300/85 bg-emerald-500/[0.06] px-1.5 py-0.5 rounded-full">#{t}</span>
                  ))}
                  {extraTags > 0 && <span className="text-[9px] text-muted-foreground/50">+{extraTags}</span>}
                </div>
              )}
              <div className="mt-auto pt-3 text-[11px] text-muted-foreground/55">
                {timeAgoShort(note.updatedAt)}
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function NotebookList({ notebooks, counts, total, active, onSelect, onRename, onDelete }: {
  notebooks: NotebookMeta[];
  counts: Record<string, number>;
  total: number;
  active: string;
  onSelect: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1 flex items-center gap-1.5">
        <BookOpen className="w-3 h-3" /> Notebooks
      </div>
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={`w-full flex items-center justify-between text-left px-2 py-1.5 rounded-md transition-colors text-sm ${active === 'all' ? 'bg-emerald-500/10 text-emerald-300' : 'text-foreground hover:bg-white/[0.05]'}`}
      >
        <span>All Notes</span>
        <span className="text-[11px] text-muted-foreground/60 tabular-nums">{total}</span>
      </button>
      {notebooks.map(nb => (
        <NotebookListItem
          key={nb.name}
          notebook={nb}
          count={counts[nb.name.toLowerCase()] ?? 0}
          active={active.toLowerCase() === nb.name.toLowerCase()}
          onSelect={() => onSelect(nb.name)}
          onRename={() => onRename(nb.name)}
          onDelete={() => onDelete(nb.name)}
        />
      ))}
    </div>
  );
}

function NotebookListItem({ notebook, count, active, onSelect, onRename, onDelete }: {
  notebook: NotebookMeta;
  count: number;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onClick={onSelect}
        className={`flex-1 flex items-center justify-between text-left px-2 py-1.5 rounded-md transition-colors text-sm ${active ? 'bg-emerald-500/10 text-emerald-300' : 'text-foreground hover:bg-white/[0.05]'}`}
      >
        <span className="truncate flex items-center gap-1.5">
          {notebook.icon && <span>{notebook.icon}</span>}
          <span className="capitalize truncate">{notebook.name}</span>
        </span>
        <span className="text-[11px] text-muted-foreground/60 tabular-nums">{count}</span>
      </button>
      {notebook.name.toLowerCase() !== 'default' && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 absolute right-1">
          <button type="button" onClick={onRename} aria-label={`Rename ${notebook.name}`} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.08]">
            <Pencil className="w-3 h-3" />
          </button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${notebook.name}`} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function TagList({ tags, active, onSelect }: { tags: Array<[string, number]>; active: string | null; onSelect: (tag: string) => void }) {
  if (tags.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 mb-1 flex items-center gap-1.5">
        <Hash className="w-3 h-3" /> Tags
      </div>
      <div className="flex flex-wrap gap-1 px-1">
        {tags.map(([tag, count]) => (
          <button
            key={tag}
            type="button"
            onClick={() => onSelect(tag)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition-colors ${active === tag ? 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30' : 'bg-white/[0.04] text-foreground hover:bg-white/[0.08]'}`}
          >
            #{tag}
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // flex-shrink-0 prevents the chip from collapsing when the rail
      // overflows horizontally, which was making `#Develop #Food` visually
      // collide on narrower viewports.
      className={`flex-shrink-0 text-xs px-3.5 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
        active ? 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
      }`}
    >
      <span className="capitalize">{label}</span>
      {typeof count === 'number' && count > 0 && (
        <span className="ml-1.5 text-[10px] text-muted-foreground/60 tabular-nums">{count}</span>
      )}
    </button>
  );
}

function EmptyState({ isFiltered, onCreate, onClearFilters }: { isFiltered: boolean; onCreate: () => void; onClearFilters: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="flex flex-col items-center justify-center py-16 text-center px-4"
    >
      <StickyNote className="w-10 h-10 text-muted-foreground/40 mb-4" strokeWidth={1.5} />
      <h2 className="text-base sm:text-lg font-semibold text-foreground mb-1">
        {isFiltered ? 'No notes match' : 'No notes yet'}
      </h2>
      <p className="text-sm text-muted-foreground/70 mb-5 max-w-xs">
        {isFiltered ? 'Try a different search or clear the filters.' : 'Tap the + button to create your first encrypted note.'}
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

function DesktopEditorEmpty({ onCreate, disabled }: { onCreate: () => void; disabled: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="relative w-20 h-20 mb-5">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/15 via-teal-500/8 to-transparent blur-2xl" aria-hidden />
        <div className="relative w-full h-full rounded-3xl border border-white/10 bg-white/[0.02] flex items-center justify-center">
          <StickyNote className="w-8 h-8 text-emerald-300/80" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">Pick a note</h2>
      <p className="text-sm text-muted-foreground/70 mb-5 max-w-sm">
        Select a note from the list to view it, or create a new one.
      </p>
      <Button size="sm" onClick={onCreate} disabled={disabled} className="cta-tap-pulse">
        <Plus className="w-3.5 h-3.5 mr-1" /> New note
      </Button>
    </div>
  );
}

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{children}</div>;
}

function MenuOption({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-1.5 text-sm text-left flex items-center justify-between transition-colors ${active ? 'text-emerald-300 bg-emerald-500/10' : 'text-foreground hover:bg-white/[0.06]'}`}
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
