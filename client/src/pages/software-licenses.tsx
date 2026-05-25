import { useState, useMemo } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, Search, KeyRound, ExternalLink, Share2 } from 'lucide-react';
import type { SoftwareLicense } from '@shared/schema';
import { copyToClipboardSecure } from '@/native/clipboard';
import { PageHero } from '@/components/page-hero';
import { PremiumCard, PremiumIcon } from '@/components/premium-card';
import { Favicon } from '@/components/favicon';
import { ShareItemModal } from '@/components/share-item-modal';
import { FeaturePreview } from '@/components/feature-preview';
import { useSubscription } from '@/hooks/use-subscription';
import { usePlan } from '@/lib/plan-service';

function maskKey(k: string): string {
  if (!k) return '';
  if (k.length <= 8) return '•'.repeat(k.length);
  return k.slice(0, 4) + '•'.repeat(Math.min(20, k.length - 8)) + k.slice(-4);
}

function daysUntil(date?: string): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
}

const blank = (): Omit<SoftwareLicense, 'id' | 'createdAt' | 'updatedAt'> => ({
  softwareName: '',
  licenseKey: '',
  version: '',
  purchaseDate: '',
  expiryDate: '',
  licensedTo: '',
  seats: undefined,
  platform: undefined,
  vendor: '',
  purchaseUrl: '',
  notes: '',
});

export default function SoftwareLicensesPage() {
  const { softwareLicenses, addSoftwareLicense, updateSoftwareLicense, deleteSoftwareLicense } = useVault();
  const { toast } = useToast();
  const { isLoading: licenseLoading } = useSubscription();
  const plan = usePlan();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SoftwareLicense | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [showKeyIds, setShowKeyIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<SoftwareLicense | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return softwareLicenses;
    return softwareLicenses.filter(l =>
      l.softwareName.toLowerCase().includes(q) ||
      (l.vendor || '').toLowerCase().includes(q) ||
      (l.licensedTo || '').toLowerCase().includes(q)
    );
  }, [softwareLicenses, query]);

  const toggleKey = (id: string) => {
    setShowKeyIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboardSecure(text);
    toast({ title: ok ? `${label} copied` : 'Copy failed', variant: ok ? 'success' : 'destructive' });
  };

  const openAdd = () => { setEditing(null); setForm(blank()); setIsOpen(true); };
  const openEdit = (l: SoftwareLicense) => {
    setEditing(l);
    setForm({
      softwareName: l.softwareName, licenseKey: l.licenseKey,
      version: l.version || '', purchaseDate: l.purchaseDate || '', expiryDate: l.expiryDate || '',
      licensedTo: l.licensedTo || '', seats: l.seats, platform: l.platform,
      vendor: l.vendor || '', purchaseUrl: l.purchaseUrl || '', notes: l.notes || '',
    });
    setIsOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.softwareName.trim() || !form.licenseKey.trim()) {
      toast({ title: 'Name and license key required', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...form, seats: form.seats ? Number(form.seats) : undefined };
      if (editing) {
        await updateSoftwareLicense(editing.id, payload);
        toast({ title: 'License updated', variant: 'success' });
      } else {
        await addSoftwareLicense(payload);
        toast({ title: 'License saved', variant: 'success' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteSoftwareLicense(confirmDeleteId);
      toast({ title: 'License deleted', variant: 'success' });
    } finally { setConfirmDeleteId(null); }
  };

  if (!licenseLoading && !plan.isPaid) {
    return (
      <FeaturePreview
        feature="Software Licenses"
        description="Never lose a license key again. Track activations, seat counts, and renewal dates across every app you own."
        bullets={[
          'Encrypted key storage with masked display + reveal',
          'Renewal alerts 30 days before expiry',
          'Vendor URL + license-holder tracking per entry',
        ]}
        mock="api-keys"
      />
    );
  }

  if (softwareLicenses.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={KeyRound}
          title="Software Licenses"
          subtitle="Track license keys and activations across every device — never lose a key again, and get a heads-up when a renewal is coming."
          accent="violet"
          badges={[
            { label: 'Renewal alerts' },
            { label: 'End-to-end encrypted' },
          ]}
          cta={{ label: 'Add license', onClick: openAdd, icon: Plus }}
        />
        <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Software Licenses</h1>
          <p className="text-sm text-muted-foreground mt-1">{softwareLicenses.length} license{softwareLicenses.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search licenses…" className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(l => {
          const days = daysUntil(l.expiryDate);
          const expiringSoon = days !== null && days >= 0 && days <= 30;
          const expired = days !== null && days < 0;
          // Prefer vendor domain favicon (e.g. "Sublime HQ" → sublimehq.com) and
          // fall back to first-letter circle via the shared Favicon component.
          const faviconUrl = l.purchaseUrl || (l.vendor ? '' : undefined);
          return (
            <PremiumCard key={l.id} accent="violet" className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  {(l.vendor || l.purchaseUrl) ? (
                    <Favicon url={faviconUrl} name={l.vendor || l.softwareName} className="w-11 h-11 rounded-2xl" />
                  ) : (
                    <PremiumIcon accent="violet"><KeyRound className="w-5 h-5" /></PremiumIcon>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{l.softwareName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {l.vendor || l.version || '—'}{l.version && l.vendor ? ` · v${l.version}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSharing(l)} title="Share"><Share2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l)} title="Edit"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(l.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">License key</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono truncate flex-1 bg-black/[0.03] dark:bg-white/[0.04] rounded px-2 py-1.5">
                    {showKeyIds.has(l.id) ? l.licenseKey : maskKey(l.licenseKey)}
                  </code>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleKey(l.id)}>
                    {showKeyIds.has(l.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(l.licenseKey, 'Key')}><Copy className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wider">
                {l.platform && <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">{l.platform}</span>}
                {l.seats && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">{l.seats} seat{l.seats === 1 ? '' : 's'}</span>}
                {expired && <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-700 dark:text-red-300 border border-red-500/25">Expired</span>}
                {expiringSoon && !expired && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">Renew in {days}d</span>}
              </div>
              {l.purchaseUrl && (
                <a href={l.purchaseUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Vendor page
                </a>
              )}
            </PremiumCard>
          );
        })}
      </div>

      <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />

      <ShareItemModal
        open={!!sharing}
        onOpenChange={(o) => !o && setSharing(null)}
        itemLabel={sharing?.softwareName || 'License'}
        itemKind="license"
        data={sharing ? {
          softwareName: sharing.softwareName, licenseKey: sharing.licenseKey,
          vendor: sharing.vendor, version: sharing.version, licensedTo: sharing.licensedTo,
          purchaseUrl: sharing.purchaseUrl, notes: sharing.notes,
        } : {}}
      />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete license?</AlertDialogTitle>
            <AlertDialogDescription>This license will be permanently removed from your vault.</AlertDialogDescription>
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
  editing: SoftwareLicense | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  submit: (e: React.FormEvent) => Promise<void>;
}) {
  const { isOpen, setIsOpen, editing, form, setForm, submit } = props;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit license' : 'Add software license'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Software</Label>
                <Input value={form.softwareName} onChange={e => setForm({ ...form, softwareName: e.target.value })} required autoFocus placeholder="Sketch, Sublime Text…" />
              </div>
              <div className="col-span-2">
                <Label>License key</Label>
                <Input value={form.licenseKey} onChange={e => setForm({ ...form, licenseKey: e.target.value })} required className="font-mono text-xs" />
              </div>
              <div>
                <Label>Version</Label>
                <Input value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} placeholder="4.0" />
              </div>
              <div>
                <Label>Vendor</Label>
                <Input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Sublime HQ" />
              </div>
              <div>
                <Label>Licensed to</Label>
                <Input value={form.licensedTo} onChange={e => setForm({ ...form, licensedTo: e.target.value })} placeholder="email or name" />
              </div>
              <div>
                <Label>Seats</Label>
                <Input type="number" min={1} value={form.seats ?? ''} onChange={e => setForm({ ...form, seats: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>Platform</Label>
                <Select value={form.platform || ''} onValueChange={(v: any) => setForm({ ...form, platform: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="windows">Windows</SelectItem>
                    <SelectItem value="mac">Mac</SelectItem>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="android">Android</SelectItem>
                    <SelectItem value="ios">iOS</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="all">Cross-platform</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Purchase date</Label>
                <Input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Expiry date</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Vendor URL</Label>
                <Input type="url" value={form.purchaseUrl} onChange={e => setForm({ ...form, purchaseUrl: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Add license'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
