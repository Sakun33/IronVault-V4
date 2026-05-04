import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Eye, EyeOff, Mail, User, Globe, Phone, Building2, MapPin,
  Sparkles, Crown, Infinity, Users, KeyRound, MailCheck, ChevronRight,
} from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useToast } from '@/hooks/use-toast';
import { sha256 } from '@/lib/account-auth';
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
  const { toast } = useToast();

  // Stage 1 fields — account identity + security
  const [email, setEmail] = useState('');
  const [inviteId, setInviteId] = useState('');
  const [inviteMode, setInviteMode] = useState(false);
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

  const [company, setCompany] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv = params.get('invite');
    const invEmail = params.get('email');
    if (inv) {
      setInviteId(inv);
      setInviteMode(true);
      localStorage.setItem('pending_family_invite_id', inv);
      if (invEmail) {
        const decoded = decodeURIComponent(invEmail);
        setEmail(decoded);
        localStorage.setItem('pending_family_invite_email', decoded);
      }
    }
  }, []);

  const handleCountryChange = (code: string) => {
    setCountry(code);
    const c = COUNTRIES.find(x => x.code === code);
    if (c) setPhoneCode(c.phoneCode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (accountPassword.length < 8) { setError('Account password must be at least 8 characters.'); return; }
    if (accountPassword !== confirmAccountPassword) { setError('Account passwords do not match.'); return; }

    setIsLoading(true);
    try {
      const passwordHash = await sha256(accountPassword);
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          accountPasswordHash: passwordHash,
          fullName: name.trim(),
          country,
          phone: phone ? `${phoneCode}${phone}` : '',
          company: company.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: addressState.trim() || undefined,
          postalCode: postalCode.trim() || undefined,
          planType: selectedPlan,
          marketingConsent,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setError('An account with this email already exists. Please log in or use "Forgot Password" to reset it.');
        return;
      }
      if (!res.ok) {
        setError(data.error || 'Failed to create account. Please try again.');
        return;
      }

      // Store plan selection for later (after verification + login)
      localStorage.setItem('signup_selected_plan', selectedPlan);

      toast({
        title: 'Account created!',
        description: 'Check your email for a verification link.',
      });
      setEmailSent(true);
    } catch (err) {
      setError('Failed to create account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      setResendSent(true);
    } catch {
      // ignore
    } finally {
      setResendLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center px-6 py-4 border-b border-border/50">
          <Link href="/"><a className="flex items-center gap-2"><AppLogo size={28} /><span className="font-bold text-lg">IronVault</span></a></Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Check your inbox</h1>
            <p className="text-muted-foreground mb-2">
              We sent a verification link to:
            </p>
            <p className="font-semibold text-foreground mb-6">{email}</p>
            <p className="text-sm text-muted-foreground mb-6">
              Click the link in the email to activate your account, then come back to log in.
            </p>
            <Link href="/auth/login">
              <a className="block w-full">
                <Button className="w-full h-11">Go to Login</Button>
              </a>
            </Link>
            <div className="mt-4">
              {resendSent ? (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Email resent! Check your inbox.</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {resendLoading ? 'Sending…' : "Didn't receive it? Resend"}
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

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

      {/* Progress stepper — animated connecting line that fills as you advance */}
      <div className="flex items-center justify-center py-5 border-b border-border/30 bg-muted/10">
        <div className="flex items-center gap-3">
          {/* Step 1 — current */}
          <div className="flex items-center gap-1.5">
            <span className="relative w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-xs font-bold flex items-center justify-center shadow-[0_4px_14px_-2px_rgba(16,185,129,0.6)]">
              1
              <span aria-hidden className="absolute inset-0 rounded-full ring-2 ring-emerald-400/40 animate-pulse" />
            </span>
            <span className="text-sm font-medium text-foreground">Create account</span>
          </div>
          {/* Connector — fills the first half (step 1 active, step 2 pending) */}
          <div className="relative w-16 h-[3px] rounded-full overflow-hidden bg-border/50">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '50%' }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-teal-400"
            />
          </div>
          {/* Step 2 — pending */}
          <div className="flex items-center gap-1.5 opacity-60">
            <span className="w-7 h-7 rounded-full border-2 border-white/15 bg-white/[0.04] text-xs font-bold flex items-center justify-center text-muted-foreground">
              2
            </span>
            <span className="text-sm text-muted-foreground">Create vault</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{inviteMode ? 'Accept your family invite' : 'Create your account'}</h1>
            <p className="text-muted-foreground">{inviteMode ? 'Create a free account to join your family plan. No credit card required.' : 'Step 1 of 2 — Your account details. No credit card required.'}</p>
          </div>

          {inviteMode && (
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-3 mb-2 flex items-start gap-3">
              <Users className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <p className="text-sm text-indigo-700 dark:text-indigo-300">You've been invited to join a family plan. Sign up below — your account will be upgraded automatically.</p>
            </div>
          )}

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
                  onChange={e => !inviteMode && setEmail(e.target.value)}
                  className={`pl-10 ${inviteMode ? 'bg-muted text-muted-foreground' : ''}`}
                  required
                  autoComplete="email"
                  readOnly={inviteMode}
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

            {/* Company (optional) */}
            <div>
              <Label htmlFor="signup-company" className="text-sm font-medium">
                Company <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <div className="relative mt-1.5">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-company"
                  data-testid="signup-company"
                  type="text"
                  placeholder="Your company or organization"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="pl-10"
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

            {/* Billing Address (optional) */}
            <div className="border-t border-border/60 pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Billing Address <span className="font-normal normal-case">(optional)</span></p>
              <p className="text-xs text-muted-foreground mb-4">Used for invoices and receipts. All fields optional.</p>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="signup-address" className="text-sm font-medium">Address</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-address"
                      type="text"
                      placeholder="Street address"
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="signup-city" className="text-sm font-medium">City</Label>
                    <Input
                      id="signup-city"
                      type="text"
                      placeholder="City"
                      value={city}
                      onChange={e => setCity(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-state" className="text-sm font-medium">State</Label>
                    <Input
                      id="signup-state"
                      type="text"
                      placeholder="State / Province"
                      value={addressState}
                      onChange={e => setAddressState(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <div className="w-1/2 pr-1.5">
                  <Label htmlFor="signup-postal" className="text-sm font-medium">Postal Code</Label>
                  <Input
                    id="signup-postal"
                    type="text"
                    placeholder="PIN / ZIP"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>

            {/* Plan Selection — hidden in invite mode (plan set server-side on acceptance) */}
            {!inviteMode && <div>
              <Label className="text-sm font-medium mb-2 block">
                Choose your plan <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PLANS.filter(p => p.id !== 'pro_family_member').map(plan => {
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
            </div>}

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
                  aria-label={showAccountPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showAccountPassword}
                >
                  {showAccountPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Strength meter — appears as soon as the user starts typing */}
              {accountPassword.length > 0 && (() => {
                // Lightweight inline scoring; mirrors PasswordGenerator buckets
                // (weak/medium/strong) without pulling in the full module here.
                let score = 0;
                if (accountPassword.length >= 8) score += 25;
                if (accountPassword.length >= 12) score += 20;
                if (/[a-z]/.test(accountPassword)) score += 15;
                if (/[A-Z]/.test(accountPassword)) score += 15;
                if (/[0-9]/.test(accountPassword)) score += 15;
                if (/[^A-Za-z0-9]/.test(accountPassword)) score += 10;
                score = Math.min(100, score);
                const label = score < 40 ? 'Weak' : score < 70 ? 'Medium' : 'Strong';
                const color = score < 40 ? 'from-red-500 to-rose-400' : score < 70 ? 'from-amber-500 to-yellow-400' : 'from-emerald-500 to-teal-400';
                const labelColor = score < 40 ? 'text-red-400' : score < 70 ? 'text-amber-400' : 'text-emerald-400';
                return (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">Strength</span>
                      <span className={`text-[11px] font-medium ${labelColor}`}>{label}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        animate={{ width: `${Math.max(8, score)}%` }}
                        transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                        className={`h-full bg-gradient-to-r ${color}`}
                      />
                    </div>
                  </div>
                );
              })()}
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
                  aria-label={showConfirmAccountPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirmAccountPassword}
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
                onCheckedChange={v => { try { setMarketingConsent(v === true); } catch { /* ignore */ } }}
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
