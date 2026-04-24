import { useState, useMemo, useEffect, useRef } from 'react';
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
  Lightbulb, ListTodo, Users, Target, PenLine, Sparkles, ChevronRight
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

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
  const { notes, addNote, updateNote, deleteNote } = useVault();
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

  const blankForm = { title: '', content: '', notebook: 'personal', tags: [] as string[], isPinned: false };
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

  const handleAddNote = async () => {
    if (!formData.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    try {
      await addNote({ title: formData.title.trim(), content: formData.content, notebook: formData.notebook, tags: formData.tags, isPinned: formData.isPinned });
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
    setFormData({ title: note.title, content, notebook: note.notebook, tags: [...note.tags], isPinned: note.isPinned });
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !formData.title.trim()) {
      toast({ title: 'Title required', variant: 'destructive' });
      return;
    }
    try {
      await updateNote(editingNote.id, { title: formData.title.trim(), content: formData.content, notebook: formData.notebook, tags: formData.tags, isPinned: formData.isPinned });
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
                      dangerouslySetInnerHTML={{ __html: viewingNote.content }} />
                  : viewingNote.content
                }
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  const renderNoteModal = () => (
    <Dialog open={showAddModal || !!editingNote} onOpenChange={open => { if (!open) closeModal(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <Input
            data-testid="input-note-title"
            value={formData.title}
            onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Note title…"
            className="border-0 shadow-none text-xl font-semibold px-0 focus-visible:ring-0 h-auto py-0"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); contentRef.current?.focus(); } }}
          />
        </DialogHeader>

        <DialogBody className="space-y-4" onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); (editingNote ? handleUpdateNote : handleAddNote)(); } }}>
          <Textarea
            ref={contentRef}
            data-testid="input-note-content"
            value={formData.content}
            onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Write something…"
            className="border-0 shadow-none resize-none min-h-[280px] text-sm leading-relaxed focus-visible:ring-0 px-0"
          />

          <div className="pt-3 border-t space-y-3">
            {/* Notebook + Pin row */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={formData.notebook} onValueChange={v => setFormData(prev => ({ ...prev, notebook: v }))}>
                <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-note-notebook">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_NOTEBOOKS.map(nb => <SelectItem key={nb} value={nb}>{nb}</SelectItem>)}
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isPinned: !prev.isPinned }))}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${formData.isPinned ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-amber-600 dark:text-amber-400' : 'border-border text-muted-foreground hover:border-amber-300'}`}
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
          </div>
        </DialogBody>

        <DialogFooter>
          {editingNote && (
            <Button variant="destructive" className="mr-auto" data-testid="button-delete-note"
              onClick={() => { closeModal(); handleDeleteNote(editingNote.id, editingNote.title); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={closeModal}>Cancel</Button>
          <Button type="button" data-testid="button-save-note" onClick={editingNote ? handleUpdateNote : handleAddNote}>
            {editingNote ? 'Save changes' : 'Save note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <BookOpen className="w-6 h-6" /> Notes
          </h1>
          <p className="text-muted-foreground text-sm">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
            {!isPro && ` · ${notes.length}/${getLimit('notes')} used`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowTemplatesModal(true)}>
            <LayoutTemplate className="w-4 h-4 mr-1" /> Templates
          </Button>
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
          >
            <Plus className="w-4 h-4 mr-1" />
            {!isPro && notes.length >= getLimit('notes') ? 'Upgrade' : 'New note'}
          </Button>
        </div>
      </div>

      {/* Search + compact filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            data-testid="input-notes-search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="pl-10 rounded-xl"
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

      {/* Notes grid */}
      {sortedNotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Archive className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium mb-1">
            {notes.length === 0 ? 'No notes yet' : 'No notes match your filters'}
          </p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            {notes.length === 0 ? 'Start writing to capture your thoughts' : 'Try a different search or filter'}
          </p>
          {notes.length === 0 && (
            <Button size="sm" onClick={() => { setFormData({ ...blankForm, notebook: 'personal' }); setShowAddModal(true); }}
              data-testid="button-create-first-note">
              <Plus className="w-4 h-4 mr-1" /> Write your first note
            </Button>
          )}
        </div>
      ) : (
        <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
          {sortedNotes.map((note, idx) => {
            const color = notebookColor(note.notebook);
            const preview = getPreview(note.content || '');
            return (
              <button
                key={note.id}
                data-testid={`note-card-${note.id}`}
                onClick={() => setViewingNote(note)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors ${idx < sortedNotes.length - 1 ? 'border-b border-border/50' : ''}`}
              >
                <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-0.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
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
                <ChevronRight size={16} className="text-muted-foreground/40 flex-shrink-0" />
              </button>
            );
          })}
        </Card>
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
    </div>
  );
}
