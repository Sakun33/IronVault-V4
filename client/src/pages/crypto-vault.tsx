import { useState, useMemo } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Copy, Edit, Trash2, Eye, EyeOff, Search, Bitcoin, ShieldCheck, AlertTriangle, Share2 } from 'lucide-react';
import type { CryptoWallet } from '@shared/schema';
import { copyToClipboardSecure } from '@/native/clipboard';
import { PageHero } from '@/components/page-hero';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { PremiumCard } from '@/components/premium-card';
import { ShareItemModal } from '@/components/share-item-modal';
import { FeaturePreview } from '@/components/feature-preview';
import { useSubscription } from '@/hooks/use-subscription';
import { usePlan } from '@/lib/plan-service';

const WALLET_TYPE_LABEL: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', polygon: 'MATIC', other: 'WALLET',
};
const WALLET_TYPE_COLOR: Record<string, string> = {
  bitcoin:  'from-orange-500 to-amber-600',
  ethereum: 'from-indigo-500 to-violet-600',
  solana:   'from-fuchsia-500 to-purple-600',
  polygon:  'from-purple-500 to-fuchsia-600',
  other:    'from-slate-500 to-slate-700',
};

const blank = (): Omit<CryptoWallet, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  walletType: 'other',
  walletAddress: '',
  seedPhrase: '',
  privateKey: '',
  publicKey: '',
  network: '',
  exchangeName: '',
  notes: '',
});

export default function CryptoVaultPage() {
  const { cryptoWallets, addCryptoWallet, updateCryptoWallet, deleteCryptoWallet } = useVault();
  const { toast } = useToast();
  const { isLoading: licenseLoading } = useSubscription();
  const plan = usePlan();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<CryptoWallet | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(blank());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Master-password gate. The unlocked id is held in state so a single
  // verification can reveal both seed phrase AND private key for one wallet.
  const [unlockedId, setUnlockedId] = useState<string | null>(null);
  const [verifyFor, setVerifyFor] = useState<string | null>(null);
  const [sharing, setSharing] = useState<CryptoWallet | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cryptoWallets;
    return cryptoWallets.filter(w =>
      w.name.toLowerCase().includes(q) ||
      (w.walletAddress || '').toLowerCase().includes(q) ||
      (w.exchangeName || '').toLowerCase().includes(q)
    );
  }, [cryptoWallets, query]);

  const openAdd = () => { setEditing(null); setForm(blank()); setIsOpen(true); };
  const openEdit = (w: CryptoWallet) => {
    setEditing(w);
    setForm({
      name: w.name, walletType: w.walletType,
      walletAddress: w.walletAddress || '', seedPhrase: w.seedPhrase || '',
      privateKey: w.privateKey || '', publicKey: w.publicKey || '',
      network: w.network || '', exchangeName: w.exchangeName || '',
      notes: w.notes || '',
    });
    setIsOpen(true);
  };

  const copy = async (text: string, label: string) => {
    const ok = await copyToClipboardSecure(text);
    toast({ title: ok ? `${label} copied` : 'Copy failed', variant: ok ? 'success' : 'destructive' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: 'Wallet name required', variant: 'destructive' }); return; }
    try {
      if (editing) {
        await updateCryptoWallet(editing.id, form);
        toast({ title: 'Wallet updated', variant: 'success' });
      } else {
        await addCryptoWallet(form);
        toast({ title: 'Wallet saved', variant: 'success' });
      }
      setIsOpen(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteCryptoWallet(confirmDeleteId);
      toast({ title: 'Wallet deleted', variant: 'success' });
    } finally { setConfirmDeleteId(null); }
  };

  // Pro-gate — sensitive seed phrases / private keys live behind a paid plan
  if (!licenseLoading && !plan.isPaid) {
    return (
      <FeaturePreview
        feature="Crypto Vault"
        description="Store BIP-39 seed phrases, private keys, and wallet addresses with master-password-gated reveal — the only password manager built for crypto holders."
        bullets={[
          'AES-256-GCM encryption with master-password gate on every reveal',
          'Per-word seed phrase copy — never expose the full phrase',
          'Bitcoin, Ethereum, Solana, Polygon support out of the box',
        ]}
        mock="api-keys"
      />
    );
  }

  if (cryptoWallets.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Bitcoin}
          title="Crypto Vault"
          subtitle="Store BIP-39 seed phrases and private keys with the same end-to-end encryption that protects your passwords. Sensitive fields are master-password gated for every reveal."
          accent="amber"
          badges={[
            { label: 'AES-256-GCM' },
            { label: 'Master-password gate' },
          ]}
          cta={{ label: 'Add wallet', onClick: openAdd, icon: Plus, testId: 'crypto-add-cta' }}
        />
        <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Crypto Vault</h1>
          <p className="text-sm text-muted-foreground mt-1">{cryptoWallets.length} wallet{cryptoWallets.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={openAdd} className="gap-2"><Plus className="w-4 h-4" /> Add wallet</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search wallets…" className="pl-9" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map(w => {
          const revealed = unlockedId === w.id;
          const seedWords = (w.seedPhrase || '').trim().split(/\s+/).filter(Boolean);
          return (
            <PremiumCard key={w.id} accent="amber" className="p-4 flex flex-col gap-3 min-h-[76px]">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${WALLET_TYPE_COLOR[w.walletType]} flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20`}>
                    <span className="text-[10px] font-bold text-white tracking-tighter">{WALLET_TYPE_LABEL[w.walletType]}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold truncate leading-tight">{w.name}</div>
                    <div className="text-[13px] text-muted-foreground truncate mt-0.5">
                      {w.exchangeName || w.network || w.walletType.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSharing(w)} title="Share"><Share2 className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(w)} title="Edit"><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(w.id)} title="Delete"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>

              {w.walletAddress && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Address</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono truncate flex-1 bg-black/[0.03] dark:bg-white/[0.04] rounded px-2 py-1.5">{w.walletAddress}</code>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(w.walletAddress!, 'Address')}><Copy className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              )}

              {(w.seedPhrase || w.privateKey) && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Sensitive
                  </div>
                  {!revealed ? (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setVerifyFor(w.id)}>
                      <Eye className="w-3.5 h-3.5 mr-2" /> Reveal with master password
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      {w.seedPhrase && (
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" /> Seed phrase ({seedWords.length} words)
                          </div>
                          <div className="grid grid-cols-3 gap-1 mb-1">
                            {seedWords.map((word, i) => (
                              <button
                                key={i}
                                onClick={() => copy(word, `Word ${i + 1}`)}
                                className="text-left text-xs font-mono bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.08] dark:hover:bg-white/[0.08] rounded px-1.5 py-1"
                                title="Copy word"
                              >
                                <span className="text-muted-foreground mr-1">{i + 1}.</span>{word}
                              </button>
                            ))}
                          </div>
                          <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => copy(w.seedPhrase!, 'Seed phrase')}>
                            <Copy className="w-3 h-3 mr-1" /> Copy full phrase
                          </Button>
                        </div>
                      )}
                      {w.privateKey && (
                        <div>
                          <div className="text-[10px] text-muted-foreground mb-1">Private key</div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono truncate flex-1 bg-black/[0.03] dark:bg-white/[0.04] rounded px-2 py-1.5">{w.privateKey}</code>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copy(w.privateKey!, 'Private key')}><Copy className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => setUnlockedId(null)}>
                        <EyeOff className="w-3 h-3 mr-1" /> Hide
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </PremiumCard>
          );
        })}
      </div>

      <ShareItemModal
        open={!!sharing}
        onOpenChange={(o) => !o && setSharing(null)}
        itemLabel={sharing?.name || 'Wallet'}
        itemKind="wallet"
        data={sharing ? {
          name: sharing.name, walletType: sharing.walletType,
          walletAddress: sharing.walletAddress, publicKey: sharing.publicKey,
          network: sharing.network, exchangeName: sharing.exchangeName,
          notes: sharing.notes,
        } : {}}
      />

      <VerifyAccessModal
        open={!!verifyFor}
        onOpenChange={(o) => !o && setVerifyFor(null)}
        onVerified={() => { setUnlockedId(verifyFor); setVerifyFor(null); }}
        title="Verify master password"
        description="Re-enter your master password to reveal seed phrase / private key."
      />

      <AddEditDialog isOpen={isOpen} setIsOpen={setIsOpen} editing={editing} form={form} setForm={setForm} submit={submit} />

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete wallet?</AlertDialogTitle>
            <AlertDialogDescription>This wallet and its seed phrase will be permanently removed from your vault. Make sure you have a backup.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddEditDialog(props: {
  isOpen: boolean; setIsOpen: (v: boolean) => void;
  editing: CryptoWallet | null;
  form: ReturnType<typeof blank>; setForm: (v: ReturnType<typeof blank>) => void;
  submit: (e: React.FormEvent) => Promise<void>;
}) {
  const { isOpen, setIsOpen, editing, form, setForm, submit } = props;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Edit wallet' : 'Add crypto wallet'}</DialogTitle></DialogHeader>
        <DialogBody>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus placeholder="Bitcoin Cold Storage" />
              </div>
              <div>
                <Label>Network</Label>
                <Select value={form.walletType} onValueChange={(v: any) => setForm({ ...form, walletType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bitcoin">Bitcoin</SelectItem>
                    <SelectItem value="ethereum">Ethereum</SelectItem>
                    <SelectItem value="solana">Solana</SelectItem>
                    <SelectItem value="polygon">Polygon</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Sub-network</Label>
                <Input value={form.network} onChange={e => setForm({ ...form, network: e.target.value })} placeholder="mainnet, testnet" />
              </div>
              <div className="col-span-2">
                <Label>Exchange (optional)</Label>
                <Input value={form.exchangeName} onChange={e => setForm({ ...form, exchangeName: e.target.value })} placeholder="Coinbase, Binance, Ledger…" />
              </div>
              <div className="col-span-2">
                <Label>Wallet address</Label>
                <Input value={form.walletAddress} onChange={e => setForm({ ...form, walletAddress: e.target.value })} className="font-mono text-xs" />
              </div>
              <div className="col-span-2">
                <Label>Public key (optional)</Label>
                <Input value={form.publicKey} onChange={e => setForm({ ...form, publicKey: e.target.value })} className="font-mono text-xs" />
              </div>
              <div className="col-span-2">
                <Label>Seed phrase (12 or 24 words, space-separated)</Label>
                <Textarea value={form.seedPhrase} onChange={e => setForm({ ...form, seedPhrase: e.target.value })} rows={3} className="font-mono text-xs" />
              </div>
              <div className="col-span-2">
                <Label>Private key (optional)</Label>
                <Textarea value={form.privateKey} onChange={e => setForm({ ...form, privateKey: e.target.value })} rows={2} className="font-mono text-xs" />
              </div>
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit">{editing ? 'Save' : 'Add wallet'}</Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
