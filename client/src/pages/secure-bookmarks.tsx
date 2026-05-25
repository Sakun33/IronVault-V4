import { useState, useMemo } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Search, Bookmark, ExternalLink, Lock, Share2 } from 'lucide-react';
import type { SecureBookmark } from '@shared/schema';
import { PageHero } from '@/components/page-hero';
import { PremiumCard } from '@/components/premium-card';
import { Favicon } from '@/components/favicon';
import { ShareItemModal } from '@/components/share-item-modal';

const blank = (): Omit<SecureBookmark, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  url: '',
  category: '',
  tags: [],
  icon: '',
  autoLogin: false,
  linkedPasswordId: undefined,
  notes: '',
});

export default function SecureBookmarksPage() {
  const { secureBookmarks, addSecureBookmark, updateSecureBookmark, deleteSecureBookmark, passwords } = useVault();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SecureBookmark | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [tagsInput, setTagsInput] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<SecureBookmark | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return secureBookmarks;
    return secureBookmarks.filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [secureBookmarks, query]);

  const openAdd = () => { setEditing(null); setForm(blank()); setTagsInput(''); setIsOpen(true); };
  const openEdit = (b: SecureBookmark) => {
    setEditing(b);
    setForm({
      title: b.title, url: b.url, category: b.category || '',
      tags: b.tags || [], icon: b.icon || '', autoLogin: b.autoLogin,
      linkedPasswordId: b.linkedPasswordId, notes: b.notes || '',
    });
    setTagsInput((b.tags || []).join(', '));
    setIsOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.url.trim()) {
      toast({ title: 'Title and URL required', variant: 'destructive' });
      return;
    }
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
      const payload = { ...form, tags };
      if (editing) {
        await updateSecureBookmark(editing.id, payload);
        toast({ title: 'Bookmark updated', variant: 'success' });
      } else {
        await addSecureBookmark(payload);
        toast({ title: 'Bookmark saved', variant: 'success' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteSecureBookmark(confirmDeleteId);
      toast({ title: 'Bookmark deleted', variant: 'success' });
    } finally { setConfirmDeleteId(null); }
  };

  const openBookmark = (b: SecureBookmark) => {
    if (b.autoLogin && b.linkedPasswordId) {
      const p = passwords.find(x => x.id === b.linkedPasswordId);
      if (p?.username) {
        navigator.clipboard.writeText(p.username).catch(() => undefined);
        toast({ title: 'Opening site', description: 'Username copied. Chrome extension will autofill if installed.' });
      }
    }
    window.open(b.url.includes('://') ? b.url : `https://${b.url}`, '_blank', 'noopener,noreferrer');
  };

  if (secureBookmarks.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Bookmark}
          title="Secure Bookmarks"
          subtitle="Save sites alongside their credentials. Open with one tap; the Chrome extension fills the login form for you when autoLogin is on."
          accent="sky"
          badges={[{ label: 'Auto-login' }, { label: 'Vault-linked' }]}
          cta={{ label: 'Add bookmark', onClick: openAdd, icon: Plus }}
        />
        <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} tagsInput={tagsInput} setTagsInput={setTagsInput} submit={submit} passwords={passwords} />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Bookmarks</h1>
          <p className="text-sm text-muted-foreground mt-1">{secureBookmarks.length} saved</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search bookmarks…" className="pl-9" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtered.map(b => {
          const linkedPw = b.linkedPasswordId ? passwords.find(p => p.id === b.linkedPasswordId) : null;
          let hostname = '';
          try { hostname = new URL(b.url.includes('://') ? b.url : `https://${b.url}`).hostname.replace(/^www\./, ''); } catch { /* ignore */ }
          return (
            <PremiumCard key={b.id} accent="sky" className="p-3 flex flex-col gap-2 group">
              <button onClick={() => openBookmark(b)} className="flex flex-col items-center text-center gap-2 flex-1" title={b.url}>
                <Favicon url={b.url} name={b.title} className="w-12 h-12 rounded-2xl" />
                <div className="min-w-0 w-full">
                  <div className="font-semibold text-xs truncate" title={b.title}>{b.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{hostname || b.url}</div>
                </div>
              </button>
              <div className="flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {b.autoLogin && linkedPw ? (
                  <span title="Auto-login enabled" className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                ) : <span />}
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openBookmark(b)} title="Open"><ExternalLink className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSharing(b)} title="Share"><Share2 className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(b)} title="Edit"><Edit className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(b.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
            </PremiumCard>
          );
        })}
      </div>

      <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} tagsInput={tagsInput} setTagsInput={setTagsInput} submit={submit} passwords={passwords} />

      <ShareItemModal
        open={!!sharing}
        onOpenChange={(o) => !o && setSharing(null)}
        itemLabel={sharing?.title || 'Bookmark'}
        itemKind="bookmark"
        data={sharing ? { title: sharing.title, url: sharing.url, category: sharing.category, notes: sharing.notes } : {}}
      />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bookmark?</AlertDialogTitle>
            <AlertDialogDescription>This bookmark will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddEditDialog(props: {
  isOpen: boolean; setIsOpen: (v: boolean) => void;
  editing: SecureBookmark | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  tagsInput: string; setTagsInput: (v: string) => void;
  submit: (e: React.FormEvent) => Promise<void>;
  passwords: any[];
}) {
  const { isOpen, setIsOpen, editing, form, setForm, tagsInput, setTagsInput, submit, passwords } = props;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit bookmark' : 'Add bookmark'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required autoFocus placeholder="GitHub" />
            </div>
            <div>
              <Label>URL</Label>
              <Input type="url" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} required placeholder="https://github.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Work, Banking…" />
              </div>
              <div>
                <Label>Tags (comma-separated)</Label>
                <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="dev, daily" />
              </div>
            </div>
            <div>
              <Label>Link to vault password (optional)</Label>
              <Select value={form.linkedPasswordId ?? '__none__'} onValueChange={(v) => setForm({ ...form, linkedPasswordId: v === '__none__' ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No linked password</SelectItem>
                  {passwords.slice(0, 50).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.username || '—'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <div>
                <Label htmlFor="auto-login">Auto-login when opened</Label>
                <p className="text-xs text-muted-foreground">Chrome extension fills the login form using the linked password.</p>
              </div>
              <Switch id="auto-login" checked={form.autoLogin} onCheckedChange={(v) => setForm({ ...form, autoLogin: v })} disabled={!form.linkedPasswordId} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Add bookmark'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
