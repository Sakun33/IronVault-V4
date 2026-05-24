import { useState, useMemo, useEffect } from 'react';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'wouter';
import { PageHero } from '@/components/page-hero';
import { Clock, ShieldAlert, ShieldCheck, ChevronRight, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { scanBreaches } from '@/lib/breach-checker';

interface TimelineEntry {
  passwordId: string;
  name: string;
  username?: string;
  url?: string;
  domain?: string;
  occurrences: number;
  /** Severity bucket — same scale as the dark-web monitor. */
  severity: 'critical' | 'high' | 'medium';
  /**
   * Approximate breach date — we don't have access to per-breach metadata
   * without HIBP API key, so we use the password's `updatedAt` as a
   * placeholder until the user wires HIBP's /breachedaccount endpoint.
   */
  firstSeen: string;
}

function severityFor(n: number): TimelineEntry['severity'] {
  if (n >= 100_000) return 'critical';
  if (n >= 1_000) return 'high';
  return 'medium';
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function domainOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.includes('://') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch { return undefined; }
}

const SEV_DOT: Record<TimelineEntry['severity'], string> = {
  critical: 'bg-red-500 ring-red-500/30',
  high:     'bg-amber-500 ring-amber-500/30',
  medium:   'bg-yellow-500 ring-yellow-500/30',
};
const SEV_CHIP: Record<TimelineEntry['severity'], string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  high:     'bg-amber-500/15 text-amber-300 border-amber-500/30',
  medium:   'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
};

export default function BreachTimelinePage() {
  const { passwords } = useVault();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [entries, setEntries] = useState<TimelineEntry[]>(() => {
    // Seed from existing per-password breach flags so the page renders
    // immediately on first visit even before a fresh scan.
    return passwords
      .filter((p: any) => p.isBreached === true || p.breached === true || Number(p.breachOccurrences ?? 0) > 0)
      .map((p: any) => ({
        passwordId: p.id,
        name: p.name,
        username: p.username,
        url: p.url,
        domain: domainOf(p.url),
        occurrences: Number(p.breachOccurrences ?? p.occurrences ?? 1),
        severity: severityFor(Number(p.breachOccurrences ?? p.occurrences ?? 1)),
        firstSeen: (p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt || p.createdAt || Date.now())).toISOString(),
      }))
      .sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
  });

  // Re-seed when passwords change (vault sync, edits).
  useEffect(() => {
    const seeded = passwords
      .filter((p: any) => p.isBreached === true || p.breached === true)
      .map((p: any) => ({
        passwordId: p.id,
        name: p.name,
        username: p.username,
        url: p.url,
        domain: domainOf(p.url),
        occurrences: Number(p.breachOccurrences ?? p.occurrences ?? 1),
        severity: severityFor(Number(p.breachOccurrences ?? p.occurrences ?? 1)),
        firstSeen: (p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt || p.createdAt || Date.now())).toISOString(),
      }))
      .sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
    if (seeded.length > 0) setEntries(seeded);
  }, [passwords]);

  // Group by year for the timeline rail. Each year shows month/day on the
  // entry card — typical case is a small handful of breaches per year so
  // the rail stays readable without virtualization.
  const grouped = useMemo(() => {
    const byYear: Record<string, TimelineEntry[]> = {};
    for (const e of entries) {
      const y = new Date(e.firstSeen).getFullYear().toString();
      (byYear[y] = byYear[y] || []).push(e);
    }
    return Object.entries(byYear).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const stats = useMemo(() => ({
    total: entries.length,
    critical: entries.filter(e => e.severity === 'critical').length,
    high: entries.filter(e => e.severity === 'high').length,
    medium: entries.filter(e => e.severity === 'medium').length,
    exposed: entries.reduce((sum, e) => sum + e.occurrences, 0),
  }), [entries]);

  const runScan = async () => {
    if (scanning) return;
    if (passwords.length === 0) {
      toast({ title: 'Nothing to scan', description: 'Add a password first.' });
      return;
    }
    setScanning(true);
    try {
      const results = await scanBreaches(passwords.map(p => ({ entry: p, password: p.password })));
      const next: TimelineEntry[] = results
        .filter(r => r.count > 0)
        .map(r => {
          const p: any = r.entry;
          return {
            passwordId: p.id,
            name: p.name,
            username: p.username,
            url: p.url,
            domain: domainOf(p.url),
            occurrences: r.count,
            severity: severityFor(r.count),
            firstSeen: (p.updatedAt instanceof Date ? p.updatedAt : new Date(p.updatedAt || p.createdAt || Date.now())).toISOString(),
          };
        })
        .sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
      setEntries(next);
      toast({
        title: next.length > 0 ? `${next.length} breached` : 'All clear',
        description: next.length > 0
          ? `Your timeline shows ${next.length} compromised credential${next.length === 1 ? '' : 's'}.`
          : `Scanned ${passwords.length} passwords — none found in any breach.`,
        variant: next.length > 0 ? 'destructive' : 'success',
      });
    } catch (err) {
      toast({ title: 'Scan failed', description: err instanceof Error ? err.message : 'Try again', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  if (passwords.length === 0) {
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        <PageHero
          icon={Clock}
          title="Breach Timeline"
          subtitle="Visualize every credential of yours that's appeared in a known data breach, ordered by when the password was last touched."
          accent="rose"
          badges={[{ label: 'k-anonymity HIBP' }, { label: 'Cross-account view' }]}
          cta={{ label: 'Add a password to begin', onClick: () => { window.location.href = '/passwords'; }, icon: ShieldAlert }}
        />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="w-7 h-7 text-rose-400" /> Breach Timeline
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total} compromised credential{stats.total === 1 ? '' : 's'} · {stats.exposed.toLocaleString()} total breach hits
          </p>
        </div>
        <Button onClick={runScan} disabled={scanning} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning…' : 'Rescan'}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <Card className="rounded-2xl border bg-red-500/5 backdrop-blur-xl border-red-500/20 shadow-none">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Critical</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-amber-500/5 backdrop-blur-xl border-amber-500/20 shadow-none">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats.high}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">High</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border bg-yellow-500/5 backdrop-blur-xl border-yellow-500/20 shadow-none">
          <CardContent className="pt-4 pb-3 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.medium}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Medium</div>
          </CardContent>
        </Card>
      </div>

      {entries.length === 0 ? (
        <Card className="rounded-2xl border bg-emerald-500/5 backdrop-blur-xl border-emerald-500/20 shadow-none">
          <CardContent className="py-10 text-center">
            <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
            <div className="font-semibold text-emerald-300">Timeline is empty</div>
            <div className="text-sm text-muted-foreground mt-1">None of your saved passwords show up in any known breach.</div>
            <Button variant="outline" className="mt-4" onClick={runScan} disabled={scanning}>
              <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} /> {scanning ? 'Scanning…' : 'Run a fresh scan'}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(([year, items]) => (
            <div key={year}>
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2 mb-2">
                <h2 className="text-lg font-bold tracking-wide flex items-center gap-2">
                  {year}
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-normal">{items.length} entr{items.length === 1 ? 'y' : 'ies'}</span>
                </h2>
              </div>
              <div className="relative pl-7">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                {items.map(entry => (
                  <div key={entry.passwordId} className="relative mb-3">
                    <div className={`absolute -left-[22px] top-3 w-3 h-3 rounded-full ring-4 ${SEV_DOT[entry.severity]}`} />
                    <Card className="rounded-xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
                      <CardContent className="py-3 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{entry.name}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${SEV_CHIP[entry.severity]}`}>{entry.severity}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {entry.username || '—'} · last touched {formatLongDate(entry.firstSeen)}
                          </div>
                          <div className="text-xs mt-1 flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Seen <span className="text-foreground font-semibold">{entry.occurrences.toLocaleString()}</span> time{entry.occurrences === 1 ? '' : 's'} in breach corpora</span>
                          </div>
                        </div>
                        <Link href={`/passwords?openId=${encodeURIComponent(entry.passwordId)}`}>
                          <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline whitespace-nowrap">
                            Change <ChevronRight className="w-3 h-3" />
                          </a>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center mt-6 flex items-center justify-center gap-1">
        Powered by Have I Been Pwned (Pwned Passwords) ·
        <a href="https://haveibeenpwned.com" target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 hover:underline">
          source <ExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
}
