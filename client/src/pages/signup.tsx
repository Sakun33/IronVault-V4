import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Eye, EyeOff, Mail, User, Globe, Phone,
  Sparkles, Crown, Infinity, Users, ChevronRight, KeyRound,
} from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { saveAccountCredentials, markOnboardingShown } from '@/lib/account-auth';
import { autoRegisterOnVaultCreation } from '@/lib/customer-registration';
import { PLANS, planPriceLabel } from '@/lib/plans';

const COUNTRIES = [
  { code: 'IN', name: 'India', phoneCode: '+91' },
  { code: 'US', name: 'United States', phoneCode: '+1' },
  { code: 'GB', name: 'United Kingdom', phoneCode: '+44' },
  { code: 'CA', name: 'Canada', phoneCode: '+1' },
  { code: 'AU', name: 'Australia', phoneCode: '+61' },
  { code: 'DE', name: 'Germany', phoneCode: '+49' },
  { code: 'FR', name: 'France', phoneCode: '+33' },
  { code: 'SG', name: 'Singapore', phoneCode: '+65' },
  { code: 'AE', name: 'UAE', phoneCode: '+971' },
  { code: 'BR', name: 'Brazil', phoneCode: '+55' },
  { code: 'JP', name: 'Japan', phoneCode: '+81' },
  { code: 'NL', name: 'Netherlands', phoneCode: '+31' },
  { code: 'SE', name: 'Sweden', phoneCode: '+46' },
  { code: 'CH', name: 'Switzerland', phoneCode: '+41' },
  { code: 'NZ', name: 'New Zealand', phoneCode: '+64' },
  { code: 'IE', name: 'Ireland', phoneCode: '+353' },
  { code: 'PH', name: 'Philippines', phoneCode: '+63' },
  { code: 'MX', name: 'Mexico', phoneCode: '+52' },
];

// Icon + style map for signup plan cards (supplements PLANS from plans.ts)
const PLAN_CARD_STYLE = {
  free:     { icon: Sparkles, color: 'text-green-600 dark:text-green-400',  ring: 'ring-green-500',  bg: 'bg-green-50 dark:bg-green-950/40',   border: 'border-green-200 dark:border-green-800' },
  pro:      { icon: Crown,    color: 'text-blue-500 dark:text-blue-400',    ring: 'ring-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-200 dark:border-blue-800' },
  family:   { icon: Users,    color: 'text-purple-500 dark:text-purple-400',ring: 'ring-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800' },
  lifetime: { icon: Infinity, color: 'text-amber-500 dark:text-amber-400',  ring: 'ring-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/40',   border: 'border-amber-200 dark:border-amber-800' },
} as const;

export default function SignupPage() {
  const [, setLocation] = useLocation();
  const { accountLogin } = useAuth();
  const { toast } = useToast();

  // Stage 1 fields — account identity + security
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [country, setCountry] = useState('IN');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('free');
  const [accountPassword, setAccountPassword] = useState('');
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('');
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showConfirmAccountPassword, setShowConfirmAccountPassword] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCountryChange = (code: string) => {
    setCountry(code);
    const c = COUNTRIES.find(x => x.code === code);
    if (c) setPhoneCode(c.phoneCode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (accountPassword.length < 8) { setError('Account password must be at least 8 characters.'); return; }
    if (accountPassword !== confirmAccountPassword) { setError('Account passwords do not match.'); return; }

    setIsLoading(true);
    try {
      // Stage 1: save account credentials + create session
      await saveAccountCredentials(email, accountPassword);
      markOnboardingShown();

      // Save customer profile
      const customerProfile = {
        email,
        name: name || email.split('@')[0],
        country: country || 'IN',
        phone: phone ? `${phoneCode}${phone}` : '',
        registeredAt: new Date().toISOString(),
        subscription: selectedPlan,
        trialActive: false,
        marketingConsent,
      };
      localStorage.setItem('customerProfile', JSON.stringify(customerProfile));

      // CRM registration (non-blocking)
      autoRegisterOnVaultCreation(
        email, name, country,
        phone ? `${phoneCode}${phone}` : '',
        marketingConsent, selectedPlan
      );

      // Log in to account session (sets isAccountLoggedIn in React state)
      await accountLogin(email, accountPassword);

      toast({
        title: 'Account Created!',
        description: selectedPlan === 'family' || selectedPlan === 'lifetime'
          ? 'Now create your vault. You can manage your subscription after.'
          : 'Now create your vault to get started.',
      });

      // Stage 2: redirect to vault creation
      // Plan-gated routing: non-free plans are routed to /upgrade after vault creation,
      // handled by create-vault.tsx. Store plan selection for reference.
      localStorage.setItem('signup_selected_plan', selectedPlan);
      setLocation('/auth/create-vault');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <Link href="/">
          <a className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="font-bold text-lg">IronVault</span>
          </a>
        </Link>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/auth/login">
            <a className="text-primary font-medium hover:underline">Log in</a>
          </Link>
        </p>
      </header>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-2 py-4 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">1</span>
          <span className="text-sm font-medium">Create account</span>
        </div>
        <div className="w-8 h-px bg-border" />
        <div className="flex items-center gap-1.5 opacity-50">
          <span className="w-6 h-6 rounded-full border-2 border-border text-xs font-bold flex items-center justify-center">2</span>
          <span className="text-sm">Create vault</span>
        </div>
      </div>

      {/* Form */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Create your account</h1>
            <p className="text-muted-foreground">Step 1 of 2 — Your account details. No credit card required.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <Label htmlFor="signup-email" className="text-sm font-medium">
                Email <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-email"
                  data-testid="signup-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Name */}
            <div>
              <Label htmlFor="signup-name" className="text-sm font-medium">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1.5">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-name"
                  data-testid="signup-name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            {/* Country + Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="signup-country" className="text-sm font-medium">
                  Country <span className="text-destructive">*</span>
                </Label>
                <Select value={country} onValueChange={handleCountryChange}>
                  <SelectTrigger id="signup-country" data-testid="signup-country" className="mt-1.5">
                    <Globe className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="signup-phone" className="text-sm font-medium">
                  Phone <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <div className="flex gap-1.5 mt-1.5">
                  <Input value={phoneCode} disabled className="w-16 text-center font-medium bg-muted shrink-0 px-2" />
                  <div className="relative flex-1">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-phone"
                      data-testid="signup-phone"
                      type="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Plan Selection */}
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Choose your plan <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.map(plan => {
                  const style = PLAN_CARD_STYLE[plan.id];
                  const Icon = style.icon;
                  const selected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      data-testid={`signup-plan-${plan.id}`}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all focus:outline-none ${
                        selected
                          ? `${style.border} ${style.bg} ring-2 ${style.ring} ring-offset-1`
                          : `border-border bg-card hover:bg-muted/50`
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-4 h-4 ${selected ? style.color : 'text-muted-foreground'}`} />
                        <span className={`font-semibold text-sm ${selected ? '' : 'text-foreground'}`}>{plan.name}</span>
                        {!plan.available && (
                          <span className="ml-auto text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Soon</span>
                        )}
                      </div>
                      <p className={`text-xs font-medium ${selected ? style.color : 'text-muted-foreground'}`}>{planPriceLabel(plan)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{plan.description}</p>
                    </button>
                  );
                })}
              </div>
              {(selectedPlan === 'family' || selectedPlan === 'lifetime') && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <ChevronRight className="w-3 h-3" />
                  After vault creation you'll be taken to manage your {selectedPlan} subscription.
                </p>
              )}
            </div>

            {/* Divider: Account Security */}
            <div className="border-t border-border/60 pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Account Password</p>
              <p className="text-xs text-muted-foreground mb-4">Used to log into your IronVault account. Keep separate from your vault master password.</p>
            </div>

            {/* Account Password */}
            <div>
              <Label htmlFor="signup-account-password" className="text-sm font-medium">
                Account Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-account-password"
                  data-testid="signup-account-password"
                  type={showAccountPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={accountPassword}
                  onChange={e => setAccountPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowAccountPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showAccountPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Account Password */}
            <div>
              <Label htmlFor="signup-confirm-account-password" className="text-sm font-medium">
                Confirm Account Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-confirm-account-password"
                  data-testid="signup-confirm-account-password"
                  type={showConfirmAccountPassword ? 'text' : 'password'}
                  placeholder="Re-enter your account password"
                  value={confirmAccountPassword}
                  onChange={e => setConfirmAccountPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmAccountPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmAccountPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Marketing consent */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="signup-marketing"
                data-testid="signup-marketing"
                checked={marketingConsent}
                onCheckedChange={v => setMarketingConsent(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="signup-marketing" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                Send me product updates and tips (you can unsubscribe anytime)
              </Label>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              data-testid="signup-submit"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Creating account…' : 'Continue to Vault Setup →'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              By signing up you agree to our{' '}
              <Link href="/terms"><a className="underline hover:text-foreground">Terms</a></Link>
              {' '}and{' '}
              <Link href="/privacy"><a className="underline hover:text-foreground">Privacy Policy</a></Link>.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
