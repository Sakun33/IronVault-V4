import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, ChevronLeft, ChevronRight, Lock, KeyRound, Clock, ShieldCheck,
  Smartphone, AlertTriangle, CheckCircle2, Sparkles, Trophy, Award,
  Upload, Star, Flame, Zap, ShieldAlert, Loader2, RotateCw, ScanSearch,
} from "lucide-react";
import { useVault } from "@/contexts/vault-context";
import { useAuth } from "@/contexts/auth-context";
import { calculateSecurityScore, type SecurityBreakdown } from "@/lib/security-score";
import { scanBreaches, type BreachScanResult } from "@/lib/breach-checker";
import { PasswordGenerator } from "@/lib/password-generator";
import { Favicon } from "@/components/favicon";
import type { PasswordEntry } from "@shared/schema";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

// ── Big animated ring ─────────────────────────────────────────────────────────
function BigSecurityRing({ score, level, levelColor }: { score: number; level: string; levelColor: string }) {
  const [animScore, setAnimScore] = useState(0);
  // Compact ring: 140 sits inside a 2-row hero so the breach scan card lands
  // above the fold on a 700px viewport. 220 was pushing every category below
  // the fold and the page felt like a one-card landing screen.
  const size = 140, sw = 10;
  const r = (size - sw) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (animScore / 100) * circ;

  useEffect(() => {
    const t = setTimeout(() => setAnimScore(score), 120);
    return () => clearTimeout(t);
  }, [score]);

  const stroke =
    levelColor === 'red' ? '#ef4444' :
    levelColor === 'amber' ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={sw} />
        <circle
          cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={sw}
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
          fontSize="36" fontWeight="800" fill="currentColor" className="text-foreground">
          {animScore}
        </text>
        <text x={cx} y={cy + 20} textAnchor="middle" dominantBaseline="middle"
          fontSize="9" fontWeight="700" fill="currentColor" className="text-muted-foreground"
          letterSpacing="0.12em">
          OF 100
        </text>
      </svg>
      <div
        className={`mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
          levelColor === 'red'
            ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
            : levelColor === 'amber'
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
        }`}
      >
        {level}
      </div>
    </div>
  );
}

// ── Category row ──────────────────────────────────────────────────────────────
interface CategoryDef {
  key: keyof SecurityBreakdown['categories'];
  label: string;
  icon: React.ElementType;
  color: string;
  href?: string;
  cta?: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: 'passwordStrength', label: 'Password strength', icon: Lock, color: '#6366f1', href: '/passwords?strength=weak', cta: 'Fix weak passwords' },
  { key: 'uniquePasswords', label: 'Unique passwords', icon: KeyRound, color: '#8b5cf6', href: '/passwords', cta: 'Review passwords' },
  { key: 'twoFactorEnabled', label: 'Two-factor auth', icon: ShieldCheck, color: '#10b981', href: '/profile?tab=security', cta: 'Enable 2FA' },
  { key: 'recentlyChanged', label: 'Recently rotated', icon: Clock, color: '#f59e0b', href: '/passwords', cta: 'Rotate old passwords' },
  { key: 'masterPasswordStrength', label: 'Master password', icon: Shield, color: '#ef4444', href: '/profile?tab=security', cta: 'Change master password' },
  { key: 'autoLockEnabled', label: 'Auto-lock', icon: Smartphone, color: '#06b6d4', href: '/settings', cta: 'Enable auto-lock' },
];

function CategoryRow({ def, score, max, detail }: {
  def: CategoryDef;
  score: number;
  max: number;
  detail: string;
}) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const Icon = def.icon;
  const passing = pct >= 75;
  const warning = pct >= 40 && pct < 75;

  const inner = (
    <div className="rounded-2xl border border-border/50 bg-card p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ring-white/10"
          style={{ background: `${def.color}22`, boxShadow: `0 0 20px -8px ${def.color}66` }}
        >
          <Icon className="w-5 h-5" style={{ color: def.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground">{def.label}</h3>
            <span className="text-xs font-bold tabular-nums text-foreground flex-shrink-0">
              {score}<span className="text-muted-foreground font-normal">/{max}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2.5">{detail}</p>
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: passing ? '#10b981' : warning ? '#f59e0b' : '#ef4444',
                transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
        </div>
        {def.href && <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-2" />}
      </div>
    </div>
  );

  if (def.href && !passing) {
    return <Link href={def.href} data-testid={`security-cat-${def.key}`}>{inner}</Link>;
  }
  return <div data-testid={`security-cat-${def.key}`}>{inner}</div>;
}

// ── Achievements ──────────────────────────────────────────────────────────────
interface AchievementDef {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  earned: boolean;
  hint: string;
}

function buildAchievements(opts: {
  totalPasswords: number;
  totalNotes: number;
  twoFactorEnabled: boolean;
  imported: boolean;
  rotatedRecently: boolean;
  uniquePct: number;
  scoreLevel: SecurityBreakdown['level'];
}): AchievementDef[] {
  const { totalPasswords, totalNotes, twoFactorEnabled, imported, rotatedRecently, uniquePct, scoreLevel } = opts;
  return [
    { key: 'first-pw', label: 'First Password',  icon: Lock,         color: '#6366f1', earned: totalPasswords >= 1,  hint: 'Add your first password' },
    { key: 'p10',     label: 'Vault Builder',    icon: Star,         color: '#a855f7', earned: totalPasswords >= 10, hint: 'Save 10 passwords' },
    { key: 'p50',     label: 'Power User',       icon: Trophy,       color: '#f59e0b', earned: totalPasswords >= 50, hint: 'Save 50 passwords' },
    { key: 'imp',     label: 'Migrated',         icon: Upload,       color: '#06b6d4', earned: imported,             hint: 'Run your first import' },
    { key: '2fa',     label: '2FA Pro',          icon: ShieldCheck,  color: '#10b981', earned: twoFactorEnabled,     hint: 'Enable two-factor auth' },
    { key: 'rot',     label: 'Hygiene Hero',     icon: Flame,        color: '#ef4444', earned: rotatedRecently,      hint: 'Rotate a password in the last 90 days' },
    { key: 'uniq',    label: 'No Duplicates',    icon: Zap,          color: '#eab308', earned: totalPasswords >= 5 && uniquePct === 100, hint: 'Keep every password unique (5+ stored)' },
    { key: 'note',    label: 'Note Keeper',      icon: Award,        color: '#f97316', earned: totalNotes >= 1,      hint: 'Save your first secure note' },
    { key: 'top',     label: 'Excellent',        icon: Sparkles,     color: '#22c55e', earned: scoreLevel === 'Excellent', hint: 'Reach an Excellent security score' },
  ];
}

function AchievementBadge({ a }: { a: AchievementDef }) {
  const Icon = a.icon;
  return (
    <div
      className={`relative rounded-2xl p-3 border transition-all ${
        a.earned
          ? 'bg-card border-border/60 shadow-sm'
          : 'bg-muted/20 border-border/30 grayscale opacity-60'
      }`}
      data-testid={`badge-${a.key}`}
      title={a.earned ? a.label : a.hint}
    >
      <div className="flex flex-col items-center text-center gap-1.5">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center ring-1 ring-white/10"
          style={{
            background: a.earned ? `${a.color}22` : 'rgba(120,120,120,0.12)',
            boxShadow: a.earned ? `0 0 18px -6px ${a.color}88` : 'none',
          }}
        >
          <Icon className="w-5 h-5" style={{ color: a.earned ? a.color : '#94a3b8' }} />
        </div>
        <span className={`text-[11px] font-semibold leading-tight ${a.earned ? 'text-foreground' : 'text-muted-foreground'}`}>
          {a.label}
        </span>
        {!a.earned && <span className="text-[9px] text-muted-foreground/70 leading-tight">{a.hint}</span>}
      </div>
      {a.earned && (
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-background">
          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
        </div>
      )}
    </div>
  );
}

// ── Breach scan card ──────────────────────────────────────────────────────────
function BreachScanCard({ passwords }: { passwords: PasswordEntry[] }) {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<BreachScanResult<PasswordEntry>[] | null>(null);
  const [lastScannedAt, setLastScannedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hydrate last-scan timestamp
  useEffect(() => {
    try {
      const ts = localStorage.getItem('iv_breach_last_scan');
      if (ts) setLastScannedAt(parseInt(ts, 10));
    } catch { /* noop */ }
  }, []);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setProgress({ done: 0, total: passwords.length });
    try {
      const items = passwords.map(p => ({ entry: p, password: p.password }));
      const out = await scanBreaches(items, p => setProgress(p));
      setResults(out);
      const now = Date.now();
      try { localStorage.setItem('iv_breach_last_scan', String(now)); } catch { /* noop */ }
      setLastScannedAt(now);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }, [passwords]);

  const breached = useMemo(() => (results || []).filter(r => r.count > 0), [results]);
  const totalScanned = results?.length ?? 0;
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden" data-testid="breach-scan-card">
      <div className="p-4 flex items-center gap-3 border-b border-border/40">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center ring-1 ring-red-500/20">
          <ScanSearch className="w-5 h-5 text-red-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Dark web monitoring</h2>
          <p className="text-[11px] text-muted-foreground">
            Checks every password against known data breaches via Have I Been Pwned. Your passwords stay on this device — only a 5-character hash prefix is sent.
          </p>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {scanning && (
          <div data-testid="breach-scan-progress">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Scanning… {progress.done}/{progress.total}
              </span>
              <span className="text-xs font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-red-500"
                style={{ width: `${pct}%`, transition: 'width 0.3s ease' }}
              />
            </div>
          </div>
        )}

        {!scanning && results === null && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {passwords.length === 0
                ? 'Add passwords to run a breach scan.'
                : `${passwords.length} password${passwords.length === 1 ? '' : 's'} ready to scan.`}
            </p>
            <button
              onClick={runScan}
              disabled={passwords.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
              data-testid="run-breach-scan"
            >
              <ScanSearch className="w-3.5 h-3.5" /> Run scan
            </button>
          </div>
        )}

        {!scanning && results !== null && (
          <div className="space-y-3" data-testid="breach-scan-results">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs">
                {breached.length === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> No breaches found across {totalScanned} password{totalScanned === 1 ? '' : 's'}.
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" /> {breached.length} of {totalScanned} password{totalScanned === 1 ? '' : 's'} found in breaches.
                  </span>
                )}
                {lastScannedAt && (
                  <span className="text-muted-foreground ml-2">
                    Last scanned {new Date(lastScannedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <button
                onClick={runScan}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted/40 text-xs font-medium transition-colors"
                data-testid="rerun-breach-scan"
              >
                <RotateCw className="w-3 h-3" /> Re-scan
              </button>
            </div>

            {breached.length > 0 && (
              <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1" data-testid="breached-list">
                {breached.slice(0, 50).map(({ entry, count }) => {
                  const url = (entry.url || '') as string;
                  const name = entry.name || 'Untitled';
                  const href = `/passwords?openId=${encodeURIComponent(entry.id)}`;
                  return (
                    <li key={entry.id} data-testid={`breached-row-${entry.id}`}>
                      <Link href={href}>
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                          data-testid={`breached-link-${entry.id}`}
                        >
                          <Favicon url={url} name={name} className="w-9 h-9 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{name}</div>
                            <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                              Seen {count.toLocaleString()} time{count === 1 ? '' : 's'} in breaches
                            </div>
                          </div>
                          <span
                            className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-colors flex-shrink-0"
                            data-testid={`change-now-${entry.id}`}
                          >
                            Change Now
                          </span>
                        </button>
                      </Link>
                    </li>
                  );
                })}
                {breached.length > 50 && (
                  <li className="text-[11px] text-muted-foreground text-center py-1">
                    Showing first 50 of {breached.length}. Address these first, then re-scan.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}

        {error && <div className="text-xs text-red-500" data-testid="breach-scan-error">{error}</div>}
      </div>
    </div>
  );
}

// ── Stats card (safe / weak / breached) ──────────────────────────────────────
function StatsCard({ safe, weak, breached }: { safe: number; weak: number; breached: number }) {
  const tile = (color: string, label: string, value: number, testId: string) => (
    <div className="flex-1 rounded-xl border border-border/40 bg-card p-3 text-center" data-testid={testId}>
      <div className={`text-2xl font-extrabold tabular-nums ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">{label}</div>
    </div>
  );
  return (
    <div className="flex gap-2">
      {tile('text-emerald-500', 'Safe', safe, 'stat-safe')}
      {tile('text-amber-500', 'Weak', weak, 'stat-weak')}
      {tile('text-red-500', 'Breached', breached, 'stat-breached')}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SecurityHealth() {
  const { passwords, notes } = useVault();
  const { masterPassword } = useAuth();

  const breakdown = useMemo(
    () => calculateSecurityScore(passwords, masterPassword || ''),
    [passwords, masterPassword],
  );

  const weakCount = useMemo(() => {
    let n = 0;
    for (const p of passwords) {
      if (!p.password) continue;
      const { level } = PasswordGenerator.calculateStrength(p.password);
      if (level === 'weak' || level === 'medium') n++;
    }
    return n;
  }, [passwords]);

  // Read the most recent breach count from localStorage; updated by the scan card.
  const [breachedCount, setBreachedCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('iv_breach_count');
        const n = raw ? parseInt(raw, 10) : 0;
        setBreachedCount(Number.isFinite(n) && n > 0 ? n : 0);
      } catch { /* noop */ }
    };
    read();
    window.addEventListener('storage', read);
    const t = setInterval(read, 1500);
    return () => { window.removeEventListener('storage', read); clearInterval(t); };
  }, []);

  const safeCount = Math.max(0, passwords.length - weakCount - breachedCount);

  const achievements = useMemo(() => {
    let imported = false;
    try { imported = !!localStorage.getItem('iv_imported_at'); } catch { /* noop */ }
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const rotatedRecently = passwords.some(p => p.updatedAt && new Date(p.updatedAt as any).getTime() >= ninetyDaysAgo);
    const seen = new Set<string>();
    let dupes = 0;
    for (const p of passwords) {
      if (!p.password) continue;
      if (seen.has(p.password)) dupes++; else seen.add(p.password);
    }
    const uniquePct = passwords.length === 0 ? 100 : Math.round(((passwords.length - dupes) / passwords.length) * 100);
    return buildAchievements({
      totalPasswords: passwords.length,
      totalNotes: notes.length,
      twoFactorEnabled: breakdown.categories.twoFactorEnabled.score > 0,
      imported,
      rotatedRecently,
      uniquePct,
      scoreLevel: breakdown.level,
    });
  }, [passwords, notes, breakdown]);
  const earnedCount = achievements.filter(a => a.earned).length;

  const heroBg =
    breakdown.levelColor === 'red'
      ? 'from-red-600 via-red-700 to-rose-800'
      : breakdown.levelColor === 'amber'
      ? 'from-amber-500 via-amber-600 to-orange-700'
      : 'from-emerald-600 via-emerald-700 to-teal-800';

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4 pb-6">
      {/* Header w/ back link */}
      <motion.div variants={fadeUp} className="flex items-center gap-2">
        <Link href="/dashboard">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-back-dashboard"
            aria-label="Back to dashboard"
          >
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </button>
        </Link>
      </motion.div>

      {/* Hero — side-by-side ring + headline so the score, level, and one-line
          summary all fit in a 160px-tall band. Stacks on small screens. */}
      <motion.div
        variants={fadeUp}
        className={`rounded-3xl overflow-hidden bg-gradient-to-br ${heroBg} shadow-xl`}
      >
        <div className="relative p-4 sm:p-5">
          <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
            <BigSecurityRing
              score={breakdown.totalScore}
              level={breakdown.level}
              levelColor={breakdown.levelColor}
            />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1.5">
                <Shield className="w-4 h-4 text-white" />
                <h1 className="text-base font-bold text-white">Security Health</h1>
              </div>
              <p className="text-sm text-white/85 leading-snug">
                {breakdown.totalScore >= 80
                  ? 'Your vault is well protected. Stay vigilant — review alerts as they appear.'
                  : breakdown.totalScore >= 50
                  ? 'Decent posture. A few quick wins below will close the gaps.'
                  : 'Several risks detected. Tap a category below to fix them.'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats: safe / weak / breached */}
      {passwords.length > 0 && (
        <motion.div variants={fadeUp}>
          <StatsCard safe={safeCount} weak={weakCount} breached={breachedCount} />
        </motion.div>
      )}

      {/* Dark web monitoring / breach scan */}
      <motion.div variants={fadeUp}>
        <BreachScanCard passwords={passwords} />
      </motion.div>

      {/* Detailed score breakdown — per-category bars so the user understands
          where their points come from and where the gaps are. */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.04] backdrop-blur-xl p-4"
        data-testid="security-breakdown"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Score breakdown</h2>
          <span className="ml-auto text-xs text-muted-foreground">{breakdown.totalScore}/100</span>
        </div>
        <ul className="space-y-3">
          {([
            ['passwordStrength',        'Password strength'],
            ['uniquePasswords',         'Password reuse'],
            ['twoFactorEnabled',        '2FA coverage'],
            ['recentlyChanged',         'Password freshness'],
            ['masterPasswordStrength',  'Master password'],
            ['autoLockEnabled',         'Auto-lock'],
          ] as const).map(([key, label]) => {
            const cat = breakdown.categories[key];
            const pct = Math.round((cat.score / cat.max) * 100);
            const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
            return (
              <li key={key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{cat.score}/{cat.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{cat.detail}</p>
              </li>
            );
          })}
        </ul>
      </motion.div>

      {/* Tips card (collapsible) */}
      {breakdown.tips.length > 0 && (
        <motion.div
          variants={fadeUp}
          className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4"
          data-testid="security-tips"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Recommended actions</h2>
          </div>
          <ul className="space-y-2">
            {breakdown.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/85">
                {breakdown.totalScore >= 80 ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                )}
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Categories grid */}
      <motion.div variants={fadeUp}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-1">
          Score breakdown
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {CATEGORIES.map(def => {
            const cat = breakdown.categories[def.key];
            return (
              <CategoryRow
                key={def.key}
                def={def}
                score={cat.score}
                max={cat.max}
                detail={cat.detail}
              />
            );
          })}
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div variants={fadeUp} data-testid="achievements">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Achievements
          </p>
          <span className="text-[11px] font-semibold text-foreground tabular-nums">
            {earnedCount}/{achievements.length} earned
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {achievements.map(a => <AchievementBadge key={a.key} a={a} />)}
        </div>
      </motion.div>

      {/* Footer info */}
      <motion.div variants={fadeUp} className="rounded-2xl border border-border/50 bg-muted/20 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">How it's calculated:</strong> Strong passwords (30 pts),
          unique passwords (20 pts), two-factor auth (15 pts), passwords updated in the last 90 days
          (15 pts), master password strength (10 pts), and auto-lock enabled (10 pts) — for a total
          out of 100. Scores update automatically as you make changes.
        </p>
      </motion.div>
    </motion.div>
  );
}
