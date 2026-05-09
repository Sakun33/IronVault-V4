import { useVault } from "@/contexts/vault-context";
import { useCurrency } from "@/contexts/currency-context";
import { useAuth } from "@/contexts/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock, FileText, DollarSign, Bell, Plus, AlertTriangle,
  Clock, Globe, Upload, Shield, RefreshCw,
  ChevronRight, CreditCard, Activity, Key, Calendar, TrendingUp,
  Sparkles, ShieldAlert, ShieldCheck, ArrowRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays, formatDistanceToNow, isToday } from "date-fns";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { ListSkeleton } from "@/components/list-skeleton";
import { Favicon } from "@/components/favicon";
import { calculateSecurityScore, type SecurityBreakdown } from "@/lib/security-score";
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
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTimeEmoji(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return '☀️';
  if (h >= 12 && h < 17) return '🌤️';
  if (h >= 17 && h < 21) return '🌅';
  return '🌙';
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

const LEVEL_RING_COLOR: Record<SecurityBreakdown['level'], string> = {
  Critical: '#ef4444',
  'Needs Work': '#f59e0b',
  Good: '#22c55e',
  Excellent: '#10b981',
};

function SecurityRing({ breakdown, isEmpty = false }: { breakdown: SecurityBreakdown; isEmpty?: boolean }) {
  const [animScore, setAnimScore] = useState(0);
  const size = 96, sw = 8;
  const r = (size - sw) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (animScore / 100) * circ;
  const strokeColor = LEVEL_RING_COLOR[breakdown.level];

  useEffect(() => {
    const t = setTimeout(() => setAnimScore(breakdown.totalScore), 200);
    return () => clearTimeout(t);
  }, [breakdown.totalScore]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <defs>
        <linearGradient id="dash-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="1" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={sw} />
      {!isEmpty && (
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="url(#dash-ring-grad)"
          strokeWidth={sw}
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)' }}
        />
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
        fontSize={isEmpty ? '22' : '26'} fontWeight="800" fill="white">
        {isEmpty ? '—' : animScore}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
        fontSize="8" fontWeight="700" fill="rgba(255,255,255,0.7)" letterSpacing="0.08em">
        {isEmpty ? 'EMPTY' : breakdown.level.toUpperCase()}
      </text>
    </svg>
  );
}

function WidgetCard({
  title, viewAllHref, children, empty, emptyText = 'Nothing here yet',
  accentClass = 'bg-primary/10', iconEl,
}: {
  title: string;
  viewAllHref?: string;
  children?: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
  accentClass?: string;
  iconEl?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          {iconEl && (
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${accentClass}`}>
              {iconEl}
            </div>
          )}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {viewAllHref && (
          <Link href={viewAllHref}>
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              All <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        )}
      </div>
      <div className="px-3 py-3 flex-1">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-7 text-center">
            <Clock className="w-6 h-6 text-muted-foreground/25 mb-2" />
            <p className="text-xs text-muted-foreground">{emptyText}</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

function ExpenseBars({
  cats, fmt,
}: {
  cats: { cat: string; amount: number; pct: number; color: string }[];
  fmt: (n: number) => string;
}) {
  return (
    <div className="space-y-3">
      {cats.slice(0, 3).map(c => (
        <div key={c.cat}>
          <div className="flex justify-between items-center mb-1">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-foreground/80 truncate max-w-[140px]">{c.cat}</span>
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
}

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

  const breakdown = useMemo(
    () => calculateSecurityScore(passwords as any, masterPassword || ''),
    [passwords, masterPassword]
  );

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
      .slice(0, 4),
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

  const lastMonthExpenses = useMemo(() => {
    const now = new Date();
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === lastMonthYear && d.getMonth() === lastMonth;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  const expenseDeltaPct = lastMonthExpenses > 0
    ? Math.round(((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100)
    : null;

  const todayExpenses = useMemo(() =>
    expenses
      .filter(e => isToday(new Date(e.date)))
      .reduce((sum, e) => sum + (e.amount || 0), 0),
    [expenses]
  );

  const topExpenseCategories = useMemo(() => {
    const byCategory: Record<string, number> = {};
    expenses.forEach(e => {
      const cat = e.category || 'Other';
      byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
    });
    const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat, amount]) => ({
        cat, amount,
        pct: (amount / total) * 100,
        color: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other'],
      }));
  }, [expenses]);

  const recentActivity = useMemo(() => {
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
      .slice(0, 6);
  }, [passwords, notes, expenses, reminders, subscriptions, normalizedSearch]);

  const criticalAlerts = useMemo(() => {
    type Alert = { icon: React.ElementType; text: string; sub: string; variant: 'red' | 'amber'; href?: string };
    const alerts: Alert[] = [];
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

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4 pb-6" data-testid="dashboard-today">

      <motion.div variants={fadeUp}
        className="rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 dark:from-indigo-950 dark:via-indigo-900 dark:to-purple-950 shadow-xl shadow-indigo-500/20">
        <div className="relative p-5 sm:p-6">
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-28 h-28 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

          <div className="mb-5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-200/80 mb-1">
              <Sparkles className="w-3 h-3" />
              <span>Today · {format(new Date(), 'EEE, MMM d')}</span>
            </div>
            <h1 className="text-[22px] sm:text-2xl font-bold text-white leading-snug">
              {getGreeting()}{userName ? `, ${userName}` : ''} {getTimeEmoji()}
            </h1>
          </div>

          <div className="flex items-center gap-5 mb-5">
            <SecurityRing breakdown={breakdown} isEmpty={isEmpty} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-orange-300 flex-shrink-0" />
                <span className="text-sm text-indigo-100">
                  <span className="font-semibold">{todayReminders.length}</span> reminder{todayReminders.length === 1 ? '' : 's'} today
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-purple-300 flex-shrink-0" />
                <span className="text-sm text-indigo-100">
                  Subs: <span className="font-semibold">{fmtAmt(monthlySubSpend)}</span>/mo
                </span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
                <span className="text-sm text-indigo-100">
                  Spent today: <span className="font-semibold">{fmtAmt(todayExpenses)}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={handleRefresh} disabled={isRefreshing}
              data-testid="hero-refresh"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all disabled:opacity-50 active:scale-95">
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="h-auto py-2 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 border-0 text-white text-sm font-medium focus:ring-0 gap-1.5 w-auto shadow-none [&>svg]:text-white/60">
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
            <button onClick={() => setShowImportExport(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all active:scale-95">
              <Upload className="w-3.5 h-3.5" />
              Import/Export
            </button>
            <button onClick={() => setShowGenerator(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all active:scale-95">
              <Key className="w-3.5 h-3.5" />
              Generator
            </button>
          </div>
        </div>
      </motion.div>

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

      {!isEmpty && criticalAlerts.length > 0 && (
        <motion.div variants={fadeUp}
          data-testid="security-alerts-banner"
          className="rounded-2xl border border-red-500/20 bg-gradient-to-br from-red-500/5 via-orange-500/5 to-amber-500/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-500/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Security needs attention</h3>
                <p className="text-[11px] text-muted-foreground">
                  {criticalAlerts.length} action{criticalAlerts.length === 1 ? '' : 's'} could improve your score · {breakdown.totalScore}/100
                </p>
              </div>
            </div>
            <Link href="/profile?tab=security">
              <span className="hidden sm:flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 hover:underline cursor-pointer">
                Review <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
          <div className="divide-y divide-border/30">
            {criticalAlerts.map((a) => {
              const Icon = a.icon;
              const dotCls = a.variant === 'red'
                ? 'bg-red-500/15 text-red-500'
                : 'bg-amber-500/15 text-amber-500';
              const inner = (
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${dotCls}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{a.text}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{a.sub}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              );
              return a.href
                ? <Link key={a.text} href={a.href}>{inner}</Link>
                : <div key={a.text}>{inner}</div>;
            })}
          </div>
        </motion.div>
      )}

      {!isEmpty && criticalAlerts.length === 0 && (
        <motion.div variants={fadeUp}
          data-testid="security-all-clear"
          className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Security looking good</div>
            <div className="text-[11px] text-muted-foreground">No critical issues — score {breakdown.totalScore}/100.</div>
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <WidgetCard
          title="Today's Reminders"
          viewAllHref="/reminders"
          empty={todayReminders.length === 0}
          emptyText="Nothing due today — clear sky"
          accentClass="bg-orange-500/10"
          iconEl={<Bell className="w-3.5 h-3.5 text-orange-500" />}
        >
          <div className="space-y-0.5" data-testid="today-reminders">
            {todayReminders.slice(0, 5).map(r => (
              <Link key={r.id} href="/reminders">
                <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-1 ${PRIORITY_DOT[r.priority] ?? 'bg-muted'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.priority} priority</div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 bg-red-500/10 text-red-500">
                    Today
                  </span>
                </div>
              </Link>
            ))}
            {todayReminders.length > 5 && (
              <Link href="/reminders">
                <div className="text-xs text-muted-foreground hover:text-foreground text-center py-2 cursor-pointer">
                  +{todayReminders.length - 5} more today
                </div>
              </Link>
            )}
          </div>
        </WidgetCard>
      </motion.div>

      <motion.div variants={fadeUp}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Quick Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" data-testid="quick-actions">
          {([
            { label: 'Add Password', icon: Lock, href: '/passwords?action=add', bg: 'from-indigo-500 to-indigo-600' },
            { label: 'New Note', icon: FileText, href: '/notes?action=add', bg: 'from-amber-500 to-orange-500' },
            { label: 'Log Expense', icon: DollarSign, href: '/expenses?action=add', bg: 'from-emerald-500 to-green-600' },
            { label: 'Set Reminder', icon: Bell, href: '/reminders?action=add', bg: 'from-orange-500 to-red-500' },
            { label: 'Subscription', icon: CreditCard, href: '/subscriptions?action=add', bg: 'from-purple-500 to-fuchsia-500' },
            { label: 'Generator', icon: Key, bg: 'from-cyan-500 to-sky-500', onClick: () => setShowGenerator(true) },
          ] as Array<{ label: string; icon: React.ElementType; bg: string; href?: string; onClick?: () => void }>).map(({ label, icon: Icon, href, bg, onClick }) => {
            const inner = (
              <motion.div
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer h-full"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${bg} shadow-md`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
              </motion.div>
            );
            if (href) return <Link key={label} href={href}>{inner}</Link>;
            return <button key={label} onClick={onClick} className="text-left w-full">{inner}</button>;
          })}
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WidgetCard
          title={`${format(new Date(), 'MMMM')} Spending`}
          viewAllHref="/expenses"
          empty={topExpenseCategories.length === 0}
          emptyText="No expenses recorded yet"
          accentClass="bg-emerald-500/10"
          iconEl={<TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
        >
          <div className="mb-3" data-testid="financial-summary">
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {fmtAmt(thisMonthExpenses)}
              </div>
              {expenseDeltaPct !== null && (
                <span
                  className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                    expenseDeltaPct > 0
                      ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                      : expenseDeltaPct < 0
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {expenseDeltaPct > 0 ? '↑' : expenseDeltaPct < 0 ? '↓' : '·'} {Math.abs(expenseDeltaPct)}%
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px]">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Today: <span className="font-semibold text-foreground tabular-nums">{fmtAmt(todayExpenses)}</span>
              </span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Subs: <span className="font-semibold text-foreground tabular-nums">{fmtAmt(monthlySubSpend)}</span>/mo
              </span>
            </div>
          </div>
          <ExpenseBars cats={topExpenseCategories} fmt={fmtAmt} />
        </WidgetCard>

        <WidgetCard
          title="Upcoming Renewals"
          viewAllHref="/subscriptions"
          empty={upcomingRenewals.length === 0}
          emptyText="No renewals in the next 7 days"
          accentClass="bg-purple-500/10"
          iconEl={<Calendar className="w-3.5 h-3.5 text-purple-500" />}
        >
          <div className="space-y-0.5">
            {upcomingRenewals.map(s => {
              const daysLeft = s.nextBillingDate ? differenceInCalendarDays(new Date(s.nextBillingDate), new Date()) : 99;
              const urgent = daysLeft <= 3;
              return (
                <Link key={s.id} href="/subscriptions">
                  <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                    <Favicon url={s.platformLink} name={s.name} className="w-8 h-8 flex-shrink-0 rounded-lg" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{fmtAmt(s.cost || 0)}</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${urgent ? 'bg-red-500/10 text-red-500' : 'bg-muted text-muted-foreground'}`}>
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1d' : `${daysLeft}d`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </WidgetCard>
      </motion.div>

      <motion.div variants={fadeUp} className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        {[
          { icon: Lock, label: 'Passwords', value: stats.totalPasswords, href: '/passwords', accent: '#6366f1' },
          { icon: FileText, label: 'Notes', value: stats.totalNotes, href: '/notes', accent: '#f59e0b' },
          { icon: CreditCard, label: 'Subs', value: stats.activeSubscriptions, href: '/subscriptions', accent: '#a855f7' },
          { icon: DollarSign, label: 'Expenses', value: stats.totalExpenses, href: '/expenses', accent: '#22c55e' },
          { icon: Bell, label: 'Reminders', value: stats.totalReminders, href: '/reminders', accent: '#f97316' },
          { icon: Shield, label: 'Documents', value: stats.totalBankStatements, href: '/documents', accent: '#64748b' },
        ].map((s, i) => (
          <Link key={s.label} href={s.href}>
            <motion.div
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="rounded-2xl bg-card border border-border/50 p-3 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <s.icon className="w-3 h-3 flex-shrink-0" style={{ color: s.accent }} />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{s.label}</span>
              </div>
              <div className="text-lg font-bold tabular-nums text-foreground">
                <AnimatedNumber value={s.value} delay={0.04 * i} />
              </div>
            </motion.div>
          </Link>
        ))}
      </motion.div>

      {!isEmpty && breakdown.totalScore < 80 && breakdown.tips.length > 0 && (
        <motion.div variants={fadeUp}
          data-testid="security-tips"
          className="rounded-2xl border border-border/50 bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Security Tips</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400">
                {breakdown.level}
              </span>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{breakdown.totalScore}/100</span>
          </div>
          <div className="px-4 py-3 space-y-2">
            {breakdown.tips.slice(0, 3).map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{i + 1}</span>
                </div>
                <p className="text-sm text-foreground/85 leading-snug">{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <WidgetCard
          title="Recent Activity"
          viewAllHref="/logging"
          empty={recentActivity.length === 0}
          emptyText="No activity yet"
          accentClass="bg-blue-500/10"
          iconEl={<Activity className="w-3.5 h-3.5 text-blue-500" />}
        >
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            animate="show"
            className="relative pl-1"
            data-testid="recent-activity"
          >
            <span aria-hidden className="absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-border via-border to-transparent" />
            {recentActivity.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={`${item.action}-${item.id}`}
                  variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                >
                  <Link href={item.href}>
                    <div className="relative flex items-center gap-3 pl-1 py-2 rounded-xl hover:bg-muted/40 transition-colors cursor-pointer">
                      <div className={`w-7 h-7 rounded-full ${item.iconBg} ring-2 ring-background flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                        <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0 ml-1">
                        <div className="text-sm text-foreground truncate">{item.text}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full flex-shrink-0">
                        {item.action}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </WidgetCard>
      </motion.div>

      <PasswordGeneratorModal open={showGenerator} onOpenChange={setShowGenerator} />
      <ImportExportModal open={showImportExport} onOpenChange={setShowImportExport} />
    </motion.div>
  );
}
