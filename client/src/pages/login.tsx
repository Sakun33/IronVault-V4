import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, KeyRound, MailCheck, Shield, Fingerprint, ScanFace } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { AppleSignInButton } from '@/components/apple-sign-in-button';
import { PasskeySignInButton } from '@/components/passkey-sign-in-button';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { hasAccountCredentials } from '@/lib/account-auth';
import { motionPresets } from '@/lib/design-system';
import { apiBase, isNativeApp } from '@/native/platform';
import {
  checkBiometricCapabilities,
  signInWithBiometric,
  hasAccountBiometricCredentials,
  getAccountBiometricEmail,
} from '@/native/biometrics';

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

  // Biometric sign-in state (native only). The button is shown when:
  //  (a) device biometry is available AND
  //  (b) Capacitor Preferences has at least one enrolled vault entry.
  // The email hint may have been wiped from localStorage on a WKWebView
  // storage purge — `rehydrateAccountEmail()` recovers it lazily on tap.
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<'Face ID' | 'Touch ID' | 'Fingerprint' | 'Biometric'>('Biometric');
  const [biometricIcon, setBiometricIcon] = useState<'face' | 'finger'>('finger');
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricEmailHint, setBiometricEmailHint] = useState<string | null>(null);

  const hasCredentials = hasAccountCredentials();

  // Pre-fill the email field from `?email=` (set by verify-email after
  // a successful click-through). Saves the user from retyping after
  // bouncing through their email client. Runs once on mount.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prefill = params.get('email');
      if (prefill) setEmail(prefill);
    } catch { /* noop */ }
  }, []);

  // Detect biometric availability on mount. Native only.
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    (async () => {
      try {
        const [caps, hasCreds] = await Promise.all([
          checkBiometricCapabilities(),
          hasAccountBiometricCredentials(),
        ]);
        if (cancelled) return;
        if (!caps.isAvailable || !hasCreds) {
          setBiometricAvailable(false);
          return;
        }
        setBiometricAvailable(true);
        setBiometricLabel(caps.biometricLabel);
        setBiometricIcon(
          caps.biometryType === 'faceId' || caps.biometryType === 'face' ? 'face' : 'finger',
        );
        // Surface the cached email hint immediately if present. (We don't
        // proactively prompt biometric to rehydrate — that happens on tap.)
        setBiometricEmailHint(getAccountBiometricEmail());
      } catch {
        if (!cancelled) setBiometricAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleBiometricSignIn = async () => {
    if (!isNativeApp() || biometricLoading) return;
    setBiometricLoading(true);
    setError('');
    try {
      // If the email hint was lost (WKWebView purge) try to rehydrate
      // it from the encrypted Preferences entry. This needs a biometric
      // prompt, so it's combined with the sign-in flow below — we only
      // proactively call it here if the next call wouldn't already prompt.
      const result = await signInWithBiometric();
      if (!result.success || !result.email || !result.password) {
        // Cancelled or failed — surface a soft message, NOT a full error UI.
        if (result.error && !/cancel/i.test(result.error)) {
          toast({
            title: `${biometricLabel} sign-in failed`,
            description: result.error,
            variant: 'destructive',
          });
        }
        return;
      }
      // Pre-fill the form so 2FA / wrong-password paths show the right email.
      setEmail(result.email);
      const loginResult = await accountLogin(result.email, result.password);
      if (loginResult === 'success') {
        // Re-stash the just-validated password so the post-unlock
        // BiometricSetupPrompt can re-enroll if Preferences was rotated.
        try { sessionStorage.setItem('iv_pending_bio_account_pw', result.password); } catch {}
        setLocation('/');
      } else if (loginResult === 'wrong_password') {
        // The stored biometric credential is stale (e.g. account password
        // was changed elsewhere). Tell the user to sign in with the typed
        // password — that path can re-enroll biometric afterwards.
        toast({
          title: 'Stored password is stale',
          description: 'Your account password changed. Sign in once with your password to re-enable biometric.',
          variant: 'destructive',
        });
        setError('Stored biometric password is stale. Please type your account password.');
        setBiometricAvailable(false);
      }
      // 'needs_2fa' — UI re-renders with pendingTwoFactor set, no action here.
    } catch (err) {
      console.error('[login] biometric sign-in failed:', err);
      toast({
        title: `${biometricLabel} sign-in failed`,
        description: 'Please try again or sign in with your password.',
        variant: 'destructive',
      });
    } finally {
      setBiometricLoading(false);
    }
  };

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
      const result = await accountLogin(trimmedEmail, password);
      if (result === 'success') {
        // Stash the just-validated password for the post-unlock enrollment
        // prompt to consume. Cleared by BiometricSetupPrompt or on logout.
        if (isNativeApp()) {
          try { sessionStorage.setItem('iv_pending_bio_account_pw', password); } catch {}
        }
        setLocation('/');
      } else if (result === 'wrong_password') {
        // Only show the error when the server actually rejected the
        // password. The 'needs_2fa' case sets pendingTwoFactor and pivots
        // the UI to the code prompt — it must NOT surface an error toast.
        setError('Incorrect email or password. Please try again.');
        toast({
          title: 'Login failed',
          description: 'Incorrect email or password.',
          variant: 'destructive',
        });
      }
      // result === 'needs_2fa' — UI re-renders with pendingTwoFactor set.
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
      await fetch(`${apiBase()}/api/auth/resend-verification`, {
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
        <header className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4 border-b border-border/50">
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
        <header className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4 border-b border-border/50">
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
      <header className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4 border-b border-border/50">
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

      <main className="flex-1 flex items-center justify-center px-4 py-10 relative gradient-mesh">
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
              className="btn-premium cta-tap-pulse w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4">
            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
              </div>
            </div>
            {/* Biometric Sign-In (native only). Requires a previously enrolled
                vault — without an entry in Capacitor Preferences this button
                stays hidden. Tapping prompts Face ID / Touch ID and signs in
                with the stored email + account password in one gesture. */}
            {isNativeApp() && biometricAvailable && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBiometricSignIn}
                disabled={biometricLoading || isLoading}
                data-testid="button-biometric-signin"
                className="w-full h-11 mb-2 gap-2 border-primary/30 hover:border-primary hover:bg-primary/5"
              >
                {biometricIcon === 'face'
                  ? <ScanFace className="w-5 h-5 text-primary" />
                  : <Fingerprint className="w-5 h-5 text-primary" />}
                <span className="font-medium">
                  {biometricLoading
                    ? `Signing in…`
                    : biometricEmailHint
                      ? `Sign in as ${biometricEmailHint} with ${biometricLabel}`
                      : `Sign in with ${biometricLabel}`}
                </span>
              </Button>
            )}
            <GoogleSignInButton label="Continue with Google" />
            <div className="mt-2">
              <AppleSignInButton label="Continue with Apple" />
            </div>
            <div className="mt-2">
              <PasskeySignInButton label="Sign in with passkey" email={email || undefined} />
            </div>
          </div>

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
