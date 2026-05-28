/**
 * Security Scanner page.
 *
 * Deep device + browser + vault + network security audit.
 * Runs the engine in `@/lib/security-scanner`, renders a hero score ring,
 * per-category cards, and an actionable findings list. Includes:
 *   - Run/Re-run scan button with live progress
 *   - History trend (sparkline)
 *   - Bumblebee desktop supply-chain report parser (web only)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldAlert, ShieldCheck, ScanSearch, Loader2, ChevronRight,
  Monitor, Smartphone, Globe, Lock, AlertTriangle, CheckCircle2, Info,
  XCircle, RefreshCw, Trash2, Upload, FileText, History, ArrowRight,
  Wifi, Eye, Sparkles,
} from 'lucide-react';

import { useAuth } from '@/contexts/auth-context';
import { useVault } from '@/contexts/vault-context';
import { vaultStorage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { runScan } from '@/lib/security-scanner/engine';
import {
  type ScanResult, type Finding, type Severity, type Category,
  gradeFromScore,
} from '@/lib/security-scanner/types';
import { loadHistory, saveScan, clearHistory } from '@/lib/security-scanner/history';
import { parseBumblebee, type BumblebeeReport } from '@/lib/security-scanner/bumblebee';
import { Capacitor } from '@capacitor/core';

// ─── Motion helpers ──────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

// ─── Hero ring ───────────────────────────────────────────────────────────────
function ScoreRing({ score, grade, scanning }: { score: number; grade: string; scanning: boolean }) {
  const [anim, setAnim] = useState(0);
  const size = 180, sw = 12;
  const r = (size - sw) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (anim / 100) * circ;

  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 120);
    return () => clearTimeout(t);
  }, [score]);

  const tone =
    score >= 90 ? { stroke: '#10b981', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' } :
    score >= 70 ? { stroke: '#3b82f6', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' } :
    score >= 50 ? { stroke: '#f59e0b', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' } :
                  { stroke: '#ef4444', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={scanning ? 'animate-pulse' : ''}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
          <circle
            cx={cx} cy={cy} r={r} fill="none" stroke={tone.stroke} strokeWidth={sw}
            strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 1.6s cubic-bezier(0.4,0,0.2,1)' }}
          />
          <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
                fontSize="44" fontWeight="800" fill="currentColor" className="text-foreground">
            {anim}
          </text>
          <text x={cx} y={cy + 22} textAnchor="middle" dominantBaseline="middle"
                fontSize="10" fontWeight="700" fill="currentColor" className="text-muted-foreground"
                letterSpacing="0.16em">
            OUT OF 100
          </text>
        </svg>
      </div>
      <div className={`mt-3 px-4 py-1.5 rounded-full text-sm font-bold border ${tone.bg} ${tone.text} ${tone.border}`}>
        Grade {grade}
      </div>
    </div>
  );
}

// ─── Severity helpers ────────────────────────────────────────────────────────
function severityChip(sev: Severity) {
  const map: Record<Severity, { label: string; cls: string; Icon: any }> = {
    critical: { label: 'Critical', cls: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30', Icon: XCircle },
    high:     { label: 'High',     cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30', Icon: AlertTriangle },
    medium:   { label: 'Medium',   cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30', Icon: AlertTriangle },
    low:      { label: 'Low',      cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30', Icon: Info },
    info:     { label: 'Info',     cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30', Icon: Info },
  };
  return map[sev];
}

// ─── Category card ───────────────────────────────────────────────────────────
const CATEGORY_META: Record<Category, { icon: any; gradient: string }> = {
  browser: { icon: Globe,      gradient: 'from-blue-500/20 to-cyan-500/10' },
  device:  { icon: Smartphone, gradient: 'from-purple-500/20 to-pink-500/10' },
  vault:   { icon: Lock,       gradient: 'from-emerald-500/20 to-teal-500/10' },
  network: { icon: Wifi,       gradient: 'from-amber-500/20 to-orange-500/10' },
};

function CategoryCard({
  cat, label, score, grade, failedCount, totalCount, expanded, onToggle,
}: {
  cat: Category; label: string; score: number; grade: string;
  failedCount: number; totalCount: number; expanded: boolean; onToggle: () => void;
}) {
  const meta = CATEGORY_META[cat];
  const Icon = meta.icon;
  const tone =
    score >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
    score >= 70 ? 'text-blue-600 dark:text-blue-400' :
    score >= 50 ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400';

  return (
    <motion.button
      variants={fadeUp}
      onClick={onToggle}
      className={`w-full text-left rounded-2xl border border-border/60 bg-gradient-to-br ${meta.gradient} backdrop-blur-xl hover:border-border transition-all p-4 sm:p-5 group`}
      data-testid={`category-card-${cat}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-background/70 backdrop-blur flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-foreground truncate">{label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {failedCount === 0
                ? `All ${totalCount} checks passed`
                : `${failedCount} of ${totalCount} need attention`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className={`text-2xl font-bold tabular-nums ${tone}`}>{score}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Grade {grade}</div>
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>
    </motion.button>
  );
}

// ─── Finding row ─────────────────────────────────────────────────────────────
function FindingRow({ f }: { f: Finding }) {
  const chip = severityChip(f.severity);
  const Icon = f.passed ? CheckCircle2 : chip.Icon;
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 backdrop-blur p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${f.passed ? 'text-emerald-500' : f.severity === 'critical' || f.severity === 'high' ? 'text-red-500' : f.severity === 'medium' ? 'text-amber-500' : 'text-muted-foreground'}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-sm text-foreground">{f.title}</div>
            {!f.passed && (
              <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${chip.cls}`}>
                {chip.label}
              </span>
            )}
            {f.passed && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Pass
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{f.description}</div>
          {f.fix && !f.passed && (
            f.fix.href ? (
              <Link href={f.fix.href}>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                  {f.fix.label}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            ) : (
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs">
                {f.fix.label}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Trend sparkline ─────────────────────────────────────────────────────────
function Sparkline({ history }: { history: ScanResult[] }) {
  const points = history.slice(0, 12).reverse();
  if (points.length < 2) return null;
  const w = 160, h = 36, pad = 2;
  const max = 100, min = 0;
  const dx = (w - pad * 2) / (points.length - 1);
  const path = points.map((p, i) => {
    const x = pad + i * dx;
    const y = pad + (h - pad * 2) * (1 - (p.score - min) / (max - min));
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const last = points[points.length - 1];
  const trend = points[points.length - 1].score - points[0].score;
  return (
    <div className="flex items-center gap-3">
      <svg width={w} height={h} className="overflow-visible">
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.8}
              className={trend >= 0 ? 'text-emerald-500' : 'text-red-500'} strokeLinecap="round" />
      </svg>
      <div className="text-xs text-muted-foreground">
        <span className={trend >= 0 ? 'text-emerald-500' : 'text-red-500'}>
          {trend >= 0 ? '+' : ''}{trend}
        </span>{' '}
        over {points.length} scans
      </div>
    </div>
  );
}

// ─── Bumblebee section (web only) ────────────────────────────────────────────
function BumblebeeSection() {
  const [input, setInput] = useState('');
  const [report, setReport] = useState<BumblebeeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleParse = useCallback((text: string) => {
    setError(null);
    const r = parseBumblebee(text);
    if ('error' in r) {
      setError(r.error);
      setReport(null);
    } else {
      setReport(r);
    }
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result ?? '');
      setInput(text);
      handleParse(text);
    };
    reader.readAsText(file);
  }, [handleParse]);

  return (
    <motion.div variants={fadeUp} className="rounded-2xl border border-border/60 bg-background/40 backdrop-blur-xl p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold">Desktop Supply-Chain Scan</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bumblebee scans your local dev machine for vulnerable packages across npm, pip, gem, cargo, and more.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-muted/40 border border-border/50 p-3 text-xs space-y-1.5 mb-4">
        <div className="font-semibold text-foreground">Install Bumblebee</div>
        <code className="block text-xs bg-background/60 rounded px-2 py-1 font-mono">
          curl -fsSL https://bumblebee.sh/install | sh
        </code>
        <div className="text-muted-foreground">
          Then run <code className="px-1 bg-background/60 rounded font-mono">bumblebee scan --json &gt; report.json</code> and upload below.
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="w-4 h-4 mr-1.5" /> Upload report.json
        </Button>
        {report && (
          <Button size="sm" variant="ghost" onClick={() => { setReport(null); setInput(''); }}>
            Clear
          </Button>
        )}
      </div>

      <details className="text-xs text-muted-foreground mb-3">
        <summary className="cursor-pointer select-none hover:text-foreground">Or paste JSON manually</summary>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onBlur={() => input.trim() && handleParse(input)}
          placeholder='{"packageCount": 1234, "ecosystems": [...], "findings": [...]}'
          rows={5}
          className="mt-2 font-mono text-xs"
        />
      </details>

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-xl bg-background/60 border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Packages</div>
              <div className="text-xl font-bold tabular-nums">{report.packageCount}</div>
            </div>
            <div className="rounded-xl bg-background/60 border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Ecosystems</div>
              <div className="text-xl font-bold tabular-nums">{report.ecosystems.length}</div>
            </div>
            <div className="rounded-xl bg-background/60 border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Findings</div>
              <div className="text-xl font-bold tabular-nums">{report.findings.length}</div>
            </div>
            <div className="rounded-xl bg-background/60 border border-border/50 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Critical</div>
              <div className="text-xl font-bold tabular-nums text-red-500">
                {report.findings.filter(f => f.severity === 'critical').length}
              </div>
            </div>
          </div>

          {report.ecosystems.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1.5">
                Ecosystem breakdown
              </div>
              <div className="flex flex-wrap gap-1.5">
                {report.ecosystems.map((e) => (
                  <span key={e.name} className="text-xs px-2 py-0.5 rounded-full bg-background/60 border border-border/50">
                    <span className="font-medium">{e.name}</span>
                    <span className="text-muted-foreground"> · {e.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.findings.length > 0 && (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {report.findings.slice(0, 25).map((f, i) => {
                const chip = severityChip(f.severity);
                return (
                  <div key={i} className="rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${chip.cls}`}>
                        {chip.label}
                      </span>
                      <span className="font-mono">{f.package}@{f.version}</span>
                      {f.advisory && (
                        <span className="text-muted-foreground font-mono">· {f.advisory}</span>
                      )}
                    </div>
                    {f.summary && <div className="text-muted-foreground mt-0.5">{f.summary}</div>}
                  </div>
                );
              })}
              {report.findings.length > 25 && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  +{report.findings.length - 25} more…
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─── Error boundary ──────────────────────────────────────────────────────────
class ScannerErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void },
  { error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[SecurityScanner] render error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] bg-background">
          <div className="max-w-5xl mx-auto px-3 sm:px-6 py-10 pb-24">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 sm:p-8 text-center">
              <ShieldAlert className="w-10 h-10 mx-auto text-red-500 mb-3" />
              <h2 className="text-lg font-bold mb-1">Security Scanner crashed</h2>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Something went wrong while rendering the scanner. Your vault is safe — this is a UI issue only.
              </p>
              <div className="text-xs text-muted-foreground mb-4 font-mono break-all max-w-md mx-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    this.setState({ error: null });
                    this.props.onRetry();
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
                </Button>
                <Link href="/">
                  <Button variant="ghost" size="sm">Back to Dashboard</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function SecurityScannerPage() {
  return (
    <ScannerErrorBoundary onRetry={() => window.location.reload()}>
      <SecurityScannerPageInner />
    </ScannerErrorBoundary>
  );
}

function SecurityScannerPageInner() {
  // Context hooks — read defensively so a missing/locked vault never crashes
  // the page. Both contexts may still be initializing on first nav.
  const auth = useAuth();
  const vault = useVault();
  const masterPassword = auth?.masterPassword ?? null;
  const accountEmail = auth?.accountEmail ?? null;
  const passwords = vault?.passwords ?? [];

  let currentVaultId: string | null = null;
  try {
    currentVaultId = vaultStorage.getCurrentVaultId() ?? null;
  } catch {
    currentVaultId = null;
  }

  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [expandedCats, setExpandedCats] = useState<Set<Category>>(() => new Set<Category>(['vault']));
  const [history, setHistory] = useState<ScanResult[]>([]);

  useEffect(() => {
    try {
      const h = loadHistory();
      setHistory(h);
      if (h[0]) setResult(h[0]);
    } catch (e) {
      // Corrupt history shouldn't block the page.
      // eslint-disable-next-line no-console
      console.warn('[SecurityScanner] failed to load history:', e);
    }
  }, []);

  const runScanNow = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    setScanError(null);
    setProgress({ done: 0, total: 0, label: 'Starting…' });
    try {
      const r = await runScan({
        masterPassword,
        accountEmail,
        currentVaultId,
        passwords,
        onProgress: (done, total, label) => setProgress({ done, total, label: label ?? '' }),
      });
      setResult(r);
      try { saveScan(r); } catch { /* persistence is best-effort */ }
      try { setHistory(loadHistory()); } catch { /* */ }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[SecurityScanner] scan failed:', e);
      setScanError(e?.message || 'Scan failed unexpectedly. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [scanning, masterPassword, accountEmail, currentVaultId, passwords]);

  const toggleCat = useCallback((c: Category) => {
    setExpandedCats((s) => {
      const next = new Set(s);
      if (next.has(c)) next.delete(c); else next.add(c);
      return next;
    });
  }, []);

  const score = result?.score ?? 0;
  const grade = result?.grade ?? gradeFromScore(0);

  const topIssues = useMemo(() => {
    if (!result) return [];
    return result.allFindings.filter((f) => !f.passed).slice(0, 5);
  }, [result]);

  const isWeb = !Capacitor.isNativePlatform();

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24">
        {/* Header */}
        <motion.div initial="hidden" animate="show" variants={stagger} className="mb-5">
          <motion.div variants={fadeUp} className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
            <Link href="/" className="hover:text-foreground">Dashboard</Link>
            <span>·</span>
            <span>Security Scanner</span>
          </motion.div>
          <motion.div variants={fadeUp} className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                <ScanSearch className="w-7 h-7 text-primary" />
                Security Scanner
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Deep audit of your browser, device, vault, and network. Findings are computed
                locally — nothing is sent to a server.
              </p>
            </div>
          </motion.div>
        </motion.div>

        {/* Hero */}
        <motion.div
          initial="hidden" animate="show" variants={stagger}
          className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/5 via-background to-purple-500/5 backdrop-blur-xl p-5 sm:p-8 mb-5"
        >
          <div className="grid sm:grid-cols-[auto_1fr] gap-5 sm:gap-8 items-center">
            <motion.div variants={fadeUp} className="flex justify-center sm:justify-start">
              <ScoreRing score={score} grade={grade} scanning={scanning} />
            </motion.div>
            <motion.div variants={fadeUp} className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Overall security</div>
                <div className="text-xl sm:text-2xl font-bold mt-1">
                  {!result ? 'Run your first scan' :
                    score >= 90 ? 'Excellent — you are well protected' :
                    score >= 70 ? 'Good — a few things to harden' :
                    score >= 50 ? 'Fair — meaningful issues found' :
                                  'Action needed — critical gaps detected'}
                </div>
                {result && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Last scan: {new Date(result.scannedAt).toLocaleString()} · {result.durationMs}ms · {result.platform}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={runScanNow} disabled={scanning} size="lg" className="gap-2">
                  {scanning
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning…</>
                    : result
                      ? <><RefreshCw className="w-4 h-4" /> Re-run scan</>
                      : <><ScanSearch className="w-4 h-4" /> Run Security Scan</>
                  }
                </Button>
                {history.length > 1 && (
                  <div className="ml-2"><Sparkline history={history} /></div>
                )}
              </div>
              {scanning && progress.total > 0 && (
                <div className="space-y-1">
                  <Progress value={(progress.done / progress.total) * 100} className="h-1.5" />
                  <div className="text-[11px] text-muted-foreground">
                    {progress.done} / {progress.total} · {progress.label}
                  </div>
                </div>
              )}
              {scanError && !scanning && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-semibold text-red-600 dark:text-red-400">Scan failed</div>
                      <div className="text-muted-foreground mt-0.5 break-all">{scanError}</div>
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={runScanNow}>
                        <RefreshCw className="w-3 h-3 mr-1" /> Try again
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Top issues */}
        {result && topIssues.length > 0 && (
          <motion.div
            initial="hidden" animate="show" variants={stagger}
            className="rounded-2xl border border-border/60 bg-background/40 backdrop-blur-xl p-4 sm:p-5 mb-5"
          >
            <motion.div variants={fadeUp} className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold">Top issues to fix</h2>
              </div>
              <span className="text-xs text-muted-foreground">{topIssues.length} of {result.allFindings.filter(f => !f.passed).length}</span>
            </motion.div>
            <motion.div variants={stagger} className="space-y-2">
              {topIssues.map((f) => (
                <motion.div key={f.id} variants={fadeUp}>
                  <FindingRow f={f} />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {/* Category cards */}
        {result && (
          <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-3 mb-5">
            {result.categories.map((cat) => {
              const failedCount = cat.findings.filter(f => !f.passed).length;
              const expanded = expandedCats.has(cat.category);
              return (
                <React.Fragment key={cat.category}>
                  <CategoryCard
                    cat={cat.category}
                    label={cat.label}
                    score={cat.score}
                    grade={cat.grade}
                    failedCount={failedCount}
                    totalCount={cat.findings.length}
                    expanded={expanded}
                    onToggle={() => toggleCat(cat.category)}
                  />
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-2 pl-2 sm:pl-4 pr-1">
                          {cat.findings.map((f) => (
                            <FindingRow key={f.id} f={f} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </motion.div>
        )}

        {/* Bumblebee — web only */}
        {isWeb && (
          <motion.div initial="hidden" animate="show" variants={stagger} className="mb-5">
            <BumblebeeSection />
          </motion.div>
        )}

        {/* History footer */}
        {history.length > 0 && (
          <motion.div initial="hidden" animate="show" variants={fadeUp}
                      className="rounded-2xl border border-border/60 bg-background/40 backdrop-blur p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <History className="w-4 h-4 text-muted-foreground" />
              <span>{history.length} scan{history.length === 1 ? '' : 's'} stored on this device</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { clearHistory(); setHistory([]); }}>
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear history
            </Button>
          </motion.div>
        )}

        {/* Empty state */}
        {!result && !scanning && (
          <motion.div initial="hidden" animate="show" variants={fadeUp}
                      className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <div className="font-semibold mb-1">No scans yet</div>
            <div className="text-sm text-muted-foreground mb-4">
              Tap “Run Security Scan” above to audit your browser, device, vault, and network.
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
