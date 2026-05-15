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
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, CheckCircle, CreditCard as CardIcon, Search } from 'lucide-react';
import { CREDIT_CARD_BRANDS, type CreditCard } from '@shared/schema';
import { copyToClipboardSecure } from '@/native/clipboard';

const BRAND_GRADIENTS: Record<string, string> = {
  visa:       'from-blue-700 via-blue-600 to-blue-500',
  mastercard: 'from-orange-600 via-red-500 to-yellow-500',
  amex:       'from-slate-700 via-slate-600 to-slate-500',
  discover:   'from-orange-500 via-amber-500 to-yellow-500',
  rupay:      'from-emerald-700 via-green-600 to-lime-500',
  diners:     'from-zinc-800 via-zinc-700 to-zinc-600',
  jcb:        'from-indigo-700 via-purple-600 to-fuchsia-500',
  unionpay:   'from-red-700 via-rose-600 to-pink-500',
  other:      'from-gray-800 via-gray-700 to-gray-600',
};

const DEFAULT_COLORS = ['#1f2937', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

function maskNumber(num: string | undefined): string {
  if (!num) return '•••• •••• •••• ••••';
  const digits = num.replace(/\D/g, '');
  if (digits.length <= 4) return `•••• •••• •••• ${digits.padStart(4, '•')}`;
  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

function formatGroups(num: string): string {
  return num.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
}

const blank = (): Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt'> => ({
  cardName: '',
  cardholderName: '',
  cardNumber: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
  brand: 'other',
  type: 'credit',
  color: DEFAULT_COLORS[0],
  pin: '',
  notes: '',
  billingZip: '',
});

export default function CreditCards() {
  const { creditCards, addCreditCard, updateCreditCard, deleteCreditCard } = useVault();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [formData, setFormData] = useState(blank());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<CreditCard | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return creditCards;
    return creditCards.filter(c =>
      (c.cardName || '').toLowerCase().includes(q) ||
      (c.cardholderName || '').toLowerCase().includes(q) ||
      (c.brand || '').toLowerCase().includes(q)
    );
  }, [creditCards, searchQuery]);

  const openAdd = () => {
    setEditing(null);
    setFormData(blank());
    setShowAddModal(true);
  };

  const openEdit = (card: CreditCard) => {
    setEditing(card);
    setFormData({
      cardName: card.cardName,
      cardholderName: card.cardholderName,
      cardNumber: card.cardNumber,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cvv: card.cvv || '',
      brand: card.brand,
      type: card.type,
      color: card.color || DEFAULT_COLORS[0],
      pin: card.pin || '',
      notes: card.notes || '',
      billingZip: card.billingZip || '',
    });
    setShowAddModal(true);
    setDetail(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cardName.trim() || !formData.cardholderName.trim() || !formData.cardNumber.trim()
        || !formData.expiryMonth || !formData.expiryYear) {
      toast({ title: 'Missing fields', description: 'Name, cardholder, number, and expiry are required.', variant: 'destructive' });
      return;
    }
    try {
      if (editing?.id) {
        await updateCreditCard(editing.id, formData);
        toast({ variant: 'success', title: 'Updated', description: 'Card updated' });
      } else {
        await addCreditCard(formData);
        toast({ variant: 'success', title: 'Saved', description: 'Card saved' });
      }
      setShowAddModal(false);
    } catch {
      toast({ title: 'Error', description: 'Could not save card', variant: 'destructive' });
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

  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteCreditCard(deleteId);
      toast({ variant: 'success', title: 'Deleted', description: 'Card removed' });
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Cards</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{creditCards.length} {creditCards.length === 1 ? 'card' : 'cards'}</p>
        </div>
        <Button onClick={openAdd} size="sm" className="rounded-xl" data-testid="add-card-button">
          <Plus className="w-4 h-4 mr-1" />
          Add Card
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 w-4 h-4 pointer-events-none" />
        <Input
          type="text"
          placeholder="Search cards..."
          className="pl-10 rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center" data-testid="cards-empty-state">
          <CardIcon className="w-10 h-10 mx-auto text-muted-foreground/60" />
          <h3 className="mt-3 text-sm font-semibold">No cards yet</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first card to store it securely with the rest of your vault.
          </p>
          <Button onClick={openAdd} size="sm" className="mt-4 rounded-xl">
            <Plus className="w-4 h-4 mr-1" />
            Add Card
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(card => {
            const isVisible = revealed.has(card.id);
            const grad = BRAND_GRADIENTS[card.brand] ?? BRAND_GRADIENTS.other;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setDetail(card)}
                className={`relative aspect-[1.586/1] rounded-2xl text-left text-white shadow-lg overflow-hidden bg-gradient-to-br ${grad} ring-1 ring-white/10`}
                style={card.color ? { backgroundImage: `linear-gradient(135deg, ${card.color}, ${card.color}cc)` } : undefined}
                data-testid={`card-${card.id}`}
              >
                <div className="absolute inset-0 p-4 flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div className="text-[11px] uppercase tracking-widest opacity-80">{card.type}</div>
                    <div className="text-xs font-semibold uppercase opacity-90">{card.brand}</div>
                  </div>
                  <div>
                    <div className="font-mono text-base tracking-widest mb-2">
                      {isVisible ? formatGroups(card.cardNumber) : maskNumber(card.cardNumber)}
                    </div>
                    <div className="flex items-center justify-between text-[11px] opacity-90">
                      <div>
                        <div className="opacity-75">CARDHOLDER</div>
                        <div className="font-medium uppercase truncate max-w-[140px]">{card.cardholderName}</div>
                      </div>
                      <div className="text-right">
                        <div className="opacity-75">EXPIRES</div>
                        <div className="font-medium tabular-nums">{card.expiryMonth.padStart(2, '0')}/{card.expiryYear.slice(-2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="absolute top-2 right-12 flex gap-1">
                  <span
                    onClick={(e) => { e.stopPropagation(); toggleReveal(card.id); }}
                    className="p-1.5 rounded-md bg-black/30 hover:bg-black/50 transition-colors cursor-pointer"
                    aria-label="Toggle number visibility"
                  >
                    {isVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{detail.cardName}</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-3">
              <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Card Number</div>
                  <div className="font-mono text-[14px] truncate">
                    {revealed.has(detail.id) ? formatGroups(detail.cardNumber) : maskNumber(detail.cardNumber)}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => toggleReveal(detail.id)} className="p-1.5 rounded-lg hover:bg-muted">
                    {revealed.has(detail.id) ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  <button type="button" onClick={() => copy(detail.cardNumber, `${detail.id}-num`, 'Card number')} className="p-1.5 rounded-lg hover:bg-muted">
                    {copiedKey === `${detail.id}-num` ? <CheckCircle size={15} className="text-primary" /> : <Copy size={15} className="text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-muted/50 px-3 py-2.5">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Expiry</div>
                  <div className="text-[14px] font-medium tabular-nums">{detail.expiryMonth.padStart(2, '0')}/{detail.expiryYear}</div>
                </div>
                {detail.cvv && (
                  <div className="rounded-xl bg-muted/50 px-3 py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">CVV</div>
                      <div className="font-mono text-[14px]">{revealed.has(`${detail.id}-cvv`) ? detail.cvv : '•••'}</div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setRevealed(prev => {
                        const next = new Set(prev);
                        const k = `${detail.id}-cvv`;
                        if (next.has(k)) next.delete(k); else next.add(k);
                        return next;
                      })} className="p-1 rounded-md hover:bg-muted">
                        {revealed.has(`${detail.id}-cvv`) ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button type="button" onClick={() => copy(detail.cvv!, `${detail.id}-cvv-copy`, 'CVV')} className="p-1 rounded-md hover:bg-muted">
                        {copiedKey === `${detail.id}-cvv-copy` ? <CheckCircle size={13} className="text-primary" /> : <Copy size={13} className="text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Cardholder</div>
                  <div className="text-[14px] truncate">{detail.cardholderName}</div>
                </div>
                <button type="button" onClick={() => copy(detail.cardholderName, `${detail.id}-name`, 'Cardholder')} className="p-1.5 rounded-lg hover:bg-muted">
                  {copiedKey === `${detail.id}-name` ? <CheckCircle size={15} className="text-primary" /> : <Copy size={15} className="text-muted-foreground" />}
                </button>
              </div>

              {detail.pin && (
                <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">PIN</div>
                    <div className="font-mono text-[14px]">{revealed.has(`${detail.id}-pin`) ? detail.pin : '••••'}</div>
                  </div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => setRevealed(prev => {
                      const next = new Set(prev);
                      const k = `${detail.id}-pin`;
                      if (next.has(k)) next.delete(k); else next.add(k);
                      return next;
                    })} className="p-1.5 rounded-lg hover:bg-muted">
                      {revealed.has(`${detail.id}-pin`) ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button type="button" onClick={() => copy(detail.pin!, `${detail.id}-pin-copy`, 'PIN')} className="p-1.5 rounded-lg hover:bg-muted">
                      {copiedKey === `${detail.id}-pin-copy` ? <CheckCircle size={15} className="text-primary" /> : <Copy size={15} className="text-muted-foreground" />}
                    </button>
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
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => openEdit(detail)} data-testid={`edit-card-${detail.id}`}>
                  <Edit size={14} className="mr-1.5" /> Edit
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl text-destructive border-destructive/30" onClick={() => setDeleteId(detail.id)} data-testid={`delete-card-${detail.id}`}>
                  <Trash2 size={14} className="mr-1.5" /> Delete
                </Button>
              </div>
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Card' : 'Add Card'}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="cc-name">Card Nickname *</Label>
                <Input id="cc-name" value={formData.cardName} onChange={(e) => setFormData({ ...formData, cardName: e.target.value })} placeholder="HDFC Platinum" data-testid="input-card-name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-cardholder">Cardholder Name *</Label>
                <Input id="cc-cardholder" value={formData.cardholderName} onChange={(e) => setFormData({ ...formData, cardholderName: e.target.value })} placeholder="JOHN DOE" data-testid="input-cardholder" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-number">Card Number *</Label>
                <Input id="cc-number" value={formData.cardNumber} onChange={(e) => setFormData({ ...formData, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 19) })} placeholder="•••• •••• •••• ••••" inputMode="numeric" className="font-mono" data-testid="input-card-number" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cc-month">Month *</Label>
                  <Input id="cc-month" value={formData.expiryMonth} onChange={(e) => setFormData({ ...formData, expiryMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="MM" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-year">Year *</Label>
                  <Input id="cc-year" value={formData.expiryYear} onChange={(e) => setFormData({ ...formData, expiryYear: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="YYYY" inputMode="numeric" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cc-cvv">CVV</Label>
                  <Input id="cc-cvv" value={formData.cvv} onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="•••" inputMode="numeric" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Brand</Label>
                  <Select value={formData.brand} onValueChange={(v) => setFormData({ ...formData, brand: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CREDIT_CARD_BRANDS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="debit">Debit</SelectItem>
                      <SelectItem value="prepaid">Prepaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {DEFAULT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c })}
                      className={`w-7 h-7 rounded-lg border-2 transition-transform ${formData.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Set card color to ${c}`}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-notes">Notes</Label>
                <Textarea id="cc-notes" rows={2} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 rounded-xl" data-testid="save-card-button">{editing ? 'Save' : 'Add Card'}</Button>
              </div>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>Removes the card from your vault. This cannot be undone.</AlertDialogDescription>
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
