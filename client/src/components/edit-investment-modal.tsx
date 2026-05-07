import { useState, useEffect } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useLogging } from '@/contexts/logging-context';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/currency-context';
import { Investment, INVESTMENT_TYPES } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Save, Eye, Pencil } from 'lucide-react';

interface EditInvestmentModalProps {
  investment: Investment | null;
  isOpen: boolean;
  onClose: () => void;
  onInvestmentUpdated?: () => void;
  initialMode?: 'view' | 'edit';
}

type FormState = {
  name: string;
  type: string;
  institution: string;
  ticker: string;
  purchaseDate: string;
  purchasePrice: string;
  quantity: string;
  currentPrice: string;
  currency: string;
  interestRate: string;
  maturityDate: string;
  dividendYield: string;
  fees: string;
  notes: string;
  isActive: boolean;
};

function toDateInput(value: Date | string | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function emptyForm(): FormState {
  return {
    name: '',
    type: '',
    institution: '',
    ticker: '',
    purchaseDate: '',
    purchasePrice: '',
    quantity: '',
    currentPrice: '',
    currency: 'USD',
    interestRate: '',
    maturityDate: '',
    dividendYield: '',
    fees: '',
    notes: '',
    isActive: true,
  };
}

export function EditInvestmentModal({
  investment,
  isOpen,
  onClose,
  onInvestmentUpdated,
  initialMode = 'view',
}: EditInvestmentModalProps) {
  const { updateInvestment, deleteInvestment } = useVault();
  const { addLog } = useLogging();
  const { toast } = useToast();
  const { currency: appCurrency, currencies, formatCurrency } = useCurrency();

  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    if (!investment) return;
    setMode(initialMode);
    setForm({
      name: investment.name ?? '',
      type: investment.type ?? '',
      institution: investment.institution ?? '',
      ticker: investment.ticker ?? '',
      purchaseDate: toDateInput(investment.purchaseDate),
      purchasePrice: investment.purchasePrice?.toString() ?? '',
      quantity: investment.quantity?.toString() ?? '',
      currentPrice: investment.currentPrice?.toString() ?? '',
      currency: investment.currency || appCurrency || 'USD',
      interestRate: investment.interestRate?.toString() ?? '',
      maturityDate: toDateInput(investment.maturityDate),
      dividendYield: investment.dividendYield?.toString() ?? '',
      fees: investment.fees?.toString() ?? '',
      notes: investment.notes ?? '',
      isActive: investment.isActive !== false,
    });
  }, [investment, initialMode, appCurrency]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investment) return;

    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Name is required.', variant: 'destructive' });
      return;
    }
    if (!form.type) {
      toast({ title: 'Validation Error', description: 'Investment type is required.', variant: 'destructive' });
      return;
    }
    const purchasePriceNum = parseFloat(form.purchasePrice);
    if (!form.purchasePrice || isNaN(purchasePriceNum) || purchasePriceNum <= 0) {
      toast({ title: 'Validation Error', description: 'Purchase price must be a positive number.', variant: 'destructive' });
      return;
    }
    const quantityNum = parseFloat(form.quantity);
    if (!form.quantity || isNaN(quantityNum) || quantityNum <= 0) {
      toast({ title: 'Validation Error', description: 'Quantity must be a positive number.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const currentPriceNum = form.currentPrice ? parseFloat(form.currentPrice) : undefined;
      const updates: Partial<Investment> = {
        name: form.name.trim(),
        type: form.type as Investment['type'],
        institution: form.institution.trim() || undefined,
        ticker: form.ticker.trim() || undefined,
        purchaseDate: form.purchaseDate ? new Date(form.purchaseDate) : investment.purchaseDate,
        purchasePrice: purchasePriceNum,
        quantity: quantityNum,
        currentPrice: currentPriceNum,
        currentValue: currentPriceNum != null ? currentPriceNum * quantityNum : undefined,
        currency: form.currency || appCurrency || 'USD',
        interestRate: form.interestRate ? parseFloat(form.interestRate) : undefined,
        maturityDate: form.maturityDate ? new Date(form.maturityDate) : undefined,
        dividendYield: form.dividendYield ? parseFloat(form.dividendYield) : undefined,
        fees: form.fees ? parseFloat(form.fees) : 0,
        notes: form.notes.trim() || undefined,
        isActive: form.isActive,
        updatedAt: new Date(),
      };

      await updateInvestment(investment.id, updates);
      addLog('Investment updated', 'system', `Updated investment: ${updates.name}`);
      toast({ title: 'Investment Updated', description: `"${updates.name}" has been updated.` });
      onInvestmentUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to update investment:', error);
      addLog('Investment update failed', 'system', `Failed to update: ${form.name}`);
      toast({ title: 'Error', description: 'Failed to update investment. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!investment) return;
    setIsLoading(true);
    try {
      await deleteInvestment(investment.id);
      addLog('Investment deleted', 'system', `Deleted investment: ${investment.name}`);
      toast({ variant: 'success', title: 'Investment Deleted', description: `"${investment.name}" has been removed.` });
      setShowDeleteConfirm(false);
      onInvestmentUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to delete investment:', error);
      toast({ title: 'Error', description: 'Failed to delete investment.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!investment) return null;

  const typeInfo = INVESTMENT_TYPES.find((t) => t.value === investment.type);
  const totalInvested = investment.purchasePrice * investment.quantity;
  const currentValue = investment.currentValue ?? (investment.currentPrice ?? investment.purchasePrice) * investment.quantity;
  const gainLoss = currentValue - totalInvested;
  const returnPct = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;
  const investmentCurrency = investment.currency || appCurrency || 'USD';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{typeInfo?.icon ?? '📈'}</span>
              {mode === 'view' ? 'Investment Details' : 'Edit Investment'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'view'
                ? `Viewing details for ${investment.name}`
                : `Update details for ${investment.name}`}
            </DialogDescription>
          </DialogHeader>

          {mode === 'view' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground">Invested</p>
                  <p className="font-semibold">{formatCurrency(totalInvested, investmentCurrency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Value</p>
                  <p className="font-semibold">{formatCurrency(currentValue, investmentCurrency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gain / Loss</p>
                  <p className={`font-semibold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss, investmentCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Return</p>
                  <p className={`font-semibold ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <DetailRow label="Type" value={typeInfo?.label ?? investment.type} />
                <DetailRow label="Status" value={investment.isActive ? 'Active' : 'Inactive'} />
                <DetailRow label="Institution" value={investment.institution || '—'} />
                <DetailRow label="Ticker" value={investment.ticker || '—'} />
                <DetailRow label="Purchase Date" value={toDateInput(investment.purchaseDate) || '—'} />
                <DetailRow label="Purchase Price" value={formatCurrency(investment.purchasePrice, investmentCurrency)} />
                <DetailRow label="Quantity" value={investment.quantity.toString()} />
                <DetailRow
                  label="Current Price"
                  value={investment.currentPrice != null ? formatCurrency(investment.currentPrice, investmentCurrency) : '—'}
                />
                <DetailRow label="Currency" value={investmentCurrency} />
                <DetailRow label="Fees" value={investment.fees ? formatCurrency(investment.fees, investmentCurrency) : '—'} />
                {investment.interestRate != null && (
                  <DetailRow label="Interest Rate" value={`${investment.interestRate}%`} />
                )}
                {investment.dividendYield != null && (
                  <DetailRow label="Dividend Yield" value={`${investment.dividendYield}%`} />
                )}
                {investment.maturityDate && (
                  <DetailRow label="Maturity Date" value={toDateInput(investment.maturityDate) || '—'} />
                )}
              </div>

              {investment.notes && (
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="whitespace-pre-wrap">{investment.notes}</p>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="sm:mr-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Close
                </Button>
                <Button type="button" onClick={() => setMode('edit')}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="inv-name">Name *</Label>
                  <Input
                    id="inv-name"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-type">Type *</Label>
                  <Select value={form.type} onValueChange={(v) => setField('type', v)}>
                    <SelectTrigger id="inv-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.icon} {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-currency">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setField('currency', v)}>
                    <SelectTrigger id="inv-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c: { code: string; name: string; symbol: string; flag?: string }) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.flag ? `${c.flag} ` : ''}{c.symbol} {c.code} — {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-institution">Institution</Label>
                  <Input
                    id="inv-institution"
                    value={form.institution}
                    onChange={(e) => setField('institution', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-ticker">Ticker</Label>
                  <Input
                    id="inv-ticker"
                    value={form.ticker}
                    onChange={(e) => setField('ticker', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-purchase-date">Purchase Date</Label>
                  <Input
                    id="inv-purchase-date"
                    type="date"
                    value={form.purchaseDate}
                    onChange={(e) => setField('purchaseDate', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-quantity">Quantity *</Label>
                  <Input
                    id="inv-quantity"
                    type="number"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => setField('quantity', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-purchase-price">Purchase Price (per unit) *</Label>
                  <Input
                    id="inv-purchase-price"
                    type="number"
                    step="any"
                    value={form.purchasePrice}
                    onChange={(e) => setField('purchasePrice', e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-current-price">Current Price (per unit)</Label>
                  <Input
                    id="inv-current-price"
                    type="number"
                    step="any"
                    value={form.currentPrice}
                    onChange={(e) => setField('currentPrice', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-fees">Fees</Label>
                  <Input
                    id="inv-fees"
                    type="number"
                    step="any"
                    value={form.fees}
                    onChange={(e) => setField('fees', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-interest-rate">Interest Rate (%)</Label>
                  <Input
                    id="inv-interest-rate"
                    type="number"
                    step="any"
                    value={form.interestRate}
                    onChange={(e) => setField('interestRate', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-dividend-yield">Dividend Yield (%)</Label>
                  <Input
                    id="inv-dividend-yield"
                    type="number"
                    step="any"
                    value={form.dividendYield}
                    onChange={(e) => setField('dividendYield', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-maturity-date">Maturity Date</Label>
                  <Input
                    id="inv-maturity-date"
                    type="date"
                    value={form.maturityDate}
                    onChange={(e) => setField('maturityDate', e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="inv-status">Status</Label>
                  <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={(v) => setField('isActive', v === 'active')}>
                    <SelectTrigger id="inv-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="inv-notes">Notes</Label>
                  <Textarea
                    id="inv-notes"
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isLoading}
                  className="sm:mr-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
                <Button type="button" variant="outline" onClick={() => setMode('view')} disabled={isLoading}>
                  <Eye className="w-4 h-4 mr-2" /> View
                </Button>
                <Button type="submit" disabled={isLoading}>
                  <Save className="w-4 h-4 mr-2" />
                  {isLoading ? 'Saving…' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this investment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{investment.name}" from your portfolio. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isLoading}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLoading ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
