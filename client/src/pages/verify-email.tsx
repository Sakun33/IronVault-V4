import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { AppLogo } from '@/components/app-logo';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email and try again.');
      return;
    }

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified! You can now log in.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. Please try again.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error. Please check your connection and try again.');
      });
  }, [token, email]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center px-6 py-4 border-b border-border/50">
        <Link href="/">
          <a className="flex items-center gap-2">
            <AppLogo size={28} />
            <span className="font-bold text-lg">IronVault</span>
          </a>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm text-center">
          {status === 'loading' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Verifying your email…</h1>
              <p className="text-muted-foreground">Please wait a moment.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Email verified!</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <Link href="/auth/login">
                <a className="block">
                  <Button className="w-full h-11">Log In Now</Button>
                </a>
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Verification failed</h1>
              <p className="text-muted-foreground mb-6">{message}</p>
              <Link href="/auth/signup">
                <a className="block">
                  <Button variant="outline" className="w-full h-11">Back to Sign Up</Button>
                </a>
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
