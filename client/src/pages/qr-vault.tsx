import { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
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
import { Plus, Edit, Trash2, Search, QrCode as QrIcon, Maximize2, Ticket, Plane, Wifi, Link as LinkIcon, User, CreditCard } from 'lucide-react';
import type { QrCode } from '@shared/schema';
import { PageHero } from '@/components/page-hero';

const CATEGORY_LABEL: Record<string, string> = {
  boarding_pass: 'Boarding Pass',
  event_ticket: 'Event Ticket',
  payment: 'Payment',
  wifi: 'Wi-Fi',
  url: 'URL',
  contact: 'Contact',
  other: 'Other',
};
const CATEGORY_ICON: Record<string, any> = {
  boarding_pass: Plane,
  event_ticket: Ticket,
  payment: CreditCard,
  wifi: Wifi,
  url: LinkIcon,
  contact: User,
  other: QrIcon,
};
const CATEGORY_GRADIENT: Record<string, string> = {
  boarding_pass: 'from-sky-500 to-blue-600',
  event_ticket: 'from-rose-500 to-pink-600',
  payment: 'from-emerald-500 to-teal-600',
  wifi: 'from-cyan-500 to-sky-600',
  url: 'from-violet-500 to-fuchsia-600',
  contact: 'from-amber-500 to-orange-600',
  other: 'from-slate-500 to-slate-700',
};

const blank = (): Omit<QrCode, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  category: 'other',
  qrData: '',
  imageData: '',
  expiryDate: '',
  notes: '',
});

function MiniQr({ data, size = 80 }: { data: string; size?: number }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(data || ' ', { width: size, margin: 1, errorCorrectionLevel: 'M' })
      .then(setSrc).catch(() => setSrc(''));
  }, [data, size]);
  if (!src) return <div className="rounded bg-black/5 dark:bg-white/5" style={{ width: size, height: size }} />;
  return <img src={src} alt="QR" className="rounded bg-white p-1" style={{ width: size, height: size }} />;
}

export default function QRVaultPage() {
  const { qrCodes, addQrCode, updateQrCode, deleteQrCode } = useVault();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<QrCode | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [fullscreenFor, setFullscreenFor] = useState<QrCode | null>(null);
  const [fullscreenDataUrl, setFullscreenDataUrl] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return qrCodes;
    return qrCodes.filter(qr =>
      qr.name.toLowerCase().includes(q) ||
      qr.qrData.toLowerCase().includes(q)
    );
  }, [qrCodes, query]);

  useEffect(() => {
    if (!fullscreenFor) { setFullscreenDataUrl(''); return; }
    QRCode.toDataURL(fullscreenFor.qrData, { width: 720, margin: 2, errorCorrectionLevel: 'H' })
      .then(setFullscreenDataUrl)
      .catch(() => setFullscreenDataUrl(''));
  }, [fullscreenFor]);

  const openAdd = () => { setEditing(null); setForm(blank()); setIsOpen(true); };
  const openEdit = (q: QrCode) => {
    setEditing(q);
    setForm({
      name: q.name, category: q.category, qrData: q.qrData,
      imageData: q.imageData || '', expiryDate: q.expiryDate || '', notes: q.notes || '',
    });
    setIsOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.qrData.trim()) {
      toast({ title: 'Name and QR content required', variant: 'destructive' });
      return;
    }
    try {
      if (editing) {
        await updateQrCode(editing.id, form);
        toast({ title: 'QR updated', variant: 'success' });
      } else {
        await addQrCode(form);
        toast({ title: 'QR saved', variant: 'success' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteQrCode(confirmDeleteId);
      toast({ title: 'QR deleted', variant: 'success' });
    } finally { setConfirmDeleteId(null); }
  };

  if (qrCodes.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={QrIcon}
          title="QR Vault"
          subtitle="Save boarding passes, event tickets, UPI codes, and any QR you'll need later. Show them fullscreen at the counter — no fumbling through your inbox."
          accent="violet"
          badges={[{ label: 'Fullscreen scan mode' }, { label: 'Offline ready' }]}
          cta={{ label: 'Add QR code', onClick: openAdd, icon: Plus }}
        />
        <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">QR Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">{qrCodes.length} code{qrCodes.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search codes…" className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(q => {
          const Icon = CATEGORY_ICON[q.category] || QrIcon;
          const grad = CATEGORY_GRADIENT[q.category];
          return (
            <div key={q.id} className="glass-card p-4 flex gap-3">
              <button onClick={() => setFullscreenFor(q)} className="flex-shrink-0" title="View fullscreen">
                <MiniQr data={q.qrData} size={96} />
              </button>
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{q.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded bg-gradient-to-br ${grad}`}><Icon className="w-3 h-3 text-white" /></span>
                        <span className="truncate">{CATEGORY_LABEL[q.category]}</span>
                      </div>
                    </div>
                  </div>
                  {q.expiryDate && (
                    <div className="text-[10px] uppercase tracking-wider text-amber-300 mt-1">
                      Expires {new Date(q.expiryDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setFullscreenFor(q)} title="Fullscreen"><Maximize2 className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}><Edit className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(q.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!fullscreenFor} onOpenChange={(o) => !o && setFullscreenFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrIcon className="w-5 h-5" /> {fullscreenFor?.name}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col items-center gap-3 py-4">
              {fullscreenDataUrl ? (
                <img src={fullscreenDataUrl} alt="QR code" className="w-80 h-80 rounded-xl bg-white p-4" />
              ) : (
                <div className="w-80 h-80 rounded-xl bg-black/5 dark:bg-white/5" />
              )}
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Hold the screen up to the scanner at the counter.
              </p>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete QR?</AlertDialogTitle>
            <AlertDialogDescription>This QR code will be permanently removed.</AlertDialogDescription>
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
  editing: QrCode | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  submit: (e: React.FormEvent) => Promise<void>;
}) {
  const { isOpen, setIsOpen, editing, form, setForm, submit } = props;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit QR' : 'Add QR code'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus placeholder="IndiGo BLR-DEL · seat 12A" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v: any) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boarding_pass">Boarding pass</SelectItem>
                    <SelectItem value="event_ticket">Event ticket</SelectItem>
                    <SelectItem value="payment">Payment / UPI</SelectItem>
                    <SelectItem value="wifi">Wi-Fi</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                    <SelectItem value="contact">Contact (vCard)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiry date</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>QR content</Label>
                <Textarea value={form.qrData} onChange={e => setForm({ ...form, qrData: e.target.value })} rows={4} className="font-mono text-xs" required placeholder="Paste the URL, ticket payload, UPI string, etc." />
                <p className="text-[11px] text-muted-foreground mt-1">A QR code will be generated from this content. For Wi-Fi use the format WIFI:T:WPA;S:SSID;P:password;;</p>
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Add QR'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
