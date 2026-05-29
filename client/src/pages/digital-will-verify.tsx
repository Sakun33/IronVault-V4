import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Heart, Loader2 } from 'lucide-react';
import { verifyBeneficiary } from '@/lib/digital-will-api';

export default function DigitalWillVerifyPage() {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setError('No verification token in URL.');
      setState('error');
      return;
    }
    verifyBeneficiary(token)
      .then(r => {
        setName(r.beneficiary.name);
        setState('success');
      })
      .catch(e => {
        setError(e?.message || 'Verification failed.');
        setState('error');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-rose-500/10 mb-3">
            <Heart className="w-7 h-7 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold">IronVault Digital Will</h1>
          <p className="text-sm text-muted-foreground mt-1">Beneficiary confirmation</p>
        </div>
        <Card className="rounded-2xl border bg-card/50 backdrop-blur-xl shadow-none">
          <CardContent className="py-8 px-6 text-center">
            {state === 'loading' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Verifying…</p>
              </div>
            )}
            {state === 'success' && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <h2 className="text-lg font-semibold">You're confirmed{name ? `, ${name}` : ''}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Thanks for accepting this role. If the dead-man's switch ever triggers, you'll receive an email with a time-limited link to access the encrypted vault data.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-2">You can close this window.</p>
                <Button asChild variant="outline" className="mt-2">
                  <a href="https://www.ironvault.app">Visit IronVault</a>
                </Button>
              </div>
            )}
            {state === 'error' && (
              <div className="flex flex-col items-center gap-3">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
                <h2 className="text-lg font-semibold">Couldn't verify</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  The link may have already been used, expired, or the beneficiary was removed. Ask the vault owner to re-send the invitation.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
