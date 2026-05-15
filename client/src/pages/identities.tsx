import { useState, useMemo } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, CheckCircle, Search, UserCircle, Mail, Phone, MapPin, FileText as FileTextIcon } from 'lucide-react';
import { IDENTITY_TYPES, type Identity } from '@shared/schema';
import { copyToClipboardSecure } from '@/native/clipboard';

function maskMiddle(value: string | undefined): string {
  if (!value) return '—';
  const v = value.trim();
  if (v.length <= 4) return '•'.repeat(v.length);
  return `${v.slice(0, 2)}${'•'.repeat(Math.max(0, v.length - 4))}${v.slice(-2)}`;
}

function fullName(i: Identity): string {
  return [i.firstName, i.middleName, i.lastName].filter(Boolean).join(' ') || i.title;
}

const TYPE_ICONS: Record<string, typeof UserCircle> = {
  passport: UserCircle,
  driver_license: UserCircle,
  national_id: UserCircle,
  ssn: FileTextIcon,
  tax_id: FileTextIcon,
  address: MapPin,
  contact: Phone,
  other: UserCircle,
};

const blank = (): Omit<Identity, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  type: 'other',
  firstName: '',
  middleName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  documentNumber: '',
  issuingCountry: '',
  issueDate: '',
  expiryDate: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  email: '',
  phone: '',
  notes: '',
});

export default function Identities() {
  const { identities, addIdentity, updateIdentity, deleteIdentity } = useVault();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<Identity | null>(null);
  const [formData, setFormData] = useState(blank());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<Identity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return identities;
    return identities.filter(i =>
      (i.title || '').toLowerCase().includes(q) ||
      (fullName(i)).toLowerCase().includes(q) ||
      (i.documentNumber || '').toLowerCase().includes(q) ||
      (i.email || '').toLowerCase().includes(q)
    );
  }, [identities, searchQuery]);

  const openAdd = () => {
    setEditing(null);
    setFormData(blank());
    setShowAddModal(true);
  };

  const openEdit = (i: Identity) => {
    setEditing(i);
    setFormData({
      title: i.title,
      type: i.type,
      firstName: i.firstName || '',
      middleName: i.middleName || '',
      lastName: i.lastName || '',
      dateOfBirth: i.dateOfBirth || '',
      gender: i.gender || '',
      documentNumber: i.documentNumber || '',
      issuingCountry: i.issuingCountry || '',
      issueDate: i.issueDate || '',
      expiryDate: i.expiryDate || '',
      addressLine1: i.addressLine1 || '',
      addressLine2: i.addressLine2 || '',
      city: i.city || '',
      state: i.state || '',
      postalCode: i.postalCode || '',
      country: i.country || '',
      email: i.email || '',
      phone: i.phone || '',
      notes: i.notes || '',
    });
    setShowAddModal(true);
    setDetail(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast({ title: 'Title required', description: 'Give this identity a name.', variant: 'destructive' });
      return;
    }
    try {
      if (editing?.id) {
        await updateIdentity(editing.id, formData);
        toast({ variant: 'success', title: 'Updated', description: 'Identity updated' });
      } else {
        await addIdentity(formData);
        toast({ variant: 'success', title: 'Saved', description: 'Identity saved' });
      }
      setShowAddModal(false);
    } catch {
      toast({ title: 'Error', description: 'Could not save identity', variant: 'destructive' });
    }
  };

  const copy = async (text: string, key: string, label: string) => {
    if (!text) return;
    const ok = await copyToClipboardSecure(text, { showToast: false });
    if (ok) {
      setCopiedKey(key);
      toast({ variant: 'success', title: 'Copied', description: `${label} copied — clears in 30s` });
      setTimeout(() => setCopiedKey(null), 2000);
    } else {
      toast({ title: 'Error', description: 'Copy failed', variant: 'destructive' });
    }
  };

  const toggleReveal = (key: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteIdentity(deleteId);
      toast({ variant: 'success', title: 'Deleted', description: 'Identity removed' });
      if (detail?.id === deleteId) setDetail(null);
    } catch {
      toast({ title: 'Error', description: 'Delete failed', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  // Sensitive field row used in the detail modal. Reveal / copy controls live
  // in here so they apply consistently to document number, SSN, etc.
  const SensitiveRow = ({ id, label, value }: { id: string; label: string; value: string | undefined }) => {
    if (!value) return null;
    const isVisible = revealed.has(id);
    return (
      <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="font-mono text-[14px] truncate">{isVisible ? value : maskMiddle(value)}</div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button type="button" onClick={() => toggleReveal(id)} className="p-1.5 rounded-lg hover:bg-muted">
            {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button type="button" onClick={() => copy(value, id, label)} className="p-1.5 rounded-lg hover:bg-muted">
            {copiedKey === id ? <CheckCircle size={15} className="text-primary" /> : <Copy size={15} className="text-muted-foreground" />}
          </button>
        </div>
      </div>
    );
  };

  const PlainRow = ({ id, label, value, icon: Icon }: { id: string; label: string; value: string | undefined; icon?: typeof Mail }) => {
    if (!value) return null;
    return (
      <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          {Icon && <Icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />}
          <div className="min-w-0">
            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
            <div className="text-[14px] truncate">{value}</div>
          </div>
        </div>
        <button type="button" onClick={() => copy(value, id, label)} className="p-1.5 rounded-lg hover:bg-muted flex-shrink-0">
          {copiedKey === id ? <CheckCircle size={15} className="text-primary" /> : <Copy size={15} className="text-muted-foreground" />}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Identities</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{identities.length} {identities.length === 1 ? 'identity' : 'identities'}</p>
        </div>
        <Button onClick={openAdd} size="sm" className="rounded-xl" data-testid="add-identity-button">
          <Plus className="w-4 h-4 mr-1" />
          Add Identity
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 w-4 h-4 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search identities..."
          className="pl-10 rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center" data-testid="identities-empty-state">
          <UserCircle className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 className="mt-3 text-sm font-semibold">No identities yet</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Store passports, licences, addresses, and other ID documents securely.
          </p>
          <Button onClick={openAdd} size="sm" className="mt-4 rounded-xl">
            <Plus className="w-4 h-4 mr-1" />
            Add Identity
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(i => {
            const Icon = TYPE_ICONS[i.type] || UserCircle;
            const typeLabel = IDENTITY_TYPES.find(t => t.value === i.type)?.label ?? 'Other';
            return (
              <button
                key={i.id}
                type="button"
                onClick={() => setDetail(i)}
                className="text-left rounded-2xl border border-border bg-card hover:bg-accent/30 transition-colors p-4 flex items-start gap-3"
                data-testid={`identity-${i.id}`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 ring-1 ring-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{i.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{fullName(i)}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{typeLabel}</span>
                    {i.documentNumber && <span className="font-mono text-[11px] text-muted-foreground">{maskMiddle(i.documentNumber)}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="truncate">{detail.title}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 ring-1 ring-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  {(() => {
                    const Icon = TYPE_ICONS[detail.type] || UserCircle;
                    return <Icon className="w-6 h-6 text-indigo-500" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{fullName(detail)}</div>
                  <div className="text-xs text-muted-foreground">
                    {IDENTITY_TYPES.find(t => t.value === detail.type)?.label}
                  </div>
                </div>
              </div>

              <SensitiveRow id={`${detail.id}-docnum`} label="Document Number" value={detail.documentNumber} />
              <PlainRow id={`${detail.id}-dob`} label="Date of Birth" value={detail.dateOfBirth} />
              <PlainRow id={`${detail.id}-issuer`} label="Issuing Country" value={detail.issuingCountry} />
              <div className="grid grid-cols-2 gap-2">
                <PlainRow id={`${detail.id}-issue`} label="Issue Date" value={detail.issueDate} />
                <PlainRow id={`${detail.id}-expiry`} label="Expiry Date" value={detail.expiryDate} />
              </div>

              <PlainRow id={`${detail.id}-email`} label="Email" value={detail.email} icon={Mail} />
              <PlainRow id={`${detail.id}-phone`} label="Phone" value={detail.phone} icon={Phone} />

              {(detail.addressLine1 || detail.city) && (
                <div className="rounded-xl bg-muted/50 px-4 py-3">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Address</div>
                  <div className="text-[14px] whitespace-pre-line">
                    {[
                      detail.addressLine1,
                      detail.addressLine2,
                      [detail.city, detail.state, detail.postalCode].filter(Boolean).join(', '),
                      detail.country,
                    ].filter(Boolean).join('\n')}
                  </div>
                </div>
              )}

              {detail.notes && (
                <div className="rounded-xl bg-muted/50 px-4 py-3">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Notes</div>
                  <div className="text-[14px] whitespace-pre-wrap">{detail.notes}</div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => openEdit(detail)} data-testid={`edit-identity-${detail.id}`}>
                  <Edit size={14} className="mr-1.5" /> Edit
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl text-destructive border-destructive/30" onClick={() => setDeleteId(detail.id)} data-testid={`delete-identity-${detail.id}`}>
                  <Trash2 size={14} className="mr-1.5" /> Delete
                </Button>
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Identity' : 'Add Identity'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="id-title">Title *</Label>
                <Input id="id-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="My Passport" data-testid="input-identity-title" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IDENTITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>First Name</Label>
                  <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Middle</Label>
                  <Input value={formData.middleName} onChange={(e) => setFormData({ ...formData, middleName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name</Label>
                  <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={formData.dateOfBirth} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Input value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Document Number</Label>
                <Input value={formData.documentNumber} onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })} className="font-mono" autoComplete="off" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Issuing Country</Label>
                  <Input value={formData.issuingCountry} onChange={(e) => setFormData({ ...formData, issuingCountry: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Expiry Date</Label>
                  <Input type="date" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Address line 1</Label>
                <Input value={formData.addressLine1} onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="City" />
                <Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} placeholder="State" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} placeholder="Postal code" />
                <Input value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} placeholder="Country" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 rounded-xl" data-testid="save-identity-button">{editing ? 'Save' : 'Add Identity'}</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this identity?</AlertDialogTitle>
            <AlertDialogDescription>Removes the identity from your vault. This cannot be undone.</AlertDialogDescription>
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
