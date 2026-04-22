import { useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'sent' | 'devcode'>('email');
  const [email, setEmail] = useState('');
  const [resetLink, setResetLink] = useState('');
  const [devCode, setDevCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      if (data.emailSent) {
        setStep('sent');
      } else if (data.resetCode) {
        // SMTP not configured — show dev fallback with reset link
        setDevCode(data.resetCode);
        setResetLink(data.resetLink || `/auth/reset-password?token=${data.resetCode}&email=${encodeURIComponent(email)}`);
        setStep('devcode');
      } else {
        // Email doesn't exist — still show "sent" to avoid enumeration
        setStep('sent');
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

          {step === 'email' && (
            <>
              <div className="text-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-7 h-7 text-primary" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Reset Password</h1>
                <p className="text-muted-foreground">Enter your account email and we'll send you a reset link.</p>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="reset-email" className="text-sm font-medium">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="reset-email"
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
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                  {isLoading ? 'Sending…' : 'Send Reset Link'}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Remember your password?{' '}
                <Link href="/auth/login">
                  <a className="text-primary font-medium hover:underline">Sign in</a>
                </Link>
              </p>
            </>
          )}

          {step === 'sent' && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Check your email</h1>
              <p className="text-muted-foreground mb-6">
                We sent a password reset link to <strong className="text-foreground">{email}</strong>.
                Check your inbox and follow the link to set a new password.
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Didn't receive it? Check your spam folder, or{' '}
                <button
                  onClick={() => { setStep('email'); setError(''); }}
                  className="text-primary hover:underline"
                >
                  try again
                </button>.
              </p>
              <Link href="/auth/login">
                <a className="text-sm text-primary font-medium hover:underline flex items-center justify-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to login
                </a>
              </Link>
            </div>
          )}

          {step === 'devcode' && (
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                <KeyRound className="w-7 h-7 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Reset link generated</h1>
              <p className="text-muted-foreground mb-4 text-sm">
                Email sending is not configured yet. Use the link below to reset your password directly.
              </p>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-left">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Reset code (expires in 1 hour)</p>
                <p className="text-2xl font-mono font-bold tracking-widest text-amber-500">{devCode}</p>
              </div>
              <Link href={resetLink}>
                <a className="block w-full text-center bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg h-11 leading-[2.75rem] font-semibold text-sm">
                  Continue to Reset Password →
                </a>
              </Link>
              <p className="text-center text-sm text-muted-foreground mt-4">
                <Link href="/auth/login">
                  <a className="text-primary hover:underline">Back to login</a>
                </Link>
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
