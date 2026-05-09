import { useVault } from "@/contexts/vault-context";
import { useCurrency } from "@/contexts/currency-context";
import { useAuth } from "@/contexts/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock, FileText, DollarSign, Bell, Plus, AlertTriangle,
  Clock, Globe, Upload, Shield, RefreshCw,
  ChevronRight, CreditCard, Activity, Key, TrendingUp,
  Sparkles, ShieldAlert, ShieldCheck, ArrowRight, Search,
} from "lucide-react";
import React, { useState, useEffect, useMemo, useDeferredValue, useRef, memo } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays, formatDistanceToNow, isToday } from "date-fns";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { ListSkeleton } from "@/components/list-skeleton";
import { Favicon } from "@/components/favicon";
import { calculateSecurityScore, type SecurityBreakdown } from "@/lib/security-score";
import { generateInsights, recordSecurityScore, dismissInsight, type Insight } from "@/lib/ai-insights";
import * as LucideIcons from "lucide-react";
import { publishWidgetSnapshot } from "@/lib/widget-data";
import { useAutoNotifications } from "@/hooks/use-auto-notifications";
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
  const namifyEmail = (email: string): string => {
    const prefix = email.split('@')[0].replace(/[0-9]/g, '').replace(/[._-]/g, ' ').trim();
    if (!prefix) return '';
    const first = prefix.split(' ')[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  };
  const isEmailPrefix = (name: string, email: string | null): boolean => {
    if (!email) return false;
    return name.toLowerCase() === email.split('@')[0].toLowerCase();
  };
  try {
    const cp = JSON.parse(localStorage.getItem('customerProfile') || '{}');
    const profileMatchesAccount =
      accountEmail &&
      typeof cp.email === 'string' &&
      cp.email.toLowerCase() === accountEmail.toLowerCase();
    if (profileMatchesAccount) {
      const fullName = (cp.full_name || cp.name || cp.display_name || '').trim();
      if (fullName && !fullName.includes('@') && !isEmailPrefix(fullName, accountEmail)) {
        return fullName.split(' ')[0];
      }
    }
    if (accountEmail) return namifyEmail(accountEmail);
    const session = localStorage.getItem('iv_account_session');
    if (session) {
      const { email, name } = JSON.parse(session);
      if (name && typeof name === 'string' && !name.includes('@') && !isEmailPrefix(name, email)) {
        return name.split(' ')[0];
      }
      if (email) return namifyEmail(email);
    }
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

const QuickStatCard = memo(function QuickStatCard({
  label, value, accent, href, fmt,
}: {
  label: string; value: number; accent: string; href: string; fmt?: (n: number) => string;
}) {
  return (
    <Link href={href}>
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className="rounded-2xl bg-card border border-border/50 p-3 cursor-pointer hover:shadow-md transition-shadow h-full backdrop-blur-md"
        style={{ borderTop: `2px solid ${accent}` }}
      >
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{label}</div>
        <div className="text-lg sm:text-xl font-bold tabular-nums text-foreground mt-0.5 truncate">
          {fmt ? fmt(value) : <AnimatedNumber value={value} />}
        </div>
      </motion.div>
    </Link>
  );
});

// ─────────────────────────────────────────────────────────────────────────
// Insight carousel card
// ─────────────────────────────────────────────────────────────────────────

const INSIGHT_PALETTE: Record<string, { stripe: string; iconBg: string; tag: string }> = {
  security: {
    stripe: 'bg-emerald-500',
    iconBg: 'bg-emerald-500/15 text-emerald-500 ring-emerald-500/30',
    tag: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  },
  finance: {
    stripe: 'bg-amber-500',
    iconBg: 'bg-amber-500/15 text-amber-500 ring-amber-500/30',
    tag: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  productivity: {
    stripe: 'bg-blue-500',
    iconBg: 'bg-blue-500/15 text-blue-500 ring-blue-500/30',
    tag: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
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
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className="snap-start flex-shrink-0 w-[260px] sm:w-[280px] rounded-2xl border border-border/50 bg-card backdrop-blur-md hover:shadow-md transition-all cursor-pointer overflow-hidden"
      style={{ maxHeight: 120, minHeight: 120 }}
    >
      <div className={`h-1 w-full ${palette.stripe}`} />
      <div className="px-3 py-2.5 flex flex-col gap-1.5 h-[calc(120px-4px)]">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ring-1 ${palette.iconBg}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div className="text-sm font-semibold text-foreground leading-snug truncate flex-1 min-w-0">{ins.title}</div>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(ins.id); }}
            className="text-[16px] leading-none text-muted-foreground/60 hover:text-foreground -mr-1 px-1"
            aria-label="Dismiss insight"
          >
            ×
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground leading-snug line-clamp-1">{ins.description}</div>
        <div className="mt-auto flex items-center justify-between">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${palette.tag}`}>{ins.category}</span>
          {ins.actionUrl && (
            <span className="text-[11px] font-semibold text-primary inline-flex items-center gap-0.5">
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
        border: 'border-l-red-500',
        iconBg: 'bg-red-500/15 text-red-500',
        cta: 'text-red-600 dark:text-red-400',
        ctaLabel: 'Fix now',
      }
    : a.variant === 'amber'
      ? {
          border: 'border-l-amber-500',
          iconBg: 'bg-amber-500/15 text-amber-500',
          cta: 'text-amber-600 dark:text-amber-400',
          ctaLabel: 'Review',
        }
      : {
          border: 'border-l-indigo-500',
          iconBg: 'bg-indigo-500/15 text-indigo-500',
          cta: 'text-indigo-600 dark:text-indigo-400',
          ctaLabel: 'Scan now',
        };
  const inner = (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`snap-start flex-shrink-0 w-[260px] sm:w-[280px] rounded-2xl bg-card border border-border/50 border-l-4 ${tone.border} backdrop-blur-md hover:shadow-md transition-all cursor-pointer overflow-hidden px-3.5 py-3 flex flex-col gap-1.5`}
      style={{ maxHeight: 120, minHeight: 120 }}
    >
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${tone.iconBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-sm font-semibold text-foreground leading-snug truncate flex-1 min-w-0">{a.text}</div>
      </div>
      <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{a.sub}</div>
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
  const { accountEmail, masterPassword } = useAuth();
  const { currency, setCurrency, formatCurrency, currencies } = useCurrency();
  const { toast } = useToast();

  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
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
    try { return localStorage.getItem('iv_display_name') || ''; } catch { return ''; }
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

  const thisMonthExpenses = useMemo(() => {
    const now = new Date();
    return expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const safeDate = (v: unknown): Date => {
      const d = new Date(v as any);
      return isNaN(d.getTime()) ? new Date(0) : d;
    };
    const items = [
      ...passwords.map(p => ({ id: p.id, text: p.name ?? 'Password', action: 'Password', icon: Lock, iconColor: 'text-indigo-500', iconBg: 'bg-indigo-500/10', timestamp: safeDate(p.updatedAt || p.createdAt), href: '/passwords' })),
      ...notes.map(n => ({ id: n.id, text: n.title ?? 'Note', action: 'Note', icon: FileText, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10', timestamp: safeDate(n.updatedAt || n.createdAt), href: '/notes' })),
      ...expenses.map(e => ({ id: e.id, text: e.description || e.category || 'Expense', action: 'Expense', icon: DollarSign, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/10', timestamp: safeDate((e as any).updatedAt || e.date || e.createdAt), href: '/expenses' })),
      ...reminders.map(r => ({ id: r.id, text: r.title ?? 'Reminder', action: 'Reminder', icon: Bell, iconColor: 'text-orange-500', iconBg: 'bg-orange-500/10', timestamp: safeDate(r.updatedAt || r.createdAt), href: '/reminders' })),
      ...subscriptions.map(s => ({ id: s.id, text: s.name ?? 'Subscription', action: 'Subscription', icon: CreditCard, iconColor: 'text-purple-500', iconBg: 'bg-purple-500/10', timestamp: safeDate(s.updatedAt || s.createdAt), href: '/subscriptions' })),
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
  const [breachedCount, setBreachedCount] = useState(() => {
    try {
      const raw = localStorage.getItem('iv_breach_count');
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch { return 0; }
  });
  useEffect(() => {
    const update = (val?: number) => {
      if (typeof val === 'number') {
        setBreachedCount(Number.isFinite(val) && val > 0 ? val : 0);
        return;
      }
      try {
        const raw = localStorage.getItem('iv_breach_count');
        const n = raw ? parseInt(raw, 10) : 0;
        setBreachedCount(Number.isFinite(n) && n > 0 ? n : 0);
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

      {/* ─── Section 1 · Compact hero ──────────────────────────────────── */}
      <motion.div variants={fadeUp}
        className="rounded-2xl border border-border/50 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent backdrop-blur-md px-4 py-3.5 sm:py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="text-base sm:text-lg font-bold text-foreground truncate">
              {getGreeting()}{userName ? `, ${userName}` : ''}
            </div>
            <div className="text-[11px] text-muted-foreground">{format(new Date(), 'EEEE, MMM d')}</div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="hero-refresh"
              aria-label="Refresh dashboard"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger
                aria-label="Currency"
                className="h-9 px-2.5 rounded-xl bg-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground border-0 text-xs font-medium gap-1 [&>svg:last-child]:ml-0 focus:ring-0"
              >
                <Globe className="w-3.5 h-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(curr => (
                  <SelectItem key={curr.code} value={curr.code}>
                    {curr.symbol === curr.code ? curr.code : `${curr.symbol} ${curr.code}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={() => setShowImportExport(true)}
              aria-label="Import / export"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security badge row → single line, links to /security-health */}
        <Link href="/security-health">
          <div
            data-testid="security-badge-row"
            className={`flex items-center gap-3 rounded-xl bg-card/60 border border-border/40 px-3 py-2.5 cursor-pointer hover:bg-card transition-colors group`}
          >
            <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 ${levelStyle.ring} ${levelStyle.bg}`}>
              {isEmpty
                ? <Shield className="w-4 h-4 text-muted-foreground" />
                : <span className={`text-sm font-bold tabular-nums ${levelStyle.text}`}>{breakdown.totalScore}</span>}
              <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${levelStyle.dot} ring-2 ring-background`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Security score</div>
              <div className={`text-sm font-semibold ${levelStyle.text}`}>
                {isEmpty ? 'Vault empty' : breakdown.level}
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

      {/* ─── Section 2 · Quick stats row ──────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="quick-stats">
        <QuickStatCard label="Passwords" value={stats.totalPasswords} accent="#6366f1" href="/passwords" />
        <QuickStatCard label="Notes" value={stats.totalNotes} accent="#f59e0b" href="/notes" />
        <Link href="/subscriptions">
          <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="rounded-2xl bg-card border border-border/50 p-3 cursor-pointer hover:shadow-md transition-shadow h-full backdrop-blur-md"
            style={{ borderTop: '2px solid #a855f7' }}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Subs / mo</div>
            <div className="text-lg sm:text-xl font-bold tabular-nums text-foreground mt-0.5 truncate">{fmtAmt(monthlySubSpend)}</div>
          </motion.div>
        </Link>
        <Link href="/expenses">
          <motion.div
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="rounded-2xl bg-card border border-border/50 p-3 cursor-pointer hover:shadow-md transition-shadow h-full backdrop-blur-md"
            style={{ borderTop: '2px solid #22c55e' }}
          >
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">Spent / mo</div>
            <div className="text-lg sm:text-xl font-bold tabular-nums text-foreground mt-0.5 truncate">{fmtAmt(thisMonthExpenses)}</div>
          </motion.div>
        </Link>
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

      {/* ─── Section 4 · Quick actions (compact 2x2 / 4-col on desktop) ── */}
      <motion.div variants={fadeUp}>
        <SectionLabel label="Quick Actions" />
        <div className="grid grid-cols-4 gap-2.5" data-testid="quick-actions">
          {([
            { label: 'Add Password', icon: Lock, href: '/passwords?action=add', bg: 'from-indigo-500 to-indigo-600' },
            { label: 'New Note', icon: FileText, href: '/notes?action=add', bg: 'from-amber-500 to-orange-500' },
            { label: 'Log Expense', icon: DollarSign, href: '/expenses?action=add', bg: 'from-emerald-500 to-green-600' },
            { label: 'Generator', icon: Key, bg: 'from-cyan-500 to-sky-500', onClick: () => setShowGenerator(true) },
          ] as Array<{ label: string; icon: React.ElementType; bg: string; href?: string; onClick?: () => void }>).map(({ label, icon: Icon, href, bg, onClick }) => {
            const inner = (
              <motion.div
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                aria-label={label}
                title={label}
                className="flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2 py-3 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer h-full"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${bg} shadow-sm`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="hidden sm:inline text-xs font-medium text-foreground text-center leading-tight">{label}</span>
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
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/30" data-testid="today-reminders">
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
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden divide-y divide-border/30">
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
            action={{ href: '/logging', label: 'See all' }}
          />
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
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
          <SpendingBreakdown expenses={expenses} fmt={fmtAmt} />
        </motion.div>
      )}

      <PasswordGeneratorModal open={showGenerator} onOpenChange={setShowGenerator} />
      <ImportExportModal open={showImportExport} onOpenChange={setShowImportExport} />
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
    <div className="rounded-2xl border border-border/50 bg-card p-3.5 space-y-2.5">
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
