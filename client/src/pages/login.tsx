import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, KeyRound, ArrowLeft } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { hasAccountCredentials, sha256 } from '@/lib/account-auth';

export default function Login() {
  const [, setLocation] = useLocation();
  const { accountLogin } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot-password flow state
  const [forgotStep, setForgotStep] = useState<'idle' | 'email' | 'code'>('idle');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const hasCredentials = hasAccountCredentials();

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.includes('@')) { setForgotError('Enter a valid email.'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (data.resetCode) {
        setResetCode(data.resetCode);
        setForgotStep('code');
      } else {
        setForgotError('No account found for that email.');
      }
    } catch {
      setForgotError('Network error. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotCode.trim().length < 6) { setForgotError('Enter the 6-character reset code.'); return; }
    if (resetNewPassword.length < 6) { setForgotError('New password must be at least 6 characters.'); return; }
    setForgotLoading(true); setForgotError('');
    try {
      const hash = await sha256(resetNewPassword);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, token: forgotCode.toUpperCase(), newPasswordHash: hash }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Password reset', description: 'Your password has been reset. Please log in.' });
        setForgotStep('idle');
        setEmail(forgotEmail);
        setForgotEmail(''); setForgotCode(''); setResetCode(''); setResetNewPassword('');
      } else {
        setForgotError(data.error || 'Invalid or expired code.');
      }
    } catch {
      setForgotError('Network error. Try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    try {
      const success = await accountLogin(email, password);
      if (success) {
        // Router will re-render and show vault picker (isAccountLoggedIn && !isUnlocked tier)
        // Navigate explicitly so wouter picks up the new route state
        setLocation('/');
      } else {
        setError('Incorrect email or password. Please try again.');
        toast({
          title: 'Login failed',
          description: 'Incorrect email or password.',
          variant: 'destructive',
        });
      }
    } catch {
      setError('An error occurred. Please try again.');
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
          No account?{' '}
          <Link href="/auth/signup">
            <a className="text-primary font-medium hover:underline">Sign up free</a>
          </Link>
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome back</h1>
            <p className="text-muted-foreground">
              {hasCredentials
                ? 'Sign in to access your vaults.'
                : 'Sign in with your account credentials.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Email */}
            <div>
              <Label htmlFor="account-email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="account-email"
                  data-testid="input-account-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Account Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label htmlFor="account-password" className="text-sm font-medium">
                  Account Password
                </Label>
                <Link href="/auth/signup">
                  <a
                    data-testid="link-forgot-password"
                    className="text-xs text-primary hover:underline cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      setForgotEmail(email);
                      setForgotStep('email');
                      setForgotError('');
                    }}
                  >
                    Forgot password?
                  </a>
                </Link>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="account-password"
                  data-testid="input-account-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your account password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="button-account-login"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          {/* Forgot password — step 1: enter email */}
          {forgotStep === 'email' && (
            <div className="mt-6 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setForgotStep('idle')} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="font-semibold text-sm">Reset your password</h2>
              </div>
              <form onSubmit={handleForgotRequest} className="space-y-3">
                {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
                <div>
                  <Label className="text-xs">Account email</Label>
                  <Input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 h-9 text-sm"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-9 text-sm" disabled={forgotLoading}>
                  {forgotLoading ? 'Generating…' : 'Get Reset Code'}
                </Button>
              </form>
            </div>
          )}

          {/* Forgot password — step 2: enter code + new password */}
          {forgotStep === 'code' && (
            <div className="mt-6 p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-3">
                <button onClick={() => setForgotStep('email')} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="font-semibold text-sm">Enter reset code</h2>
              </div>
              {resetCode && (
                <div className="mb-3 p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Your reset code (valid 1 hour):</p>
                  <p className="text-2xl font-mono font-bold tracking-widest text-primary">{resetCode}</p>
                </div>
              )}
              <form onSubmit={handleResetPassword} className="space-y-3">
                {forgotError && <p className="text-xs text-destructive">{forgotError}</p>}
                <div>
                  <Label className="text-xs">Reset code</Label>
                  <Input
                    value={forgotCode}
                    onChange={e => setForgotCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXX"
                    className="mt-1 h-9 text-sm font-mono tracking-widest"
                    maxLength={6}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">New password</Label>
                  <Input
                    type="password"
                    value={resetNewPassword}
                    onChange={e => setResetNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="mt-1 h-9 text-sm"
                    required
                  />
                </div>
                <Button type="submit" className="w-full h-9 text-sm" disabled={forgotLoading}>
                  {forgotLoading ? 'Resetting…' : 'Reset Password'}
                </Button>
              </form>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            New to IronVault?{' '}
            <Link href="/auth/signup">
              <a className="text-primary font-medium hover:underline">Create a free account</a>
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
