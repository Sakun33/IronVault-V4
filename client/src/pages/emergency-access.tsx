import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { HeartHandshake, ArrowLeft, Plus, Trash2, Shield, Clock, AlertTriangle, CheckCircle2, X, Mail, KeyRound } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';

const WAIT_OPTIONS = [
  { value: '24',  label: '24 hours' },
  { value: '168', label: '7 days' },
  { value: '720', label: '30 days' },
];

interface Contact {
  id: string;
  contact_email: string;
  contact_name: string | null;
  waiting_period_hours: number;
  status: string;
  created_at: string;
}

interface RequestRow {
  id: string;
  status: 'pending' | 'denied' | 'granted';
  requested_at: string;
  unlocks_at: string;
  denied_at: string | null;
  contact_email: string;
  contact_name: string | null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getCloudToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `HTTP ${res.status}`);
  return data as T;
}

export default function EmergencyAccess() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Contact | null>(null);

  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newWait, setNewWait] = useState('168');
  const [submitting, setSubmitting] = useState(false);

  // For contact-side: request access on someone else's account
  const [requestOwnerEmail, setRequestOwnerEmail] = useState('');
  const [requesting, setRequesting] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        api<{ contacts: Contact[] }>('/api/emergency/contacts'),
        api<{ requests: RequestRow[] }>('/api/emergency/requests'),
      ]);
      setContacts(c.contacts || []);
      setRequests(r.requests || []);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  // Owners can land on this page from the email's "Deny" button —
  // ?action=deny&token=...  Auto-call the deny endpoint then strip the params.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'deny') {
      const token = params.get('token');
      if (token) {
        api('/api/emergency/deny', { method: 'POST', body: JSON.stringify({ token }) })
          .then(() => {
            toast({ variant: 'success', title: 'Request denied', description: 'Trusted contact will not gain access.' });
            reload();
          })
          .catch((e: any) => toast({ title: 'Could not deny', description: e.message, variant: 'destructive' }))
          .finally(() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            url.searchParams.delete('token');
            window.history.replaceState({}, '', url.toString());
          });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addContact() {
    if (!newEmail.trim()) { toast({ title: 'Email required', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      await api('/api/emergency/add-contact', {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim() || undefined,
          waitingPeriodHours: Number(newWait),
        }),
      });
      toast({ variant: 'success', title: 'Contact added', description: 'They\'ve been notified by email.' });
      setShowAdd(false); setNewEmail(''); setNewName(''); setNewWait('168');
      await reload();
    } catch (e: any) {
      toast({ title: 'Could not add', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteContact(c: Contact) {
    try {
      await api(`/api/emergency/contacts/${c.id}`, { method: 'DELETE' });
      setContacts((prev) => prev.filter((x) => x.id !== c.id));
      toast({ variant: 'success', title: 'Contact removed' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setPendingDelete(null);
    }
  }

  async function denyRequest(r: RequestRow) {
    // We don't have the access_token here — it lives on the server. For deny
    // from the UI we'd need to expose a separate "deny by request id" endpoint.
    // The email link uses the token-based path; here we just inform the user.
    toast({
      title: 'Use the email deny link',
      description: 'Open the email we sent you when this request was made and click "Deny" — the link is bound to the request.',
    });
  }

  async function requestAccess() {
    if (!requestOwnerEmail.trim()) { toast({ title: 'Owner email required', variant: 'destructive' }); return; }
    setRequesting(true);
    try {
      const r = await api<{ unlocksAt: string }>('/api/emergency/request-access', {
        method: 'POST',
        body: JSON.stringify({ ownerEmail: requestOwnerEmail.trim() }),
      });
      toast({
        variant: 'success',
        title: 'Request sent',
        description: `Access unlocks ${formatDistanceToNow(new Date(r.unlocksAt), { addSuffix: true })} unless the owner denies it.`,
      });
      setRequestOwnerEmail('');
    } catch (e: any) {
      toast({ title: 'Request failed', description: e.message, variant: 'destructive' });
    } finally {
      setRequesting(false);
    }
  }

  const pendingCount = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <HeartHandshake className="w-6 h-6 text-rose-500" />
            Emergency Access
          </h1>
          <p className="text-sm text-muted-foreground">Designate trusted people who can request access to your encrypted vault if you become inactive.</p>
        </div>
      </div>

      <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-sm">
        <CardContent className="pt-5 flex gap-3">
          <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">How it works</p>
            <p className="text-muted-foreground mt-1">
              Contacts you add can request access if you don't sign in for the waiting period you choose.
              You'll get an email with a 24-hour window to deny the request before access is granted.
              The vault remains encrypted — your contact still needs your master password (left in a sealed envelope or with a lawyer) to read it.
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingCount > 0 && (
        <Card className="rounded-2xl border-red-500/40 bg-red-500/5 shadow-sm" data-testid="emergency-pending-banner">
          <CardContent className="pt-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm flex-1">
              <p className="font-semibold text-foreground">
                {pendingCount} pending access request{pendingCount > 1 ? 's' : ''}
              </p>
              <p className="text-muted-foreground mt-1">
                Open the deny email we sent if you didn't expect these requests, and consider rotating your master password.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trusted contacts */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <HeartHandshake className="w-4 h-4" /> Trusted Contacts
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="emergency-add-contact">
            <Plus className="w-4 h-4 mr-1.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : contacts.length === 0 && !showAdd ? (
            <div className="text-center py-10">
              <HeartHandshake className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No trusted contacts yet.</p>
              <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" /> Add your first contact</Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
                  <div className="w-9 h-9 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 text-sm font-semibold shrink-0">
                    {(c.contact_name?.[0] || c.contact_email[0]).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{c.contact_name || c.contact_email}</div>
                    {c.contact_name && <div className="text-xs text-muted-foreground truncate">{c.contact_email}</div>}
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> Waits {WAIT_OPTIONS.find((o) => Number(o.value) === c.waiting_period_hours)?.label || `${c.waiting_period_hours}h`}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setPendingDelete(c)} aria-label="Remove">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> New trusted contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ec-email">Email</Label>
              <Input id="ec-email" type="email" placeholder="trusted@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} data-testid="emergency-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-name">Name (optional)</Label>
              <Input id="ec-name" placeholder="Mom, Best friend, Lawyer…" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Inactivity waiting period</Label>
              <Select value={newWait} onValueChange={setNewWait}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WAIT_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                If you don't sign in for this long, this contact may request access. You always get 24h to deny once a request is made.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => { setShowAdd(false); setNewEmail(''); setNewName(''); setNewWait('168'); }}>Cancel</Button>
              <Button onClick={addContact} disabled={submitting} data-testid="emergency-submit-contact">
                {submitting ? 'Adding…' : 'Add Contact'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Inbound requests against MY account */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" /> Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No requests yet — this is a good thing.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => {
                const tone =
                  r.status === 'pending' ? 'border-amber-500/40 bg-amber-500/5'
                  : r.status === 'granted' ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-border/60 bg-card opacity-70';
                return (
                  <div key={r.id} className={`p-3 rounded-xl border ${tone} flex items-center gap-3`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{r.contact_name || r.contact_email}</span>
                        <Badge variant={r.status === 'denied' ? 'secondary' : r.status === 'granted' ? 'default' : 'outline'} className="text-[10px]">
                          {r.status}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Requested {format(new Date(r.requested_at), 'MMM d, HH:mm')}
                        {r.status === 'pending' && (
                          <> · Unlocks {formatDistanceToNow(new Date(r.unlocks_at), { addSuffix: true })}</>
                        )}
                        {r.status === 'denied' && r.denied_at && (
                          <> · Denied {formatDistanceToNow(new Date(r.denied_at), { addSuffix: true })}</>
                        )}
                      </div>
                    </div>
                    {r.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => denyRequest(r)} className="shrink-0">
                        <X className="w-3.5 h-3.5 mr-1" /> Deny
                      </Button>
                    )}
                    {r.status === 'granted' && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact-side: request access on someone else's account */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" /> Request Access (Someone Designated You)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            If someone added you as their trusted contact and you need to request access to their vault (e.g. they're incapacitated), enter their account email below.
          </p>
          <div className="flex gap-2">
            <Input placeholder="owner@example.com" value={requestOwnerEmail} onChange={(e) => setRequestOwnerEmail(e.target.value)} data-testid="emergency-owner-input" />
            <Button onClick={requestAccess} disabled={requesting} data-testid="emergency-request-access">
              {requesting ? 'Requesting…' : 'Request Access'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            They'll get an email and have 24 hours to deny. After their configured waiting period passes (if not denied), you'll receive a one-time link to download their encrypted vault. You'll still need their master password — given to you out-of-band — to decrypt it.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove trusted contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.contact_email} will no longer be able to request emergency access to your vault.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && deleteContact(pendingDelete)} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
