import { useEffect, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AppLogo } from '@/components/app-logo';
import { Lock, Eye, EyeOff, Copy, ShieldAlert, ShieldCheck, Clock } from 'lucide-react';
import { redeemShareLink } from '@/lib/share-link';
import { copyToClipboardSecure } from '@/native/clipboard';

export default function ShareRedeemPage() {
  const [, params] = useRoute('/share/:id');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [meta, setMeta] = useState<{ viewCount: number; maxViews: number; expiresAt: string; itemLabel?: string } | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const id = params?.id;
    if (!id) { setError('Missing link ID'); setLoading(false); return; }

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const keyMatch = /(?:^|[#&])k=([A-Za-z0-9_-]+)/.exec(hash);
    if (!keyMatch) { setError('Link is missing the decryption key — was the URL truncated?'); setLoading(false); return; }
    const key = keyMatch[1];

    (async () => {
      const r = await redeemShareLink(id, key);
      if (!r.ok) {
        setError(r.error || 'Could not redeem this link');
      } else {
        setPayload(r.payload);
        setMeta({ ...r.meta, itemLabel: r.payload.itemLabel });
      }
      setLoading(false);
    })();
  }, [params?.id]);

  const copyValue = async (label: string, value: string) => {
    const ok = await copyToClipboardSecure(value);
    toast({ title: ok ? `${label} copied` : 'Copy failed', variant: ok ? 'success' : 'destructive' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-4 border-b border-border/50 flex items-center gap-2">
        <AppLogo size={28} />
        <span className="font-bold text-lg">IronVault</span>
        <span className="ml-auto text-xs text-muted-foreground">Shared item</span>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {loading && (
            <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
              <CardContent className="py-10 text-center">
                <div className="animate-pulse text-muted-foreground">Decrypting…</div>
              </CardContent>
            </Card>
          )}

          {!loading && error && (
            <Card className="rounded-2xl border bg-red-500/5 border-red-500/30 backdrop-blur-xl shadow-none">
              <CardContent className="py-8 text-center">
                <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <h1 className="text-lg font-bold mb-1">Can't open this link</h1>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" className="mt-4" onClick={() => setLocation('/')}>Go to IronVault</Button>
              </CardContent>
            </Card>
          )}

          {!loading && !error && payload && meta && (
            <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
              <CardContent className="py-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-6 h-6 text-emerald-400" />
                  <h1 className="text-lg font-bold">{meta.itemLabel || 'Shared item'}</h1>
                </div>
                <div className="rounded-lg border bg-emerald-500/5 border-emerald-500/20 px-3 py-2 flex items-start gap-2 mb-4">
                  <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Decrypted in your browser. The IronVault server never saw the content.
                  </p>
                </div>

                <div className="space-y-2">
                  {payload.data && typeof payload.data === 'object' ? (
                    Object.entries(payload.data as Record<string, any>).map(([k, v]) => {
                      const isSecret = /password|secret|key|token|cvv|pin/i.test(k);
                      const value = String(v ?? '');
                      const show = !isSecret || revealed;
                      return (
                        <div key={k} className="border border-border/40 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                              <div className={`text-sm break-all ${isSecret ? 'font-mono' : ''} mt-0.5`}>
                                {show ? value : '•'.repeat(Math.min(20, value.length))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {isSecret && (
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRevealed(!revealed)} title={revealed ? 'Hide' : 'Reveal'}>
                                  {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyValue(k, value)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <pre className="font-mono text-sm bg-muted/30 rounded p-3 whitespace-pre-wrap break-words">{JSON.stringify(payload.data, null, 2)}</pre>
                  )}
                </div>

                <div className="border-t border-border/40 mt-4 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" /> View {meta.viewCount} of {meta.maxViews}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Expires {new Date(meta.expiresAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-[10px] text-center text-muted-foreground mt-3">
                  {meta.viewCount >= meta.maxViews
                    ? 'This was the last view. The link is now used up.'
                    : `Self-destructs after ${meta.maxViews - meta.viewCount} more view${meta.maxViews - meta.viewCount === 1 ? '' : 's'}.`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
