import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, Heart, Loader2 } from 'lucide-react';
import { acceptCoupleInvite } from '@/lib/couple-api';

export default function CoupleAcceptPage() {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setError('No invitation token in URL.');
      setState('error');
      return;
    }
    acceptCoupleInvite(token)
      .then(() => setState('success'))
      .catch(e => {
        setError(e?.message || 'Acceptance failed.');
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
          <h1 className="text-2xl font-bold">Couple's Vault Invite</h1>
        </div>
        <Card className="rounded-2xl border bg-card/50 backdrop-blur-xl shadow-none">
          <CardContent className="py-8 px-6 text-center">
            {state === 'loading' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Accepting…</p>
              </div>
            )}
            {state === 'success' && (
              <div className="flex flex-col items-center gap-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <h2 className="text-lg font-semibold">You're paired!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The shared sections will appear in your IronVault once you sign in. If you don't have an account yet, create one with this email — the share will appear automatically.
                </p>
                <Button asChild className="mt-2">
                  <a href="/auth/login">Open IronVault</a>
                </Button>
              </div>
            )}
            {state === 'error' && (
              <div className="flex flex-col items-center gap-3">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
                <h2 className="text-lg font-semibold">Couldn't accept</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">
                  The invite may have already been accepted, expired, or revoked. Ask the inviter to re-send it.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
