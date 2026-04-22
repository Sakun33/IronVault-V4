import { useVault } from "@/contexts/vault-context";
import { useCurrency } from "@/contexts/currency-context";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock, Bookmark, FileText, DollarSign, Bell, Plus, AlertTriangle,
  CheckCircle, Clock, Globe, Copy, Upload, Shield, RefreshCw,
  BarChart3, ArrowRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { Favicon } from "@/components/favicon";

// ── Expense horizontal bar chart ──────────────────────────────────────────────
function ExpenseBarChart({
  categories,
  formatAmount,
}: {
  categories: { cat: string; amount: number; pct: number; color: string }[];
  formatAmount: (n: number) => string;
}) {
  const top3 = categories.slice(0, 3);
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  return (
    <div className="space-y-4">
      {top3.map(c => (
        <div key={c.cat}>
          <div className="flex justify-between items-center mb-1.5">
            <span className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-foreground truncate max-w-[130px]">{c.cat}</span>
            </span>
            <span className="text-xs text-muted-foreground font-medium">{formatAmount(c.amount)}</span>
          </div>
          <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(c.pct, 100)}%`, background: c.color }}
            />
          </div>
        </div>
      ))}
      {total > 0 && (
        <div className="flex justify-between text-xs font-semibold pt-2 border-t border-border/40 mt-1">
          <span className="text-muted-foreground">Total</span>
          <span className="text-foreground">{formatAmount(total)}</span>
        </div>
      )}
    </div>
  );
}

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

// ── Glass widget card ─────────────────────────────────────────────────────────
function WidgetCard({
  title,
  viewAllHref,
  children,
  empty,
  emptyText = 'Nothing here yet',
}: {
  title: string;
  viewAllHref?: string;
  children?: React.ReactNode;
  empty?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {viewAllHref && (
          <Link href={viewAllHref}>
            <span className="text-xs text-primary hover:text-primary/70 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        )}
      </div>
      <div className="px-5 pb-5 flex-1">
        {empty ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Clock className="w-8 h-8 text-muted-foreground/40 mb-2" />
            <p className="text-xs text-muted-foreground">{emptyText}</p>
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ── Greeting helpers ──────────────────────────────────────────────────────────
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
    const name = (cp.name || '').trim();
    if (name && !name.includes('@')) return name.split(' ')[0];
    // Fall back to email prefix from account session
    const session = localStorage.getItem('iv_account_session');
    if (session) {
      const { email } = JSON.parse(session);
      if (email) return (email as string).split('@')[0];
    }
  } catch {}
  return '';
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { passwords, subscriptions, expenses, reminders, notes, stats, searchQuery, setSearchQuery, refreshData } = useVault();
  const { currency, setCurrency, formatCurrency, currencies } = useCurrency();
  const { toast } = useToast();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshData();
      setLastRefresh(new Date());
    }, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      setLastRefresh(new Date());
      toast({ title: "Refreshed", description: "Dashboard data updated successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to refresh dashboard", variant: "destructive" });
    } finally {
      setIsRefreshing(false);
    }
  };

  const copyPassword = async (password: string, id: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      toast({ title: "Copied", description: "Password copied to clipboard" });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy password", variant: "destructive" });
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  // ── Derived data ─────────────────────────────────────────────────────────────

  const weakPasswordList = useMemo(() =>
    passwords.filter(p => pwdStrength(p.password || '') === 'weak'),
    [passwords]
  );
  const weakPasswords = weakPasswordList.length;

  const monthlySpend = useMemo(() =>
    subscriptions.filter(s => s.isActive).reduce((t, s) => t + (s.cost || 0), 0),
    [subscriptions]
  );

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
    reminders.filter(r =>
      !r.isCompleted && r.dueDate &&
      differenceInCalendarDays(new Date(r.dueDate), new Date()) === 0
    ).length,
    [reminders]
  );

  const userName = getUserName();

  const securityScore = useMemo(() => {
    if (stats.totalPasswords === 0) return 0;
    let score = Math.min(50, stats.totalPasswords * 5);
    if (stats.activeSubscriptions > 0) score += 20;
    if (expenses.length > 0) score += 15;
    if (stats.totalNotes > 0) score += 15;
    score -= weakPasswords * 5;
    return Math.max(0, Math.min(100, score));
  }, [stats.totalPasswords, stats.activeSubscriptions, expenses.length, stats.totalNotes, weakPasswords]);

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
      .filter(p => {
        if (!normalizedSearch) return true;
        return (
          p.name.toLowerCase().includes(normalizedSearch) ||
          p.username.toLowerCase().includes(normalizedSearch) ||
          (p.url || '').toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5),
    [passwords, normalizedSearch]
  );

  const upcomingRenewals = useMemo(() =>
    subscriptions
      .filter(s => s.isActive)
      .filter(s => {
        if (!normalizedSearch) return true;
        return (
          s.name.toLowerCase().includes(normalizedSearch) ||
          (s.plan || '').toLowerCase().includes(normalizedSearch)
        );
      })
      .filter(s => {
        const today = new Date();
        const reminderDate = addDays(today, s.reminderDays || 7);
        return s.nextBillingDate <= reminderDate;
      })
      .sort((a, b) => (a.nextBillingDate?.getTime?.() ?? 0) - (b.nextBillingDate?.getTime?.() ?? 0))
      .slice(0, 3),
    [subscriptions, normalizedSearch]
  );

  const dueSoonReminders = useMemo(() =>
    reminders
      .filter(r => !r.isCompleted && r.dueDate)
      .filter(r => {
        const days = differenceInCalendarDays(new Date(r.dueDate), new Date());
        return days >= 0 && days <= 6;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [reminders]
  );

  const getActivityIcon = (category: string) => {
    switch (category) {
      case 'password': return Lock;
      case 'subscription': return Bookmark;
      case 'note': return FileText;
      case 'expense': return DollarSign;
      case 'reminder': return Bell;
      case 'system': return BarChart3;
      case 'security': return Shield;
      default: return Clock;
    }
  };

  const getActivityColor = (category: string) => {
    switch (category) {
      case 'password': return 'text-primary';
      case 'subscription': return 'text-primary';
      case 'security': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getActivityBg = (category: string) => {
    switch (category) {
      case 'password': return 'bg-primary/10';
      case 'subscription': return 'bg-primary/10';
      case 'security': return 'bg-destructive/10';
      default: return 'bg-muted/50';
    }
  };

  const recentActivity = useMemo(() => {
    const merged = [
      ...passwords.map(p => ({
        id: p.id,
        description: `Password for ${p.name}`,
        category: 'password' as const,
        timestamp: new Date(p.updatedAt || p.createdAt),
      })),
      ...subscriptions.map(s => ({
        id: s.id,
        description: `Subscription: ${s.name}`,
        category: 'subscription' as const,
        timestamp: new Date(s.updatedAt || s.createdAt),
      })),
      ...expenses.map(e => ({
        id: e.id,
        description: e.description || e.category || 'Expense',
        category: 'expense' as const,
        timestamp: new Date((e as any).updatedAt || e.date || e.createdAt),
      })),
      ...reminders.map(r => ({
        id: r.id,
        description: r.title,
        category: 'reminder' as const,
        timestamp: new Date(r.updatedAt || r.createdAt),
      })),
      ...notes.map(n => ({
        id: n.id,
        description: n.title,
        category: 'note' as const,
        timestamp: new Date(n.updatedAt || n.createdAt),
      })),
    ];
    return merged
      .filter(item => {
        if (!normalizedSearch) return true;
        return (
          item.description.toLowerCase().includes(normalizedSearch) ||
          item.category.toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5)
      .map(item => ({
        ...item,
        icon: getActivityIcon(item.category),
        color: getActivityColor(item.category),
        bg: getActivityBg(item.category),
      }));
  }, [passwords, subscriptions, expenses, reminders, notes, normalizedSearch]);

  const fmtAmt = (n: number) => formatCurrency(n, currency);

  const quickActions = [
    { label: 'Add Password', icon: Lock, href: '/passwords?action=add', gradient: 'from-primary/20 to-primary/5' },
    { label: 'New Note', icon: FileText, href: '/notes?action=add', gradient: 'from-blue-500/20 to-blue-500/5' },
    { label: 'Log Expense', icon: DollarSign, href: '/expenses?action=add', gradient: 'from-green-500/20 to-green-500/5' },
    { label: 'Set Reminder', icon: Bell, href: '/reminders?action=add', gradient: 'from-orange-500/20 to-orange-500/5' },
  ];

  return (
    <div>
      <div className="space-y-6">


        {/* Greeting Card — white in light mode, gradient in dark */}
        <div className="relative overflow-hidden rounded-2xl p-6
          bg-white dark:bg-gradient-to-br dark:from-indigo-600/20 dark:via-purple-600/10 dark:to-blue-600/20
          border border-slate-200 dark:border-white/10
          shadow-sm dark:shadow-none">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 dark:animate-pulse pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {getGreeting()}{userName ? `, ${userName}` : ''} {getTimeEmoji()}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {format(new Date(), 'EEEE, MMMM d, yyyy')} · Your vault is secure 🔒
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition disabled:opacity-50
                  bg-slate-100 hover:bg-slate-200 text-slate-700
                  dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/80"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-auto py-1.5 px-3 rounded-full border-0 text-sm gap-1.5 w-auto shadow-none focus:ring-0
                  bg-slate-100 hover:bg-slate-200 text-slate-700
                  dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/80">
                  <Globe className="w-3.5 h-3.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => setShowImportExport(true)}
                className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition
                  bg-slate-100 hover:bg-slate-200 text-slate-700
                  dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/80"
              >
                <Upload className="w-3.5 h-3.5" />
                Import / Export
              </button>
              <button
                onClick={() => setShowGenerator(true)}
                className="px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 transition
                  bg-slate-100 hover:bg-slate-200 text-slate-700
                  dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/80"
              >
                <Plus className="w-3.5 h-3.5" />
                Generator
              </button>
            </div>
          </div>
        </div>

        {/* Security Score — own centered card */}
        <div className="rounded-2xl p-5 text-center
          bg-white dark:bg-white/5
          border border-slate-200 dark:border-white/10
          shadow-sm dark:shadow-none">
          <div className="flex flex-col items-center gap-1">
            <svg width="96" height="96" viewBox="0 0 76 76" className="mb-1">
              {(() => {
                const r = 30, cx = 38, cy = 38, sw = 8;
                const circ = 2 * Math.PI * r;
                const dash = (securityScore / 100) * circ;
                const color = securityScore >= 90 ? '#22c55e' : securityScore >= 75 ? '#22c55e' : securityScore >= 50 ? '#f59e0b' : '#ef4444';
                return (
                  <>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-slate-200 dark:text-muted/20" />
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
                      strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
                      strokeLinecap="round"
                      transform={`rotate(-90 ${cx} ${cy})`}
                    />
                    <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={color}>{securityScore}</text>
                    <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#64748b">/100</text>
                  </>
                );
              })()}
            </svg>
            <p className={`text-lg font-bold ${securityScore >= 90 ? 'text-emerald-500' : securityScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {securityScore >= 90 ? 'Excellent' : securityScore >= 75 ? 'Strong' : securityScore >= 50 ? 'Fair' : 'Weak'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Security Score</p>
            {stats.totalPasswords > 0 && (
              <div className="flex justify-center gap-6 mt-2 text-sm">
                <span className="text-slate-600 dark:text-slate-300">
                  Strong <span className="text-emerald-500 font-semibold">{stats.totalPasswords - weakPasswords}/{stats.totalPasswords}</span>
                </span>
                {weakPasswords > 0 && (
                  <span className="text-slate-600 dark:text-slate-300">
                    Weak <span className="text-red-500 font-semibold">{weakPasswords}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Onboarding CTA */}
        {stats.totalPasswords === 0 && stats.activeSubscriptions === 0 && stats.totalNotes === 0 && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col md:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-semibold text-foreground mb-1">Welcome to IronVault!</h3>
              <p className="text-sm text-muted-foreground">Your vault is ready. Start by adding a password, tracking a subscription, or creating a note.</p>
            </div>
            <Link href="/passwords">
              <Button size="sm" className="rounded-xl shrink-0">
                <Plus className="w-4 h-4 mr-1" />
                Add Password
              </Button>
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard
            icon={Lock}
            label="Passwords"
            value={stats.totalPasswords}
            color="text-primary"
            subtitle={weakPasswords > 0 ? `${weakPasswords} weak` : undefined}
          />
          <StatCard
            icon={Bookmark}
            label="Subscriptions"
            value={stats.activeSubscriptions}
            color="text-primary"
            subtitle={monthlySpend > 0 ? `${fmtAmt(monthlySpend)}/mo` : undefined}
            subtitleColor="text-muted-foreground"
          />
          <StatCard
            icon={FileText}
            label="Notes"
            value={stats.totalNotes}
            color="text-foreground"
          />
          <StatCard
            icon={DollarSign}
            label="Expenses"
            value={stats.totalExpenses}
            color="text-foreground"
            subtitle={thisMonthExpenses > 0 ? `${fmtAmt(thisMonthExpenses)} this mo.` : undefined}
            subtitleColor="text-muted-foreground"
          />
          <StatCard
            icon={Bell}
            label="Reminders"
            value={stats.totalReminders}
            color="text-foreground"
            subtitle={dueTodayCount > 0 ? `${dueTodayCount} due today` : undefined}
            subtitleColor="text-destructive"
          />
          <StatCard
            icon={BarChart3}
            label="Documents"
            value={stats.totalBankStatements}
            color="text-foreground"
          />
        </div>

        {/* Weak password alert */}
        {weakPasswords > 0 && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-destructive">
                {weakPasswords} weak {weakPasswords === 1 ? 'password' : 'passwords'} detected
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                These passwords are shorter than 8 characters or missing complexity.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {weakPasswordList.slice(0, 6).map(p => (
                  <Link key={p.id} href="/passwords">
                    <span className="inline-flex items-center gap-1 text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full hover:bg-destructive/20 transition-colors cursor-pointer">
                      {p.url ? <Favicon url={p.url} name={p.name} size={12} /> : <Lock className="w-3 h-3" />}
                      {p.name}
                    </span>
                  </Link>
                ))}
                {weakPasswords > 6 && (
                  <span className="text-xs text-muted-foreground px-2 py-0.5">+{weakPasswords - 6} more</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map(({ label, icon: Icon, href, gradient }) => (
              <Link key={label} href={href}>
                <div className={`rounded-2xl border border-border/60 bg-gradient-to-br ${gradient} backdrop-blur-sm p-4 flex flex-col items-center gap-2.5 cursor-pointer hover:scale-[1.02] hover:shadow-md transition-all duration-200`}>
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground text-center leading-tight">{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Three-column widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Upcoming Renewals */}
          <WidgetCard
            title="Upcoming Renewals"
            viewAllHref="/subscriptions"
            empty={upcomingRenewals.length === 0}
            emptyText="No renewals due soon"
          >
            <div className="space-y-3">
              {upcomingRenewals.map(s => {
                const daysLeft = differenceInCalendarDays(s.nextBillingDate, new Date());
                return (
                  <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                    <Favicon url={s.platformLink} name={s.name} className="w-8 h-8 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{fmtAmt(s.cost || 0)}</p>
                    </div>
                    <Badge variant={daysLeft <= 3 ? 'destructive' : 'secondary'} className="text-[11px] flex-shrink-0">
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1d' : `${daysLeft}d`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </WidgetCard>

          {/* Recent Passwords */}
          <WidgetCard
            title="Recent Passwords"
            viewAllHref="/passwords"
            empty={recentPasswords.length === 0}
            emptyText="No passwords saved yet"
          >
            <div className="space-y-2">
              {recentPasswords.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors group">
                  <Favicon url={p.url} name={p.name} className="w-8 h-8 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{maskUsername(p.username)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyPassword(p.password, p.id)}
                      className="p-1.5 h-auto opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedId === p.id ? (
                        <CheckCircle className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </WidgetCard>

          {/* Due Soon */}
          <WidgetCard
            title="Due Soon"
            viewAllHref="/reminders"
            empty={dueSoonReminders.length === 0}
            emptyText="No reminders due in the next 7 days"
          >
            <div className="space-y-3">
              {dueSoonReminders.map(r => {
                const daysLeft = differenceInCalendarDays(new Date(r.dueDate), new Date());
                return (
                  <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[r.priority] ?? 'bg-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{r.priority} priority</p>
                    </div>
                    <Badge
                      variant={daysLeft === 0 ? 'destructive' : daysLeft === 1 ? 'secondary' : 'outline'}
                      className="text-[11px] flex-shrink-0"
                    >
                      {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </WidgetCard>
        </div>

        {/* Two-column bottom widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Expense Summary */}
          <WidgetCard
            title="Expense Summary"
            viewAllHref="/expenses"
            empty={topExpenseCategories.length === 0}
            emptyText="No expenses recorded yet"
          >
            <ExpenseBarChart categories={topExpenseCategories} formatAmount={fmtAmt} />
          </WidgetCard>

          {/* Recent Activity */}
          <WidgetCard
            title="Recent Activity"
            viewAllHref="/logging"
            empty={recentActivity.length === 0}
            emptyText="No activity recorded yet"
          >
            <div className="space-y-2">
              {recentActivity.map((log: any, index: number) => {
                const IconComponent = log.icon;
                return (
                  <div key={log.id || index} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors">
                    <div className={`w-8 h-8 rounded-full ${log.bg} flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className={`w-3.5 h-3.5 ${log.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{log.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] capitalize flex-shrink-0">
                      {log.category}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </WidgetCard>
        </div>

      </div>

      <PasswordGeneratorModal open={showGenerator} onOpenChange={setShowGenerator} />
      <ImportExportModal open={showImportExport} onOpenChange={setShowImportExport} />
    </div>
  );
}
