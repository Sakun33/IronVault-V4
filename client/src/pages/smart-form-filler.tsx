import { useState, useMemo } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wand2, Copy, Search, CreditCard, UserCircle, KeyRound } from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import { buildFillSnapshot, matchCredentialsForUrl } from '@/lib/form-filler';
import { copyToClipboardSecure } from '@/native/clipboard';

export default function SmartFormFillerPage() {
  const { passwords, identities, creditCards } = useVault();
  const { toast } = useToast();
  const [target, setTarget] = useState('');

  const snapshot = useMemo(
    () => buildFillSnapshot(identities, creditCards, passwords),
    [identities, creditCards, passwords],
  );

  const matches = useMemo(() => target.trim() ? matchCredentialsForUrl(snapshot, target) : [], [snapshot, target]);

  const copy = async (text: string, label: string) => {
    if (!text) { toast({ title: 'Nothing to copy', variant: 'destructive' }); return; }
    const ok = await copyToClipboardSecure(text);
    toast({ title: ok ? `${label} copied` : 'Copy failed', variant: ok ? 'success' : 'destructive' });
  };

  if (identities.length === 0 && creditCards.length === 0 && passwords.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Wand2}
          title="Smart Form Filler"
          subtitle="One place to copy the right field into any web form — pulls from your identities, cards, and passwords. Pair with the Chrome extension for one-click autofill."
          accent="violet"
          badges={[{ label: 'Cross-section' }, { label: 'On-device' }]}
          cta={{ label: 'Add an identity', onClick: () => { window.location.href = '/identities'; }, icon: UserCircle }}
        />
      </div>
    );
  }

  const p = snapshot.profile;

  return (
    <div className="px-4 md:px-6 py-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Wand2 className="w-7 h-7 text-violet-400" /> Smart Form Filler
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Tap any value to copy. Chrome extension picks these up automatically.</p>
      </div>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4" /> Match credentials for a site</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={target} onChange={e => setTarget(e.target.value)} placeholder="https://example.com/login" />
          {target && (
            <div className="mt-3 space-y-2">
              {matches.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved credentials for {target}</p>
              ) : (
                matches.map(m => (
                  <div key={m.id} className="flex items-center justify-between border border-border/40 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.username} · {m.host}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => copy(m.username, 'Username')}>Copy user</Button>
                      <Button variant="ghost" size="sm" onClick={() => copy(m.password, 'Password')}>Copy pwd</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {p && (
        <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><UserCircle className="w-4 h-4 text-emerald-400" /> Primary identity</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              ['Full name', p.fullName],
              ['First name', p.firstName],
              ['Last name', p.lastName],
              ['Email', p.email],
              ['Phone', p.phone],
              ['DOB', p.dateOfBirth],
              ['Address line 1', p.addressLine1],
              ['Address line 2', p.addressLine2],
              ['City', p.city],
              ['State', p.state],
              ['Postal code', p.postalCode],
              ['Country', p.country],
            ].filter(([, v]) => v).map(([label, value]) => (
              <button key={label} onClick={() => copy(value as string, label as string)} className="text-left bg-muted/30 hover:bg-muted/50 rounded-lg px-3 py-2 group">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="text-sm truncate flex items-center gap-1 mt-0.5">
                  {value} <Copy className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {snapshot.cards.length > 0 && (
        <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-sky-400" /> Cards ({snapshot.cards.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.cards.map(c => (
              <div key={c.id} className="border border-border/40 rounded-lg p-3">
                <div className="font-semibold text-sm">{c.cardName} <span className="text-xs text-muted-foreground">· {c.brand}</span></div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => copy(c.cardNumber, 'Card number')}>Card #</Button>
                  <Button variant="outline" size="sm" onClick={() => copy(`${c.expiryMonth}/${c.expiryYear}`, 'Expiry')}>{c.expiryMonth || 'MM'}/{c.expiryYear || 'YY'}</Button>
                  <Button variant="outline" size="sm" onClick={() => copy(c.cvv, 'CVV')}>CVV</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><KeyRound className="w-4 h-4 text-violet-400" /> Vault credentials ({snapshot.credentials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Search for a site URL above to match credentials. Across the vault: {snapshot.credentials.length} saved logins covering {Object.keys(snapshot.credentialsByHost).length} hosts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
