import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, KeyRound, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useToast } from '@/hooks/use-toast';
import { sha256 } from '@/lib/account-auth';

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Parse token and email from URL query params
  const params = new URLSearchParams(window.location.search);
  const tokenParam = params.get('token') || '';
  const emailParam = params.get('email') || '';

  const [email] = useState(emailParam);
  const [token] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token || !email) {
      setError('Invalid or missing reset link. Please request a new one.');
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setIsLoading(true);
    try {
      const hash = await sha256(newPassword);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, newPasswordHash: hash }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDone(true);
        toast({ title: 'Password updated', description: 'Your password has been reset successfully.' });
        setTimeout(() => setLocation('/auth/login'), 2500);
      } else {
        setError(data.error || 'Reset failed. The link may have expired — please request a new one.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <Link href="/">
          <a className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="font-bold text-lg">IronVault</span>
          </a>
        </Link>
        <Link href="/auth/login">
          <a className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to login
          </a>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">

          {done ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Password updated!</h1>
              <p className="text-muted-foreground">Redirecting you to login…</p>
            </div>
          ) : !token || !email ? (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Invalid reset link</h1>
              <p className="text-muted-foreground mb-6">This link is missing required information. Please request a new reset link.</p>
              <Link href="/auth/forgot-password">
                <a className="text-primary font-medium hover:underline">Request new reset link</a>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Set new password</h1>
                <p className="text-muted-foreground text-sm">
                  Resetting password for <strong className="text-foreground">{email}</strong>
                </p>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
                  {error}{' '}
                  {error.includes('expired') && (
                    <Link href="/auth/forgot-password">
                      <a className="underline font-medium">Request new link</a>
                    </Link>
                  )}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                  <div className="relative mt-1.5">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  aria-pressed={showNew}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                  <div className="relative mt-1.5">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirm}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                  {isLoading ? 'Resetting…' : 'Reset Password'}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                <Link href="/auth/forgot-password">
                  <a className="text-primary hover:underline">Request a new reset link</a>
                </Link>
              </p>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
