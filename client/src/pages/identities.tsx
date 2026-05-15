import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { useSubscription } from '@/hooks/use-subscription';
import { FeaturePreview } from '@/components/feature-preview';
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
import {
  Plus, Copy, Edit, Trash2, Eye, EyeOff, CheckCircle, Search, UserCircle, Mail,
  Phone, MapPin, FileText as FileTextIcon, Building2, Sparkles, Lock, Cloud, ShieldCheck,
} from 'lucide-react';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { PageHero } from '@/components/page-hero';
import { IDENTITY_TYPES, type Identity } from '@shared/schema';
import { copyToClipboardSecure } from '@/native/clipboard';

// Identity-type → visual treatment. Personal=violet, Work=blue, Custom=emerald.
// `tile` powers the gradient on each card; `ring` and `text` tint the type pill.
type IdentityTypeKey = 'personal' | 'work' | 'custom';
const TYPE_THEME: Record<IdentityTypeKey, {
  tile: string;
  ring: string;
  text: string;
  badgeBg: string;
  label: string;
  emoji: string;
  icon: typeof UserCircle;
}> = {
  personal: {
    tile:    'from-violet-600/90 via-purple-600/85 to-fuchsia-600/80',
    ring:    'ring-violet-400/30',
    text:    'text-violet-300',
    badgeBg: 'bg-violet-500/15',
    label:   'Personal',
    emoji:   '👤',
    icon:    UserCircle,
  },
  work: {
    tile:    'from-blue-600/90 via-sky-600/85 to-cyan-600/80',
    ring:    'ring-blue-400/30',
    text:    'text-blue-300',
    badgeBg: 'bg-blue-500/15',
    label:   'Work',
    emoji:   '💼',
    icon:    Building2,
  },
  custom: {
    tile:    'from-emerald-600/90 via-teal-600/85 to-cyan-600/80',
    ring:    'ring-emerald-400/30',
    text:    'text-emerald-300',
    badgeBg: 'bg-emerald-500/15',
    label:   'Custom',
    emoji:   '⭐',
    icon:    Sparkles,
  },
};

function resolveTheme(t: string | undefined): typeof TYPE_THEME[IdentityTypeKey] {
  const key = (t as IdentityTypeKey) || 'personal';
  return TYPE_THEME[key] ?? TYPE_THEME.custom;
}

function maskMiddle(value: string | undefined): string {
  if (!value) return '—';
  const v = value.trim();
  if (v.length <= 4) return '•'.repeat(v.length);
  return `${v.slice(0, 2)}${'•'.repeat(Math.max(0, v.length - 4))}${v.slice(-2)}`;
}

function fullName(i: Identity): string {
  return [i.firstName, i.middleName, i.lastName].filter(Boolean).join(' ') || i.title;
}

const blank = (): Omit<Identity, 'id' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  type: 'personal',
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
  const { isPro, isLoading: planLoading } = useSubscription();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<Identity | null>(null);
  const [formData, setFormData] = useState(blank());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<Identity | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Master-password gate — same pattern as /cards and /api-keys. Identity
  // document numbers (passport / SSN / driver's licence) are sensitive
  // enough to warrant a re-verification step on top of the vault unlock.
  const [isVerified, setIsVerified] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

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

  // Free-plan soft paywall. The teams.tsx / credit-cards.tsx pattern: render
  // FeaturePreview instead of the CRUD surface for free users. Guard placed
  // AFTER hooks so the hook order stays stable across renders.
  if (!planLoading && !isPro) {
    return (
      <FeaturePreview
        feature="Identities"
        description="Store passports, licences, addresses, and contact details in one encrypted vault — categorized Personal, Work, or Custom."
        bullets={[
          'Glassmorphism cards grouped by Personal / Work / Custom',
          'Sensitive fields masked by default with reveal + copy controls',
          'Document numbers, addresses, and contact info all in one place',
        ]}
        mock="api-keys"
      />
    );
  }

  // Master-password gate — re-verify before document numbers + addresses
  // render, even when the vault itself is unlocked.
  if (!isVerified) {
    return (
      <>
        <PageHero
          icon={UserCircle}
          title="Identities"
          subtitle="Passports, licences, and personal documents — verify your identity to unlock."
          badges={[
            { icon: <Lock className="w-3 h-3" />,        label: 'AES-256' },
            { icon: <ShieldCheck className="w-3 h-3" />, label: 'Master password gated' },
            { icon: <Cloud className="w-3 h-3" />,       label: 'Cloud synced' },
          ]}
          cta={{ label: 'Unlock with Master Password', icon: Lock, onClick: () => setShowVerifyModal(true), testId: 'identities-unlock-cta' }}
          accent="violet"
        />
        <VerifyAccessModal
          open={showVerifyModal}
          onOpenChange={setShowVerifyModal}
          onVerified={() => setIsVerified(true)}
          title="Unlock Identities"
          description="Enter your master password or use biometrics to view your saved identities."
        />
      </>
    );
  }

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

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Identities</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {identities.length} {identities.length === 1 ? 'identity' : 'identities'}
          </p>
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
            Store passports, licences, addresses, and contacts categorized by Personal, Work, or Custom.
          </p>
          <Button onClick={openAdd} size="sm" className="mt-4 rounded-xl">
            <Plus className="w-4 h-4 mr-1" />
            Add Identity
          </Button>
        </div>
      ) : (
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {filtered.map(i => {
            const theme = resolveTheme(i.type);
            const Icon = theme.icon;
            return (
              // motion.div handles the stagger animation; a plain inner button
              // owns the click handler. Earlier we used motion.button directly,
              // but the variants+layout combination ate the click in some
              // builds and the detail modal never opened — splitting them
              // makes click semantics deterministic.
              <motion.div
                key={i.id}
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="h-full"
              >
                <button
                  type="button"
                  onClick={() => setDetail(i)}
                  data-testid={`identity-${i.id}`}
                  className={`w-full h-full relative text-left rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-white/20 ring-1 ${theme.ring} p-4 transition-colors overflow-hidden group cursor-pointer`}
                >
                  {/* Brand gradient corner accent — non-interactive */}
                  <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${theme.tile} opacity-30 blur-2xl pointer-events-none`} aria-hidden />
                  <div className="relative flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${theme.tile} flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate text-foreground">{i.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{fullName(i)}</div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${theme.badgeBg} ${theme.text} font-medium inline-flex items-center gap-1`}>
                          <span aria-hidden>{theme.emoji}</span>
                          {theme.label}
                        </span>
                        {i.documentNumber && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {maskMiddle(i.documentNumber)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Detail modal */}
      {detail && (() => {
        const theme = resolveTheme(detail.type);
        const Icon = theme.icon;
        // Are any of the document fields present? Drives whether the Documents
        // section renders.
        const hasDocs = !!(detail.documentNumber || detail.issuingCountry || detail.issueDate || detail.expiryDate);
        const hasAddress = !!(detail.addressLine1 || detail.city || detail.country || detail.postalCode);
        const hasContact = !!(detail.email || detail.phone);
        const hasPersonal = !!(detail.firstName || detail.lastName || detail.middleName || detail.dateOfBirth || detail.gender);
        return (
          <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${theme.tile} flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/20`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="truncate flex-1">{detail.title}</span>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${theme.badgeBg} ${theme.text} font-medium flex-shrink-0 inline-flex items-center gap-1`}>
                    <span aria-hidden>{theme.emoji}</span>
                    {theme.label}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-4">
                {hasPersonal && (
                  <Section title="Personal Info">
                    <PlainRow id={`${detail.id}-name`} label="Full name" value={fullName(detail)} icon={UserCircle} copy={copy} copiedKey={copiedKey} />
                    <PlainRow id={`${detail.id}-dob`}  label="Date of birth" value={detail.dateOfBirth} copy={copy} copiedKey={copiedKey} />
                    <PlainRow id={`${detail.id}-gender`} label="Gender" value={detail.gender} copy={copy} copiedKey={copiedKey} />
                  </Section>
                )}

                {hasContact && (
                  <Section title="Contact">
                    <PlainRow id={`${detail.id}-email`} label="Email" value={detail.email} icon={Mail} copy={copy} copiedKey={copiedKey} />
                    <PlainRow id={`${detail.id}-phone`} label="Phone" value={detail.phone} icon={Phone} copy={copy} copiedKey={copiedKey} />
                  </Section>
                )}

                {hasAddress && (
                  <Section title="Address">
                    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm">
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">
                            Postal address
                          </div>
                          <div className="text-[14px] whitespace-pre-line">
                            {[
                              detail.addressLine1,
                              detail.addressLine2,
                              [detail.city, detail.state, detail.postalCode].filter(Boolean).join(', '),
                              detail.country,
                            ].filter(Boolean).join('\n')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const formatted = [
                              detail.addressLine1, detail.addressLine2,
                              [detail.city, detail.state, detail.postalCode].filter(Boolean).join(', '),
                              detail.country,
                            ].filter(Boolean).join(', ');
                            copy(formatted, `${detail.id}-addr`, 'Address');
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
                          aria-label="Copy address"
                        >
                          {copiedKey === `${detail.id}-addr`
                            ? <CheckCircle size={15} className="text-primary" />
                            : <Copy size={15} className="text-muted-foreground" />}
                        </button>
                      </div>
                    </div>
                  </Section>
                )}

                {hasDocs && (
                  <Section title="Documents">
                    <SensitiveRow id={`${detail.id}-docnum`} label="Document number" value={detail.documentNumber} revealed={revealed} toggleReveal={toggleReveal} copy={copy} copiedKey={copiedKey} />
                    <div className="grid grid-cols-2 gap-2">
                      <PlainRow id={`${detail.id}-issuer`} label="Issuer" value={detail.issuingCountry} copy={copy} copiedKey={copiedKey} compact />
                      <PlainRow id={`${detail.id}-issue`}  label="Issued" value={detail.issueDate} copy={copy} copiedKey={copiedKey} compact />
                    </div>
                    <PlainRow id={`${detail.id}-expiry`} label="Expires" value={detail.expiryDate} copy={copy} copiedKey={copiedKey} />
                  </Section>
                )}

                {detail.notes && (
                  <Section title="Notes">
                    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 backdrop-blur-sm">
                      <div className="text-[14px] whitespace-pre-wrap">{detail.notes}</div>
                    </div>
                  </Section>
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
        );
      })()}

      {/* Add/Edit modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Identity' : 'Add Identity'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="id-title">Title *</Label>
                <Input
                  id="id-title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Home, Office, Visa Application"
                  data-testid="input-identity-title"
                />
              </div>

              {/* Type picker — three big tinted tiles match the card visual */}
              <div className="space-y-1.5">
                <Label>Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {IDENTITY_TYPES.map(t => {
                    const theme = resolveTheme(t.value);
                    const Icon = theme.icon;
                    const active = formData.type === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: t.value })}
                        aria-pressed={active}
                        className={`relative rounded-xl border p-3 text-left transition-all overflow-hidden ${active ? `border-white/30 bg-gradient-to-br ${theme.tile} text-white shadow-lg` : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                        data-testid={`identity-type-${t.value}`}
                      >
                        <Icon className={`w-5 h-5 mb-1 ${active ? 'text-white' : 'text-muted-foreground'}`} />
                        <div className={`text-xs font-semibold ${active ? 'text-white' : 'text-foreground'}`}>{t.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <FormSection title="Personal Info">
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="First Name" value={formData.firstName} onChange={(v) => setFormData({ ...formData, firstName: v })} />
                  <FormField label="Middle"     value={formData.middleName} onChange={(v) => setFormData({ ...formData, middleName: v })} />
                  <FormField label="Last Name"  value={formData.lastName}   onChange={(v) => setFormData({ ...formData, lastName: v })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Date of Birth" type="date" value={formData.dateOfBirth} onChange={(v) => setFormData({ ...formData, dateOfBirth: v })} />
                  <FormField label="Gender" value={formData.gender} onChange={(v) => setFormData({ ...formData, gender: v })} />
                </div>
              </FormSection>

              <FormSection title="Contact">
                <FormField label="Email" type="email" value={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} />
                <FormField label="Phone" value={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} />
              </FormSection>

              <FormSection title="Address">
                <FormField label="Address line 1" value={formData.addressLine1} onChange={(v) => setFormData({ ...formData, addressLine1: v })} />
                <FormField label="Address line 2" value={formData.addressLine2} onChange={(v) => setFormData({ ...formData, addressLine2: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="City"   value={formData.city}   onChange={(v) => setFormData({ ...formData, city: v })} />
                  <FormField label="State"  value={formData.state}  onChange={(v) => setFormData({ ...formData, state: v })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Postal code" value={formData.postalCode} onChange={(v) => setFormData({ ...formData, postalCode: v })} />
                  <FormField label="Country"     value={formData.country}    onChange={(v) => setFormData({ ...formData, country: v })} />
                </div>
              </FormSection>

              <FormSection title="Documents">
                <FormField label="Document number" value={formData.documentNumber} onChange={(v) => setFormData({ ...formData, documentNumber: v })} mono autoComplete="off" />
                <div className="grid grid-cols-2 gap-2">
                  <FormField label="Issuer / Country" value={formData.issuingCountry} onChange={(v) => setFormData({ ...formData, issuingCountry: v })} />
                  <FormField label="Issue date" type="date" value={formData.issueDate} onChange={(v) => setFormData({ ...formData, issueDate: v })} />
                </div>
                <FormField label="Expiry date" type="date" value={formData.expiryDate} onChange={(v) => setFormData({ ...formData, expiryDate: v })} />
              </FormSection>

              <div className="space-y-1.5">
                <Label htmlFor="id-notes">Notes</Label>
                <Textarea id="id-notes" rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 rounded-xl" data-testid="save-identity-button">
                  {editing ? 'Save' : 'Add Identity'}
                </Button>
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

// ── Sub-components (defined outside the page component so React doesn't
// remount the whole subtree on every parent state change) ──────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium px-1">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium border-t border-white/5 pt-3">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FormField({
  label, value, onChange, type, mono, autoComplete,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type ?? 'text'}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? 'font-mono' : undefined}
        autoComplete={autoComplete}
      />
    </div>
  );
}

function PlainRow({
  id, label, value, icon: Icon, copy, copiedKey, compact,
}: {
  id: string;
  label: string;
  value: string | undefined;
  icon?: typeof Mail;
  copy: (text: string, key: string, label: string) => void;
  copiedKey: string | null;
  compact?: boolean;
}) {
  if (!value) return null;
  return (
    <div className={`rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex items-center justify-between gap-2 ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
      <div className="min-w-0 flex items-start gap-2">
        {Icon && <Icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="text-[14px] truncate">{value}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => copy(value, id, label)}
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
        aria-label={`Copy ${label}`}
      >
        {copiedKey === id
          ? <CheckCircle size={15} className="text-primary" />
          : <Copy size={15} className="text-muted-foreground" />}
      </button>
    </div>
  );
}

function SensitiveRow({
  id, label, value, revealed, toggleReveal, copy, copiedKey,
}: {
  id: string;
  label: string;
  value: string | undefined;
  revealed: Set<string>;
  toggleReveal: (key: string) => void;
  copy: (text: string, key: string, label: string) => void;
  copiedKey: string | null;
}) {
  if (!value) return null;
  const isVisible = revealed.has(id);
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm px-4 py-3 flex items-center justify-between gap-2">
      <div className="min-w-0 flex items-start gap-2">
        <FileTextIcon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
          <div className="font-mono text-[14px] truncate">{isVisible ? value : maskMiddle(value)}</div>
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => toggleReveal(id)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-pressed={isVisible}
          aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
        >
          {isVisible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button
          type="button"
          onClick={() => copy(value, id, label)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label={`Copy ${label}`}
        >
          {copiedKey === id
            ? <CheckCircle size={15} className="text-primary" />
            : <Copy size={15} className="text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}
