import { useVault } from "@/contexts/vault-context";
import { useCurrency } from "@/contexts/currency-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock, Bookmark, FileText, DollarSign, Bell, Plus, AlertTriangle,
  CheckCircle, Clock, Globe, Copy, Upload, Shield, RefreshCw,
  BarChart3, ChevronRight, CreditCard, Activity, Key, Calendar,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { Favicon } from "@/components/favicon";
import { motion } from "framer-motion";

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

// ── Helpers ───────────────────────────────────────────────────────────────────
function pwdStrength(pwd: string): 'weak' | 'fair' | 'strong' {
  if (!pwd || pwd.length < 8) return 'weak';
  const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pwd)).length;
  if (pwd.length < 12 || checks < 3) return 'fair';
  return 'strong';
}

function maskUsername(u: string): string {
  if (!u) return '•••';
  if (u.includes('@')) {
    const [local, domain] = u.split('@');
    return local.slice(0, 2) + '•••@' + domain;
  }
  return u.slice(0, 2) + '•••';
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
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

function getUserName(): string {
  try {
    const cp = JSON.parse(localStorage.getItem('customerProfile') || '{}');
    // Prefer full_name, then name, then display_name
    const fullName = (cp.full_name || cp.name || cp.display_name || '').trim();
    if (fullName && !fullName.includes('@')) return fullName.split(' ')[0];
    const session = localStorage.getItem('iv_account_session');
    if (session) {
      const { email, name } = JSON.parse(session);
      if (name && typeof name === 'string' && !name.includes('@')) return name.split(' ')[0];
      if (email) {
        // Capitalize and strip numbers from email prefix
        const prefix = (email as string).split('@')[0].replace(/[0-9]/g, '').replace(/[._-]/g, ' ').trim();
        if (prefix) return prefix.charAt(0).toUpperCase() + prefix.slice(1).split(' ')[0];
      }
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

// ── Animated security ring ────────────────────────────────────────────────────
function SecurityRing({ score }: { score: number }) {
  const [animScore, setAnimScore] = useState(0);
  const size = 84, sw = 7;
  const r = (size - sw) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = (animScore / 100) * circ;

  useEffect(() => {
    const t = setTimeout(() => setAnimScore(score), 200);
    return () => clearTimeout(t);
  }, [score]);

  const label = score >= 90 ? 'EXCELLENT' : score >= 75 ? 'STRONG' : score >= 50 ? 'FAIR' : 'WEAK';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="white" strokeWidth={sw}
        strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle"
        fontSize="22" fontWeight="800" fill="white">{animScore}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" dominantBaseline="middle"
        fontSize="7.5" fontWeight="700" fill="rgba(255,255,255,0.6)" letterSpacing="0.06em">{label}</text>
    </svg>
  );
}

// ── Widget card ───────────────────────────────────────────────────────────────
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

// ── Expense category bars ─────────────────────────────────────────────────────
function ExpenseBars({
  cats, fmt,
}: {
  cats: { cat: string; amount: number; pct: number; color: string }[];
  fmt: (n: number) => string;
}) {
  return (
    <div className="space-y-3.5">
      {cats.slice(0, 3).map(c => (
        <div key={c.cat}>
          <div className="flex justify-between items-center mb-1">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-foreground/80 truncate max-w-[110px]">{c.cat}</span>
            </span>
            <span className="text-xs font-medium text-muted-foreground">{fmt(c.amount)}</span>
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

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { passwords, subscriptions, expenses, reminders, notes, stats, searchQuery, refreshData } = useVault();
  const { currency, setCurrency, formatCurrency, currencies } = useCurrency();
  const { toast } = useToast();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => refreshData(), 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      toast({ title: 'Refreshed', description: 'Dashboard updated' });
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyPassword = async (password: string, id: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      toast({ title: 'Copied', description: 'Password copied to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const fmtAmt = (n: number) => formatCurrency(n, currency);
  const userName = getUserName();
  const normalizedSearch = searchQuery.trim().toLowerCase();

  // ── Derived stats ─────────────────────────────────────────────────────────
  const weakPasswordList = useMemo(() =>
    passwords.filter(p => pwdStrength(p.password || '') === 'weak'), [passwords]);
  const weakPasswords = weakPasswordList.length;
  const strongPasswords = passwords.length - weakPasswords;

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

  const dueTodayCount = useMemo(() =>
    reminders.filter(r => !r.isCompleted && r.dueDate &&
      differenceInCalendarDays(new Date(r.dueDate), new Date()) === 0).length,
    [reminders]);

  const securityScore = useMemo(() => {
    if (stats.totalPasswords === 0) return 0;
    let score = Math.min(50, stats.totalPasswords * 3);
    if (stats.activeSubscriptions > 0) score += 15;
    if (expenses.length > 0) score += 10;
    if (stats.totalNotes > 0) score += 10;
    if (reminders.length > 0) score += 5;
    score -= weakPasswords * 4;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [stats, expenses.length, weakPasswords, reminders.length]);

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

  const recentPasswords = useMemo(() =>
    [...passwords]
      .filter(p => !normalizedSearch || p.name.toLowerCase().includes(normalizedSearch) || p.username.toLowerCase().includes(normalizedSearch))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5),
    [passwords, normalizedSearch]);

  const upcomingRenewals = useMemo(() =>
    subscriptions
      .filter(s => s.isActive)
      .filter(s => !normalizedSearch || s.name.toLowerCase().includes(normalizedSearch))
      .filter(s => {
        if (!s.nextBillingDate) return false;
        const d = differenceInCalendarDays(new Date(s.nextBillingDate), new Date());
        return d >= 0 && d <= 30;
      })
      .sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime())
      .slice(0, 4),
    [subscriptions, normalizedSearch]);

  const dueSoonReminders = useMemo(() =>
    reminders
      .filter(r => !r.isCompleted && r.dueDate)
      .filter(r => {
        const d = differenceInCalendarDays(new Date(r.dueDate), new Date());
        return d >= 0 && d <= 7;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 4),
    [reminders]);

  const recentActivity = useMemo(() => {
    const items = [
      ...passwords.map(p => ({ id: p.id, text: p.name, action: 'Password', icon: Lock, iconColor: 'text-indigo-500', iconBg: 'bg-indigo-500/10', timestamp: new Date(p.updatedAt || p.createdAt) })),
      ...notes.map(n => ({ id: n.id, text: n.title, action: 'Note', icon: FileText, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10', timestamp: new Date(n.updatedAt || n.createdAt) })),
      ...expenses.map(e => ({ id: e.id, text: e.description || e.category || 'Expense', action: 'Expense', icon: DollarSign, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/10', timestamp: new Date((e as any).updatedAt || e.date || e.createdAt) })),
      ...reminders.map(r => ({ id: r.id, text: r.title, action: 'Reminder', icon: Bell, iconColor: 'text-orange-500', iconBg: 'bg-orange-500/10', timestamp: new Date(r.updatedAt || r.createdAt) })),
      ...subscriptions.map(s => ({ id: s.id, text: s.name, action: 'Subscription', icon: Bookmark, iconColor: 'text-purple-500', iconBg: 'bg-purple-500/10', timestamp: new Date(s.updatedAt || s.createdAt) })),
    ];
    return items
      .filter(item => !normalizedSearch || item.text.toLowerCase().includes(normalizedSearch))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 6);
  }, [passwords, notes, expenses, reminders, subscriptions, normalizedSearch]);

  // ── Insights ──────────────────────────────────────────────────────────────
  interface InsightItem { icon: React.ElementType; text: string; sub?: string; variant: 'red' | 'amber' | 'green'; href?: string; }
  const insights = useMemo((): InsightItem[] => {
    const items: InsightItem[] = [];
    if (weakPasswords > 0) items.push({ icon: AlertTriangle, text: `${weakPasswords} weak password${weakPasswords > 1 ? 's' : ''}`, sub: 'Tap to fix', variant: 'red', href: '/passwords' });
    const expiringCount = subscriptions.filter(s => s.isActive && s.nextBillingDate && differenceInCalendarDays(new Date(s.nextBillingDate), new Date()) <= 7).length;
    if (expiringCount > 0) items.push({ icon: Calendar, text: `${expiringCount} renewal${expiringCount > 1 ? 's' : ''} this week`, sub: 'Check billing', variant: 'amber', href: '/subscriptions' });
    if (dueTodayCount > 0) items.push({ icon: Bell, text: `${dueTodayCount} reminder${dueTodayCount > 1 ? 's' : ''} due today`, sub: "Don't miss them", variant: 'red', href: '/reminders' });
    if (items.length === 0) items.push({ icon: CheckCircle, text: 'All clear', sub: 'No action needed', variant: 'green' });
    return items;
  }, [weakPasswords, subscriptions, dueTodayCount]);

  const insightStyles: Record<string, string> = {
    red: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  };

  // ── Stat items ────────────────────────────────────────────────────────────
  const pinnedNotes = notes.filter(n => n.isPinned).length;
  const statItems = [
    { icon: Lock, label: 'Passwords', value: stats.totalPasswords, sub: weakPasswords > 0 ? `${weakPasswords} weak` : `${strongPasswords} strong`, subColor: weakPasswords > 0 ? '#ef4444' : '#22c55e', href: '/passwords', accent: '#6366f1' },
    { icon: FileText, label: 'Notes', value: stats.totalNotes, sub: pinnedNotes > 0 ? `${pinnedNotes} pinned` : undefined, subColor: '#f59e0b', href: '/notes', accent: '#f59e0b' },
    { icon: CreditCard, label: 'Subscriptions', value: stats.activeSubscriptions, sub: monthlySubSpend > 0 ? `${fmtAmt(monthlySubSpend)}/mo` : undefined, subColor: '#a855f7', href: '/subscriptions', accent: '#a855f7' },
    { icon: DollarSign, label: 'Expenses', value: stats.totalExpenses, sub: thisMonthExpenses > 0 ? `${fmtAmt(thisMonthExpenses)} this mo` : undefined, subColor: '#22c55e', href: '/expenses', accent: '#22c55e' },
    { icon: Bell, label: 'Reminders', value: stats.totalReminders, sub: dueTodayCount > 0 ? `${dueTodayCount} due today` : undefined, subColor: '#f97316', href: '/reminders', accent: '#f97316' },
    { icon: BarChart3, label: 'Documents', value: stats.totalBankStatements, sub: undefined, subColor: '#64748b', href: '/documents', accent: '#64748b' },
  ];

  const isEmpty = stats.totalPasswords === 0 && stats.activeSubscriptions === 0 && stats.totalNotes === 0;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4 pb-6">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}
        className="rounded-3xl overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 dark:from-indigo-950 dark:via-indigo-900 dark:to-purple-950 shadow-xl shadow-indigo-500/20">
        <div className="relative p-5 sm:p-6">
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/4 pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-28 h-28 rounded-full bg-white/5 translate-y-1/2 pointer-events-none" />

          <div className="mb-4">
            <h1 className="text-[22px] font-bold text-white leading-snug">
              {getGreeting()}{userName ? `, ${userName}` : ''} {getTimeEmoji()}
            </h1>
            <p className="text-sm text-indigo-200 mt-0.5">
              {format(new Date(), 'EEEE, MMMM d')} · Vault secure 🔒
            </p>
          </div>

          {/* Score + metrics row */}
          <div className="flex items-center gap-5 mb-5">
            <SecurityRing score={securityScore} />
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                <span className="text-sm text-indigo-100">
                  Strong: <span className="font-semibold">{strongPasswords}/{stats.totalPasswords}</span>
                </span>
              </div>
              {weakPasswords > 0 && (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <button onClick={() => setLocation('/passwords')} className="text-sm text-red-300 hover:text-red-100 underline underline-offset-2 text-left">
                    Weak: {weakPasswords} — fix now
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-300 flex-shrink-0" />
                <span className="text-sm text-indigo-100">Subs: {fmtAmt(monthlySubSpend)}/mo</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
                <span className="text-sm text-indigo-100">Spent: {fmtAmt(thisMonthExpenses)} this month</span>
              </div>
            </div>
          </div>

          {/* Action pills */}
          <div className="flex flex-wrap gap-2">
            <button onClick={handleRefresh} disabled={isRefreshing}
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
                  <SelectItem key={curr.code} value={curr.code}>{curr.symbol} {curr.code}</SelectItem>
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

      {/* ── Onboarding ────────────────────────────────────────────────────── */}
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

      {/* ── Insights bar ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-2.5">
        {insights.map(insight => {
          const Icon = insight.icon;
          const cls = insightStyles[insight.variant];
          const card = (
            <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border cursor-pointer select-none transition-all hover:scale-[1.02] active:scale-[0.98] flex-shrink-0 ${cls}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <div>
                <div className="text-xs font-semibold">{insight.text}</div>
                {insight.sub && <div className="text-[11px] opacity-70">{insight.sub}</div>}
              </div>
            </div>
          );
          return insight.href
            ? <Link key={insight.text} href={insight.href}>{card}</Link>
            : <div key={insight.text}>{card}</div>;
        })}
      </motion.div>

      {/* ── Stats grid ────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {statItems.map(s => (
          <Link key={s.label} href={s.href}>
            <div className="rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer overflow-hidden">
              <div className="h-1 w-full" style={{ background: s.accent }} />
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${s.accent}18` }}>
                    <s.icon className="w-3.5 h-3.5" style={{ color: s.accent }} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                    {s.label}
                  </span>
                </div>
                <div className="text-2xl font-bold tabular-nums text-foreground">{s.value}</div>
                {s.sub && (
                  <div className="text-[11px] mt-0.5 font-medium" style={{ color: s.subColor }}>{s.sub}</div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </motion.div>

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Quick Actions</p>
        <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2.5" style={{ minWidth: 'max-content' }}>
            {([
              { label: 'Add Password', icon: Lock, href: '/passwords?action=add', bg: 'bg-indigo-500' },
              { label: 'New Note', icon: FileText, href: '/notes?action=add', bg: 'bg-amber-500' },
              { label: 'Log Expense', icon: DollarSign, href: '/expenses?action=add', bg: 'bg-emerald-500' },
              { label: 'Set Reminder', icon: Bell, href: '/reminders?action=add', bg: 'bg-orange-500' },
              { label: 'Subscription', icon: Bookmark, href: '/subscriptions?action=add', bg: 'bg-purple-500' },
              { label: 'Import', icon: Upload, bg: 'bg-slate-500', onClick: () => setShowImportExport(true) },
              { label: 'Generator', icon: Key, bg: 'bg-cyan-500', onClick: () => setShowGenerator(true) },
            ] as Array<{ label: string; icon: React.ElementType; bg: string; href?: string; onClick?: () => void }>).map(({ label, icon: Icon, href, bg, onClick }) => {
              const inner = (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                    <Icon className="w-[15px] h-[15px] text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground whitespace-nowrap">{label}</span>
                </div>
              );
              if (href) return <Link key={label} href={href}>{inner}</Link>;
              return <button key={label} onClick={onClick}>{inner}</button>;
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Weak password alert ────────────────────────────────────────────── */}
      {weakPasswords > 0 && (
        <motion.div variants={fadeUp}
          className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-600 dark:text-red-400">
              {weakPasswords} weak {weakPasswords === 1 ? 'password' : 'passwords'} detected
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">
              These are too short or lack complexity.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {weakPasswordList.slice(0, 6).map(p => (
                <Link key={p.id} href="/passwords">
                  <span className="inline-flex items-center gap-1 text-xs bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full hover:bg-red-500/20 transition-colors cursor-pointer border border-red-500/20">
                    {p.url ? <Favicon url={p.url} name={p.name} size={11} /> : <Lock className="w-2.5 h-2.5" />}
                    {p.name}
                  </span>
                </Link>
              ))}
              {weakPasswords > 6 && (
                <span className="text-xs text-muted-foreground px-2 py-0.5">+{weakPasswords - 6} more</span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Renewals + Reminders ───────────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WidgetCard title="Upcoming Renewals" viewAllHref="/subscriptions"
          empty={upcomingRenewals.length === 0} emptyText="No renewals due soon"
          accentClass="bg-purple-500/10" iconEl={<CreditCard className="w-3.5 h-3.5 text-purple-500" />}>
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

        <WidgetCard title="Due Soon" viewAllHref="/reminders"
          empty={dueSoonReminders.length === 0} emptyText="No reminders in the next 7 days"
          accentClass="bg-orange-500/10" iconEl={<Bell className="w-3.5 h-3.5 text-orange-500" />}>
          <div className="space-y-0.5">
            {dueSoonReminders.map(r => {
              const daysLeft = differenceInCalendarDays(new Date(r.dueDate), new Date());
              return (
                <Link key={r.id} href="/reminders">
                  <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ml-1 ${PRIORITY_DOT[r.priority] ?? 'bg-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                      <div className="text-xs text-muted-foreground capitalize">{r.priority} priority</div>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${daysLeft === 0 ? 'bg-red-500/10 text-red-500' : daysLeft <= 2 ? 'bg-orange-500/10 text-orange-500' : 'bg-muted text-muted-foreground'}`}>
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </WidgetCard>
      </motion.div>

      {/* ── Recent Passwords ───────────────────────────────────────────────── */}
      <motion.div variants={fadeUp}>
        <WidgetCard title="Recently Used" viewAllHref="/passwords"
          empty={recentPasswords.length === 0} emptyText="No passwords saved yet"
          accentClass="bg-indigo-500/10" iconEl={<Lock className="w-3.5 h-3.5 text-indigo-500" />}>
          <div className="space-y-0.5">
            {recentPasswords.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors group">
                <Favicon url={p.url} name={p.name} className="w-8 h-8 flex-shrink-0 rounded-lg" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{maskUsername(p.username)}</div>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <button onClick={() => copyPassword(p.password, p.id)}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-muted transition-all">
                    {copiedId === p.id
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <span className="text-[10px] text-muted-foreground/50">
                    {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </WidgetCard>
      </motion.div>

      {/* ── Expense snapshot + Activity ────────────────────────────────────── */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <WidgetCard title={`${format(new Date(), 'MMMM')} Spending`} viewAllHref="/expenses"
          empty={topExpenseCategories.length === 0} emptyText="No expenses recorded yet"
          accentClass="bg-emerald-500/10" iconEl={<DollarSign className="w-3.5 h-3.5 text-emerald-500" />}>
          <div className="mb-4">
            <div className="text-2xl font-bold tabular-nums text-foreground">{fmtAmt(thisMonthExpenses)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">total spent this month</div>
          </div>
          <ExpenseBars cats={topExpenseCategories} fmt={fmtAmt} />
        </WidgetCard>

        <WidgetCard title="Recent Activity" viewAllHref="/logging"
          empty={recentActivity.length === 0} emptyText="No activity yet"
          accentClass="bg-blue-500/10" iconEl={<Activity className="w-3.5 h-3.5 text-blue-500" />}>
          <div className="space-y-0.5">
            {recentActivity.map(item => {
              const Icon = item.icon;
              return (
                <div key={`${item.action}-${item.id}`}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-muted/50 transition-colors">
                  <div className={`w-7 h-7 rounded-full ${item.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${item.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{item.text}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/60 bg-muted/50 px-2 py-0.5 rounded-full flex-shrink-0">
                    {item.action}
                  </span>
                </div>
              );
            })}
          </div>
        </WidgetCard>
      </motion.div>

      <PasswordGeneratorModal open={showGenerator} onOpenChange={setShowGenerator} />
      <ImportExportModal open={showImportExport} onOpenChange={setShowImportExport} />
    </motion.div>
  );
}
