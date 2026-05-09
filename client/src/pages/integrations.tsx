import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Webhook, Plus, Trash2, Send, ExternalLink, Zap, ArrowLeft,
  CheckCircle2, XCircle, Activity, Copy,
} from 'lucide-react';
import { Link } from 'wouter';
import { apiBase } from '@/native/platform';
import { getCloudToken } from '@/lib/cloud-vault-sync';
import { format } from 'date-fns';

const EVENTS: { id: string; label: string; description: string }[] = [
  { id: 'password_added',                  label: 'Password Added',          description: 'Fires when a new password is saved' },
  { id: 'password_updated',                label: 'Password Updated',        description: 'Fires when an existing password changes' },
  { id: 'password_deleted',                label: 'Password Deleted',        description: 'Fires when a password is removed' },
  { id: 'subscription_renewal_upcoming',   label: 'Renewal Upcoming',        description: '7, 3, or 1 day before a subscription renews' },
  { id: 'security_score_changed',          label: 'Security Score Changed',  description: 'Fires when your security score moves up or down' },
  { id: 'vault_synced',                    label: 'Vault Synced',            description: 'Fires after a successful cloud sync' },
  { id: 'expense_added',                   label: 'Expense Added',           description: 'Fires when a new expense is logged' },
];

const PROVIDERS: { name: string; tagline: string; href: string; color: string }[] = [
  { name: 'Zapier', tagline: 'Connect IronVault to 5000+ apps via Zaps', href: 'https://zapier.com/apps/webhook/integrations', color: 'from-orange-500 to-amber-500' },
  { name: 'Make',   tagline: 'Build visual automation flows (formerly Integromat)', href: 'https://www.make.com/en/help/tools/webhooks', color: 'from-purple-500 to-fuchsia-500' },
  { name: 'n8n',    tagline: 'Open-source self-hosted automation', href: 'https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/', color: 'from-rose-500 to-pink-500' },
];

interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  last_fired_at: string | null;
  last_status: number | null;
  created_at: string;
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

export default function Integrations() {
  const { toast } = useToast();
  const [hooks, setHooks] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WebhookRow | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>(['password_added']);
  const [submitting, setSubmitting] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const r = await api<{ webhooks: WebhookRow[] }>('/api/webhooks');
      setHooks(r.webhooks || []);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { reload(); }, []);

  async function addHook() {
    if (!newUrl.trim()) { toast({ title: 'URL required', variant: 'destructive' }); return; }
    if (newEvents.length === 0) { toast({ title: 'Pick at least one event', variant: 'destructive' }); return; }
    setSubmitting(true);
    try {
      await api('/api/webhooks/register', {
        method: 'POST',
        body: JSON.stringify({ url: newUrl.trim(), events: newEvents }),
      });
      toast({ variant: 'success', title: 'Webhook registered' });
      setShowAdd(false);
      setNewUrl(''); setNewEvents(['password_added']);
      await reload();
    } catch (e: any) {
      toast({ title: 'Could not register', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleHook(h: WebhookRow) {
    try {
      await api(`/api/webhooks/${h.id}/toggle`, { method: 'POST', body: JSON.stringify({ active: !h.active }) });
      setHooks((prev) => prev.map((x) => x.id === h.id ? { ...x, active: !x.active } : x));
    } catch (e: any) {
      toast({ title: 'Toggle failed', description: e.message, variant: 'destructive' });
    }
  }

  async function deleteHook(h: WebhookRow) {
    try {
      await api(`/api/webhooks/${h.id}`, { method: 'DELETE' });
      setHooks((prev) => prev.filter((x) => x.id !== h.id));
      toast({ variant: 'success', title: 'Webhook removed' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setPendingDelete(null);
    }
  }

  async function testHook(h: WebhookRow) {
    toast({ title: 'Sending test payload…' });
    try {
      const r = await api<{ success: boolean; status: number; body?: string; error?: string }>(`/api/webhooks/test/${h.id}`, { method: 'POST' });
      if (r.success) {
        toast({ variant: 'success', title: `Test OK (${r.status})`, description: 'Receiver responded with success' });
      } else {
        toast({ title: `Test failed (${r.status || 'no response'})`, description: r.error || (r.body || '').slice(0, 120), variant: 'destructive' });
      }
      await reload();
    } catch (e: any) {
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    }
  }

  const eventLabel = useMemo(() => Object.fromEntries(EVENTS.map((e) => [e.id, e.label])), []);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">Connect IronVault events to Zapier, Make, n8n, or any HTTP endpoint.</p>
        </div>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="w-4 h-4" /> Your Webhooks
          </CardTitle>
          <Button size="sm" onClick={() => setShowAdd(true)} data-testid="webhook-add">
            <Plus className="w-4 h-4 mr-1.5" /> Add Webhook
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : hooks.length === 0 && !showAdd ? (
            <div className="text-center py-10">
              <Webhook className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No webhooks yet. Add one to send events to your favourite automation tool.</p>
              <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" /> Add your first webhook</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {hooks.map((h) => (
                <div key={h.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl border border-border/60 bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <code className="text-xs sm:text-sm font-mono truncate text-foreground">{h.url}</code>
                      <Button
                        size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                        onClick={() => { navigator.clipboard.writeText(h.url); toast({ title: 'URL copied' }); }}
                        aria-label="Copy URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {h.events.map((e) => (
                        <Badge key={e} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">{eventLabel[e] || e}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {h.last_fired_at ? (
                        <span className="flex items-center gap-1">
                          {h.last_status && h.last_status >= 200 && h.last_status < 300
                            ? <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            : <XCircle className="w-3 h-3 text-red-500" />}
                          Last fired {format(new Date(h.last_fired_at), 'MMM d, HH:mm')} · {h.last_status || 'no response'}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Never fired</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={h.active} onCheckedChange={() => toggleHook(h)} aria-label="Active" />
                    <Button size="icon" variant="ghost" onClick={() => testHook(h)} aria-label="Send test"><Send className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setPendingDelete(h)} aria-label="Delete">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4" /> New Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input id="webhook-url" placeholder="https://hooks.zapier.com/hooks/catch/..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} data-testid="webhook-url-input" />
                <p className="text-[11px] text-muted-foreground">Must be an HTTPS endpoint. Payloads are JSON.</p>
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {EVENTS.map((ev) => {
                    const checked = newEvents.includes(ev.id);
                    return (
                      <label key={ev.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer ${checked ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-accent/40'}`}>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            setNewEvents((prev) => v ? [...prev, ev.id] : prev.filter((x) => x !== ev.id));
                          }}
                          className="mt-0.5"
                        />
                        <div className="text-xs">
                          <div className="font-medium text-foreground">{ev.label}</div>
                          <div className="text-muted-foreground">{ev.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => { setShowAdd(false); setNewUrl(''); setNewEvents(['password_added']); }}>Cancel</Button>
                <Button onClick={addHook} disabled={submitting} data-testid="webhook-submit">
                  {submitting ? 'Saving…' : 'Register Webhook'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4" /> Setup Guides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROVIDERS.map((p) => (
              <a key={p.name} href={p.href} target="_blank" rel="noopener noreferrer" className="group">
                <div className="p-4 rounded-xl border border-border/60 hover:border-primary/60 hover:shadow-md transition-all bg-card h-full">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} mb-3 flex items-center justify-center text-white font-bold`}>
                    {p.name[0]}
                  </div>
                  <div className="font-semibold text-sm flex items-center gap-1.5 group-hover:text-primary">
                    {p.name} <ExternalLink className="w-3 h-3 opacity-60" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.tagline}</p>
                </div>
              </a>
            ))}
          </div>
          <div className="mt-4 text-[11px] text-muted-foreground space-y-1">
            <p>1. Pick a tool and create a "Webhook" or "Catch Hook" trigger.</p>
            <p>2. Copy the resulting URL and paste it into the form above.</p>
            <p>3. Hit "Send test" to confirm it's wired up.</p>
            <p className="pt-2 italic">Payloads contain event metadata only — never your actual passwords or secrets.</p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this webhook?</AlertDialogTitle>
            <AlertDialogDescription>The endpoint will stop receiving events immediately. You can add it back any time.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && deleteHook(pendingDelete)} className="bg-red-600 hover:bg-red-700">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
