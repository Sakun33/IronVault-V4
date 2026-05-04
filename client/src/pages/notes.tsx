import { useState, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import DOMPurify from 'dompurify';
import { useFormDefaults } from '@/hooks/use-form-defaults';
import { useSubscription } from '@/hooks/use-subscription';
import { useVault } from '@/contexts/vault-context';
import { NoteEntry, NOTE_NOTEBOOKS } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus, Edit, Trash2, Search, BookOpen, Tag, Pin, Calendar,
  StickyNote, Archive, FileText, LayoutTemplate,
  Lightbulb, ListTodo, Users, Target, PenLine, Sparkles, ChevronRight, CheckSquare,
  LayoutGrid, List as ListIcon,
  Bold, Italic, Underline as UnderlineIcon, List as ListBullets, ListOrdered, Heading2, Code,
  MoreHorizontal, Palette, Save, Check,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { ListSkeleton } from '@/components/list-skeleton';

const NOTEBOOK_COLORS: Record<string, string> = {
  personal:  '#6366f1',
  work:      '#0ea5e9',
  ideas:     '#f59e0b',
  finance:   '#10b981',
  health:    '#ec4899',
  travel:    '#8b5cf6',
  Default:   '#94a3b8',
};
const notebookColor = (nb: string) => NOTEBOOK_COLORS[nb] ?? NOTEBOOK_COLORS.Default;

// Per-note accent palette. Stored on `note.color` as the swatch name; the
// hex is resolved here so a future palette change doesn't require touching
// stored data.
const NOTE_ACCENT_PALETTE: Array<{ id: string; name: string; hex: string; glow: string }> = [
  { id: 'emerald', name: 'Emerald', hex: '#10b981', glow: 'rgba(16, 185, 129, 0.35)' },
  { id: 'sky',     name: 'Sky',     hex: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.35)' },
  { id: 'violet',  name: 'Violet',  hex: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.35)' },
  { id: 'amber',   name: 'Amber',   hex: '#f59e0b', glow: 'rgba(245, 158, 11, 0.35)' },
  { id: 'rose',    name: 'Rose',    hex: '#f43f5e', glow: 'rgba(244, 63, 94, 0.35)' },
  { id: 'slate',   name: 'Gray',    hex: '#64748b', glow: 'rgba(100, 116, 139, 0.3)' },
];

// Accent for a note: explicit per-note color first, then the notebook
// default. Returns both hex (for CSS) and the matching glow rgba.
function accentFor(note: Pick<NoteEntry, 'color' | 'notebook'>): { hex: string; glow: string } {
  if (note.color) {
    const swatch = NOTE_ACCENT_PALETTE.find(s => s.id === note.color);
    if (swatch) return { hex: swatch.hex, glow: swatch.glow };
  }
  const hex = notebookColor(note.notebook);
  return { hex, glow: hex.replace('#', 'rgba(') }; // unused branch; we just need the fallback hex
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function getPreview(content: string): string {
  const stripped = content.includes('<') ? stripHtml(content) : content;
  return stripped.slice(0, 120);
}

function timeAgo(date: Date | string) {
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }); }
  catch { return ''; }
}

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote, bulkDeleteNotes, isLoading } = useVault();
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const { getLimit, isPro } = useSubscription();
  const { lastNotebook, saveNotebook } = useFormDefaults();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteEntry | null>(null);
  const [viewingNote, setViewingNote] = useState<NoteEntry | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<{ id: string; title: string } | null>(null);
  const [notesView, setNotesView] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return (localStorage.getItem('iv_notes_view') as 'list' | 'grid') || 'list';
  });
  useEffect(() => {
    try { localStorage.setItem('iv_notes_view', notesView); } catch {}
  }, [notesView]);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const NOTE_TEMPLATES = [
    { id: 'grocery',  name: 'Grocery List',      icon: ListTodo, notebook: 'personal', content: 'Grocery List\n\nProduce:\n- \n\nDairy:\n- \n\nMeat / Protein:\n- \n\nPantry:\n- \n\nOther:\n- ' },
    { id: 'meeting',  name: 'Meeting Notes',      icon: Users,    notebook: 'work',     content: `Meeting Notes\n\nDate: ${new Date().toLocaleDateString()}\nAttendees: \n\nAgenda:\n1. \n\nKey Points:\n- \n\nAction Items:\n- ` },
    { id: 'todo',     name: 'Daily Tasks',        icon: ListTodo, notebook: 'personal', content: `Tasks for ${new Date().toLocaleDateString()}\n\nMust Do:\n- \n\nShould Do:\n- \n\nNice to Have:\n- ` },
    { id: 'journal',  name: 'Daily Journal',      icon: PenLine,  notebook: 'personal', content: `Journal — ${new Date().toLocaleDateString()}\n\nHow I'm feeling:\n\nWhat happened today:\n\nGrateful for:\n1. \n2. \n3. \n\nTomorrow's priorities:\n- ` },
    { id: 'recipe',   name: 'Recipe',             icon: FileText, notebook: 'personal', content: 'Recipe: \n\nServings: \nPrep Time: \nCook Time: \n\nIngredients:\n- \n\nInstructions:\n1. \n2. \n3. \n\nNotes:\n' },
    { id: 'travel',   name: 'Travel Checklist',   icon: Target,   notebook: 'travel',   content: 'Travel Packing\n\nDestination: \nDates: \n\nDocuments:\n- Passport\n- ID\n- Tickets\n\nClothing:\n- \n\nToiletries:\n- \n\nElectronics:\n- Charger\n- ' },
    { id: 'project',  name: 'Project Plan',       icon: Sparkles, notebook: 'work',     content: 'Project: \n\nObjective:\n\nMilestones:\n- Phase 1: \n- Phase 2: \n- Phase 3: \n\nRisks:\n- \n\nNotes:\n' },
    { id: 'contacts', name: 'Contact Info',       icon: Users,    notebook: 'personal', content: 'Contact\n\nName: \nCompany: \nRole: \nPhone: \nEmail: \n\nNotes:\n' },
    { id: 'ideas',    name: 'Ideas',              icon: Lightbulb,notebook: 'ideas',    content: 'Ideas\n\n- \n- \n- \n' },
    { id: 'blank',    name: 'Blank Note',         icon: FileText, notebook: 'personal', content: '' },
  ];

  const handleUseTemplate = (template: typeof NOTE_TEMPLATES[0]) => {
    setFormData({ title: '', content: template.content, notebook: template.notebook, tags: [], isPinned: false });
    setShowTemplatesModal(false);
    setShowAddModal(true);
  };

  useEffect(() => {
    if (showAddModal && !editingNote) {
      setFormData(prev => ({ ...prev, notebook: lastNotebook || 'personal' }));
    }
  }, [showAddModal]);

  const blankForm = { title: '', content: '', notebook: 'personal', tags: [] as string[], isPinned: false, color: undefined as string | undefined };
  const [formData, setFormData] = useState(blankForm);
  const [newTag, setNewTag] = useState('');

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => (note.tags || []).forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => notes.filter(note => {
    const matchesSearch = !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesNotebook = selectedNotebook === 'all' || note.notebook === selectedNotebook;
    const matchesTags = selectedTags.length === 0 || selectedTags.some(tag => (note.tags || []).includes(tag));
    const matchesPinned = !showPinnedOnly || note.isPinned;
    return matchesSearch && matchesNotebook && matchesTags && matchesPinned;
  }), [notes, searchQuery, selectedNotebook, selectedTags, showPinnedOnly]);

  const sortedNotes = useMemo(() =>
    [...filteredNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }), [filteredNotes]);

  const selection = useMultiSelect(sortedNotes);

  const handleBulkDeleteNotes = async () => {
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

  const handleAddNote = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    try {
      await addNote({ title: formData.title.trim(), content: formData.content, notebook: formData.notebook, tags: formData.tags, isPinned: formData.isPinned, color: formData.color });
      saveNotebook(formData.notebook);
      setFormData({ ...blankForm, notebook: formData.notebook });
      setShowAddModal(false);
      toast({ title: 'Note saved' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    }
  };

  const handleEditNote = (note: NoteEntry) => {
    setEditingNote(note);
    const content = note.content.includes('<') ? stripHtml(note.content) : note.content;
    setFormData({ title: note.title, content, notebook: note.notebook, tags: [...note.tags], isPinned: note.isPinned, color: note.color });
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !formData.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    try {
      await updateNote(editingNote.id, { title: formData.title.trim(), content: formData.content, notebook: formData.notebook, tags: formData.tags, isPinned: formData.isPinned, color: formData.color });
      setEditingNote(null);
      setFormData(blankForm);
      toast({ title: 'Note updated' });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const handleDeleteNote = (id: string, title: string) => setDeleteNoteTarget({ id, title });

  const handleDeleteNoteConfirmed = async () => {
    if (!deleteNoteTarget) return;
    const { id } = deleteNoteTarget;
    setDeleteNoteTarget(null);
    try {
      await deleteNote(id);
      toast({ title: 'Note deleted' });
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const togglePinNote = async (note: NoteEntry) => {
    try {
      await updateNote(note.id, { isPinned: !note.isPinned });
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, newTag.trim()] }));
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  const toggleTagFilter = (tag: string) => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const closeModal = () => {
    setShowAddModal(false);
    setEditingNote(null);
    setFormData(blankForm);
    setNewTag('');
  };

  const renderViewModal = () => (
    <Dialog open={!!viewingNote} onOpenChange={open => { if (!open) setViewingNote(null); }}>
      <DialogContent className="max-w-2xl">
        {viewingNote && (
          <>
            <DialogHeader className="pr-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl mb-1 flex items-center gap-2">
                    {viewingNote.isPinned && <Pin className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />}
                    <span className="truncate">{viewingNote.title}</span>
                  </DialogTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: notebookColor(viewingNote.notebook) }}
                    />
                    <span>{viewingNote.notebook}</span>
                    <span>·</span>
                    <Calendar className="w-3 h-3" />
                    <span>{format(new Date(viewingNote.updatedAt), 'MMM d, yyyy')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm"
                    onClick={() => { setViewingNote(null); handleEditNote(viewingNote); }}>
                    <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button variant="destructive" size="sm"
                    onClick={() => { setViewingNote(null); handleDeleteNote(viewingNote.id, viewingNote.title); }}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4">
              {(viewingNote.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {viewingNote.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs gap-1">
                      <Tag className="w-3 h-3" />{tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {viewingNote.content.includes('<')
                  ? <div className="prose dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingNote.content) }} />
                  : viewingNote.content
                }
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  // Lightweight markdown-style toolbar — wraps the current textarea selection
  // in markers. We avoid pulling in a real WYSIWYG dep here; this gives the
  // user "formatting" feedback without a heavy runtime.
  const wrapSelection = (before: string, after: string = before) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const value = formData.content;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setFormData(prev => ({ ...prev, content: next }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  };
  const prefixLines = (prefix: string) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const value = formData.content;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = value.indexOf('\n', end);
    const segment = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
    const transformed = segment.split('\n').map(l => l ? `${prefix}${l}` : l).join('\n');
    const next = value.slice(0, lineStart) + transformed + value.slice(lineEnd === -1 ? value.length : lineEnd);
    setFormData(prev => ({ ...prev, content: next }));
    requestAnimationFrame(() => ta.focus());
  };

  const wordCount = formData.content.trim() ? formData.content.trim().split(/\s+/).length : 0;
  const accentHex = formData.color
    ? (NOTE_ACCENT_PALETTE.find(s => s.id === formData.color)?.hex ?? notebookColor(formData.notebook))
    : notebookColor(formData.notebook);

  const renderNoteModal = () => (
    <Dialog open={showAddModal || !!editingNote} onOpenChange={open => { if (!open) closeModal(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden glass-card border-white/10 bg-background/85">
        {/* Color accent rail at the very top — reflects formData.color */}
        <div aria-hidden className="h-1 w-full" style={{ background: accentHex }} />

        <DialogHeader className="px-6 pt-5 pb-2">
          <div className="flex items-center justify-between gap-3 mb-3">
            <DialogTitle className="sr-only">{editingNote ? 'Edit note' : 'New note'}</DialogTitle>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {editingNote ? 'Editing' : 'New note'}
            </span>
            {/* Auto-save-style indicator. We don't actually autosave on every
                keystroke (that would race with optimistic vault writes), but
                the UI surfaces the dirty/clean state so the user can tell
                whether their typing is pending. */}
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              {editingNote && (formData.title === editingNote.title && formData.content === (editingNote.content.includes('<') ? stripHtml(editingNote.content) : editingNote.content) && formData.notebook === editingNote.notebook && formData.isPinned === editingNote.isPinned && formData.color === editingNote.color)
                ? <><Check className="w-3 h-3 text-emerald-400" /> Saved</>
                : <><Save className="w-3 h-3 text-amber-400" /> Unsaved changes</>}
            </span>
          </div>
          <Input
            data-testid="input-note-title"
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Note title…"
            className="border-0 shadow-none bg-transparent text-2xl font-semibold px-0 h-auto py-1 focus-visible:ring-0 focus-visible:border-0 placeholder:text-muted-foreground/40 border-b border-transparent focus-visible:border-emerald-400/40 rounded-none transition-colors"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); contentRef.current?.focus(); } }}
          />
        </DialogHeader>

        {/* Formatting toolbar */}
        <div className="px-6 pt-2 pb-3 flex items-center gap-1 flex-wrap border-b border-white/[0.06]">
          {[
            { icon: Heading2,    label: 'Heading',     action: () => prefixLines('## ') },
            { icon: Bold,        label: 'Bold',        action: () => wrapSelection('**') },
            { icon: Italic,      label: 'Italic',      action: () => wrapSelection('_') },
            { icon: UnderlineIcon, label: 'Underline', action: () => wrapSelection('<u>', '</u>') },
            { icon: ListBullets, label: 'Bullet list', action: () => prefixLines('- ') },
            { icon: ListOrdered, label: 'Numbered list', action: () => prefixLines('1. ') },
            { icon: Code,        label: 'Code',        action: () => wrapSelection('`') },
          ].map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={action}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            >
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
          {/* Color picker */}
          <span className="ml-auto flex items-center gap-1.5 px-1">
            <Palette className="w-3.5 h-3.5 text-muted-foreground/70" />
            {NOTE_ACCENT_PALETTE.map(swatch => {
              const active = formData.color === swatch.id;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  aria-label={`Accent ${swatch.name}`}
                  aria-pressed={active}
                  onClick={() => setFormData(prev => ({ ...prev, color: prev.color === swatch.id ? undefined : swatch.id }))}
                  className={`relative h-5 w-5 rounded-full transition-transform ${active ? 'scale-110 ring-2 ring-white/40 ring-offset-1 ring-offset-background' : 'hover:scale-110'}`}
                  style={{ background: swatch.hex, boxShadow: active ? `0 0 10px ${swatch.glow}` : undefined }}
                />
              );
            })}
          </span>
        </div>

        <DialogBody className="px-6 py-4 space-y-4" onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); (editingNote ? handleUpdateNote : handleAddNote)(); } }}>
          <Textarea
            ref={contentRef}
            data-testid="input-note-content"
            value={formData.content}
            onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Start writing… markdown shortcuts work."
            className="border border-white/10 bg-white/[0.02] resize-none min-h-[300px] text-sm leading-7 focus-visible:ring-emerald-400/30 focus-visible:border-emerald-400/40"
          />

          {/* Notebook + Pin row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={formData.notebook} onValueChange={v => setFormData(prev => ({ ...prev, notebook: v }))}>
              <SelectTrigger className="w-40 h-8 text-xs rounded-full" data-testid="select-note-notebook">
                <span className="w-2 h-2 rounded-full mr-2" style={{ background: notebookColor(formData.notebook) }} />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_NOTEBOOKS.map(nb => <SelectItem key={nb} value={nb}>{nb}</SelectItem>)}
              </SelectContent>
            </Select>

            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isPinned: !prev.isPinned }))}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${formData.isPinned ? 'bg-amber-500/10 border-amber-400/40 text-amber-300' : 'border-white/15 text-muted-foreground hover:border-amber-400/40'}`}
            >
              <Pin className={`w-3 h-3 ${formData.isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
              {formData.isPinned ? 'Pinned' : 'Pin'}
            </button>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 flex-wrap">
            {formData.tags.map(tag => (
              <Badge key={tag} variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => removeTag(tag)}
                data-testid={`badge-tag-${tag}`}>
                {tag} ×
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                data-testid="input-note-tag"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="Add tag…"
                className="h-7 w-28 text-xs"
              />
              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={addTag}
                data-testid="button-add-tag">
                <Tag className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="px-6 py-3 border-t border-white/[0.06] flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70 mr-auto flex items-center gap-3">
            <span>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
            {editingNote && (
              <span>· edited {timeAgo(editingNote.updatedAt)}</span>
            )}
          </span>
          {editingNote && (
            <Button variant="destructive" data-testid="button-delete-note"
              onClick={() => { closeModal(); handleDeleteNote(editingNote.id, editingNote.title); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={closeModal}>Cancel</Button>
          <Button type="button" data-testid="button-save-note" onClick={editingNote ? handleUpdateNote : handleAddNote} className="cta-tap-pulse">
            {editingNote ? 'Save changes' : 'Save note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            My Notes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {!isPro && ` · ${notes.length}/${getLimit('notes')} used`}
            {sortedNotes.length !== notes.length && ` · ${sortedNotes.length} matching`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowTemplatesModal(true)}>
            <LayoutTemplate className="w-4 h-4 mr-1" /> Templates
          </Button>
          {sortedNotes.length > 0 && !selection.isSelectionMode && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => selection.enterSelectionMode()}
              data-testid="button-enter-selection-notes"
            >
              <CheckSquare className="w-4 h-4 mr-1" /> Select
            </Button>
          )}
          <Button
            size="sm"
            disabled={!isPro && notes.length >= getLimit('notes')}
            onClick={() => {
              if (!isPro && notes.length >= getLimit('notes')) {
                toast({ title: 'Limit reached', description: `Upgrade to Pro for unlimited notes.`, variant: 'destructive' });
                return;
              }
              setFormData({ ...blankForm, notebook: lastNotebook || 'personal' });
              setShowAddModal(true);
            }}
            data-testid="button-add-note"
            className="cta-tap-pulse"
          >
            <Plus className="w-4 h-4 mr-1" />
            {!isPro && notes.length >= getLimit('notes') ? 'Upgrade' : 'New Note'}
          </Button>
        </div>
      </div>

      {/* Search + compact filters */}
      <div className="space-y-3">
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

        {/* Notebook chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {(['all', ...NOTE_NOTEBOOKS] as string[]).map(nb => (
            <button
              key={nb}
              onClick={() => setSelectedNotebook(nb)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                selectedNotebook === nb
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {nb === 'all' ? 'All' : nb}
            </button>
          ))}
          <button
            onClick={() => setShowPinnedOnly(v => !v)}
            className={`text-xs px-3 py-1 rounded-full border flex items-center gap-1 transition-colors ${
              showPinnedOnly
                ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                : 'border-border text-muted-foreground hover:border-amber-300'
            }`}
          >
            <Pin className="w-3 h-3" /> Pinned
          </button>
          {(selectedNotebook !== 'all' || showPinnedOnly || selectedTags.length > 0 || searchQuery) && (
            <button
              onClick={() => { setSelectedNotebook('all'); setShowPinnedOnly(false); setSelectedTags([]); setSearchQuery(''); }}
              className="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
          <div className="ml-auto hidden sm:flex items-center rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md p-0.5">
            <button
              type="button"
              aria-label="List view"
              aria-pressed={notesView === 'list'}
              onClick={() => setNotesView('list')}
              className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors ${notesView === 'list' ? 'bg-emerald-500/15 text-emerald-300' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              aria-label="Masonry view"
              aria-pressed={notesView === 'grid'}
              onClick={() => setNotesView('grid')}
              className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors ${notesView === 'grid' ? 'bg-emerald-500/15 text-emerald-300' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {allTags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleTagFilter(tag)}
                data-testid={`filter-tag-${tag}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Notes grid / list */}
      {isLoading && notes.length === 0 ? (
        <ListSkeleton rows={5} showHeader={false} />
      ) : sortedNotes.length === 0 ? (
        // Empty state — illustrated centered block. Two flavors: truly empty
        // vs filtered-empty.
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="relative w-24 h-24 mb-5">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent blur-2xl" aria-hidden />
            <div className="relative w-24 h-24 rounded-3xl glass-card flex items-center justify-center">
              <StickyNote className="w-10 h-10 text-emerald-300" strokeWidth={1.5} />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-1.5">
            {notes.length === 0 ? 'No notes yet' : 'No notes match your filters'}
          </h2>
          <p className="text-sm text-muted-foreground/80 mb-6 max-w-sm">
            {notes.length === 0
              ? 'Capture ideas, drafts, and thoughts in a place only you can read.'
              : 'Try a different search term, clear filters, or start a new note.'}
          </p>
          {notes.length === 0 ? (
            <Button onClick={() => { setFormData({ ...blankForm, notebook: 'personal' }); setShowAddModal(true); }}
              data-testid="button-create-first-note" className="cta-tap-pulse">
              <Plus className="w-4 h-4 mr-1" /> Create your first secure note
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { setSelectedNotebook('all'); setShowPinnedOnly(false); setSelectedTags([]); setSearchQuery(''); }}>
              Clear filters
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {notesView === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Masonry — CSS columns flow without a JS lib */}
              <motion.div
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                initial="hidden"
                animate="show"
                className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]"
              >
                <AnimatePresence>
                  {sortedNotes.map(note => {
                    const accent = accentFor(note);
                    const preview = getPreview(note.content || '');
                    const checked = selection.isSelected(note.id);
                    return (
                      <motion.div
                        key={note.id}
                        layout
                        data-testid={`note-card-${note.id}`}
                        variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                        exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.18 } }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                        whileHover={{ y: -3, scale: 1.01, boxShadow: `0 14px 38px -10px ${accent.glow}` }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          if (selection.isSelectionMode) selection.toggle(note.id);
                          else setViewingNote(note);
                        }}
                        onContextMenu={(e) => { e.preventDefault(); selection.enterSelectionMode(note.id); }}
                        className={`group mb-4 break-inside-avoid glass-card cursor-pointer overflow-hidden ${checked ? 'ring-2 ring-emerald-400/40' : ''}`}
                      >
                        {/* Top accent strip — full bleed across the card */}
                        <div className="h-1 w-full" style={{ background: accent.hex }} aria-hidden />
                        <div className="p-4">
                          <div className="flex items-start gap-2 mb-2">
                            <h3 className="text-[15px] font-bold text-foreground flex-1 truncate" data-testid={`note-title-${note.id}`}>
                              {note.title || 'Untitled'}
                            </h3>
                            {note.isPinned && <Pin className="w-3.5 h-3.5 fill-amber-400 text-amber-400 flex-shrink-0 mt-1" />}
                            <button
                              type="button"
                              aria-label="Note actions"
                              onClick={(e) => { e.stopPropagation(); setViewingNote(note); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 flex items-center justify-center rounded-md hover:bg-white/[0.08] -mr-1"
                            >
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </div>
                          {preview && (
                            <p
                              data-testid={`note-content-${note.id}`}
                              className="text-[13px] text-muted-foreground/90 leading-relaxed line-clamp-5 whitespace-pre-wrap"
                            >
                              {preview}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                            <Calendar className="w-3 h-3 text-muted-foreground/60" />
                            <span className="text-[11px] text-muted-foreground/70">{format(new Date(note.updatedAt), 'MMM d')}</span>
                            {note.notebook && (
                              <span
                                className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full"
                                style={{ background: `${accent.hex}1a`, color: accent.hex, border: `1px solid ${accent.hex}33` }}
                              >
                                <span className="w-1 h-1 rounded-full" style={{ background: accent.hex }} />
                                {note.notebook}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Card className={`rounded-2xl shadow-sm border-border/50 overflow-hidden ${selection.isSelectionMode ? 'pb-20' : ''}`}>
                <motion.div
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                  initial="hidden"
                  animate="show"
                >
                  <AnimatePresence>
                    {sortedNotes.map((note, idx) => {
                      const accent = accentFor(note);
                      const preview = getPreview(note.content || '');
                      const checked = selection.isSelected(note.id);
                      return (
                        <motion.button
                          key={note.id}
                          layout
                          variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                          exit={{ opacity: 0, x: -16, transition: { duration: 0.18 } }}
                          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                          whileHover={{ scale: 1.005 }}
                          whileTap={{ scale: 0.995 }}
                          data-testid={`note-card-${note.id}`}
                          onClick={() => {
                            if (selection.isSelectionMode) selection.toggle(note.id);
                            else setViewingNote(note);
                          }}
                          onContextMenu={(e) => { e.preventDefault(); selection.enterSelectionMode(note.id); }}
                          className={`relative w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors ${idx < sortedNotes.length - 1 ? 'border-b border-border/50' : ''} ${checked ? 'bg-primary/5' : ''}`}
                        >
                          {/* Color rail on hover/active so the row identifies its accent */}
                          <span
                            aria-hidden
                            className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r"
                            style={{ background: accent.hex }}
                          />
                          {selection.isSelectionMode && (
                            <SelectionCheckbox checked={checked} onChange={() => selection.toggle(note.id)} label={`Select ${note.title}`} />
                          )}
                          <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: accent.hex }} />
                            {note.isPinned && <Pin className="w-3 h-3 fill-amber-400 text-amber-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[15px] font-medium text-foreground truncate" data-testid={`note-title-${note.id}`}>
                              {note.title}
                            </div>
                            {preview && (
                              <div className="text-[13px] text-muted-foreground truncate mt-0.5" data-testid={`note-content-${note.id}`}>
                                {preview}
                              </div>
                            )}
                            <div className="text-[11px] text-muted-foreground/60 mt-0.5">{timeAgo(note.updatedAt)}</div>
                          </div>
                          {!selection.isSelectionMode && (
                            <ChevronRight size={16} className="text-muted-foreground/40 flex-shrink-0" />
                          )}
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {renderViewModal()}
      {renderNoteModal()}

      {/* Templates Modal */}
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
                <button key={t.id} onClick={() => handleUseTemplate(t)}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:border-primary/50 hover:bg-primary/5 text-left transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{t.notebook}</p>
                  </div>
                </button>
              );
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteNoteTarget} onOpenChange={open => { if (!open) setDeleteNoteTarget(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-note">
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              &ldquo;{deleteNoteTarget?.title}&rdquo; will be permanently deleted.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNoteTarget(null)}>Cancel</Button>
            <Button variant="destructive" data-testid="button-confirm-delete-note" onClick={handleDeleteNoteConfirmed}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selection.isSelectionMode && (
        <SelectionBar
          selectedCount={selection.selectedCount}
          totalCount={sortedNotes.length}
          allSelected={selection.allSelected}
          itemLabel="note"
          onSelectAll={selection.selectAll}
          onClear={selection.clear}
          onExit={selection.exitSelectionMode}
          onBulkDelete={handleBulkDeleteNotes}
        />
      )}
    </div>
  );
}
