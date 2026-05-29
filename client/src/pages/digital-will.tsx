import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Heart, ShieldCheck, Plus, Trash2, CheckCircle2, Clock, AlertTriangle,
  Mail, User, Phone, Send, Zap, Loader2,
} from 'lucide-react';
import { PageHero } from '@/components/page-hero';
import {
  getWillStatus, configureWill, addBeneficiary, removeBeneficiary,
  checkInWill, activateWill, type WillBeneficiary, type WillStatus,
} from '@/lib/digital-will-api';

const ACCESS_LABEL: Record<string, string> = {
  full: 'Full vault',
  passwords_only: 'Passwords only',
  documents_only: 'Documents only',
  selected: 'Selected vaults',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

interface NewBeneficiaryForm {
  name: string;
  email: string;
  relationship: string;
  phone: string;
  accessLevel: 'full' | 'passwords_only' | 'documents_only' | 'selected';
}

const EMPTY_FORM: NewBeneficiaryForm = {
  name: '', email: '', relationship: '', phone: '', accessLevel: 'full',
};

export default function DigitalWillPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [will, setWill] = useState<WillStatus | null>(null);
  const [beneficiaries, setBeneficiaries] = useState<WillBeneficiary[]>([]);

  const [isActive, setIsActive] = useState(false);
  const [inactivityDays, setInactivityDays] = useState(30);
  const [message, setMessage] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<NewBeneficiaryForm>(EMPTY_FORM);
  const [addBusy, setAddBusy] = useState(false);

  const [confirmActivate, setConfirmActivate] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WillBeneficiary | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await getWillStatus();
      setWill(r.will);
      setBeneficiaries(r.beneficiaries);
      if (r.will) {
        setIsActive(r.will.isActive);
        setInactivityDays(r.will.inactivityPeriodDays);
        setMessage(r.will.personalMessage);
      }
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const verifiedCount = beneficiaries.filter(b => b.status === 'verified').length;
  const pendingCount = beneficiaries.filter(b => b.status === 'pending').length;

  const daysSince = will?.daysSinceCheckin ?? 0;
  const remaining = will?.daysRemaining ?? inactivityDays;
  const lastCheckin = will?.lastCheckinAt;

  const status = useMemo<'inactive' | 'healthy' | 'soon' | 'urgent' | 'triggered'>(() => {
    if (!isActive || !will) return 'inactive';
    if (will.activatedAt) return 'triggered';
    if (remaining <= 0) return 'triggered';
    if (remaining <= 3) return 'urgent';
    if (remaining <= 7) return 'soon';
    return 'healthy';
  }, [isActive, will, remaining]);

  const onCheckIn = async () => {
    try {
      setSaving(true);
      await checkInWill();
      await refresh();
      toast({
        title: "You're checked in",
        description: `Timer reset. Next check-in due in ${inactivityDays} days.`,
        variant: 'success',
      });
    } catch (e: any) {
      toast({ title: 'Check-in failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (isActive && verifiedCount === 0) {
      toast({
        title: 'No verified beneficiaries',
        description: 'Add at least one beneficiary and wait for them to confirm before activating.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setSaving(true);
      await configureWill({
        isActive,
        inactivityPeriodDays: inactivityDays,
        personalMessage: message,
      });
      await refresh();
      toast({
        title: 'Saved',
        description: isActive
          ? `Digital will active. ${verifiedCount} beneficiar${verifiedCount === 1 ? 'y' : 'ies'} will be notified after ${inactivityDays} days of inactivity.`
          : 'Settings saved (currently disabled).',
        variant: 'success',
      });
    } catch (e: any) {
      toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const onAddBeneficiary = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast({ title: 'Name and email required', variant: 'destructive' });
      return;
    }
    try {
      setAddBusy(true);
      await addBeneficiary({
        name: addForm.name.trim(),
        email: addForm.email.trim().toLowerCase(),
        relationship: addForm.relationship.trim() || undefined,
        phone: addForm.phone.trim() || undefined,
        accessLevel: addForm.accessLevel,
      });
      await refresh();
      setAddOpen(false);
      setAddForm(EMPTY_FORM);
      toast({
        title: 'Beneficiary added',
        description: `Verification email sent to ${addForm.email}. They must accept the role before the will can activate.`,
        variant: 'success',
      });
    } catch (e: any) {
      toast({ title: 'Failed to add', description: e?.message, variant: 'destructive' });
    } finally {
      setAddBusy(false);
    }
  };

  const onRemoveBeneficiary = async (b: WillBeneficiary) => {
    try {
      await removeBeneficiary(b.id);
      await refresh();
      setPendingDelete(null);
      toast({ title: 'Removed', description: `${b.name} is no longer a beneficiary.` });
    } catch (e: any) {
      toast({ title: 'Remove failed', description: e?.message, variant: 'destructive' });
    }
  };

  const onActivate = async () => {
    try {
      setSaving(true);
      const r = await activateWill();
      await refresh();
      setConfirmActivate(false);
      toast({
        title: 'Will activated',
        description: `${r.activated} beneficiar${r.activated === 1 ? 'y was' : 'ies were'} notified.`,
        variant: 'success',
      });
    } catch (e: any) {
      toast({ title: 'Activation failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const onDisable = async () => {
    try {
      setSaving(true);
      await configureWill({ isActive: false, inactivityPeriodDays: inactivityDays, personalMessage: '' });
      setIsActive(false);
      setMessage('');
      await refresh();
      setConfirmDisable(false);
      toast({ title: 'Disabled', description: 'Digital will is no longer active.' });
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-6 py-16 max-w-3xl mx-auto flex flex-col items-center text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin mb-2" />
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  const empty = !will;

  if (empty) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Heart}
          title="Digital Will"
          subtitle="Configure trusted beneficiaries who receive access to your encrypted vault if you don't check in for a chosen number of days. Server-side reminders, email verification, and an automatic dead-man's switch."
          accent="rose"
          badges={[
            { label: "Dead-man's switch" },
            { label: 'Email verified' },
            { label: 'Per-beneficiary scope' },
          ]}
          cta={{
            label: 'Set up',
            onClick: async () => {
              await configureWill({ isActive: false, inactivityPeriodDays: 30, personalMessage: '' });
              await refresh();
            },
            icon: Plus,
          }}
        />
        <div className="mt-6">
          <Card className="rounded-2xl border bg-emerald-500/5 backdrop-blur-xl border-emerald-500/20 shadow-none">
            <CardContent className="py-4 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-emerald-300">How it works</div>
                <div className="text-muted-foreground mt-1">
                  Add beneficiaries (they confirm by email). Set a check-in interval. If you don't
                  check in, you get reminders at day 1 and day 3. At day 7, every verified beneficiary
                  receives a personal message and a time-limited link to download your encrypted vault.
                  They still need your master password to decrypt it (share via sealed envelope, lawyer, etc).
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
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto pb-24">
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
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {status === 'healthy' && <CheckCircle2 className="w-6 h-6 text-emerald-400" />}
            {(status === 'soon' || status === 'urgent') && <Clock className="w-6 h-6 text-amber-400" />}
            {status === 'triggered' && <AlertTriangle className="w-6 h-6 text-red-400" />}
            {status === 'inactive' && <ShieldCheck className="w-6 h-6 text-muted-foreground" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold">
                {status === 'inactive' && 'Digital will is disabled'}
                {status === 'healthy' && `Active — ${remaining} day${remaining === 1 ? '' : 's'} remaining`}
                {status === 'soon' && `Check-in due in ${remaining} day${remaining === 1 ? '' : 's'}`}
                {status === 'urgent' && `Urgent: check in within ${remaining} day${remaining === 1 ? '' : 's'}`}
                {status === 'triggered' && (will?.activatedAt ? 'Will has been activated' : 'Inactivity period exceeded')}
              </div>
              {lastCheckin && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Last check-in {daysSince === 0 ? 'today' : `${daysSince}d ago`} · {formatDate(lastCheckin)}
                </div>
              )}
            </div>
            {isActive && !will?.activatedAt && (
              <Button onClick={onCheckIn} className="gap-2" disabled={saving}>
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
              <p className="text-xs text-muted-foreground mt-0.5">
                When enabled, verified beneficiaries are notified if you don't check in.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!!will?.activatedAt} />
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
            <Label>Personal message (sent to beneficiaries on activation)</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="A note for your loved ones — instructions, sentiments, anything you want them to read first."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <Label className="font-semibold">Beneficiaries</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {beneficiaries.length} total · {verifiedCount} verified · {pendingCount} pending
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Add beneficiary
            </Button>
          </div>
          {beneficiaries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No beneficiaries yet. Add at least one to enable the dead-man's switch.
            </div>
          ) : (
            <div className="space-y-2">
              {beneficiaries.map(b => (
                <div key={b.id} className="border border-border/40 rounded-xl p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{b.name}</span>
                      {b.status === 'verified' && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                        </Badge>
                      )}
                      {b.status === 'pending' && (
                        <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-xs">
                          <Clock className="w-3 h-3 mr-1" /> Pending verification
                        </Badge>
                      )}
                      {b.status === 'activated' && (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/30 text-xs">
                          <Zap className="w-3 h-3 mr-1" /> Activated
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {b.email}</span>
                      {b.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {b.phone}</span>}
                      {b.relationship && <span>· {b.relationship}</span>}
                      <span>· {ACCESS_LABEL[b.accessLevel] || b.accessLevel}</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setPendingDelete(b)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setConfirmDisable(true)} className="text-destructive hover:text-destructive" disabled={saving}>
            Disable
          </Button>
          {isActive && !will?.activatedAt && verifiedCount > 0 && (
            <Button variant="outline" onClick={() => setConfirmActivate(true)} className="text-amber-500 hover:text-amber-500 border-amber-500/30" disabled={saving}>
              <Send className="w-4 h-4 mr-2" /> Activate now
            </Button>
          )}
        </div>
        <Button onClick={onSave} className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Save settings
        </Button>
      </div>

      <AlertDialog open={addOpen} onOpenChange={setAddOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add a beneficiary</AlertDialogTitle>
            <AlertDialogDescription>
              They'll receive an email to confirm they accept being a beneficiary. Only verified beneficiaries are notified when the will activates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Name</Label>
                <Input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} placeholder="Full name" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={addForm.email} onChange={e => setAddForm({ ...addForm, email: e.target.value })} placeholder="email@example.com" />
              </div>
              <div>
                <Label>Relationship</Label>
                <Input value={addForm.relationship} onChange={e => setAddForm({ ...addForm, relationship: e.target.value })} placeholder="Spouse, sibling, friend…" />
              </div>
              <div>
                <Label>Phone (optional)</Label>
                <Input value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="+1 …" />
              </div>
            </div>
            <div>
              <Label>Access level</Label>
              <Select value={addForm.accessLevel} onValueChange={(v: any) => setAddForm({ ...addForm, accessLevel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCESS_LABEL).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={addBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onAddBeneficiary(); }} disabled={addBusy}>
              {addBusy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <><Send className="w-4 h-4 mr-2" /> Send invite</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be a beneficiary. They won't be notified about this change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && onRemoveBeneficiary(pendingDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmActivate} onOpenChange={setConfirmActivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate digital will now?</AlertDialogTitle>
            <AlertDialogDescription>
              This sends an email to all <strong>{verifiedCount}</strong> verified beneficiar{verifiedCount === 1 ? 'y' : 'ies'} with your personal message and a time-limited link to download your encrypted vault. They'll still need your master password to decrypt it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onActivate} className="bg-rose-600 hover:bg-rose-600/90">
              <Send className="w-4 h-4 mr-2" /> Activate now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable digital will?</AlertDialogTitle>
            <AlertDialogDescription>
              The dead-man's switch is turned off. Beneficiaries remain in your list but won't be notified. You can re-enable any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDisable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Disable</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
