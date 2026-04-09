import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { useVault } from '@/contexts/vault-context';
import { NoteEntry, NOTE_NOTEBOOKS } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  BookOpen, 
  Tag, 
  Pin, 
  Calendar,
  Filter,
  StickyNote,
  Archive,
  Eye,
  FileText,
  CheckSquare,
  Square,
  List,
  LayoutTemplate,
  Lightbulb,
  ListTodo,
  Users,
  Target,
  BookMarked,
  PenLine,
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeStringify from 'rehype-stringify';
import RichTextEditor from '@/components/rich-text-editor';
import 'highlight.js/styles/github-dark.css';

// Custom markdown renderer for enhanced formatting
const EnhancedMarkdown = ({ content }: { content: string }) => {
  const processContent = (text: string) => {
    // Detect and format JSON
    const jsonRegex = /```json\n([\s\S]*?)\n```/g;
    text = text.replace(jsonRegex, (match, jsonContent) => {
      try {
        const parsed = JSON.parse(jsonContent);
        const formatted = JSON.stringify(parsed, null, 2);
        return `\`\`\`json\n${formatted}\n\`\`\``;
      } catch {
        return match;
      }
    });

    // Detect and format CSV
    const csvRegex = /```csv\n([\s\S]*?)\n```/g;
    text = text.replace(csvRegex, (match, csvContent) => {
      const lines = csvContent.trim().split('\n');
      const headers = lines[0].split(',');
      const rows = lines.slice(1).map((line: string) => line.split(','));
      
      let formattedCsv = '```csv\n';
      formattedCsv += headers.join(', ') + '\n';
      rows.forEach((row: string[]) => {
        formattedCsv += row.join(', ') + '\n';
      });
      formattedCsv += '```';
      
      return formattedCsv;
    });

    // Detect and format XML
    const xmlRegex = /```xml\n([\s\S]*?)\n```/g;
    text = text.replace(xmlRegex, (match, xmlContent) => {
      try {
        // Simple XML formatting
        const formatted = xmlContent
          .replace(/></g, '>\n<')
          .replace(/^\s+|\s+$/g, '')
          .split('\n')
          .map((line: string) => line.trim())
          .join('\n');
        return `\`\`\`xml\n${formatted}\n\`\`\``;
      } catch {
        return match;
      }
    });

    return text;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeRaw]}
      components={{
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          
          if (language) {
            return (
              <div className="relative">
                <div className="bg-muted px-3 py-1 text-xs font-mono text-muted-foreground border-b">
                  {language.toUpperCase()}
                </div>
                <pre className={`${className} rounded-b-md`} {...props as any}>
                  <code className={className}>{children}</code>
                </pre>
              </div>
            );
          }
          
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border bg-muted px-4 py-2 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
            {children}
          </td>
        ),
      }}
    >
      {processContent(content)}
    </ReactMarkdown>
  );
};

export default function Notes() {
  const { notes, addNote, updateNote, deleteNote, searchQuery, setSearchQuery } = useVault();
  const { toast } = useToast();
  const { getLimit, isPro } = useSubscription();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteEntry | null>(null);
  const [viewingNote, setViewingNote] = useState<NoteEntry | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [deleteNoteTarget, setDeleteNoteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Note Templates - More practical and useful templates
  const NOTE_TEMPLATES = [
    { id: 'grocery', name: 'Grocery List', icon: ListTodo, notebook: 'personal', content: '## 🛒 Grocery List\n\n### Produce\n- [ ] \n\n### Dairy\n- [ ] \n\n### Meat/Protein\n- [ ] \n\n### Pantry\n- [ ] \n\n### Frozen\n- [ ] \n\n### Other\n- [ ] ' },
    { id: 'meeting', name: 'Meeting Notes', icon: Users, notebook: 'work', content: '## 📋 Meeting Notes\n\n**Date:** ' + new Date().toLocaleDateString() + '\n**Time:** \n**Attendees:** \n**Location:** \n\n### Agenda\n1. \n\n### Key Discussion Points\n- \n\n### Decisions Made\n- \n\n### Action Items\n- [ ] Owner: \n- [ ] Owner: \n\n### Next Meeting: ' },
    { id: 'todo', name: 'Daily Tasks', icon: ListTodo, notebook: 'personal', content: '## ✅ Tasks for ' + new Date().toLocaleDateString() + '\n\n### Must Do Today\n- [ ] \n- [ ] \n\n### Should Do\n- [ ] \n\n### Nice to Have\n- [ ] \n\n### Notes\n' },
    { id: 'password', name: 'Account Info', icon: FileText, notebook: 'personal', content: '## 🔐 Account Information\n\n**Service:** \n**Website:** \n**Username:** \n**Email:** \n**Security Questions:**\n1. Q: \n   A: \n2. Q: \n   A: \n\n**Recovery Codes:**\n- \n\n**Notes:**\n' },
    { id: 'recipe', name: 'Recipe', icon: FileText, notebook: 'personal', content: '## 🍳 Recipe: \n\n**Servings:** \n**Prep Time:** \n**Cook Time:** \n\n### Ingredients\n- \n\n### Instructions\n1. \n2. \n3. \n\n### Notes\n' },
    { id: 'travel', name: 'Travel Checklist', icon: Target, notebook: 'personal', content: '## ✈️ Travel Packing List\n\n**Destination:** \n**Dates:** \n\n### Documents\n- [ ] Passport\n- [ ] ID\n- [ ] Tickets\n- [ ] Hotel confirmation\n\n### Clothing\n- [ ] \n\n### Toiletries\n- [ ] \n\n### Electronics\n- [ ] Phone charger\n- [ ] \n\n### Other\n- [ ] ' },
    { id: 'health', name: 'Health Log', icon: FileText, notebook: 'personal', content: '## 🏥 Health Record\n\n**Date:** ' + new Date().toLocaleDateString() + '\n\n### Symptoms\n- \n\n### Medications\n| Name | Dosage | Time |\n|------|--------|------|\n|      |        |      |\n\n### Vitals\n- Blood Pressure: \n- Weight: \n- Temperature: \n\n### Doctor Notes\n' },
    { id: 'budget', name: 'Budget Planner', icon: FileText, notebook: 'personal', content: '## 💰 Monthly Budget - ' + new Date().toLocaleString('default', { month: 'long', year: 'numeric' }) + '\n\n### Income\n- Salary: $\n- Other: $\n**Total Income:** $\n\n### Fixed Expenses\n- [ ] Rent/Mortgage: $\n- [ ] Utilities: $\n- [ ] Insurance: $\n\n### Variable Expenses\n- [ ] Groceries: $\n- [ ] Transport: $\n- [ ] Entertainment: $\n\n### Savings Goal: $\n' },
    { id: 'project', name: 'Project Plan', icon: Sparkles, notebook: 'work', content: '## 📊 Project: \n\n**Status:** 🟡 In Progress\n**Start Date:** \n**Due Date:** \n\n### Objective\n\n### Milestones\n- [ ] Phase 1: \n- [ ] Phase 2: \n- [ ] Phase 3: \n\n### Team/Resources\n- \n\n### Risks & Blockers\n- \n\n### Progress Notes\n' },
    { id: 'journal', name: 'Daily Journal', icon: PenLine, notebook: 'personal', content: '## 📔 Journal - ' + new Date().toLocaleDateString() + '\n\n### How am I feeling?\n\n### What happened today?\n\n### What am I grateful for?\n1. \n2. \n3. \n\n### What could I improve?\n\n### Tomorrow\'s priorities\n- ' },
    { id: 'contacts', name: 'Contact Info', icon: Users, notebook: 'personal', content: '## 👤 Contact\n\n**Name:** \n**Company:** \n**Role:** \n\n### Contact Details\n- Phone: \n- Email: \n- LinkedIn: \n\n### How we met\n\n### Notes\n' },
    { id: 'blank', name: 'Blank Note', icon: FileText, notebook: 'personal', content: '' },
  ];

  const handleUseTemplate = (template: typeof NOTE_TEMPLATES[0]) => {
    setFormData({
      title: '',
      content: template.content,
      notebook: template.notebook,
      tags: [],
      isPinned: false,
      noteType: 'rich',
    });
    setShowTemplatesModal(false);
    setShowAddModal(true);
  };

  // Form state for add/edit modal
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    notebook: 'Default',
    tags: [] as string[],
    isPinned: false,
    noteType: 'rich' as 'rich' | 'markdown',
  });
  
  const [newTag, setNewTag] = useState('');


  // Get all unique tags from notes
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(note => {
      if (note.tags && Array.isArray(note.tags)) {
        note.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filter notes based on search, notebook, tags, and pinned status
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      // Search filter
      const matchesSearch = !searchQuery || 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      // Notebook filter
      const matchesNotebook = selectedNotebook === 'all' || note.notebook === selectedNotebook;
      
      // Tag filter
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => (note.tags || []).includes(tag));

      // Pinned filter
      const matchesPinned = !showPinnedOnly || note.isPinned;

      return matchesSearch && matchesNotebook && matchesTags && matchesPinned;
    });
  }, [notes, searchQuery, selectedNotebook, selectedTags, showPinnedOnly]);

  // Sort notes: pinned first, then by updated date
  const sortedNotes = useMemo(() => {
    return [...filteredNotes].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [filteredNotes]);

  const handleAddNote = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await addNote({
        title: formData.title.trim(),
        content: formData.content,
        notebook: formData.notebook,
        tags: formData.tags,
        isPinned: formData.isPinned,
      });

    setFormData({
      title: '',
      content: '',
      notebook: 'Default',
      tags: [],
      isPinned: false,
      noteType: 'rich',
    });
      setShowAddModal(false);

      toast({
        title: "Success",
        description: "Note added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    }
  };

  const handleEditNote = (note: NoteEntry) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      notebook: note.notebook,
      tags: [...note.tags],
      isPinned: note.isPinned,
      noteType: 'rich', // Default to text for existing notes
 // Default to empty checklist for existing notes
    });
  };

  const handleUpdateNote = async () => {
    if (!editingNote || !formData.title.trim()) {
      toast({
        title: "Error", 
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateNote(editingNote.id, {
        title: formData.title.trim(),
        content: formData.content,
        notebook: formData.notebook,
        tags: formData.tags,
        isPinned: formData.isPinned,
      });

      setEditingNote(null);
    setFormData({
      title: '',
      content: '',
      notebook: 'Default',
      tags: [],
      isPinned: false,
      noteType: 'rich',
    });

      toast({
        title: "Success",
        description: "Note updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    }
  };

  const handleDeleteNote = (id: string, title: string) => {
    setDeleteNoteTarget({ id, title });
  };

  const handleDeleteNoteConfirmed = async () => {
    if (!deleteNoteTarget) return;
    const { id } = deleteNoteTarget;
    setDeleteNoteTarget(null);
    try {
      await deleteNote(id);
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    }
  };

  const togglePinNote = async (note: NoteEntry) => {
    try {
      await updateNote(note.id, { isPinned: !note.isPinned });
      toast({
        title: "Success",
        description: note.isPinned ? "Note unpinned" : "Note pinned",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedNotebook('all');
    setSelectedTags([]);
    setShowPinnedOnly(false);
    setSearchQuery('');
  };

  const renderViewModal = () => (
    <Dialog open={!!viewingNote} onOpenChange={(open) => {
      if (!open) {
        setViewingNote(null);
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        {viewingNote && (
          <>
            <DialogHeader className="pr-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-xl mb-2 flex items-center gap-2 pr-2">
                    {viewingNote.isPinned && <Pin className="w-5 h-5 text-amber-600 dark:text-amber-400 fill-amber-600 dark:fill-amber-400 flex-shrink-0" />}
                    <span className="truncate">{viewingNote.title}</span>
                  </DialogTitle>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      <span>{viewingNote.notebook}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(viewingNote.updatedAt), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0"
                  onClick={() => {
                    setViewingNote(null);
                    handleEditNote(viewingNote);
                  }}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </div>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              {/* Tags */}
              {viewingNote.tags && viewingNote.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewingNote.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="prose dark:prose-invert max-w-none">
                {viewingNote.content.includes('<') ? (
                  // Rich text content
                  <div 
                    className="rich-text-content"
                    dangerouslySetInnerHTML={{ __html: viewingNote.content }} 
                  />
                ) : (
                  // Markdown content
                  <EnhancedMarkdown content={viewingNote.content} />
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  const renderNoteModal = () => (
    <Dialog open={showAddModal || !!editingNote} onOpenChange={(open) => {
      if (!open) {
        setShowAddModal(false);
        setEditingNote(null);
    setFormData({
      title: '',
      content: '',
      notebook: 'Default',
      tags: [],
      isPinned: false,
      noteType: 'rich',
    });
        setNewTag('');
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            {editingNote ? 'Edit Note' : 'Add New Note'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              data-testid="input-note-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter note title..."
              className="text-lg"
            />
          </div>

          {/* Notebook and Pin */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notebook">Notebook</Label>
              <Select 
                value={formData.notebook} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, notebook: value }))}
              >
                <SelectTrigger data-testid="select-note-notebook">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_NOTEBOOKS.map(notebook => (
                    <SelectItem key={notebook} value={notebook}>{notebook}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Switch
                  checked={formData.isPinned}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPinned: checked }))}
                />
                <Pin className="w-4 h-4" />
                Pin this note
              </Label>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                data-testid="input-note-tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1"
              />
              <Button 
                type="button"
                onClick={addTag}
                data-testid="button-add-tag"
                variant="outline"
                size="sm"
              >
                <Tag className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer"
                    onClick={() => removeTag(tag)}
                    data-testid={`badge-tag-${tag}`}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Note Type */}
          <div className="space-y-2">
            <Label htmlFor="note-type">Note Type</Label>
            <Select 
              value={formData.noteType} 
              onValueChange={(value: 'rich' | 'markdown') => setFormData(prev => ({ ...prev, noteType: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rich">Rich Text Editor</SelectItem>
                <SelectItem value="markdown">Markdown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Content with Rich Text Editor */}
          <div className="space-y-2">
            <Label>Content</Label>
            {formData.noteType === 'rich' ? (
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData(prev => ({ ...prev, content }))}
                placeholder="Start writing your note..."
                className="min-h-[400px]"
                showPreview={true}
                enableAdvancedFeatures={true}
                enableAutoSave={false}
                wordCount={true}
              />
            ) : formData.noteType === 'markdown' ? (
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit" className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="edit" className="space-y-2">
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Write your note content here using Markdown..."
                    className="min-h-64 font-mono text-sm resize-none"
                  />
                  <div className="text-xs text-muted-foreground">
                    <strong>Enhanced Markdown Support:</strong> Headers (#), **bold**, *italic*, `code`, lists (-, 1.), 
                    [links](url), &gt; quotes, tables, code blocks ```lang, **JSON/CSV/XML formatting**, and more
                  </div>
                </TabsContent>
                
                <TabsContent value="preview" className="space-y-2">
                  <div className="min-h-64 p-4 border rounded-md bg-background prose prose-sm dark:prose-invert max-w-none">
                    {formData.content ? (
                      <EnhancedMarkdown content={formData.content} />
                    ) : (
                      <div className="text-muted-foreground italic">
                        Nothing to preview. Write some content in the Edit tab.
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            ) : null}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setEditingNote(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              data-testid="button-save-note"
              onClick={editingNote ? handleUpdateNote : handleAddNote}
            >
              {editingNote ? 'Update Note' : 'Add Note'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <BookOpen className="w-6 h-6" />
            Notes
          </h1>
          <p className="text-muted-foreground text-sm">
            Organize your thoughts with encrypted notes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isPro && (
            <span className="text-xs text-muted-foreground">
              {notes.length}/{getLimit('notes')}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTemplatesModal(true)}
            className="rounded-xl"
          >
            <LayoutTemplate className="w-4 h-4 mr-1" />
            Templates
          </Button>
          <Button
            size="sm"
            disabled={!isPro && notes.length >= getLimit('notes')}
            onClick={() => {
              if (!isPro && notes.length >= getLimit('notes')) {
                toast({ title: "Limit Reached", description: `Free plan allows up to ${getLimit('notes')} notes. Upgrade to Pro for unlimited.`, variant: "destructive" });
                return;
              }
              setFormData({
                title: '',
                content: '',
                notebook: 'personal',
                tags: [],
                isPinned: false,
                noteType: 'rich',
              });
              setShowAddModal(true);
            }}
            data-testid="button-add-note"
          >
            <Plus className="w-4 h-4 mr-1" />
            {!isPro && notes.length >= getLimit('notes') ? 'Upgrade to Add' : 'Add'}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              data-testid="input-notes-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes by title, content, or tags..."
              className="pl-10"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Notebook Filter */}
            <div className="space-y-2">
              <Label>Notebook</Label>
              <Select value={selectedNotebook} onValueChange={setSelectedNotebook}>
                <SelectTrigger data-testid="select-notebook-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Notebooks</SelectItem>
                  {NOTE_NOTEBOOKS.map(notebook => (
                    <SelectItem key={notebook} value={notebook}>{notebook}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick Filters */}
            <div className="space-y-2">
              <Label>Quick Filters</Label>
              <div className="flex gap-2">
                <Button
                  variant={showPinnedOnly ? "default" : "outline"}
                  size="sm"
                  data-testid="button-filter-pinned"
                  onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                >
                  <Pin className="w-4 h-4 mr-1" />
                  Pinned
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-clear-filters"
                  onClick={clearFilters}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <div className="text-sm text-muted-foreground">
                Showing {sortedNotes.length} of {notes.length} notes
              </div>
            </div>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="space-y-2">
              <Label>Filter by Tags</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTagFilter(tag)}
                    data-testid={`filter-tag-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes Grid */}
      {sortedNotes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Archive className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Notes Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {notes.length === 0 
                ? "Get started by creating your first note"
                : "Try adjusting your search or filter criteria"
              }
            </p>
            {notes.length === 0 && (
              <Button onClick={() => {
                  setFormData({
                    title: '',
                    content: '',
                    notebook: 'personal',
                    tags: [],
                    isPinned: false,
                    noteType: 'rich',
                  });
                  setShowAddModal(true);
                }} data-testid="button-create-first-note">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Note
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedNotes.map(note => (
            <Card 
              key={note.id} 
              className={`group cursor-pointer transition-all duration-200 hover:shadow-xl hover:scale-[1.02] border-2 ${
                note.isPinned 
                  ? 'border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
              }`}
              onClick={() => setViewingNote(note)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base line-clamp-2 flex items-center gap-2 font-semibold">
                    {note.isPinned && <Pin className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 fill-amber-600 dark:fill-amber-400" />}
                    <span data-testid={`note-title-${note.id}`} className="text-foreground">{note.title}</span>
                  </CardTitle>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-pin-${note.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinNote(note);
                      }}
                      className="p-1.5 h-auto hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-md"
                      title={note.isPinned ? "Unpin note" : "Pin note"}
                    >
                      <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'text-primary fill-primary' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-edit-${note.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditNote(note);
                      }}
                      className="p-1.5 h-auto hover:bg-primary/10 rounded-md"
                      title="Edit note"
                    >
                      <Edit className="w-3.5 h-3.5 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`button-delete-${note.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id, note.title);
                      }}
                      className="p-1.5 h-auto hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md"
                      title="Delete note"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="font-medium">{note.notebook}</span>
                  <span className="text-muted-foreground/50">•</span>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{format(new Date(note.updatedAt), 'MMM d, yyyy')}</span>
                </div>
              </CardHeader>

              <CardContent className="pt-2 space-y-3">
                {note.content && (
                  <div className="text-sm text-muted-foreground line-clamp-4 mb-3 leading-relaxed" data-testid={`note-content-${note.id}`}>
                    {/* Strip HTML for preview */}
                    {note.content.replace(/<[^>]*>/g, '').substring(0, 150)}
                    {note.content.length > 150 ? '...' : ''}
                  </div>
                )}
                
                {(note.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(note.tags || []).slice(0, 3).map(tag => (
                      <Badge 
                        key={tag} 
                        variant="secondary" 
                        className="text-xs px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors" 
                        data-testid={`note-tag-${note.id}-${tag}`}
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                    {(note.tags || []).length > 3 && (
                      <Badge variant="outline" className="text-xs px-2 py-0.5">
                        +{(note.tags || []).length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {renderViewModal()}
      {renderNoteModal()}

      {/* Templates Modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" />
              Note Templates
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {NOTE_TEMPLATES.map(template => {
              const IconComponent = template.icon;
              return (
                <Card 
                  key={template.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow p-3"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{template.notebook}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteNoteTarget} onOpenChange={(open) => { if (!open) setDeleteNoteTarget(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-delete-note">
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete &ldquo;{deleteNoteTarget?.title}&rdquo;? This cannot be undone.
          </p>
          <div className="flex gap-3 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteNoteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-delete-note"
              onClick={handleDeleteNoteConfirmed}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}