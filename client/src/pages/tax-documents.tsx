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
import { Plus, Edit, Trash2, Search, FileText, Calculator, Share2 } from 'lucide-react';
import type { TaxDocument } from '@shared/schema';
import { PageHero } from '@/components/page-hero';
import { PremiumCard, PremiumIcon } from '@/components/premium-card';
import { ShareItemModal } from '@/components/share-item-modal';
import { FeaturePreview } from '@/components/feature-preview';
import { useSubscription } from '@/hooks/use-subscription';
import { usePlan } from '@/lib/plan-service';

const TYPE_LABEL: Record<string, string> = {
  form16: 'Form 16', itr: 'ITR', tds: 'TDS', investment_proof: 'Investment Proof',
  '80c': '80C', '80d': '80D', hra: 'HRA', other: 'Other',
};
const TYPE_COLOR: Record<string, string> = {
  form16: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  itr:    'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25',
  tds:    'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25',
  investment_proof: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
  '80c':  'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/25',
  '80d':  'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/25',
  hra:    'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/25',
  other:  'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/25',
};

function formatINR(n?: number): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '';
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function defaultFY(): string {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String(y + 1).slice(-2)}`;
}

const blank = (): Omit<TaxDocument, 'id' | 'createdAt' | 'updatedAt'> => ({
  documentName: '',
  documentType: 'other',
  financialYear: defaultFY(),
  assessmentYear: '',
  amount: undefined,
  panNumber: '',
  filedDate: '',
  acknowledgementNumber: '',
  notes: '',
});

export default function TaxDocumentsPage() {
  const { taxDocuments, addTaxDocument, updateTaxDocument, deleteTaxDocument } = useVault();
  const { toast } = useToast();
  const { isLoading: licenseLoading } = useSubscription();
  const plan = usePlan();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<TaxDocument | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [sharing, setSharing] = useState<TaxDocument | null>(null);

  // Group by financial year (newest first) for an organised view.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? taxDocuments.filter(d =>
          d.documentName.toLowerCase().includes(q) ||
          d.financialYear.toLowerCase().includes(q) ||
          (d.panNumber || '').toLowerCase().includes(q)
        )
      : taxDocuments;
    const map = new Map<string, TaxDocument[]>();
    for (const d of filtered) {
      const key = d.financialYear || 'Unfiled';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [taxDocuments, query]);

  const openAdd = () => { setEditing(null); setForm(blank()); setIsOpen(true); };
  const openEdit = (d: TaxDocument) => {
    setEditing(d);
    setForm({
      documentName: d.documentName, documentType: d.documentType,
      financialYear: d.financialYear, assessmentYear: d.assessmentYear || '',
      amount: d.amount, panNumber: d.panNumber || '',
      filedDate: d.filedDate || '', acknowledgementNumber: d.acknowledgementNumber || '',
      notes: d.notes || '',
    });
    setIsOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.documentName.trim() || !form.financialYear.trim()) {
      toast({ title: 'Name and financial year required', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...form, amount: form.amount ? Number(form.amount) : undefined };
      if (editing) {
        await updateTaxDocument(editing.id, payload);
        toast({ title: 'Document updated', variant: 'success' });
      } else {
        await addTaxDocument(payload);
        toast({ title: 'Document saved', variant: 'success' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteTaxDocument(confirmDeleteId);
      toast({ title: 'Document deleted', variant: 'success' });
    } finally { setConfirmDeleteId(null); }
  };

  if (!licenseLoading && !plan.isPaid) {
    return (
      <FeaturePreview
        feature="Tax Documents"
        description="Form 16s, ITRs, investment proofs — organised by financial year and searchable in seconds when you need them at filing time."
        bullets={[
          'FY/AY grouping with auto-detection from filing dates',
          'Encrypted PAN + acknowledgement number storage',
          'Tracks 80C, 80D, HRA, TDS, and investment proofs',
        ]}
        mock="documents"
      />
    );
  }

  if (taxDocuments.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Calculator}
          title="Tax Documents"
          subtitle="Keep Form 16s, ITR acknowledgements, and investment proofs organised by financial year — searchable in seconds when you need them."
          accent="amber"
          badges={[{ label: 'FY grouping' }, { label: 'End-to-end encrypted' }]}
          cta={{ label: 'Add document', onClick: openAdd, icon: Plus }}
        />
        <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tax Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">{taxDocuments.length} document{taxDocuments.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search documents…" className="pl-9" />
      </div>

      <div className="space-y-6">
        {grouped.map(([fy, docs]) => (
          <div key={fy}>
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground">FY {fy}</h2>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground/70">{docs.length} item{docs.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {docs.map(d => (
                <PremiumCard key={d.id} accent="amber" className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <PremiumIcon accent="amber"><FileText className="w-5 h-5" /></PremiumIcon>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{d.documentName}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.assessmentYear ? `AY ${d.assessmentYear}` : `FY ${d.financialYear}`}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSharing(d)} title="Share"><Share2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(d.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${TYPE_COLOR[d.documentType]}`}>{TYPE_LABEL[d.documentType]}</span>
                    {d.amount !== undefined && <span className="font-semibold">{formatINR(d.amount)}</span>}
                  </div>
                  {(d.panNumber || d.acknowledgementNumber) && (
                    <div className="text-xs text-muted-foreground border-t border-border/40 pt-2 space-y-0.5">
                      {d.panNumber && <div>PAN <span className="font-mono text-foreground">{d.panNumber}</span></div>}
                      {d.acknowledgementNumber && <div>Ack# <span className="font-mono text-foreground">{d.acknowledgementNumber}</span></div>}
                    </div>
                  )}
                </PremiumCard>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ShareItemModal
        open={!!sharing}
        onOpenChange={(o) => !o && setSharing(null)}
        itemLabel={sharing?.documentName || 'Tax document'}
        itemKind="tax"
        data={sharing ? {
          documentName: sharing.documentName, documentType: sharing.documentType,
          financialYear: sharing.financialYear, assessmentYear: sharing.assessmentYear,
          amount: sharing.amount, panNumber: sharing.panNumber,
          acknowledgementNumber: sharing.acknowledgementNumber, notes: sharing.notes,
        } : {}}
      />

      <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>This document record will be permanently removed.</AlertDialogDescription>
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
  editing: TaxDocument | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  submit: (e: React.FormEvent) => Promise<void>;
}) {
  const { isOpen, setIsOpen, editing, form, setForm, submit } = props;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit document' : 'Add tax document'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Document name</Label>
                <Input value={form.documentName} onChange={e => setForm({ ...form, documentName: e.target.value })} required autoFocus placeholder="Form 16 — Acme Corp" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.documentType} onValueChange={(v: any) => setForm({ ...form, documentType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="form16">Form 16</SelectItem>
                    <SelectItem value="itr">ITR</SelectItem>
                    <SelectItem value="tds">TDS</SelectItem>
                    <SelectItem value="investment_proof">Investment proof</SelectItem>
                    <SelectItem value="80c">80C</SelectItem>
                    <SelectItem value="80d">80D</SelectItem>
                    <SelectItem value="hra">HRA</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Amount (₹)</Label>
                <Input type="number" value={form.amount ?? ''} onChange={e => setForm({ ...form, amount: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>Financial year</Label>
                <Input value={form.financialYear} onChange={e => setForm({ ...form, financialYear: e.target.value })} placeholder="2025-26" required />
              </div>
              <div>
                <Label>Assessment year</Label>
                <Input value={form.assessmentYear} onChange={e => setForm({ ...form, assessmentYear: e.target.value })} placeholder="2026-27" />
              </div>
              <div>
                <Label>PAN</Label>
                <Input value={form.panNumber} onChange={e => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} className="font-mono uppercase" maxLength={10} />
              </div>
              <div>
                <Label>Filed date</Label>
                <Input type="date" value={form.filedDate} onChange={e => setForm({ ...form, filedDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Acknowledgement #</Label>
                <Input value={form.acknowledgementNumber} onChange={e => setForm({ ...form, acknowledgementNumber: e.target.value })} className="font-mono" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Add document'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
