import { useMemo, useState, useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Shield, ChevronLeft, ChevronRight, Lock, KeyRound, Clock, ShieldCheck,
  Smartphone, AlertTriangle, CheckCircle2, Sparkles,
} from "lucide-react";
import { useVault } from "@/contexts/vault-context";
import { useAuth } from "@/contexts/auth-context";
import { calculateSecurityScore, type SecurityBreakdown } from "@/lib/security-score";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

// ── Big animated ring ─────────────────────────────────────────────────────────
function BigSecurityRing({ score, level, levelColor }: { score: number; level: string; levelColor: string }) {
  const [animScore, setAnimScore] = useState(0);
  const size = 220, sw = 14;
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
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
          fontSize="56" fontWeight="800" fill="currentColor" className="text-foreground">
          {animScore}
        </text>
        <text x={cx} y={cy + 30} textAnchor="middle" dominantBaseline="middle"
          fontSize="11" fontWeight="700" fill="currentColor" className="text-muted-foreground"
          letterSpacing="0.12em">
          OF 100
        </text>
      </svg>
      <div
        className={`mt-3 px-4 py-1.5 rounded-full text-sm font-semibold ${
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SecurityHealth() {
  const { passwords } = useVault();
  const { masterPassword } = useAuth();

  const breakdown = useMemo(
    () => calculateSecurityScore(passwords, masterPassword || ''),
    [passwords, masterPassword],
  );

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

      {/* Hero */}
      <motion.div
        variants={fadeUp}
        className={`rounded-3xl overflow-hidden bg-gradient-to-br ${heroBg} shadow-xl`}
      >
        <div className="relative p-6">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-28 h-28 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />
          <div className="relative flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-white" />
              <h1 className="text-lg font-bold text-white">Security Health</h1>
            </div>
            <BigSecurityRing
              score={breakdown.totalScore}
              level={breakdown.level}
              levelColor={breakdown.levelColor}
            />
            <p className="text-sm text-white/80 mt-4 max-w-sm">
              {breakdown.totalScore >= 80
                ? 'Your vault is well protected. Stay vigilant — review alerts as they appear.'
                : breakdown.totalScore >= 50
                ? 'Decent posture. A few quick wins below will close the gaps.'
                : 'Several risks detected. Tap a category below to fix them.'}
            </p>
          </div>
        </div>
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
