import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, KeyRound, MailCheck, Shield } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { hasAccountCredentials } from '@/lib/account-auth';
import { motionPresets } from '@/lib/design-system';

export default function Login() {
  const [, setLocation] = useLocation();
  const { accountLogin, verifyTwoFactor, cancelTwoFactor, pendingTwoFactor } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  const hasCredentials = hasAccountCredentials();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedEmail = (email || '').trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setIsLoading(true);
    try {
      const success = await accountLogin(trimmedEmail, password);
      if (success) {
        setLocation('/');
      } else if (!pendingTwoFactor) {
        // pendingTwoFactor is set synchronously inside accountLogin before it
        // resolves, so by this point we can distinguish wrong-password from
        // 2FA-required. (React batches the state update but the closure value
        // we read here was captured at render time — re-reading it after await
        // gets the latest committed value.)
        setError('Incorrect email or password. Please try again.');
        toast({
          title: 'Login failed',
          description: 'Incorrect email or password.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_NOT_VERIFIED') {
        setEmailNotVerified(true);
      } else if (err instanceof Error && err.message === 'SERVER_UNREACHABLE_2FA') {
        setError('Cannot reach the server. Two-factor authentication is required for this account, so offline sign-in is disabled. Please try again when you are online.');
        toast({
          title: 'Server unreachable',
          description: 'Two-factor authentication is required — offline sign-in is disabled for this account.',
          variant: 'destructive',
        });
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // After accountLogin resolves false, decide between "wrong password" and
  // "2FA challenge issued". The hook value updates synchronously in the same
  // tick, so the next render sees pendingTwoFactor !== null in the success case.
  // Reset transient state when leaving the 2FA branch.
  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError('');
    if (twoFactorCode.replace(/\s|-/g, '').length < 6) {
      setTwoFactorError('Enter the 6-digit code from your authenticator app, or a backup code.');
      return;
    }
    setTwoFactorLoading(true);
    try {
      const ok = await verifyTwoFactor(twoFactorCode);
      if (ok) {
        setTwoFactorCode('');
        setLocation('/');
      } else {
        setTwoFactorError('Invalid or expired code. Try again.');
      }
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleTwoFactorCancel = () => {
    cancelTwoFactor();
    setTwoFactorCode('');
    setTwoFactorError('');
    setPassword('');
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendSent(true);
    } catch {
      // ignore
    } finally {
      setResendLoading(false);
    }
  };

  if (pendingTwoFactor) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <Link href="/"><a className="flex items-center gap-2"><AppLogo size={28} /><span className="font-bold text-lg">IronVault</span></a></Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Two-Factor Authentication</h1>
              <p className="text-muted-foreground">
                Enter the 6-digit code from your authenticator app to finish signing in.
              </p>
            </div>

            <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
              {twoFactorError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
                  {twoFactorError}
                </div>
              )}
              <div>
                <Label htmlFor="two-factor-code" className="text-sm font-medium">
                  Verification Code
                </Label>
                <Input
                  id="two-factor-code"
                  data-testid="input-two-factor-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  className="mt-1.5 text-center text-2xl tracking-widest font-mono"
                  maxLength={20}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1.5 text-center">
                  Lost access to your authenticator? Enter a backup code instead.
                </p>
              </div>
              <Button
                type="submit"
                data-testid="button-two-factor-submit"
                className="w-full h-11 text-base font-semibold"
                disabled={twoFactorLoading}
              >
                {twoFactorLoading ? 'Verifying…' : 'Verify & Sign In'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleTwoFactorCancel}
                className="w-full"
              >
                Use a different account
              </Button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  if (emailNotVerified) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <Link href="/"><a className="flex items-center gap-2"><AppLogo size={28} /><span className="font-bold text-lg">IronVault</span></a></Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <MailCheck className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Verify your email</h1>
            <p className="text-muted-foreground mb-6">
              Your account is registered but your email hasn't been verified yet. Please check your inbox for a verification link.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Sent to: <span className="font-medium text-foreground">{email}</span>
            </p>
            {resendSent ? (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">Verification email resent! Check your inbox.</p>
            ) : (
              <Button
                onClick={handleResend}
                disabled={resendLoading}
                variant="outline"
                className="w-full h-11"
              >
                {resendLoading ? 'Sending…' : 'Resend verification email'}
              </Button>
            )}
            <button
              onClick={() => { setEmailNotVerified(false); setResendSent(false); }}
              className="mt-4 text-sm text-primary hover:underline block w-full text-center"
            >
              Back to login
            </button>
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
          No account?{' '}
          <Link href="/auth/signup">
            <a className="text-primary font-medium hover:underline">Sign up free</a>
          </Link>
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 relative">
        {/* ambient gradient backdrop — pure decorative, sits behind everything */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[620px] rounded-full bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-transparent blur-3xl" />
          <div className="absolute -bottom-32 right-0 h-[320px] w-[480px] rounded-full bg-gradient-to-tr from-emerald-400/15 to-transparent blur-3xl" />
        </div>
        <motion.div
          {...motionPresets.scaleIn}
          className="w-full max-w-sm glass-card p-8 relative"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.08, type: 'spring', stiffness: 320, damping: 22 }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 shadow-[0_8px_24px_-6px_rgba(16,185,129,0.55)]"
            >
              <KeyRound className="w-7 h-7 text-white" />
            </motion.div>
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
                <Link href="/auth/forgot-password">
                  <a
                    data-testid="link-forgot-password"
                    className="text-xs text-primary hover:underline"
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
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
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

          <p className="text-center text-sm text-muted-foreground mt-6">
            New to IronVault?{' '}
            <Link href="/auth/signup">
              <a className="text-primary font-medium hover:underline">Create a free account</a>
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
