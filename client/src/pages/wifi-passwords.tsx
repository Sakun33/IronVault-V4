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
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, Search, Wifi, QrCode as QrIcon, Share2 } from 'lucide-react';
import type { WifiPassword } from '@shared/schema';
import { copyToClipboardSecure } from '@/native/clipboard';
import { PageHero } from '@/components/page-hero';
import { PremiumCard, PremiumIcon } from '@/components/premium-card';
import { Favicon } from '@/components/favicon';
import { ShareItemModal } from '@/components/share-item-modal';

// Encode WPA/WEP credentials into the standard Wi-Fi QR payload format.
function escapeWifi(v: string): string {
  return v.replace(/[\\;,:"]/g, ch => `\\${ch}`);
}
function buildWifiQr(item: WifiPassword): string {
  const t = item.securityType === 'Open' ? 'nopass' : item.securityType === 'WEP' ? 'WEP' : 'WPA';
  const s = escapeWifi(item.networkName || '');
  const p = item.securityType === 'Open' ? '' : escapeWifi(item.password || '');
  return `WIFI:T:${t};S:${s};P:${p};;`;
}

const blank = (): Omit<WifiPassword, 'id' | 'createdAt' | 'updatedAt'> => ({
  networkName: '',
  password: '',
  securityType: 'WPA2',
  location: '',
  router: '',
  frequency: undefined,
  notes: '',
});

export default function WifiPasswordsPage() {
  const { wifiPasswords, addWifiPassword, updateWifiPassword, deleteWifiPassword } = useVault();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<WifiPassword | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [showPasswordIds, setShowPasswordIds] = useState<Set<string>>(new Set());
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<WifiPassword | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [sharing, setSharing] = useState<WifiPassword | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wifiPasswords;
    return wifiPasswords.filter(w =>
      w.networkName.toLowerCase().includes(q) ||
      (w.location || '').toLowerCase().includes(q) ||
      (w.router || '').toLowerCase().includes(q)
    );
  }, [wifiPasswords, query]);

  useEffect(() => {
    if (!qrFor) { setQrDataUrl(''); return; }
    QRCode.toDataURL(buildWifiQr(qrFor), { width: 480, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [qrFor]);

  const togglePassword = (id: string) => {
    setShowPasswordIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboardSecure(text);
    toast({ title: ok ? `${label} copied` : 'Copy failed', variant: ok ? 'success' : 'destructive' });
  };

  const openAdd = () => { setEditing(null); setForm(blank()); setShowFormPassword(false); setIsOpen(true); };
  const openEdit = (w: WifiPassword) => {
    setEditing(w);
    setForm({
      networkName: w.networkName, password: w.password, securityType: w.securityType,
      location: w.location || '', router: w.router || '',
      frequency: w.frequency, notes: w.notes || '',
    });
    setShowFormPassword(false);
    setIsOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.networkName.trim()) {
      toast({ title: 'Network name required', variant: 'destructive' });
      return;
    }
    try {
      if (editing) {
        await updateWifiPassword(editing.id, form);
        toast({ title: 'Network updated', variant: 'success' });
      } else {
        await addWifiPassword(form);
        toast({ title: 'Network saved', variant: 'success' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteWifiPassword(confirmDeleteId);
      toast({ title: 'Network deleted', variant: 'success' });
    } finally { setConfirmDeleteId(null); }
  };

  if (wifiPasswords.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Wifi}
          title="Wi-Fi Vault"
          subtitle="Save Wi-Fi credentials and share them as a QR code in one tap. Friends and guests can connect without typing a single character."
          accent="sky"
          badges={[
            { label: 'Encrypted' },
            { label: 'QR Sharing' },
          ]}
          cta={{ label: 'Add Wi-Fi network', onClick: openAdd, icon: Plus, testId: 'wifi-add-cta' }}
        />
        <AddEditDialog
          isOpen={isOpen} setIsOpen={setIsOpen} editing={editing}
          form={form} setForm={setForm}
          showFormPassword={showFormPassword} setShowFormPassword={setShowFormPassword}
          submit={submit}
        />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Wi-Fi Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">{wifiPasswords.length} network{wifiPasswords.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search networks…" className="pl-9" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(w => (
          <PremiumCard key={w.id} accent="sky" className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                {/* Router brand favicon if recognisable (eero, ASUS, Netgear…), Wi-Fi glyph fallback */}
                {w.router ? (
                  <Favicon name={w.router} className="w-11 h-11 rounded-2xl" />
                ) : (
                  <PremiumIcon accent="sky"><Wifi className="w-5 h-5" /></PremiumIcon>
                )}
                <div className="min-w-0">
                  <div className="font-semibold truncate">{w.networkName}</div>
                  <div className="text-xs text-muted-foreground truncate">{w.location || w.securityType}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setQrFor(w)} title="Share via QR"><QrIcon className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSharing(w)} title="Share link"><Share2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(w)} title="Edit"><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(w.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={showPasswordIds.has(w.id) ? w.password : '•'.repeat(Math.min(16, w.password.length || 8))}
                readOnly
                type="text"
                className="font-mono text-sm bg-black/[0.03] dark:bg-white/[0.04] border-0"
              />
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => togglePassword(w.id)} title="Reveal">
                {showPasswordIds.has(w.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => copy(w.password, 'Password')} title="Copy"><Copy className="w-4 h-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wider">
              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25">{w.securityType}</span>
              {w.frequency && <span className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/25">{w.frequency}</span>}
            </div>
          </PremiumCard>
        ))}
      </div>

      <Dialog open={!!qrFor} onOpenChange={(o) => !o && setQrFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrIcon className="w-5 h-5" /> Share "{qrFor?.networkName}"</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col items-center gap-3 py-4">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Wi-Fi QR code" className="w-72 h-72 rounded-xl bg-white p-3" />
              ) : (
                <div className="w-72 h-72 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-sm text-muted-foreground">Generating…</div>
              )}
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Open your phone camera and point it at this code — most modern phones auto-connect.
              </p>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ShareItemModal
        open={!!sharing}
        onOpenChange={(o) => !o && setSharing(null)}
        itemLabel={sharing?.networkName || 'Wi-Fi'}
        itemKind="wifi"
        data={sharing ? { networkName: sharing.networkName, password: sharing.password, securityType: sharing.securityType, location: sharing.location } : {}}
      />

      <AddEditDialog
        isOpen={isOpen} setIsOpen={setIsOpen} editing={editing}
        form={form} setForm={setForm}
        showFormPassword={showFormPassword} setShowFormPassword={setShowFormPassword}
        submit={submit}
      />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wi-Fi entry?</AlertDialogTitle>
            <AlertDialogDescription>This network will be permanently removed from your vault.</AlertDialogDescription>
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
  editing: WifiPassword | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  showFormPassword: boolean; setShowFormPassword: (v: boolean) => void;
  submit: (e: React.FormEvent) => Promise<void>;
}) {
  const { isOpen, setIsOpen, editing, form, setForm, showFormPassword, setShowFormPassword, submit } = props;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Wi-Fi' : 'Add Wi-Fi Network'}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="ssid">Network name (SSID)</Label>
              <Input id="ssid" value={form.networkName} onChange={e => setForm({ ...form, networkName: e.target.value })} required autoFocus />
            </div>
            <div>
              <Label htmlFor="wifi-pw">Password</Label>
              <div className="relative">
                <Input id="wifi-pw" type={showFormPassword ? 'text' : 'password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="pr-10" />
                <button type="button" onClick={() => setShowFormPassword(!showFormPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" tabIndex={-1}>
                  {showFormPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Security</Label>
                <Select value={form.securityType} onValueChange={(v: any) => setForm({ ...form, securityType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WPA2">WPA2</SelectItem>
                    <SelectItem value="WPA3">WPA3</SelectItem>
                    <SelectItem value="WEP">WEP</SelectItem>
                    <SelectItem value="Open">Open (no password)</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency || ''} onValueChange={(v: any) => setForm({ ...form, frequency: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2.4GHz">2.4 GHz</SelectItem>
                    <SelectItem value="5GHz">5 GHz</SelectItem>
                    <SelectItem value="Both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="loc">Location</Label>
                <Input id="loc" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Home, Office…" />
              </div>
              <div>
                <Label htmlFor="router">Router</Label>
                <Input id="router" value={form.router} onChange={e => setForm({ ...form, router: e.target.value })} placeholder="Eero, ASUS RT-AX86U…" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Add'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
