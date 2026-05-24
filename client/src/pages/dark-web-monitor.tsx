import { useState, useEffect, useMemo } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHero } from '@/components/page-hero';
import {
  Shield, ShieldAlert, ShieldCheck, RefreshCw, AlertTriangle,
  Clock, ExternalLink, KeyRound, ChevronRight,
} from 'lucide-react';
import { Link } from 'wouter';
import { scanBreaches, type BreachScanResult } from '@/lib/breach-checker';

const HISTORY_KEY = 'iv_dark_web_history_v1';
const MONITOR_FLAG = 'iv_dark_web_monitor_enabled';
const LAST_SCAN_KEY = 'iv_dark_web_last_scan';

interface ScanHistoryEntry {
  ts: string;
  total: number;
  breached: number;
}

interface BreachedItem {
  id: string;
  name: string;
  username?: string;
  url?: string;
  occurrences: number;
  severity: 'critical' | 'high' | 'medium';
}

function severityFor(occurrences: number): BreachedItem['severity'] {
  if (occurrences >= 100_000) return 'critical';
  if (occurrences >= 1_000) return 'high';
  return 'medium';
}

const SEVERITY_STYLES: Record<BreachedItem['severity'], string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  high:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  medium:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
};

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const diffMs = Date.now() - t;
  if (diffMs < 60_000) return 'just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function DarkWebMonitorPage() {
  const { passwords } = useVault();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [breached, setBreached] = useState<BreachedItem[]>([]);
  const [lastScan, setLastScan] = useState<string | null>(() => localStorage.getItem(LAST_SCAN_KEY));
  const [history, setHistory] = useState<ScanHistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [monitorEnabled, setMonitorEnabled] = useState<boolean>(
    () => localStorage.getItem(MONITOR_FLAG) === '1'
  );

  // Pre-populate breached list from existing per-password `isBreached` flags
  // so the page renders something meaningful before the first scan.
  useEffect(() => {
    const fromVault: BreachedItem[] = passwords
      .filter((p: any) => p.isBreached === true || p.breached === true)
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        username: p.username,
        url: p.url,
        occurrences: Number(p.breachOccurrences ?? p.occurrences ?? 1),
        severity: severityFor(Number(p.breachOccurrences ?? p.occurrences ?? 1)),
      }));
    if (fromVault.length > 0) setBreached(fromVault);
  }, [passwords]);

  const summary = useMemo(() => {
    const total = passwords.length;
    const critical = breached.filter(b => b.severity === 'critical').length;
    const high = breached.filter(b => b.severity === 'high').length;
    const medium = breached.filter(b => b.severity === 'medium').length;
    return { total, critical, high, medium };
  }, [breached, passwords.length]);

  const runScan = async () => {
    if (scanning) return;
    if (passwords.length === 0) {
      toast({ title: 'Nothing to scan', description: 'Add at least one password first.' });
      return;
    }
    setScanning(true);
    setProgress({ done: 0, total: passwords.length });
    try {
      const results: BreachScanResult<any>[] = await scanBreaches(
        passwords.map(p => ({ entry: p, password: p.password })),
        (p) => setProgress({ done: p.done, total: p.total }),
      );
      const hits: BreachedItem[] = results
        .filter(r => r.count > 0)
        .map(r => {
          const p: any = r.entry;
          return {
            id: p.id,
            name: p.name,
            username: p.username,
            url: p.url,
            occurrences: r.count,
            severity: severityFor(r.count),
          };
        });
      setBreached(hits);

      const ts = new Date().toISOString();
      setLastScan(ts);
      localStorage.setItem(LAST_SCAN_KEY, ts);

      const entry: ScanHistoryEntry = { ts, total: passwords.length, breached: hits.length };
      const nextHistory = [entry, ...history].slice(0, 30);
      setHistory(nextHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));

      toast({
        title: hits.length > 0 ? `${hits.length} compromised` : 'All clear',
        description: hits.length > 0
          ? `${hits.length} of ${passwords.length} passwords found in known breaches.`
          : `Scanned ${passwords.length} passwords — none found in any breach.`,
        variant: hits.length > 0 ? 'destructive' : 'success',
      });
    } catch (err) {
      toast({
        title: 'Scan failed',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setScanning(false);
    }
  };

  const toggleMonitor = (enabled: boolean) => {
    setMonitorEnabled(enabled);
    localStorage.setItem(MONITOR_FLAG, enabled ? '1' : '0');
    toast({
      title: enabled ? 'Daily monitoring on' : 'Daily monitoring off',
      description: enabled
        ? 'Your vault will be rescanned automatically once per day while the app is open.'
        : 'Automatic rescans disabled. Use "Scan now" anytime.',
    });
  };

  // Auto-rescan once per 24h if monitoring is enabled and the page is open.
  useEffect(() => {
    if (!monitorEnabled) return;
    const sinceMs = lastScan ? Date.now() - new Date(lastScan).getTime() : Infinity;
    if (sinceMs < 24 * 60 * 60 * 1000) return;
    void runScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitorEnabled]);

  if (passwords.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={ShieldAlert}
          title="Dark Web Monitor"
          subtitle="Continuously check your saved passwords against the Have I Been Pwned breach database — without ever sending the actual passwords off your device."
          accent="rose"
          badges={[{ label: 'k-anonymity HIBP' }, { label: 'Daily auto-scan' }]}
          cta={{ label: 'Add a password to begin', onClick: () => { window.location.href = '/passwords'; }, icon: KeyRound }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-rose-400" /> Dark Web Monitor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lastScan ? <>Last scan {formatRelative(lastScan)}</> : 'Never scanned'}
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? `Scanning ${progress.done}/${progress.total}…` : 'Scan now'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Scanned</div>
            <div className="text-3xl font-bold mt-1">{summary.total}</div>
            <div className="text-xs text-muted-foreground mt-1">passwords in vault</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-red-500/5 backdrop-blur-xl border-red-500/20 shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="text-xs uppercase tracking-wider text-red-400">Critical</div>
            <div className="text-3xl font-bold mt-1 text-red-400">{summary.critical}</div>
            <div className="text-xs text-muted-foreground mt-1">100k+ breach hits</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-amber-500/5 backdrop-blur-xl border-amber-500/20 shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="text-xs uppercase tracking-wider text-amber-400">High</div>
            <div className="text-3xl font-bold mt-1 text-amber-400">{summary.high}</div>
            <div className="text-xs text-muted-foreground mt-1">1k+ breach hits</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-yellow-500/5 backdrop-blur-xl border-yellow-500/20 shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="text-xs uppercase tracking-wider text-yellow-400">Medium</div>
            <div className="text-3xl font-bold mt-1 text-yellow-400">{summary.medium}</div>
            <div className="text-xs text-muted-foreground mt-1">&lt; 1k breach hits</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-6">
        <CardContent className="py-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold">Daily monitoring</div>
              <div className="text-xs text-muted-foreground">
                Re-checks your vault every 24h while the app is open. Hashing happens on-device; only 5-char SHA-1 prefixes leave.
              </div>
            </div>
          </div>
          <Switch checked={monitorEnabled} onCheckedChange={toggleMonitor} />
        </CardContent>
      </Card>

      {breached.length > 0 ? (
        <div className="space-y-2 mb-6">
          <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Compromised passwords ({breached.length})
          </h2>
          <div className="space-y-2">
            {breached.map(b => (
              <Card key={b.id} className="rounded-xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
                <CardContent className="py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="font-semibold truncate">{b.name}</div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${SEVERITY_STYLES[b.severity]}`}>{b.severity}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {b.username || '—'} · seen {b.occurrences.toLocaleString()}× in breaches
                    </div>
                  </div>
                  <Link href={`/passwords?openId=${encodeURIComponent(b.id)}`}>
                    <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Change <ChevronRight className="w-3 h-3" />
                    </a>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : lastScan ? (
        <Card className="rounded-2xl border bg-emerald-500/5 backdrop-blur-xl border-emerald-500/20 shadow-none mb-6">
          <CardContent className="py-6 text-center">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <div className="font-semibold text-emerald-300">All clear</div>
            <div className="text-xs text-muted-foreground mt-1">No vault passwords found in any known breach.</div>
          </CardContent>
        </Card>
      ) : null}

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" /> Scan history
          </h2>
          <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
            <CardContent className="py-2">
              <ul className="divide-y divide-border/40">
                {history.slice(0, 10).map((h, i) => (
                  <li key={i} className="py-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                    <span>
                      <span className="text-foreground">{h.total}</span>
                      {' '}scanned ·{' '}
                      <span className={h.breached > 0 ? 'text-red-400 font-semibold' : 'text-emerald-400'}>
                        {h.breached} compromised
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center mt-6 flex items-center justify-center gap-1">
        <Shield className="w-3 h-3" /> Powered by Have I Been Pwned · only 5-char SHA-1 prefixes leave your device
        <a href="https://haveibeenpwned.com/Passwords" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 hover:underline">
          <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
