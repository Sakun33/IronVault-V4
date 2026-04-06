import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, User, Sparkles, Phone, Globe, Crown, Zap, Infinity, Shield } from 'lucide-react';

const COUNTRIES = [
  { code: 'US', name: 'United States', phoneCode: '+1' },
  { code: 'GB', name: 'United Kingdom', phoneCode: '+44' },
  { code: 'CA', name: 'Canada', phoneCode: '+1' },
  { code: 'AU', name: 'Australia', phoneCode: '+61' },
  { code: 'DE', name: 'Germany', phoneCode: '+49' },
  { code: 'FR', name: 'France', phoneCode: '+33' },
  { code: 'IT', name: 'Italy', phoneCode: '+39' },
  { code: 'ES', name: 'Spain', phoneCode: '+34' },
  { code: 'JP', name: 'Japan', phoneCode: '+81' },
  { code: 'IN', name: 'India', phoneCode: '+91' },
  { code: 'BR', name: 'Brazil', phoneCode: '+55' },
  { code: 'MX', name: 'Mexico', phoneCode: '+52' },
  { code: 'NL', name: 'Netherlands', phoneCode: '+31' },
  { code: 'SE', name: 'Sweden', phoneCode: '+46' },
  { code: 'CH', name: 'Switzerland', phoneCode: '+41' },
  { code: 'SG', name: 'Singapore', phoneCode: '+65' },
  { code: 'HK', name: 'Hong Kong', phoneCode: '+852' },
  { code: 'NZ', name: 'New Zealand', phoneCode: '+64' },
  { code: 'IE', name: 'Ireland', phoneCode: '+353' },
  { code: 'PH', name: 'Philippines', phoneCode: '+63' },
];

const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Free',
    description: '50 passwords, 10 subscriptions, 10 notes, 5 documents',
    price: 'Free',
    icon: Sparkles,
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-200 dark:border-green-700',
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Unlimited storage with monthly or yearly billing',
    price: '₹149/mo',
    icon: Crown,
    color: 'text-blue-400',
    bgColor: 'bg-blue-50/50 dark:bg-blue-950/30',
    borderColor: 'border-blue-100 dark:border-blue-900',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    description: 'One-time payment, lifetime access',
    price: '₹9,999',
    icon: Infinity,
    color: 'text-amber-400',
    bgColor: 'bg-amber-50/50 dark:bg-amber-950/30',
    borderColor: 'border-amber-100 dark:border-amber-900',
  },
];

interface CustomerInfoDialogProps {
  open: boolean;
  onSubmit: (email: string, name: string, country: string, phone?: string, marketingConsent?: boolean, selectedPlan?: string, vaultName?: string) => void;
  isFirstVault?: boolean;
}

export function CustomerInfoDialog({ open, onSubmit, isFirstVault = true }: CustomerInfoDialogProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [vaultName, setVaultName] = useState('My Vault');
  const [country, setCountry] = useState('US');
  const [phoneCode, setPhoneCode] = useState('+1');
  const [phone, setPhone] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [error, setError] = useState('');

  const handleCountryChange = (countryCode: string) => {
    setCountry(countryCode);
    const selectedCountry = COUNTRIES.find(c => c.code === countryCode);
    if (selectedCountry) {
      setPhoneCode(selectedCountry.phoneCode);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setError('');
    onSubmit(email, name, country, phone, marketingConsent, selectedPlan, vaultName);
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">Welcome to IronVault!</DialogTitle>
          <DialogDescription className="text-center">
            Help us serve you better by sharing your details
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="customer-email" className="text-sm font-medium">
              Email Address <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-2">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className="pl-10"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              For important updates and support
            </p>
          </div>

          <div>
            <Label htmlFor="customer-name" className="text-sm font-medium">
              Full Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-2">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="customer-name"
                data-testid="input-customer-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="vault-name" className="text-sm font-medium">
              Vault Name <span className="text-red-500">*</span>
            </Label>
            <div className="relative mt-2">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="vault-name"
                data-testid="input-vault-name"
                type="text"
                placeholder="My Vault"
                value={vaultName}
                onChange={(e) => setVaultName(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Give your vault a memorable name
            </p>
          </div>

          <div>
            <Label htmlFor="customer-country" className="text-sm font-medium">
              Country <span className="text-red-500">*</span>
            </Label>
            <Select value={country} onValueChange={handleCountryChange}>
              <SelectTrigger data-testid="select-country" className="mt-2">
                <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="customer-phone" className="text-sm font-medium">
              Phone Number (optional)
            </Label>
            <div className="flex gap-2 mt-2">
              <div className="w-24">
                <Input
                  type="text"
                  value={phoneCode}
                  disabled
                  className="text-center font-medium bg-muted"
                />
              </div>
              <div className="relative flex-1">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="customer-phone"
                  data-testid="input-customer-phone"
                  type="tel"
                  placeholder="555 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium mb-3 block">
              Your Plan
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {SUBSCRIPTION_PLANS.map((plan) => {
                const Icon = plan.icon;
                const isSelected = selectedPlan === plan.id;
                return (
                  <button
                    type="button"
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? `${plan.borderColor} ${plan.bgColor} ring-2 ring-offset-2 ring-green-500`
                        : `${plan.borderColor} ${plan.bgColor} hover:opacity-90`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${plan.bgColor}`}>
                        <Icon className={`w-5 h-5 ${plan.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">{plan.name}</h4>
                          <span className={`text-sm font-bold ${plan.color}`}>{plan.price}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                        {isSelected && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-green-600" />
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              Selected
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start space-x-3 py-2">
            <Checkbox
              id="marketing-consent"
              data-testid="checkbox-marketing-consent"
              checked={marketingConsent}
              onCheckedChange={(checked) => setMarketingConsent(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="marketing-consent" className="text-sm cursor-pointer">
                Send me product updates and tips
              </Label>
              <p className="text-xs text-muted-foreground">
                You can unsubscribe at any time
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              Create My Vault
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Your data is stored securely and never shared with third parties
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
