import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, AlertTriangle, Loader2, Download, ShieldCheck } from 'lucide-react';
import { fetchWillAccess } from '@/lib/digital-will-api';

export default function DigitalWillAccessPage() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [beneficiary, setBeneficiary] = useState<{ name: string; email: string } | null>(null);
  const [vault, setVault] = useState<any>(null);
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setError('No access token in URL.');
      setState('error');
      return;
    }
    fetchWillAccess(token)
      .then(r => {
        setBeneficiary(r.beneficiary);
        setVault(r.vault);
        setExpiresAt(r.expiresAt);
        setState('ready');
      })
      .catch(e => {
        setError(e?.message || 'Access failed.');
        setState('error');
      });
  }, []);

  const downloadBlob = () => {
    if (!vault) return;
    const data = JSON.stringify(vault, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ironvault-inheritance-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-2xl bg-rose-500/10 mb-3">
            <Heart className="w-7 h-7 text-rose-500" />
          </div>
          <h1 className="text-2xl font-bold">IronVault Inheritance Access</h1>
          <p className="text-sm text-muted-foreground mt-1">Secure download of vault data</p>
        </div>
        <Card className="rounded-2xl border bg-card/50 backdrop-blur-xl shadow-none">
          <CardContent className="py-8 px-6">
            {state === 'loading' && (
              <div className="flex flex-col items-center gap-3 text-center">
                <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            )}
            {state === 'error' && (
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500" />
                <h2 className="text-lg font-semibold">Couldn't load vault data</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}
            {state === 'ready' && vault && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Access granted{beneficiary?.name ? `, ${beneficiary.name}` : ''}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You can download the encrypted vault blob below. <strong className="text-foreground">You still need the master password</strong> to decrypt it — the original vault owner should have shared it separately.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs space-y-1">
                  <div><span className="text-muted-foreground">Vault ID:</span> <span className="font-mono">{vault.vault_id}</span></div>
                  <div><span className="text-muted-foreground">Updated:</span> {new Date(vault.updated_at).toLocaleString()}</div>
                  <div><span className="text-muted-foreground">Link expires:</span> {new Date(expiresAt).toLocaleString()}</div>
                </div>
                <Button onClick={downloadBlob} className="w-full gap-2">
                  <Download className="w-4 h-4" /> Download encrypted vault
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Keep this file private. Import it into IronVault (Profile → Data → Import) and unlock with the master password.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
