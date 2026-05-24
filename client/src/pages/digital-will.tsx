import { useState, useMemo, useEffect } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Heart, ShieldCheck, Plus, Trash2, CheckCircle2, Clock, AlertTriangle, Mail, User } from 'lucide-react';
import type { DigitalWill, DigitalWillBeneficiary } from '@shared/schema';
import { PageHero } from '@/components/page-hero';

const ACCESS_LABEL: Record<string, string> = {
  full: 'Full vault',
  passwords_only: 'Passwords only',
  documents_only: 'Documents only',
  selected: 'Selected vaults',
};

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function DigitalWillPage() {
  const { digitalWill, saveDigitalWill, clearDigitalWill } = useVault();
  const { toast } = useToast();

  const [isActive, setIsActive] = useState(digitalWill?.isActive ?? false);
  const [inactivityDays, setInactivityDays] = useState(digitalWill?.inactivityPeriodDays ?? 30);
  const [message, setMessage] = useState(digitalWill?.personalMessage ?? '');
  const [beneficiaries, setBeneficiaries] = useState<DigitalWillBeneficiary[]>(digitalWill?.beneficiaries ?? []);
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    setIsActive(digitalWill?.isActive ?? false);
    setInactivityDays(digitalWill?.inactivityPeriodDays ?? 30);
    setMessage(digitalWill?.personalMessage ?? '');
    setBeneficiaries(digitalWill?.beneficiaries ?? []);
  }, [digitalWill]);

  const lastCheckin = digitalWill?.lastCheckinAt;
  const elapsed = lastCheckin ? daysSince(lastCheckin) : 0;
  const remaining = Math.max(0, inactivityDays - elapsed);

  const status = useMemo(() => {
    if (!isActive || !lastCheckin) return 'inactive' as const;
    if (remaining <= 0) return 'triggered' as const;
    if (remaining <= 3) return 'urgent' as const;
    if (remaining <= 7) return 'soon' as const;
    return 'healthy' as const;
  }, [isActive, lastCheckin, remaining]);

  const addBeneficiary = () => {
    setBeneficiaries([...beneficiaries, { name: '', email: '', relationship: '', accessLevel: 'full' }]);
  };
  const updateBeneficiary = (idx: number, patch: Partial<DigitalWillBeneficiary>) => {
    setBeneficiaries(beneficiaries.map((b, i) => i === idx ? { ...b, ...patch } : b));
  };
  const removeBeneficiary = (idx: number) => {
    setBeneficiaries(beneficiaries.filter((_, i) => i !== idx));
  };

  const checkIn = async () => {
    const next: Omit<DigitalWill, 'id' | 'createdAt' | 'updatedAt'> = {
      isActive,
      inactivityPeriodDays: inactivityDays,
      lastCheckinAt: new Date().toISOString(),
      beneficiaries,
      personalMessage: message,
    };
    await saveDigitalWill(next);
    toast({
      title: 'Checked in',
      description: `Timer reset. Next check-in due in ${inactivityDays} days.`,
      variant: 'success',
    });
  };

  const save = async () => {
    const validBeneficiaries = beneficiaries.filter(b => b.name.trim() && b.email.trim());
    if (isActive && validBeneficiaries.length === 0) {
      toast({ title: 'Add at least one beneficiary', variant: 'destructive' });
      return;
    }
    const next: Omit<DigitalWill, 'id' | 'createdAt' | 'updatedAt'> = {
      isActive,
      inactivityPeriodDays: inactivityDays,
      lastCheckinAt: digitalWill?.lastCheckinAt || new Date().toISOString(),
      beneficiaries: validBeneficiaries,
      personalMessage: message,
    };
    await saveDigitalWill(next);
    toast({
      title: 'Saved',
      description: isActive
        ? `Digital will is active. ${validBeneficiaries.length} beneficiar${validBeneficiaries.length === 1 ? 'y' : 'ies'} will be notified after ${inactivityDays} days of inactivity.`
        : 'Settings saved (currently disabled).',
      variant: 'success',
    });
  };

  const disable = async () => {
    await clearDigitalWill();
    setIsActive(false);
    setConfirmDisable(false);
    toast({ title: 'Digital will disabled', description: 'All settings have been removed.' });
  };

  if (!digitalWill) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Heart}
          title="Digital Will"
          subtitle="Set up secure inheritance: trusted beneficiaries gain controlled access to your vault if you don't check in for a configurable period."
          accent="rose"
          badges={[{ label: 'Dead-man\'s switch' }, { label: 'Per-beneficiary scope' }]}
          cta={{ label: 'Set up', onClick: () => saveDigitalWill({
            isActive: false,
            inactivityPeriodDays: 30,
            lastCheckinAt: new Date().toISOString(),
            beneficiaries: [],
            personalMessage: '',
          }), icon: Plus }}
        />
        <div className="mt-6">
          <Card className="rounded-2xl border bg-amber-500/5 backdrop-blur-xl border-amber-500/20 shadow-none">
            <CardContent className="py-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-amber-300">Server-side trigger coming soon</div>
                <div className="text-muted-foreground mt-1">
                  Storing beneficiaries + the inactivity period locally lets you plan today.
                  Automated email notifications when the timer fires are rolling out in a follow-up
                  backend cron — until then, the "Check in" button keeps your timer fresh and the
                  settings sync across your devices via the regular vault sync.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusBg: Record<typeof status, string> = {
    inactive:  'bg-muted/30 border-muted',
    healthy:   'bg-emerald-500/10 border-emerald-500/30',
    soon:      'bg-yellow-500/10 border-yellow-500/30',
    urgent:    'bg-amber-500/10 border-amber-500/30',
    triggered: 'bg-red-500/10 border-red-500/30',
  };

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Heart className="w-7 h-7 text-rose-400" /> Digital Will
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Secure inheritance for your vault</p>
        </div>
      </div>

      <Card className={`rounded-2xl border backdrop-blur-xl shadow-none mb-4 ${statusBg[status]}`}>
        <CardContent className="py-5">
          <div className="flex items-center gap-3 mb-3">
            {status === 'healthy' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
            {(status === 'soon' || status === 'urgent') && <Clock className="w-6 h-6 text-amber-400" />}
            {status === 'triggered' && <AlertTriangle className="w-6 h-6 text-red-400" />}
            {status === 'inactive' && <ShieldCheck className="w-6 h-6 text-muted-foreground" />}
            <div className="flex-1">
              <div className="font-semibold">
                {status === 'inactive' && 'Digital will is disabled'}
                {status === 'healthy' && `Active — ${remaining} days remaining`}
                {status === 'soon' && `Check-in due in ${remaining} days`}
                {status === 'urgent' && `Urgent: check in within ${remaining} days`}
                {status === 'triggered' && 'Inactivity period exceeded'}
              </div>
              {lastCheckin && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Last check-in {elapsed === 0 ? 'today' : `${elapsed}d ago`} · {formatDate(lastCheckin)}
                </div>
              )}
            </div>
            {isActive && (
              <Button onClick={checkIn} className="gap-2">
                <CheckCircle2 className="w-4 h-4" /> Check in
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-semibold">Enable digital will</Label>
              <p className="text-xs text-muted-foreground mt-0.5">When enabled, beneficiaries are notified if you don't check in.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Inactivity period (days)</Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={inactivityDays}
                onChange={e => setInactivityDays(Math.max(7, Math.min(365, parseInt(e.target.value, 10) || 30)))}
              />
            </div>
            <div>
              <Label>Last check-in</Label>
              <Input value={lastCheckin ? formatDate(lastCheckin) : '—'} readOnly className="bg-muted/30" />
            </div>
          </div>
          <div>
            <Label>Personal message (sent to beneficiaries)</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="A note for your loved ones — instructions, sentiments, anything you want them to read first."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Label className="font-semibold">Beneficiaries</Label>
              <p className="text-xs text-muted-foreground mt-0.5">{beneficiaries.length} added</p>
            </div>
            <Button variant="outline" size="sm" onClick={addBeneficiary} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
          {beneficiaries.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No beneficiaries yet. Add at least one to enable the dead-man's switch.
            </div>
          ) : (
            <div className="space-y-3">
              {beneficiaries.map((b, i) => (
                <div key={i} className="border border-border/40 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <Input value={b.name} onChange={e => updateBeneficiary(i, { name: e.target.value })} placeholder="Name" />
                      <Input type="email" value={b.email} onChange={e => updateBeneficiary(i, { email: e.target.value })} placeholder="email@example.com" />
                      <Input value={b.relationship || ''} onChange={e => updateBeneficiary(i, { relationship: e.target.value })} placeholder="Relationship (spouse, sibling…)" />
                      <Select value={b.accessLevel} onValueChange={(v: any) => updateBeneficiary(i, { accessLevel: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ACCESS_LABEL).map(([k, label]) => (
                            <SelectItem key={k} value={k}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeBeneficiary(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" /> {b.name || 'Unnamed'}
                    <Mail className="w-3 h-3 ml-2" /> {b.email || '—'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" onClick={() => setConfirmDisable(true)} className="text-destructive hover:text-destructive">
          Disable & clear
        </Button>
        <Button onClick={save} className="gap-2">
          <CheckCircle2 className="w-4 h-4" /> Save settings
        </Button>
      </div>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable digital will?</AlertDialogTitle>
            <AlertDialogDescription>
              All beneficiaries, the personal message, and the inactivity timer will be removed. You can set this up again any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={disable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Disable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
