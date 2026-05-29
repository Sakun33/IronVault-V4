import { useState, useEffect } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Heart, Mail, Pause, Play, Send, Trash2, Users, Key, Bookmark, BookOpen, CreditCard, Wifi, Bitcoin, UserCircle, Bell, FileText, CheckCircle2 } from 'lucide-react';
import type { CoupleVault } from '@shared/schema';
import { PageHero } from '@/components/page-hero';
import { inviteCouple, getCoupleStatus, unpairCouple, type CouplePair } from '@/lib/couple-api';

const SECTION_DEF = [
  { id: 'passwords',     label: 'Passwords',     icon: Key,        desc: 'All saved logins' },
  { id: 'cards',         label: 'Cards',         icon: CreditCard, desc: 'Credit + debit cards' },
  { id: 'subscriptions', label: 'Subscriptions', icon: Bookmark,   desc: 'Billing + renewals' },
  { id: 'notes',         label: 'Notes',         icon: BookOpen,   desc: 'All vault notes' },
  { id: 'reminders',     label: 'Reminders',     icon: Bell,       desc: 'Shared reminders' },
  { id: 'wifi',          label: 'Wi-Fi',         icon: Wifi,       desc: 'Network credentials' },
  { id: 'documents',     label: 'Documents',     icon: FileText,   desc: 'Uploaded files' },
  { id: 'identities',    label: 'Identities',    icon: UserCircle, desc: 'Personal records' },
  { id: 'crypto',        label: 'Crypto',        icon: Bitcoin,    desc: 'Wallet seeds' },
] as const;

const STATUS_COLOR = {
  invited: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  active:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
  paused:  'bg-amber-500/15 text-amber-300 border-amber-500/25',
};

function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase();
}

export default function CoupleVaultPage() {
  const { coupleVault, saveCoupleVault, clearCoupleVault, passwords, creditCards, subscriptions, notes, wifiPasswords } = useVault();
  const { toast } = useToast();
  const [partnerEmail, setPartnerEmail] = useState(coupleVault?.partnerEmail || '');
  const [partnerName, setPartnerName] = useState(coupleVault?.partnerName || '');
  const [message, setMessage] = useState(coupleVault?.message || '');
  const [sections, setSections] = useState<string[]>(coupleVault?.sharedSections || []);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setPartnerEmail(coupleVault?.partnerEmail || '');
    setPartnerName(coupleVault?.partnerName || '');
    setMessage(coupleVault?.message || '');
    setSections(coupleVault?.sharedSections || []);
  }, [coupleVault]);

  const counts: Record<string, number> = {
    passwords: passwords.length,
    cards: creditCards.length,
    subscriptions: subscriptions.length,
    notes: notes.length,
    reminders: 0, // intentional — we don't pull reminders into context-light here
    wifi: wifiPasswords.length,
    documents: 0,
    identities: 0,
    crypto: 0,
  };

  const totalShared = sections.reduce((sum, id) => sum + (counts[id] || 0), 0);

  const toggleSection = (id: string) => {
    setSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const [serverPair, setServerPair] = useState<CouplePair | null>(null);
  const [busy, setBusy] = useState(false);

  // Sync server-side invite status once on mount and after every save.
  const refreshServer = async () => {
    try {
      const r = await getCoupleStatus();
      setServerPair(r.pair);
    } catch { /* ignore — local state still works */ }
  };
  useEffect(() => { refreshServer(); }, []);

  const invite = async () => {
    if (!partnerEmail.trim() || !partnerName.trim()) {
      toast({ title: 'Partner name and email required', variant: 'destructive' });
      return;
    }
    if (sections.length === 0) {
      toast({ title: 'Pick at least one section to share', variant: 'destructive' });
      return;
    }
    try {
      setBusy(true);
      // Save locally for offline UI.
      await saveCoupleVault({
        partnerEmail: partnerEmail.toLowerCase().trim(),
        partnerName: partnerName.trim(),
        sharedSections: sections as any,
        privateItemIds: coupleVault?.privateItemIds || [],
        sharedItemIds: coupleVault?.sharedItemIds || [],
        status: coupleVault?.status === 'active' ? 'active' : 'invited',
        sharedAt: coupleVault?.sharedAt || new Date().toISOString(),
        message: message.trim() || undefined,
      });
      // Fire server-side invite (email goes out).
      const r = await inviteCouple({
        partnerEmail: partnerEmail.toLowerCase().trim(),
        partnerName: partnerName.trim(),
        sharedSections: sections,
        message: message.trim() || undefined,
      });
      await refreshServer();
      toast({
        title: r.status === 'accepted' ? 'Pairing updated' : 'Invitation sent',
        description: r.status === 'accepted'
          ? `Shared sections updated for ${partnerName}.`
          : `Email sent to ${partnerEmail}. They'll see the invite right away.`,
        variant: 'success',
      });
    } catch (e: any) {
      toast({ title: 'Invite failed', description: e?.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const pauseOrResume = async () => {
    if (!coupleVault) return;
    const next = coupleVault.status === 'paused' ? 'active' : 'paused';
    await saveCoupleVault({
      ...coupleVault,
      status: next,
      pausedAt: next === 'paused' ? new Date().toISOString() : undefined,
    });
    toast({ title: next === 'paused' ? 'Sharing paused' : 'Sharing resumed', variant: 'success' });
  };

  const remove = async () => {
    try {
      setBusy(true);
      await clearCoupleVault();
      await unpairCouple().catch(() => {/* ignore — local clear is authoritative */});
      setServerPair(null);
      setConfirmRemove(false);
      toast({ title: 'Unpaired', description: 'Couple\'s vault settings removed.' });
    } finally {
      setBusy(false);
    }
  };

  if (!coupleVault) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Heart}
          title="Couple's Vault"
          subtitle="Share selected sections of your vault with one partner — passwords for Netflix and Spotify without giving away your work logins."
          accent="rose"
          badges={[{ label: 'Per-section scope' }, { label: 'Pause anytime' }]}
        />
        <Card className="mt-6 rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
          <CardContent className="pt-5 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Partner name</Label>
                <Input value={partnerName} onChange={e => setPartnerName(e.target.value)} placeholder="Alex" />
              </div>
              <div>
                <Label>Partner email</Label>
                <Input type="email" value={partnerEmail} onChange={e => setPartnerEmail(e.target.value)} placeholder="alex@example.com" />
              </div>
            </div>
            <div>
              <Label>Personal message (optional)</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} placeholder="Hey, sharing our Netflix + utility logins so you can manage them too." />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Sections to share</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {SECTION_DEF.map(s => {
                  const Icon = s.icon;
                  const enabled = sections.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSection(s.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${enabled ? 'bg-rose-500/15 border-rose-500/40' : 'bg-muted/30 border-border/40 hover:bg-muted/50'}`}
                    >
                      <Icon className={`w-4 h-4 ${enabled ? 'text-rose-400' : 'text-muted-foreground'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{s.label}</div>
                        <div className="text-[10px] text-muted-foreground">{counts[s.id] || 0} items</div>
                      </div>
                      <Switch checked={enabled} className="pointer-events-none" />
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={invite} className="w-full gap-2" size="lg">
              <Send className="w-4 h-4" /> Invite partner
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="w-7 h-7 text-rose-400" /> Couple's Vault
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paired since {new Date(coupleVault.sharedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={pauseOrResume}>
            {coupleVault.status === 'paused' ? <><Play className="w-4 h-4 mr-1" /> Resume</> : <><Pause className="w-4 h-4 mr-1" /> Pause</>}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)} className="text-destructive hover:text-destructive">
            <Trash2 className="w-4 h-4 mr-1" /> Unpair
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border bg-rose-500/5 backdrop-blur-xl border-rose-500/20 shadow-none mb-4">
        <CardContent className="pt-5 pb-4 flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center flex-shrink-0 text-white font-bold text-lg">
            {coupleVault.partnerAvatarUrl
              ? <img src={coupleVault.partnerAvatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
              : initials(coupleVault.partnerName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-lg">{coupleVault.partnerName}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" /> {coupleVault.partnerEmail}
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider border ${STATUS_COLOR[coupleVault.status]}`}>
            {coupleVault.status}
          </span>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Shared sections</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{totalShared} item{totalShared === 1 ? '' : 's'} across {sections.length} section{sections.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SECTION_DEF.map(s => {
              const Icon = s.icon;
              const enabled = sections.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSection(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${enabled ? 'bg-rose-500/15 border-rose-500/40' : 'bg-muted/30 border-border/40 hover:bg-muted/50'}`}
                >
                  <Icon className={`w-4 h-4 ${enabled ? 'text-rose-400' : 'text-muted-foreground'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">{counts[s.id] || 0} items · {s.desc}</div>
                  </div>
                  <Switch checked={enabled} className="pointer-events-none" />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
        <CardContent className="pt-5 pb-4 space-y-3">
          <div>
            <Label>Personal message</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={invite} className="w-full gap-2" size="lg">
        <Send className="w-4 h-4" /> Save changes
      </Button>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpair from {coupleVault.partnerName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {coupleVault.partnerName} will lose access to all shared sections immediately. Your private items are not affected. You can re-pair anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Unpair</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
