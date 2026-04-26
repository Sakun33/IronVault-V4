import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Calendar, DollarSign, Building2, TrendingUp } from 'lucide-react';
import { useVault } from '@/contexts/vault-context';
import { useCurrency } from '@/contexts/currency-context';
import { useLogging } from '@/contexts/logging-context';
import { useToast } from '@/hooks/use-toast';
import { INVESTMENT_TYPES } from '@shared/schema';

interface AddInvestmentModalProps {
  onInvestmentAdded?: () => void;
}

export function AddInvestmentModal({ onInvestmentAdded }: AddInvestmentModalProps) {
  const { addInvestment } = useVault();
  const { formatCurrency } = useCurrency();
  const { addLog } = useLogging();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    institution: '',
    ticker: '',
    purchaseDate: '',
    purchasePrice: '',
    quantity: '',
    currentPrice: '',
    notes: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.type || !formData.institution) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name, Type, Institution).",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
              const investmentData = {
                name: formData.name,
                type: formData.type as any,
                institution: formData.institution,
                ticker: formData.ticker || undefined,
                purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate) : new Date(),
                purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : 0,
                quantity: formData.quantity ? parseFloat(formData.quantity) : 1,
                currentPrice: formData.currentPrice ? parseFloat(formData.currentPrice) : 0,
                currency: 'USD',
                isActive: true,
                tags: [],
                fees: 0,
                notes: formData.notes || undefined
              };

      await addInvestment(investmentData);
      
      addLog('Investment added', 'system', `Added investment: ${formData.name}`);
      
      toast({
        title: "Investment Added",
        description: `Successfully added ${formData.name} to your portfolio.`,
      });

      // Reset form
      setFormData({
        name: '',
        type: '',
        institution: '',
        ticker: '',
        purchaseDate: '',
        purchasePrice: '',
        quantity: '',
        currentPrice: '',
        notes: ''
      });
      
      setIsOpen(false);
      onInvestmentAdded?.();
      
    } catch (error) {
      console.error('Failed to add investment:', error);
      addLog('Investment add failed', 'system', `Failed to add investment: ${formData.name}`);
      
      toast({
        title: "Error",
        description: "Failed to add investment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="flex items-center gap-2">
        <Plus className="w-4 h-4" />
        Add Investment
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[90svh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Add New Investment
          </h2>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            ×
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Investment Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., Apple Inc. (AAPL)"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="type">Investment Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => handleInputChange('type', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select investment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="institution">Institution/Platform *</Label>
                  <Input
                    id="institution"
                    value={formData.institution}
                    onChange={(e) => handleInputChange('institution', e.target.value)}
                    placeholder="e.g., E*TRADE, Fidelity, Coinbase"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ticker">Ticker Symbol</Label>
                  <Input
                    id="ticker"
                    value={formData.ticker}
                    onChange={(e) => handleInputChange('ticker', e.target.value.toUpperCase())}
                    placeholder="e.g., AAPL, TSLA, BTC"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Financial Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Financial Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleInputChange('purchaseDate', val);
                        if (val) {
                          const today = new Date().setHours(0, 0, 0, 0);
                          if (new Date(val).getTime() > today) {
                            toast({ title: 'Future date selected', description: 'Purchase dates are typically today or earlier.' });
                          }
                        }
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Purchase Price per Unit</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="purchasePrice"
                      type="number"
                      step="0.01"
                      value={formData.purchasePrice}
                      onChange={(e) => handleInputChange('purchasePrice', e.target.value)}
                      placeholder="0.00"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity/Units</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.000001"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="1"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="currentPrice">Current Price per Unit</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="currentPrice"
                      type="number"
                      step="0.01"
                      value={formData.currentPrice}
                      onChange={(e) => handleInputChange('currentPrice', e.target.value)}
                      placeholder="0.00"
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this investment..."
              rows={3}
              className="w-full p-2 border rounded-md"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Investment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
