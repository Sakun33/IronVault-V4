import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/page-hero';
import { ShieldAlert, ShieldCheck, ShieldX, AlertTriangle, Search, ExternalLink, Trash2, Clock } from 'lucide-react';
import { apiBase } from '@/native/platform';

const HISTORY_KEY = 'iv_phishing_history_v1';

interface PhishingCheckResult {
  url: string;
  host: string;
  severity: 'clean' | 'warn' | 'phishing';
  reasons: string[];
  safeBrowsingChecked: boolean;
  safeBrowsingMatches: number;
  checkedAt: string;
}

interface HistoryEntry {
  url: string;
  host: string;
  severity: PhishingCheckResult['severity'];
  reasons: string[];
  checkedAt: string;
}

const SEVERITY_STYLES: Record<PhishingCheckResult['severity'], { card: string; chip: string; label: string; icon: any }> = {
  clean:     { card: 'bg-emerald-500/5 border-emerald-500/30', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: 'Looks safe',     icon: ShieldCheck },
  warn:      { card: 'bg-amber-500/5 border-amber-500/30',     chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',     label: 'Be careful',    icon: AlertTriangle },
  phishing:  { card: 'bg-red-500/5 border-red-500/30',         chip: 'bg-red-500/15 text-red-300 border-red-500/30',           label: 'Likely phishing', icon: ShieldX },
};

export default function PhishingShieldPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PhishingCheckResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const score = useMemo(() => {
    if (!result) return 100;
    if (result.severity === 'phishing') return 15;
    if (result.severity === 'warn') return 55;
    return 95;
  }, [result]);

  const check = async () => {
    const target = url.trim();
    if (!target) {
      toast({ title: 'Paste a URL to check', variant: 'destructive' });
      return;
    }
    setChecking(true);
    try {
      const res = await fetch(`${apiBase()}/api/security/phishing-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: 'Check failed', description: body?.error || `HTTP ${res.status}`, variant: 'destructive' });
        return;
      }
      const data = (await res.json()) as PhishingCheckResult;
      setResult(data);
      const entry: HistoryEntry = {
        url: data.url, host: data.host, severity: data.severity, reasons: data.reasons, checkedAt: data.checkedAt,
      };
      setHistory(prev => [entry, ...prev.filter(h => h.url !== data.url)].slice(0, 50));
      toast({
        title: SEVERITY_STYLES[data.severity].label,
        description: data.severity === 'clean' ? 'No red flags found.' : `${data.reasons.length} issue${data.reasons.length === 1 ? '' : 's'} detected.`,
        variant: data.severity === 'phishing' ? 'destructive' : data.severity === 'warn' ? 'destructive' : 'success',
      });
    } catch (err) {
      toast({ title: 'Check failed', description: err instanceof Error ? err.message : 'Network error', variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    toast({ title: 'History cleared' });
  };

  const removeFromHistory = (target: string) => {
    setHistory(prev => prev.filter(h => h.url !== target));
  };

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-rose-400" /> Phishing Shield
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Paste a URL — we check it against Google Safe Browsing and a curated list of phishing patterns before you click.</p>
      </div>

      <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none mb-4">
        <CardContent className="pt-5 pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') check(); }}
                placeholder="https://example.com/login or paste any link"
                className="pl-9"
                autoFocus
              />
            </div>
            <Button onClick={check} disabled={checking}>{checking ? 'Checking…' : 'Check URL'}</Button>
          </div>
        </CardContent>
      </Card>

      {result && (() => {
        const style = SEVERITY_STYLES[result.severity];
        const Icon = style.icon;
        return (
          <Card className={`rounded-2xl border backdrop-blur-xl shadow-none mb-4 ${style.card}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Icon className={`w-10 h-10 ${result.severity === 'clean' ? 'text-emerald-400' : result.severity === 'warn' ? 'text-amber-400' : 'text-red-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border ${style.chip}`}>{style.label}</span>
                    <span className="text-2xl font-bold">{score}<span className="text-sm text-muted-foreground">/100</span></span>
                  </div>
                  <div className="font-mono text-sm break-all mt-2">{result.url}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Host: {result.host}</div>

                  {result.reasons.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {result.reasons.map((r, i) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground">
                    <span>
                      Safe Browsing: {result.safeBrowsingChecked
                        ? result.safeBrowsingMatches > 0 ? <span className="text-red-400 font-semibold">{result.safeBrowsingMatches} match{result.safeBrowsingMatches === 1 ? '' : 'es'}</span> : 'clean'
                        : <span className="text-amber-400">not configured</span>}
                    </span>
                    {result.severity !== 'phishing' && (
                      <a href={result.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" /> Recent checks ({history.length})
            </h2>
            <Button variant="ghost" size="sm" onClick={clearHistory}>Clear</Button>
          </div>
          <Card className="rounded-2xl border bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl border-black/[0.08] dark:border-white/[0.08] shadow-none">
            <CardContent className="py-2">
              <ul className="divide-y divide-border/40">
                {history.slice(0, 30).map((h, i) => {
                  const style = SEVERITY_STYLES[h.severity];
                  const Icon = style.icon;
                  return (
                    <li key={i} className="py-2 flex items-center gap-2">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${h.severity === 'clean' ? 'text-emerald-400' : h.severity === 'warn' ? 'text-amber-400' : 'text-red-400'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-mono truncate">{h.host}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(h.checkedAt).toLocaleString()} · {h.reasons.length} issue{h.reasons.length === 1 ? '' : 's'}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${style.chip}`}>{h.severity}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromHistory(h.url)}><Trash2 className="w-3 h-3" /></Button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {!result && history.length === 0 && (
        <PageHero
          icon={ShieldAlert}
          title="Check before you click"
          subtitle="Paste any link to scan for phishing patterns: brand impersonation in subdomains, IDN homographs, suspicious TLDs, and known Google Safe Browsing matches."
          accent="rose"
          badges={[{ label: 'Heuristic engine' }, { label: 'Google Safe Browsing' }]}
        />
      )}

      <p className="text-[11px] text-muted-foreground text-center mt-6">
        Heuristic scan runs offline; Google Safe Browsing lookup requires GOOGLE_SAFE_BROWSING_API_KEY on the server.
      </p>
    </div>
  );
}
