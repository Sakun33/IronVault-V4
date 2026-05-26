import { useVault } from "@/contexts/vault-context";
import { useCurrency } from "@/contexts/currency-context";
import { useAuth } from "@/contexts/auth-context";
import { useSharedExpenses } from "@/hooks/use-shared-expenses";
import {
  Lock, FileText, DollarSign, Bell, Plus, AlertTriangle,
  Clock, Upload, Shield, RefreshCw,
  ChevronRight, CreditCard, Activity, Key, KeyRound, TrendingUp, TrendingDown,
  Sparkles, ShieldAlert, ShieldCheck, ArrowRight, Search,
  Wallet, Repeat, BookOpen, Check, Pencil as PencilIcon,
} from "lucide-react";
import React, { useState, useEffect, useMemo, useDeferredValue, useRef, memo } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays, formatDistanceToNow, isToday } from "date-fns";
import { useUIActions } from "@/contexts/ui-actions-context";
import { ListSkeleton } from "@/components/list-skeleton";
import { Favicon } from "@/components/favicon";
import { calculateSecurityScore, type SecurityBreakdown } from "@/lib/security-score";
import { generateInsights, recordSecurityScore, dismissInsight, type Insight } from "@/lib/ai-insights";
import * as LucideIcons from "lucide-react";
import { publishWidgetSnapshot } from "@/lib/widget-data";
import { useAutoNotifications } from "@/hooks/use-auto-notifications";
import { NotificationService } from "@/lib/notifications";
import { motion, useMotionValue, useTransform, animate as motionAnimate } from "framer-motion";
import { apiBase } from "@/native/platform";

function AnimatedNumber({ value, duration = 0.9, delay = 0 }: { value: number; duration?: number; delay?: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, latest => Math.round(latest).toLocaleString());
  useEffect(() => {
    const controls = motionAnimate(mv, value, { duration, delay, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, duration, delay, mv]);
  return <motion.span>{rounded}</motion.span>;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getUserName(accountEmail: string | null): string {
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  // Cap any extracted name at MAX_LEN so a concatenated email prefix
  // ("saketsuman" → "Saketsuman") doesn't dominate the greeting line.
  // For users whose real first name is shorter than the email prefix,
  // they can set a preferred name via `iv_preferred_display_name` which
  // is read first below (priority 0) — no algorithm can reliably split
  // "saketsuman" into "saket", so we let the user pick.
  const MAX_LEN = 10;
  const firstName = (name: string): string => {
    const cleaned = name.replace(/\d+/g, ' ').trim();
    if (!cleaned) return '';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0] ? cap(parts[0]) : '';
    return first.length > MAX_LEN ? first.slice(0, MAX_LEN) : first;
  };
  const namifyEmail = (email: string): string => {
    const raw = email.split('@')[0];
    const cleaned = raw.replace(/[._-]+/g, ' ').replace(/\d+/g, ' ').trim();
    if (!cleaned) return '';
    const parts = cleaned.split(/\s+/).filter(Boolean);
    const first = parts[0] ? cap(parts[0]) : '';
    return first.length > MAX_LEN ? first.slice(0, MAX_LEN) : first;
  };
  // Priority 0: user-set preferred display name. Wins over everything
  // else — only the user knows whether "saketsuman" should be "Saket".
  try {
    const pref = (localStorage.getItem('iv_preferred_display_name') || '').trim();
    if (pref) {
      const cleaned = firstName(pref);
      if (cleaned) return cleaned;
    }
  } catch { /* ignore */ }
  const isEmailPrefix = (name: string, email: string | null): boolean => {
    if (!email) return false;
    // Also catch the case where the cached name is the email prefix WITH a
    // capitalised first letter ("Saketsuman1312") — case-insensitive
    // comparison already handles that, but we also strip digits before
    // comparing so "Saketsuman" matches "saketsuman1312".
    const a = name.toLowerCase().replace(/\d+/g, '');
    const b = email.split('@')[0].toLowerCase().replace(/\d+/g, '');
    return a === b;
  };
  try {
    // 1) customerProfile (most authoritative — set during signup).
    const cp = JSON.parse(localStorage.getItem('customerProfile') || '{}');
    const profileMatchesAccount =
      accountEmail &&
      typeof cp.email === 'string' &&
      cp.email.toLowerCase() === accountEmail.toLowerCase();
    if (profileMatchesAccount) {
      const fullName = (cp.full_name || cp.name || cp.display_name || '').trim();
      if (fullName && !fullName.includes('@') && !isEmailPrefix(fullName, accountEmail)) {
        const out = firstName(fullName);
        if (out) return out;
      }
    }
    // 2) iv_account_session (set on login; carries the user-provided name).
    const session = localStorage.getItem('iv_account_session');
    if (session) {
      try {
        const { email, name } = JSON.parse(session);
        if (name && typeof name === 'string' && !name.includes('@') && !isEmailPrefix(name, email)) {
          const out = firstName(name);
          if (out) return out;
        }
      } catch { /* ignore */ }
    }
    // 3) Plain `iv_account` blob (alternate storage key in some flows).
    const acct = localStorage.getItem('iv_account');
    if (acct) {
      try {
        const a = JSON.parse(acct);
        const n = (a.fullName || a.full_name || a.name || a.displayName || '').trim();
        if (n && !n.includes('@') && !isEmailPrefix(n, accountEmail)) {
          const out = firstName(n);
          if (out) return out;
        }
      } catch { /* ignore */ }
    }
    // 4) Last resort — email prefix without digits.
    if (accountEmail) return namifyEmail(accountEmail);
  } catch { /* ignore */ }
  return '';
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-400',
  low: 'bg-green-500',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': '#f97316',
  'Transportation': '#3b82f6',
  'Shopping': '#a855f7',
  'Entertainment': '#ec4899',
  'Bills & Utilities': '#eab308',
  'Healthcare': '#22c55e',
  'Travel': '#06b6d4',
  'Education': '#8b5cf6',
  'Business': '#64748b',
  'Home & Garden': '#84cc16',
  'Personal Care': '#f43f5e',
  'Insurance': '#6366f1',
  'Investments': '#10b981',
  'Gifts & Donations': '#f59e0b',
  'Other': '#94a3b8',
};

const LEVEL_BADGE: Record<SecurityBreakdown['level'], { bg: string; text: string; ring: string; dot: string }> = {
  Critical:     { bg: 'bg-red-500/15',     text: 'text-red-600 dark:text-red-400',         ring: 'ring-red-500/30',     dot: 'bg-red-500' },
  'Needs Work': { bg: 'bg-amber-500/15',   text: 'text-amber-600 dark:text-amber-400',     ring: 'ring-amber-500/30',   dot: 'bg-amber-500' },
  Good:         { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-500' },
  Excellent:    { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500/30', dot: 'bg-emerald-500' },
};

// ─────────────────────────────────────────────────────────────────────────
// Compact widget shells (memoized — pure presentational)
// ─────────────────────────────────────────────────────────────────────────

const SectionLabel = memo(function SectionLabel({
  icon: Icon, label, action, count,
}: {
  icon?: React.ElementType;
  label: string;
  action?: { href?: string; onClick?: () => void; label: string };
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-2.5 px-0.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3 text-primary" />}
        {label}
        {typeof count === 'number' && count > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold tabular-nums">{count}</span>
        )}
      </p>
      {action && (
        action.href
          ? <Link href={action.href}><span className="text-[11px] font-medium text-primary hover:underline cursor-pointer">{action.label}</span></Link>
          : <button onClick={action.onClick} className="text-[11px] font-medium text-primary hover:underline">{action.label}</button>
      )}
    </div>
  );
});

type StatTone = 'indigo' | 'amber' | 'emerald' | 'rose' | 'blue' | 'purple' | 'cyan';

const TONE_BADGE: Record<StatTone, string> = {
  indigo:  'bg-indigo-500/15 text-indigo-300 ring-indigo-500/30',
  amber:   'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  rose:    'bg-rose-500/15 text-rose-300 ring-rose-500/30',
  blue:    'bg-blue-500/15 text-blue-300 ring-blue-500/30',
  purple:  'bg-purple-500/15 text-purple-300 ring-purple-500/30',
  cyan:    'bg-cyan-500/15 text-cyan-300 ring-cyan-500/30',
};

const RichStatCard = memo(function RichStatCard({
  label, value, sub, icon: Icon, tone, href, fmt, badge,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: React.ElementType;
  tone: StatTone;
  href: string;
  fmt?: (n: number) => string;
  badge?: { text: string; tone: StatTone; icon?: React.ElementType };
}) {
  const BadgeIcon = badge?.icon;
  const [, navigate] = useLocation();
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        onClick={() => navigate(href)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(href); } }}
        className={`glass-card card-${tone} ring-tint-${tone} p-3.5 sm:p-4 cursor-pointer h-full min-h-[112px] flex flex-col justify-between relative overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 stat-glow-${tone} shadow-[0_4px_18px_-4px_rgba(0,0,0,0.55)] ring-1 ring-white/15`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          {badge && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${TONE_BADGE[badge.tone]} max-w-[60%] truncate`}>
              {BadgeIcon && <BadgeIcon className="w-2.5 h-2.5 flex-shrink-0" />}
              <span className="truncate">{badge.text}</span>
            </span>
          )}
        </div>
        <div className="mt-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums mt-0.5 truncate text-foreground leading-tight">
            {fmt ? fmt(value) : <AnimatedNumber value={value} />}
          </div>
          {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
        </div>
      </motion.div>
    </Link>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Insight carousel card
// ─────────────────────────────────────────────────────────────────────────

const INSIGHT_PALETTE: Record<string, { tone: StatTone; iconGlow: string; tag: string; cta: string }> = {
  security: {
    tone: 'emerald',
    iconGlow: 'stat-glow-emerald',
    tag: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
    cta: 'text-emerald-400',
  },
  finance: {
    tone: 'amber',
    iconGlow: 'stat-glow-amber',
    tag: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30',
    cta: 'text-amber-400',
  },
  productivity: {
    tone: 'blue',
    iconGlow: 'stat-glow-blue',
    tag: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30',
    cta: 'text-blue-400',
  },
};

const InsightCarouselCard = memo(function InsightCarouselCard({
  ins, onDismiss,
}: {
  ins: Insight; onDismiss: (id: string) => void;
}) {
  const Icon = (LucideIcons as any)[ins.icon] || Sparkles;
  const palette = INSIGHT_PALETTE[ins.category] ?? INSIGHT_PALETTE.productivity;
  const inner = (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`snap-start flex-shrink-0 w-[260px] sm:w-[280px] glass-card card-${palette.tone} ring-tint-${palette.tone} hover:shadow-lg cursor-pointer overflow-hidden`}
      style={{ minHeight: 132 }}
      title={`${ins.title}\n${ins.description}`}
    >
      <div className="px-3.5 py-3 flex flex-col gap-1.5 min-h-[132px]">
        <div className="flex items-start gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${palette.iconGlow} shadow-[0_4px_18px_-4px_rgba(0,0,0,0.55)] ring-1 ring-white/15`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{ins.title}</div>
            <div className="text-[11px] text-muted-foreground leading-snug line-clamp-3 mt-0.5">{ins.description}</div>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(ins.id); }}
            className="text-[16px] leading-none text-muted-foreground/60 hover:text-foreground -mr-1 px-1 flex-shrink-0"
            aria-label="Dismiss insight"
          >
            ×
          </button>
        </div>
        <div className="mt-auto flex items-center justify-between">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${palette.tag}`}>{ins.category}</span>
          {ins.actionUrl && (
            <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${palette.cta}`}>
              Open <ArrowRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
  return ins.actionUrl ? <Link href={ins.actionUrl}>{inner}</Link> : <div>{inner}</div>;
});

// ─────────────────────────────────────────────────────────────────────────
// Security alert carousel card
// ─────────────────────────────────────────────────────────────────────────

type AlertItem = { icon: React.ElementType; text: string; sub: string; variant: 'red' | 'amber' | 'scan'; href?: string };

const AlertCarouselCard = memo(function AlertCarouselCard({ a }: { a: AlertItem }) {
  const Icon = a.icon;
  const tone = a.variant === 'red'
    ? {
        cardClass: 'card-rose ring-tint-rose',
        accent: 'before:bg-red-500',
        iconGlow: 'stat-glow-rose',
        cta: 'text-red-300',
        ctaLabel: 'Fix now',
      }
    : a.variant === 'amber'
      ? {
          cardClass: 'card-amber ring-tint-amber',
          accent: 'before:bg-amber-400',
          iconGlow: 'stat-glow-amber',
          cta: 'text-amber-300',
          ctaLabel: 'Review',
        }
      : {
          cardClass: 'card-indigo ring-tint-indigo',
          accent: 'before:bg-indigo-400',
          iconGlow: 'stat-glow-indigo',
          cta: 'text-indigo-300',
          ctaLabel: 'Scan now',
        };
  const inner = (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`snap-start flex-shrink-0 w-[260px] sm:w-[280px] glass-card ${tone.cardClass} hover:shadow-lg cursor-pointer overflow-hidden pl-4 pr-3.5 py-3 flex flex-col gap-1.5 relative before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:rounded-r-full ${tone.accent}`}
      style={{ minHeight: 132 }}
      title={`${a.text}\n${a.sub}`}
    >
      <div className="flex items-start gap-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${tone.iconGlow} shadow-[0_4px_18px_-4px_rgba(0,0,0,0.55)] ring-1 ring-white/15`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{a.text}</div>
          <div className="text-[11px] text-muted-foreground leading-snug line-clamp-3 mt-0.5">{a.sub}</div>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-end">
        <span className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${tone.cta}`}>
          {tone.ctaLabel} <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
  return a.href ? <Link href={a.href}>{inner}</Link> : <div>{inner}</div>;
});

// ─────────────────────────────────────────────────────────────────────────
// Recent activity row (memoized — list rendering hot path)
// ─────────────────────────────────────────────────────────────────────────

type ActivityItem = {
  id: string;
  text: string;
  action: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  timestamp: Date;
  href: string;
};

const ActivityRow = memo(function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <div className="relative flex items-center gap-3 pl-1 py-1.5 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer">
        <div className={`w-7 h-7 rounded-full ${item.iconBg} ring-2 ring-background flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
          <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-foreground truncate">{item.text}</div>
          <div className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(item.timestamp, { addSuffix: true })}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full flex-shrink-0">{item.action}</span>
      </div>
    </Link>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Main dashboard
// ─────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { passwords, subscriptions, expenses, reminders, notes, stats, searchQuery, refreshData, isLoading } = useVault();
  const { expenses: sharedExpenses } = useSharedExpenses();
  const { accountEmail, masterPassword } = useAuth();
  const { currency, formatCurrency } = useCurrency();
  const { toast } = useToast();

  const { openPasswordGenerator, openImportExport } = useUIActions();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useAutoNotifications({
    userId: accountEmail || 'guest',
    subscriptions,
    passwords,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshData();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      toast({ variant: 'success', title: 'Refreshed', description: 'Dashboard updated' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const fmtAmt = (n: number) => formatCurrency(n, currency);

  const [serverName, setServerName] = useState<string>(() => {
    try {
      const cached = localStorage.getItem('iv_display_name');
      if (cached) return cached;
      // First-paint fallback: derive from session before /auth/me resolves
      const session = localStorage.getItem('iv_account_session');
      if (session) {
        const { email, name } = JSON.parse(session);
        if (name && typeof name === 'string' && !name.includes('@')) {
          const first = name.split(/\s+/)[0];
          if (first) return first;
        }
        if (email && typeof email === 'string') return getUserName(email);
      }
    } catch { /* noop */ }
    return '';
  });
  useEffect(() => {
    if (!accountEmail) return;
    const cloudToken = localStorage.getItem('iv_cloud_token');
    if (!cloudToken) return;
    let cancelled = false;
    fetch(`${apiBase()}/api/auth/me`, { headers: { 'Authorization': `Bearer ${cloudToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const name = (data?.fullName || '').trim();
        if (name) {
          const emailLocal = accountEmail.split('@')[0];
          if (name.toLowerCase() === emailLocal.toLowerCase()) {
            try { localStorage.removeItem('iv_display_name'); } catch { /* noop */ }
            setServerName('');
            return;
          }
          const first = name.split(/\s+/)[0];
          setServerName(first);
          try { localStorage.setItem('iv_display_name', first); } catch { /* noop */ }
        }
      })
      .catch(() => { /* fallback to local resolution */ });
    return () => { cancelled = true; };
  }, [accountEmail]);
  const userName = serverName || getUserName(accountEmail);
  const normalizedSearch = searchQuery.trim().toLowerCase();

  // Defer the score so a slow recompute can't block the urgent UI render.
  const deferredPasswords = useDeferredValue(passwords);
  const deferredSubs = useDeferredValue(subscriptions);
  const deferredExpenses = useDeferredValue(expenses);

  const breakdown = useMemo(
    () => calculateSecurityScore(deferredPasswords as any, masterPassword || ''),
    [deferredPasswords, masterPassword]
  );

  const prevScoreRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    prevScoreRef.current = recordSecurityScore(breakdown.totalScore);
  }, [breakdown.totalScore]);

  const [insightsTick, setInsightsTick] = useState(0);
  const insights = useMemo<Insight[]>(() => {
    return generateInsights({
      passwords: deferredPasswords as any,
      subscriptions: deferredSubs as any,
      expenses: deferredExpenses as any,
      securityScore: breakdown.totalScore,
      previousSecurityScore: prevScoreRef.current,
    });
    // insightsTick included so dismiss triggers a refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deferredPasswords, deferredSubs, deferredExpenses, breakdown.totalScore, insightsTick]);

  const insightsTop4 = useMemo(() => insights.slice(0, 4), [insights]);

  const todayReminders = useMemo(() =>
    reminders
      .filter(r => !r.isCompleted && r.dueDate && isToday(new Date(r.dueDate)))
      .sort((a, b) => {
        const order: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 99) - (order[b.priority] ?? 99);
      }),
    [reminders]
  );

  const upcomingRenewals = useMemo(() =>
    subscriptions
      .filter(s => s.isActive && s.nextBillingDate)
      .filter(s => {
        const d = differenceInCalendarDays(new Date(s.nextBillingDate), new Date());
        return d >= 0 && d <= 7;
      })
      .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime())
      .slice(0, 3),
    [subscriptions]
  );

  const monthlySubSpend = useMemo(() =>
    subscriptions.filter(s => s.isActive).reduce((t, s) => {
      const cost = s.cost || 0;
      if (s.billingCycle === 'yearly') return t + cost / 12;
      if (s.billingCycle === 'quarterly') return t + cost / 3;
      return t + cost;
    }, 0), [subscriptions]);

  // User's own share of a SharedExpense — for legacy/personal entries the
  // share equals the total amount. For Splitwise-style entries we sum only
  // splits where contactId === 'self'. Falls back to full amount if no
  // self split is present so personal-style additions still count.
  const selfShare = (e: any): number => {
    const splits = Array.isArray(e?.splits) ? e.splits : null;
    if (!splits || splits.length === 0) return e?.amount || 0;
    const ours = splits
      .filter((s: any) => s?.contactId === 'self')
      .reduce((acc: number, s: any) => acc + (s?.amount || 0), 0);
    return ours > 0 ? ours : (e?.amount || 0);
  };

  // Merge legacy and shared expense stores by id so we don't double-count
  // legacy rows that useSharedExpenses already mirrors via legacyToShared.
  const mergedExpenses = useMemo(() => {
    const map = new Map<string, any>();
    for (const e of (expenses ?? [])) map.set(e.id, e);
    for (const s of (sharedExpenses ?? [])) map.set(s.id, s);
    return Array.from(map.values());
  }, [expenses, sharedExpenses]);

  const thisMonthExpenses = useMemo(() => {
    const now = new Date();
    return mergedExpenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + selfShare(e), 0);
  }, [mergedExpenses]);

  const lastMonthExpenses = useMemo(() => {
    const now = new Date();
    const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    return mergedExpenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === ly && d.getMonth() === lm;
      })
      .reduce((sum, e) => sum + selfShare(e), 0);
  }, [mergedExpenses]);

  const spendTrend = useMemo(() => {
    if (lastMonthExpenses <= 0) return null;
    const pct = ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100;
    if (Math.abs(pct) < 1) return null;
    return { up: pct > 0, pct: Math.abs(Math.round(pct)) };
  }, [thisMonthExpenses, lastMonthExpenses]);

  const activeSubsCount = useMemo(() => subscriptions.filter(s => s.isActive).length, [subscriptions]);

  const notesThisMonth = useMemo(() => {
    const now = new Date();
    return notes.filter(n => {
      const d = new Date(n.updatedAt || n.createdAt);
      return !isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [notes]);

  const weakPasswordCount = useMemo(() => {
    return passwords.filter(p => {
      const pw = (p as any).password ?? '';
      if (typeof pw !== 'string') return false;
      return pw.length > 0 && pw.length < 10;
    }).length;
  }, [passwords]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const safeDate = (v: unknown): Date => {
      const d = new Date(v as any);
      return isNaN(d.getTime()) ? new Date(0) : d;
    };
    const items = [
      // Each section's deep-link uses `?openId=<id>` so the destination page
      // can pick up the specific item and open its detail/editor view. Notes
      // was rendering blank because the href was bare `/notes` — the openId
      // handler had no parameter to consume.
      ...passwords.map(p => ({ id: p.id, text: p.name ?? 'Password', action: 'Password', icon: Lock, iconColor: 'text-indigo-500', iconBg: 'bg-indigo-500/10', timestamp: safeDate(p.updatedAt || p.createdAt), href: `/passwords?openId=${encodeURIComponent(p.id)}` })),
      ...notes.map(n => ({ id: n.id, text: n.title ?? 'Note', action: 'Note', icon: FileText, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10', timestamp: safeDate(n.updatedAt || n.createdAt), href: `/notes?openId=${encodeURIComponent(n.id)}` })),
      ...expenses.map(e => ({ id: e.id, text: (e as any).description || (e as any).title || e.category || 'Expense', action: 'Expense', icon: DollarSign, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/10', timestamp: safeDate((e as any).updatedAt || e.date || e.createdAt), href: `/expenses?openId=${encodeURIComponent(e.id)}` })),
      ...reminders.map(r => ({ id: r.id, text: r.title ?? 'Reminder', action: 'Reminder', icon: Bell, iconColor: 'text-orange-500', iconBg: 'bg-orange-500/10', timestamp: safeDate(r.updatedAt || r.createdAt), href: `/reminders?openId=${encodeURIComponent(r.id)}` })),
      ...subscriptions.map(s => ({ id: s.id, text: s.name ?? 'Subscription', action: 'Subscription', icon: CreditCard, iconColor: 'text-purple-500', iconBg: 'bg-purple-500/10', timestamp: safeDate(s.updatedAt || s.createdAt), href: `/subscriptions?openId=${encodeURIComponent(s.id)}` })),
    ];
    return items
      .filter(item => !normalizedSearch || (item.text ?? '').toLowerCase().includes(normalizedSearch))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);
  }, [passwords, notes, expenses, reminders, subscriptions, normalizedSearch]);

  const criticalAlerts = useMemo<AlertItem[]>(() => {
    const alerts: AlertItem[] = [];
    const c = breakdown.categories;
    if (c.passwordStrength.score < 20 && passwords.length > 0) {
      alerts.push({ icon: AlertTriangle, text: 'Weak passwords detected', sub: c.passwordStrength.detail, variant: 'red', href: '/passwords?strength=weak' });
    }
    if (c.uniquePasswords.score < 16 && passwords.length > 0) {
      alerts.push({ icon: ShieldAlert, text: 'Duplicate passwords found', sub: c.uniquePasswords.detail, variant: 'red', href: '/passwords' });
    }
    if (c.twoFactorEnabled.score === 0) {
      alerts.push({ icon: Key, text: 'Two-factor not enabled', sub: 'Add an extra layer of protection', variant: 'amber', href: '/profile?tab=security' });
    }
    if (c.recentlyChanged.score < 8 && passwords.length > 0) {
      alerts.push({ icon: Clock, text: 'Old passwords need rotation', sub: c.recentlyChanged.detail, variant: 'amber', href: '/passwords' });
    }
    if (c.masterPasswordStrength.score > 0 && c.masterPasswordStrength.score < 7) {
      alerts.push({ icon: ShieldAlert, text: 'Master password could be stronger', sub: c.masterPasswordStrength.detail, variant: 'amber', href: '/profile?tab=security' });
    }
    if (c.autoLockEnabled.score === 0) {
      alerts.push({ icon: Lock, text: 'Auto-lock is off', sub: 'Vault stays unlocked indefinitely', variant: 'amber', href: '/profile?tab=security' });
    }
    return alerts.slice(0, 3);
  }, [breakdown, passwords.length]);

  const isEmpty = stats.totalPasswords === 0 && stats.activeSubscriptions === 0 && stats.totalNotes === 0;

  // Breached-password count from the most recent breach scan.
  // The raw value is cached in localStorage but a stale scan can outlive
  // password deletions / vault switches, so we clamp it to the current
  // password count. A fresh vault (no passwords) always shows 0 regardless
  // of leftover cache.
  const [rawBreachedCount, setRawBreachedCount] = useState(() => {
    try {
      const raw = localStorage.getItem('iv_breach_count');
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch { return 0; }
  });
  useEffect(() => {
    const update = (val?: number) => {
      if (typeof val === 'number') {
        setRawBreachedCount(Number.isFinite(val) && val > 0 ? val : 0);
        return;
      }
      try {
        const raw = localStorage.getItem('iv_breach_count');
        const n = raw ? parseInt(raw, 10) : 0;
        setRawBreachedCount(Number.isFinite(n) && n > 0 ? n : 0);
      } catch { /* noop */ }
    };
    const onStorage = (e: StorageEvent) => { if (e.key === 'iv_breach_count') update(); };
    const onCustom = (e: Event) => { update((e as CustomEvent<number>).detail); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('iv:breach-count-changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('iv:breach-count-changed', onCustom);
    };
  }, []);
  const breachedCount = Math.max(0, Math.min(rawBreachedCount, passwords.length));
  // Drop stale cache once we detect it can't be true for this vault.
  useEffect(() => {
    if (rawBreachedCount > passwords.length) {
      try { localStorage.removeItem('iv_breach_count'); } catch { /* noop */ }
      setRawBreachedCount(0);
    }
  }, [rawBreachedCount, passwords.length]);

  // Push the latest values to the shared App Group store so the iOS widget stays in sync.
  useEffect(() => {
    publishWidgetSnapshot({
      securityScore: breakdown.totalScore,
      securityLevel: breakdown.level,
      upcomingRenewals: upcomingRenewals.length,
      breachedCount,
    });
  }, [breakdown.totalScore, breakdown.level, upcomingRenewals.length, breachedCount]);

  // Build the security alert list (always include the leak-scan tail card so
  // /security-health gets a clear entry point even when no critical issues).
  const alertCards = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = [...criticalAlerts];
    if (breachedCount > 0) {
      out.unshift({
        icon: ShieldAlert,
        text: `${breachedCount} password${breachedCount === 1 ? '' : 's'} in breaches`,
        sub: 'Tap to review and update compromised credentials.',
        variant: 'red',
        href: '/security-health',
      });
    }
    out.push({
      icon: Search,
      text: 'Scan for leaks',
      sub: 'Run a fresh dark-web scan against HIBP',
      variant: 'scan',
      href: '/security-health',
    });
    return out;
  }, [criticalAlerts, breachedCount]);

  // Route security alerts into the notification center so the bell badge
  // reflects every outstanding security concern, not just CRM-driven ones.
  // The trailing "Scan for leaks" CTA is filtered out — it's a navigation
  // shortcut, not an alert that should accumulate unread badges.
  useEffect(() => {
    if (!accountEmail) return;
    const payload = alertCards
      .filter(a => a.variant !== 'scan')
      .map(a => ({
        key: `${a.text}`.toLowerCase().replace(/\s+/g, '-').slice(0, 80),
        title: a.text,
        message: a.sub || '',
        actionUrl: a.href,
      }));
    void NotificationService.syncSecurityAlerts(accountEmail, payload);
  }, [alertCards, accountEmail]);

  if (isLoading && stats.totalPasswords === 0 && stats.activeSubscriptions === 0 && stats.totalNotes === 0 && stats.totalExpenses === 0) {
    return (
      <div className="space-y-4 pb-6" data-testid="dashboard-loading">
        <div className="rounded-3xl bg-card border border-border p-6">
          <ListSkeleton rows={2} showHeader={true} />
        </div>
        <ListSkeleton rows={4} showHeader={false} />
      </div>
    );
  }

  const levelStyle = LEVEL_BADGE[breakdown.level];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4 pb-6" data-testid="dashboard-today">

      {/* ─── Section 1 · Premium hero ──────────────────────────────────── */}
      <motion.div variants={fadeUp}
        className="glass-card relative overflow-hidden px-5 py-4 sm:py-5">
        {/* subtle emerald edge glow */}
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="mb-3">
          <div className="text-2xl sm:text-3xl font-light tracking-tight text-foreground truncate flex items-center gap-2">
            <span className="truncate">
              {getGreeting()}, <span className="font-semibold">{userName || 'there'}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                const current = localStorage.getItem('iv_preferred_display_name') || userName || '';
                const next = window.prompt(
                  `What should we call you?\n\n(We'll show this in the greeting. We can't always guess the right first name from your email — this lets you set it.)`,
                  current,
                );
                if (next === null) return; // user cancelled
                const trimmed = next.trim();
                if (trimmed) {
                  localStorage.setItem('iv_preferred_display_name', trimmed);
                  // CRITICAL: userName is computed as `serverName || getUserName(email)`.
                  // If serverName was already populated (from /api/auth/me earlier),
                  // it wins over the localStorage value getUserName reads — so the
                  // greeting would still show the old serverName. Updating
                  // serverName directly is the only thing that triggers a
                  // re-render with the new preferred name visible.
                  setServerName(trimmed.split(/\s+/)[0].slice(0, 10));
                } else {
                  localStorage.removeItem('iv_preferred_display_name');
                  // Empty input → fall back to derivation. Clear serverName so
                  // userName re-runs getUserName(accountEmail) on next render.
                  setServerName('');
                }
              }}
              aria-label="Edit display name"
              title="Edit how we address you"
              className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-[12px] text-muted-foreground mt-0.5">{format(new Date(), 'EEEE, MMM d')}</div>
        </div>

        {/* Compact action bar — refresh · import/export · generator.
            The currency switcher was removed: stored amounts have no source
            currency tracked, so toggling here only changed the symbol while
            values stayed the same — misleading. Set the display currency in
            Profile → Preferences instead. */}
        <div className="flex items-center gap-1.5 mb-3 -mx-1 px-1 overflow-x-auto scrollbar-hide" data-testid="dashboard-action-bar">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="hero-refresh"
            aria-label="Refresh dashboard"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openImportExport}
            data-testid="hero-import-export"
            aria-label="Import / export"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors flex-shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import/Export</span>
          </button>
          <button
            onClick={openPasswordGenerator}
            data-testid="hero-generator"
            aria-label="Password generator"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors flex-shrink-0"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Generator</span>
          </button>
        </div>

        {/* Security badge row — conic ring + label, links to /security-health */}
        <Link href="/security-health">
          <div
            data-testid="security-badge-row"
            className="flex items-center gap-3 rounded-xl bg-card/60 border border-border/40 px-3 py-2.5 cursor-pointer hover:bg-card transition-colors group"
          >
            {/* Conic security ring */}
            <div
              className={`relative w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 security-ring ${!isEmpty && (breakdown.level === 'Excellent' || breakdown.level === 'Good') ? 'glow-breathe' : ''}`}
              style={{
                ['--score' as any]: isEmpty ? 0 : breakdown.totalScore,
                ['--ring-color' as any]:
                  isEmpty ? '#64748b'
                  : breakdown.level === 'Critical' ? '#ef4444'
                  : breakdown.level === 'Needs Work' ? '#f59e0b'
                  : '#10b981',
              } as React.CSSProperties}
            >
              <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center">
                {isEmpty
                  ? <Shield className="w-4 h-4 text-muted-foreground" />
                  : <span className={`text-sm font-bold tabular-nums ${levelStyle.text}`}>{breakdown.totalScore}</span>}
              </div>
              <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${levelStyle.dot} ring-2 ring-background`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Security score</div>
              <div className={`text-sm font-semibold ${levelStyle.text} flex items-center gap-1.5`}>
                {isEmpty ? 'Vault empty' : breakdown.level}
                {!isEmpty && breakdown.level === 'Excellent' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
            </div>
            <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-0.5 flex-shrink-0">
              View Report
              <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </motion.div>

      {/* ─── Empty state ──────────────────────────────────────────────── */}
      {isEmpty && (
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="font-semibold text-foreground mb-0.5">Your vault is empty</h3>
            <p className="text-sm text-muted-foreground">Add a password to unlock your security score and insights.</p>
          </div>
          <Link href="/passwords">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shrink-0">
              <Plus className="w-4 h-4" /> Add Password
            </button>
          </Link>
        </motion.div>
      )}

      {/* ─── Section 2 · Premium stat cards ───────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="quick-stats">
        <RichStatCard
          label="Passwords"
          value={stats.totalPasswords}
          sub={stats.totalPasswords === 0 ? 'Add your first' : weakPasswordCount > 0 ? `${weakPasswordCount} need attention` : 'All secured'}
          icon={Lock}
          tone="indigo"
          href="/passwords"
          badge={
            stats.totalPasswords === 0
              ? undefined
              : breachedCount > 0
                ? { text: `${breachedCount} breached`, tone: 'rose', icon: AlertTriangle }
                : weakPasswordCount > 0
                  ? { text: `${weakPasswordCount} weak`, tone: 'rose', icon: AlertTriangle }
                  : { text: 'All Strong', tone: 'emerald', icon: Check }
          }
        />
        <RichStatCard
          label="Notes"
          value={stats.totalNotes}
          sub={notesThisMonth > 0 ? `${notesThisMonth} this month` : 'Capture an idea'}
          icon={FileText}
          tone="amber"
          href="/notes"
          badge={notesThisMonth > 0 ? { text: 'Active', tone: 'amber', icon: BookOpen } : undefined}
        />
        <RichStatCard
          label="Subs / mo"
          value={monthlySubSpend}
          fmt={fmtAmt}
          sub={activeSubsCount > 0 ? `${activeSubsCount} active` : 'No subscriptions'}
          icon={Repeat}
          tone="emerald"
          href="/subscriptions"
          badge={activeSubsCount > 0 ? { text: `${activeSubsCount}`, tone: 'emerald', icon: Repeat } : undefined}
        />
        <RichStatCard
          label="Spent / mo"
          value={thisMonthExpenses}
          fmt={fmtAmt}
          sub={
            spendTrend
              ? `${spendTrend.up ? '+' : '−'}${spendTrend.pct}% vs last month`
              : thisMonthExpenses > 0
                ? format(new Date(), 'MMMM yyyy')
                : 'Log your first'
          }
          icon={Wallet}
          tone="rose"
          href="/expenses"
          badge={
            spendTrend
              ? { text: `${spendTrend.up ? '+' : '−'}${spendTrend.pct}%`, tone: spendTrend.up ? 'rose' : 'emerald', icon: spendTrend.up ? TrendingUp : TrendingDown }
              : undefined
          }
        />
      </motion.div>

      {/* ─── Section 3 · Security alerts (horizontal scroll) ─────────── */}
      {!isEmpty && (
        <motion.div variants={fadeUp} data-testid="security-alerts-banner">
          <SectionLabel
            icon={ShieldAlert}
            label="Security Alerts"
            count={criticalAlerts.length + (breachedCount > 0 ? 1 : 0)}
            action={{ href: '/security-health', label: 'Open report' }}
          />
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide" data-testid="breach-alert-banner">
            <div className="flex gap-2.5 snap-x snap-mandatory pr-4 sm:pr-0">
              {alertCards.map((a, i) => (
                <AlertCarouselCard key={`${a.text}-${i}`} a={a} />
              ))}
            </div>
          </div>
          {criticalAlerts.length === 0 && breachedCount === 0 && (
            <div data-testid="security-all-clear" className="hidden">All clear · {breakdown.totalScore}/100</div>
          )}
        </motion.div>
      )}

      {/* ─── Section 4 · Premium quick actions ───────────────────────── */}
      <motion.div variants={fadeUp}>
        <SectionLabel label="Quick Actions" />
        <div className="grid grid-cols-4 gap-2.5" data-testid="quick-actions">
          {([
            { label: 'Add Password', icon: Lock,        href: '/passwords?action=add', tone: 'indigo'  as StatTone },
            { label: 'New Note',     icon: FileText,    href: '/notes?action=add',     tone: 'amber'   as StatTone },
            { label: 'Log Expense',  icon: DollarSign,  href: '/expenses?action=add',  tone: 'emerald' as StatTone },
            // KeyRound has a chunkier glyph than Key — visually matches the
            // other Quick Action icons (Lock / FileText / DollarSign) which
            // already have heavier strokes. Also bumped icon size from 18 →
            // 20 (w-5 h-5) across the row for better legibility.
            { label: 'Generator',    icon: KeyRound,                                   tone: 'cyan'    as StatTone, onClick: openPasswordGenerator },
          ] as Array<{ label: string; icon: React.ElementType; tone: StatTone; href?: string; onClick?: () => void }>).map(({ label, icon: Icon, href, tone, onClick }) => {
            const inner = (
              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                aria-label={label}
                title={label}
                className={`glass-card card-${tone} ring-tint-${tone} flex flex-col items-center justify-center gap-1.5 px-2 py-3.5 cursor-pointer h-full min-h-[88px]`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 stat-glow-${tone} shadow-[0_6px_20px_-4px_rgba(0,0,0,0.55)] ring-1 ring-white/15`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[11px] sm:text-xs font-semibold text-foreground text-center leading-tight">{label}</span>
              </motion.div>
            );
            if (href) return <Link key={label} href={href}>{inner}</Link>;
            return <button key={label} onClick={onClick} className="text-left w-full" aria-label={label}>{inner}</button>;
          })}
        </div>
      </motion.div>

      {/* ─── Section 5 · Insights carousel (horizontal scroll) ─────── */}
      {insightsTop4.length > 0 && (
        <motion.div variants={fadeUp} data-testid="smart-insights">
          <SectionLabel icon={Sparkles} label="Smart Insights" />
          <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2.5 snap-x snap-mandatory pr-4 sm:pr-0">
              {insightsTop4.map((ins) => (
                <InsightCarouselCard
                  key={ins.id}
                  ins={ins}
                  onDismiss={(id) => { dismissInsight(id); setInsightsTick((t) => t + 1); }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Section 6 · Today's reminders (compact, only if any) ─── */}
      {todayReminders.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionLabel
            icon={Bell}
            label="Today"
            count={todayReminders.length}
            action={todayReminders.length > 3 ? { href: '/reminders', label: 'See all' } : undefined}
          />
          <div className="glass-card overflow-hidden divide-y divide-border/30" data-testid="today-reminders">
            {todayReminders.slice(0, 3).map(r => (
              <Link key={r.id} href="/reminders">
                <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[r.priority] ?? 'bg-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">{r.priority} priority</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Section 7 · Upcoming renewals (max 3, compact list) ──── */}
      {upcomingRenewals.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionLabel
            icon={CreditCard}
            label="Upcoming Renewals"
            action={{ href: '/subscriptions', label: 'See all' }}
          />
          <div className="glass-card overflow-hidden divide-y divide-border/30">
            {upcomingRenewals.map(s => {
              const daysLeft = s.nextBillingDate ? differenceInCalendarDays(new Date(s.nextBillingDate), new Date()) : 99;
              const urgent = daysLeft <= 3;
              return (
                <Link key={s.id} href="/subscriptions">
                  <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                    <Favicon url={s.platformLink} name={s.name} className="w-7 h-7 flex-shrink-0 rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">{fmtAmt(s.cost || 0)}</div>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 tabular-nums ${urgent ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1d' : `${daysLeft}d`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Section 8 · Recent activity (compact timeline, max 5) ── */}
      {recentActivity.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionLabel
            icon={Activity}
            label="Recent Activity"
            action={{ href: '/logging', label: 'View log' }}
          />
          <div className="glass-card overflow-hidden">
            <div className="relative pl-2 py-1" data-testid="recent-activity">
              <span aria-hidden className="absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent" />
              {recentActivity.map(item => (
                <ActivityRow key={`${item.action}-${item.id}`} item={item} />
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Spending breakdown (kept as a single compact widget, only when data exists) ── */}
      {!isEmpty && thisMonthExpenses > 0 && (
        <motion.div variants={fadeUp}>
          <SectionLabel
            icon={TrendingUp}
            label={`${format(new Date(), 'MMMM')} Top Categories`}
            action={{ href: '/expenses', label: 'See all' }}
          />
          <SpendingBreakdown expenses={mergedExpenses} fmt={fmtAmt} />
        </motion.div>
      )}

    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Spending breakdown — kept as a focused single widget, not a 2-col layout
// ─────────────────────────────────────────────────────────────────────────

const SpendingBreakdown = memo(function SpendingBreakdown({
  expenses, fmt,
}: {
  expenses: any[]; fmt: (n: number) => string;
}) {
  const cats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
    });
    const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat, amount]) => ({
        cat, amount,
        pct: (amount / total) * 100,
        color: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other'],
      }));
  }, [expenses]);

  if (cats.length === 0) return null;

  return (
    <div className="glass-card p-3.5 space-y-2.5">
      {cats.map(c => (
        <div key={c.cat}>
          <div className="flex justify-between items-center mb-1">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-foreground/80 truncate max-w-[180px]">{c.cat}</span>
            </span>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{fmt(c.amount)}</span>
          </div>
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div className="h-full rounded-full"
              style={{ width: `${Math.min(c.pct, 100)}%`, background: c.color, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
          </div>
        </div>
      ))}
    </div>
  );
});
