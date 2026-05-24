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
import { Plus, Copy, Edit, Trash2, Search, ShieldCheck, Heart, Car, Home, Plane, User, Briefcase } from 'lucide-react';
import type { InsurancePolicy } from '@shared/schema';
import { copyToClipboardSecure } from '@/native/clipboard';
import { PageHero } from '@/components/page-hero';

const TYPE_ICON: Record<string, any> = {
  health: Heart, life: User, car: Car, home: Home, travel: Plane, term: Briefcase, other: ShieldCheck,
};
const TYPE_GRADIENT: Record<string, string> = {
  health: 'from-rose-500 to-pink-600',
  life:   'from-emerald-500 to-teal-600',
  car:    'from-sky-500 to-blue-600',
  home:   'from-amber-500 to-orange-600',
  travel: 'from-violet-500 to-purple-600',
  term:   'from-indigo-500 to-blue-700',
  other:  'from-slate-500 to-slate-700',
};

function daysUntil(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function formatINR(n: number): string {
  return n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

const blank = (): Omit<InsurancePolicy, 'id' | 'createdAt' | 'updatedAt'> => ({
  policyName: '',
  insurer: '',
  policyNumber: '',
  policyType: 'other',
  premium: 0,
  premiumFrequency: 'yearly',
  sumInsured: undefined,
  startDate: new Date().toISOString().slice(0, 10),
  expiryDate: '',
  nominees: '',
  agentName: '',
  agentPhone: '',
  claimProcess: '',
  notes: '',
});

export default function InsuranceVaultPage() {
  const { insurancePolicies, addInsurancePolicy, updateInsurancePolicy, deleteInsurancePolicy } = useVault();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return insurancePolicies;
    return insurancePolicies.filter(p =>
      p.policyName.toLowerCase().includes(q) ||
      p.insurer.toLowerCase().includes(q) ||
      p.policyNumber.toLowerCase().includes(q)
    );
  }, [insurancePolicies, query]);

  const openAdd = () => { setEditing(null); setForm(blank()); setIsOpen(true); };
  const openEdit = (p: InsurancePolicy) => {
    setEditing(p);
    setForm({
      policyName: p.policyName, insurer: p.insurer, policyNumber: p.policyNumber,
      policyType: p.policyType, premium: p.premium, premiumFrequency: p.premiumFrequency,
      sumInsured: p.sumInsured, startDate: p.startDate, expiryDate: p.expiryDate,
      nominees: p.nominees || '', agentName: p.agentName || '', agentPhone: p.agentPhone || '',
      claimProcess: p.claimProcess || '', notes: p.notes || '',
    });
    setIsOpen(true);
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboardSecure(text);
    toast({ title: ok ? `${label} copied` : 'Copy failed', variant: ok ? 'success' : 'destructive' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.policyName.trim() || !form.insurer.trim() || !form.policyNumber.trim()) {
      toast({ title: 'Name, insurer, and policy number required', variant: 'destructive' });
      return;
    }
    try {
      const payload = { ...form, premium: Number(form.premium) || 0, sumInsured: form.sumInsured ? Number(form.sumInsured) : undefined };
      if (editing) {
        await updateInsurancePolicy(editing.id, payload);
        toast({ title: 'Policy updated', variant: 'success' });
      } else {
        await addInsurancePolicy(payload);
        toast({ title: 'Policy saved', variant: 'success' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteInsurancePolicy(confirmDeleteId);
      toast({ title: 'Policy deleted', variant: 'success' });
    } finally { setConfirmDeleteId(null); }
  };

  if (insurancePolicies.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={ShieldCheck}
          title="Insurance Vault"
          subtitle="Store every policy in one place — premiums, sum insured, nominees, claim contacts. Get a heads-up before each renewal."
          accent="emerald"
          badges={[{ label: 'Renewal alerts' }, { label: 'Nominee details' }]}
          cta={{ label: 'Add policy', onClick: openAdd, icon: Plus }}
        />
        <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Insurance Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">{insurancePolicies.length} polic{insurancePolicies.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search policies…" className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => {
          const Icon = TYPE_ICON[p.policyType] || ShieldCheck;
          const grad = TYPE_GRADIENT[p.policyType];
          const days = daysUntil(p.expiryDate);
          const expired = days < 0;
          const expiringSoon = days >= 0 && days <= 30;
          return (
            <div key={p.id} className="glass-card p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center flex-shrink-0 shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.policyName}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.insurer}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(p.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Policy #</div>
                  <button onClick={() => copy(p.policyNumber, 'Policy number')} className="text-left font-mono hover:text-primary truncate w-full" title="Copy">{p.policyNumber}</button>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Premium</div>
                  <div className="font-semibold">{formatINR(p.premium)} <span className="text-muted-foreground font-normal">/ {p.premiumFrequency}</span></div>
                </div>
                {p.sumInsured && (
                  <div className="col-span-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Sum insured</div>
                    <div className="font-semibold">{formatINR(p.sumInsured)}</div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wider">
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">{p.policyType}</span>
                {expired && <span className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/25">Expired</span>}
                {expiringSoon && <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">Renews in {days}d</span>}
                {!expired && !expiringSoon && <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/25">Renews in {days}d</span>}
              </div>
              {(p.agentName || p.agentPhone) && (
                <div className="text-xs text-muted-foreground border-t border-border/40 pt-2">
                  Agent: <span className="text-foreground">{p.agentName || '—'}</span>
                  {p.agentPhone && <> · <a href={`tel:${p.agentPhone}`} className="text-primary hover:underline">{p.agentPhone}</a></>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete policy?</AlertDialogTitle>
            <AlertDialogDescription>This policy will be permanently removed from your vault.</AlertDialogDescription>
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
  editing: InsurancePolicy | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  submit: (e: React.FormEvent) => Promise<void>;
}) {
  const { isOpen, setIsOpen, editing, form, setForm, submit } = props;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit policy' : 'Add insurance policy'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Policy name</Label>
                <Input value={form.policyName} onChange={e => setForm({ ...form, policyName: e.target.value })} required autoFocus />
              </div>
              <div>
                <Label>Insurer</Label>
                <Input value={form.insurer} onChange={e => setForm({ ...form, insurer: e.target.value })} required placeholder="LIC, HDFC Ergo…" />
              </div>
              <div>
                <Label>Policy #</Label>
                <Input value={form.policyNumber} onChange={e => setForm({ ...form, policyNumber: e.target.value })} required />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.policyType} onValueChange={(v: any) => setForm({ ...form, policyType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="life">Life</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="term">Term</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Premium frequency</Label>
                <Select value={form.premiumFrequency} onValueChange={(v: any) => setForm({ ...form, premiumFrequency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="half-yearly">Half-yearly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Premium (₹)</Label>
                <Input type="number" min={0} value={form.premium || ''} onChange={e => setForm({ ...form, premium: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Sum insured (₹)</Label>
                <Input type="number" min={0} value={form.sumInsured ?? ''} onChange={e => setForm({ ...form, sumInsured: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <Label>Start date</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required />
              </div>
              <div>
                <Label>Expiry date</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} required />
              </div>
              <div className="col-span-2">
                <Label>Nominees</Label>
                <Input value={form.nominees} onChange={e => setForm({ ...form, nominees: e.target.value })} />
              </div>
              <div>
                <Label>Agent name</Label>
                <Input value={form.agentName} onChange={e => setForm({ ...form, agentName: e.target.value })} />
              </div>
              <div>
                <Label>Agent phone</Label>
                <Input type="tel" value={form.agentPhone} onChange={e => setForm({ ...form, agentPhone: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Claim process</Label>
                <Textarea value={form.claimProcess} onChange={e => setForm({ ...form, claimProcess: e.target.value })} rows={2} />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Add policy'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
