import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { SUBSCRIPTION_CATEGORIES, SUBSCRIPTION_TYPES } from '@shared/schema';
import { useVault } from '@/contexts/vault-context';
import { useCurrency } from '@/contexts/currency-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AddSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSubscription?: any; // Subscription to edit, undefined for new subscription
}

export function AddSubscriptionModal({ open, onOpenChange, editingSubscription }: AddSubscriptionModalProps) {
  const { addSubscription, updateSubscription } = useVault();
  const { currencies, currency } = useCurrency();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: '',
    plan: '',
    cost: '',
    currency: currency, // Use user's selected currency as default
    billingCycle: 'monthly' as 'monthly' | 'yearly' | 'weekly' | 'daily',
    nextBillingDate: undefined as Date | undefined,
    reminderDays: '7',
    category: '',
    notes: '',
    // Enhanced fields
    subscriptionType: 'other' as 'streaming' | 'software' | 'cloud' | 'gaming' | 'news' | 'fitness' | 'productivity' | 'security' | 'education' | 'other',
    credentials: {
      username: '',
      email: '',
      accountId: '',
      password: '',
    },
    platformLink: '',
    expiryDate: undefined as Date | undefined,
    autoRenew: true,
  });
  
  // Update form data when editingSubscription changes
  React.useEffect(() => {
    if (editingSubscription) {
      setFormData({
        name: editingSubscription.name || '',
        plan: editingSubscription.plan || '',
        cost: editingSubscription.cost?.toString() || '',
        currency: editingSubscription.currency || 'USD',
        billingCycle: editingSubscription.billingCycle || 'monthly',
        nextBillingDate: editingSubscription.nextBillingDate ? new Date(editingSubscription.nextBillingDate) : undefined,
        reminderDays: editingSubscription.reminderDays?.toString() || '7',
        category: editingSubscription.category || '',
        notes: editingSubscription.notes || '',
        // Enhanced fields
        subscriptionType: editingSubscription.subscriptionType || 'other',
        credentials: editingSubscription.credentials || { username: '', email: '', accountId: '', password: '' },
        platformLink: editingSubscription.platformLink || '',
        expiryDate: editingSubscription.expiryDate ? new Date(editingSubscription.expiryDate) : undefined,
        autoRenew: editingSubscription.autoRenew !== undefined ? editingSubscription.autoRenew : true,
      });
    } else {
      setFormData({
        name: '',
        plan: '',
        cost: '',
        currency: currency, // Use user's selected currency
        billingCycle: 'monthly',
        nextBillingDate: undefined,
        reminderDays: '7',
        category: '',
        notes: '',
        // Enhanced fields
        subscriptionType: 'other',
        credentials: { username: '', email: '', accountId: '', password: '' },
        platformLink: '',
        expiryDate: undefined,
        autoRenew: true,
      });
    }
  }, [editingSubscription, currency]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.cost || !formData.nextBillingDate) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const cost = parseFloat(formData.cost);
    if (isNaN(cost) || cost <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid cost",
        variant: "destructive",
      });
      return;
    }

    const reminderDays = parseInt(formData.reminderDays);
    if (isNaN(reminderDays) || reminderDays < 0) {
      toast({
        title: "Error",
        description: "Please enter a valid reminder days",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSubscription) {
        await updateSubscription(editingSubscription.id, {
          name: formData.name,
          plan: formData.plan || undefined,
          cost,
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          nextBillingDate: formData.nextBillingDate,
          reminderDays,
          category: formData.category || undefined,
          notes: formData.notes || undefined,
          isActive: editingSubscription.isActive,
          // Enhanced fields
          subscriptionType: formData.subscriptionType,
          credentials: formData.credentials.username || formData.credentials.email || formData.credentials.accountId || formData.credentials.password ? formData.credentials : undefined,
          platformLink: formData.platformLink || undefined,
          expiryDate: formData.expiryDate,
          autoRenew: formData.autoRenew,
        });
        toast({
          title: "Updated",
          description: "Subscription updated successfully",
        });
      } else {
        await addSubscription({
          name: formData.name,
          plan: formData.plan || undefined,
          cost,
          currency: formData.currency,
          billingCycle: formData.billingCycle,
          nextBillingDate: formData.nextBillingDate,
          reminderDays,
          category: formData.category || undefined,
          notes: formData.notes || undefined,
          isActive: true,
          // Enhanced fields
          subscriptionType: formData.subscriptionType,
          credentials: formData.credentials.username || formData.credentials.email || formData.credentials.accountId || formData.credentials.password ? formData.credentials : undefined,
          platformLink: formData.platformLink || undefined,
          expiryDate: formData.expiryDate,
          autoRenew: formData.autoRenew,
        });
        
        toast({
          title: "Success",
          description: "Subscription saved successfully",
        });
        
        // Reset form only for new subscriptions
        setFormData({
          name: '',
          plan: '',
          cost: '',
          currency: 'USD',
          billingCycle: 'monthly',
          nextBillingDate: undefined,
          reminderDays: '7',
          category: '',
          notes: '',
          // Enhanced fields
          subscriptionType: 'other',
          credentials: { username: '', email: '', accountId: '', password: '' },
          platformLink: '',
          expiryDate: undefined,
          autoRenew: true,
        });
      }
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: editingSubscription ? "Failed to update subscription" : "Failed to save subscription",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90svh] overflow-y-auto" data-testid="add-subscription-modal">
        <DialogHeader>
          <DialogTitle>{editingSubscription ? 'Edit Subscription' : 'Add New Subscription'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service-name">Service Name *</Label>
            <Input
              id="service-name"
              placeholder="e.g., Netflix, Spotify, Adobe"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              data-testid="input-service-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Plan/Package Name</Label>
            <Input
              id="plan"
              placeholder="e.g., Premium, Pro, Basic"
              value={formData.plan}
              onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
              data-testid="input-plan"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cost">Cost *</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="9.99"
                value={formData.cost}
                onChange={(e) => setFormData(prev => ({ ...prev, cost: e.target.value }))}
                required
                data-testid="input-cost"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger data-testid="select-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      <div className="flex items-center gap-2">
                        <span>{curr.flag}</span>
                        <span>{curr.code} ({curr.symbol})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing-cycle">Billing Cycle</Label>
            <Select
              value={formData.billingCycle}
              onValueChange={(value: 'monthly' | 'yearly' | 'weekly' | 'daily') => 
                setFormData(prev => ({ ...prev, billingCycle: value }))
              }
            >
              <SelectTrigger data-testid="select-billing-cycle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Next Billing Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.nextBillingDate && "text-muted-foreground"
                  )}
                  data-testid="billing-date-trigger"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.nextBillingDate ? (
                    format(formData.nextBillingDate, "PPP")
                  ) : (
                    "Pick a date"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.nextBillingDate}
                  onSelect={(date) => setFormData(prev => ({ ...prev, nextBillingDate: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reminder-days">Reminder Days</Label>
            <Input
              id="reminder-days"
              type="number"
              min="0"
              placeholder="7"
              value={formData.reminderDays}
              onChange={(e) => setFormData(prev => ({ ...prev, reminderDays: e.target.value }))}
              data-testid="input-reminder-days"
            />
            <p className="text-xs text-muted-foreground">
              How many days before billing date to remind you
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="resize-none"
              data-testid="textarea-notes"
            />
          </div>

          {/* Enhanced Fields */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-foreground">Additional Details</h3>
            
            {/* Subscription Type */}
            <div className="space-y-2">
              <Label htmlFor="subscription-type">Subscription Type</Label>
              <Select
                value={formData.subscriptionType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, subscriptionType: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select subscription type" />
                </SelectTrigger>
                <SelectContent>
                  {SUBSCRIPTION_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform Link */}
            <div className="space-y-2">
              <Label htmlFor="platform-link">Platform Link (Optional)</Label>
              <Input
                id="platform-link"
                type="url"
                placeholder="https://example.com"
                value={formData.platformLink}
                onChange={(e) => setFormData(prev => ({ ...prev, platformLink: e.target.value }))}
                data-testid="input-platform-link"
              />
            </div>

            {/* Credentials Section */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Credentials (Optional)</Label>
              
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm">Username</Label>
                <Input
                  id="username"
                  placeholder="Your username"
                  value={formData.credentials.username}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    credentials: { ...prev.credentials, username: e.target.value }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.credentials.email}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    credentials: { ...prev.credentials, email: e.target.value }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-id" className="text-sm">Account ID</Label>
                <Input
                  id="account-id"
                  placeholder="Account ID or reference"
                  value={formData.credentials.accountId}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    credentials: { ...prev.credentials, accountId: e.target.value }
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subscription-password" className="text-sm">Password</Label>
                <div className="relative">
                  <Input
                    id="subscription-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Account password"
                    value={formData.credentials.password}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      credentials: { ...prev.credentials, password: e.target.value }
                    }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label htmlFor="expiry-date">Expiry Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.expiryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.expiryDate ? format(formData.expiryDate, "PPP") : "Select expiry date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.expiryDate}
                    onSelect={(date) => setFormData(prev => ({ ...prev, expiryDate: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Auto Renew */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auto-renew"
                checked={formData.autoRenew}
                onChange={(e) => setFormData(prev => ({ ...prev, autoRenew: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="auto-renew" className="text-sm font-normal">
                Auto-renew subscription
              </Label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              data-testid="cancel-button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting}
              data-testid="save-subscription-button"
            >
              {isSubmitting ? "Saving..." : (editingSubscription ? "Update Subscription" : "Save Subscription")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
