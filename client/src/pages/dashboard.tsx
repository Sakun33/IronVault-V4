import { useVault } from "@/contexts/vault-context";
import { useCurrency } from "@/contexts/currency-context";
import { useLogging } from "@/contexts/logging-context";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock, Bookmark, FileText, DollarSign, Bell, Plus, AlertTriangle,
  CheckCircle, Clock, Globe, Copy, Upload, Shield, RefreshCw, Info,
  BarChart3, ArrowRight,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { Favicon } from "@/components/favicon";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ── Security score ring ───────────────────────────────────────────────────────
function SecurityRing({ score, totalPasswords, weakPasswords }: { score: number; totalPasswords: number; weakPasswords: number }) {
  const r = 30, cx = 38, cy = 38, sw = 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 90 ? '#22c55e' : score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 50 ? 'Fair' : 'Weak';
  const strongCount = totalPasswords - weakPasswords;
  return (
    <div className="flex items-center gap-3 w-full">
      <svg width="76" height="76" viewBox="0 0 76 76" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/20" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize="13" fontWeight="700" fill={color}>{score}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#64748b">/100</text>
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">Security score</p>
        {totalPasswords > 0 && (
          <div className="mt-1.5 space-y-0.5">
            <p className="text-[11px] text-green-500">Strong {strongCount}/{totalPasswords}</p>
            {weakPasswords > 0 && <p className="text-[11px] text-red-500">Weak {weakPasswords}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

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

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { passwords, subscriptions, expenses, reminders, stats, searchQuery, setSearchQuery, refreshData } = useVault();
  const { currency, setCurrency, formatCurrency, currencies } = useCurrency();
  const { getLogsForCurrentVault } = useLogging();
  const { toast } = useToast();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showImportExport, setShowImportExport] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCrossBrowserTip, setShowCrossBrowserTip] = useState(false);

  useEffect(() => {
    const hasSeenTip = localStorage.getItem('hasSeenCrossBrowserTip');
    const showExportReminder = localStorage.getItem('showExportReminder');
    if (!hasSeenTip || showExportReminder === 'true') {
      setShowCrossBrowserTip(true);
      localStorage.removeItem('showExportReminder');
    }
  }, []);

  const dismissCrossBrowserTip = () => {
    setShowCrossBrowserTip(false);
    localStorage.setItem('hasSeenCrossBrowserTip', 'true');
  };

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

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    try {
      const cp = JSON.parse(localStorage.getItem('customerProfile') || '{}');
      const first = (cp.name || '').split(' ')[0] || '';
      const emoji = h < 12 ? '☀️' : h < 17 ? '🌤️' : '🌙';
      const salute = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      return first ? `${salute}, ${first} ${emoji}` : `${salute} ${emoji}`;
    } catch {
      const emoji = h < 12 ? '☀️' : h < 17 ? '🌤️' : '🌙';
      return (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ' ' + emoji;
    }
  }, []);

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
        return days >= 0 && days <= 1;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()),
    [reminders]
  );

  const vaultLogs = getLogsForCurrentVault();

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

  const recentActivity = useMemo(() =>
    (vaultLogs || [])
      .filter((log: any) => log.category !== 'system')
      .filter((log: any) => {
        if (!normalizedSearch) return true;
        return (
          (log.description || '').toLowerCase().includes(normalizedSearch) ||
          (log.category || '').toLowerCase().includes(normalizedSearch)
        );
      })
      .slice(0, 5)
      .map((log: any) => ({
        ...log,
        icon: getActivityIcon(log.category),
        color: getActivityColor(log.category),
        bg: getActivityBg(log.category),
      })),
    [vaultLogs, normalizedSearch]
  );

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

        {/* Cross-Browser Tip */}
        {showCrossBrowserTip && (
          <Alert className="border-primary/30 bg-primary/5 relative">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-foreground">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <strong className="font-semibold">💡 Cross-Browser Access:</strong> Your vault is stored only in <strong>this browser</strong>.{' '}
                  To access your data in another browser, use the{' '}
                  <button
                    onClick={() => { setShowImportExport(true); dismissCrossBrowserTip(); }}
                    className="underline font-semibold hover:text-primary"
                  >
                    Import/Export button
                  </button>
                  {' '}to create a backup and import it there.
                </div>
                <button onClick={dismissCrossBrowserTip} className="text-primary hover:text-primary/80 font-bold">✕</button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting}</h1>
            <p className="text-sm text-muted-foreground">
              Your vault is secure · Last updated: {format(lastRefresh, 'HH:mm:ss')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleManualRefresh} disabled={isRefreshing} className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-full sm:w-32 rounded-xl">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {currency}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {currencies.map((curr) => (
                  <SelectItem key={curr.code} value={curr.code}>
                    <div className="flex items-center gap-2">
                      <span>{curr.symbol}</span>
                      <span>{curr.code}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowImportExport(true)} variant="outline" className="rounded-xl px-4 py-2 whitespace-nowrap">
              <Upload className="w-4 h-4 mr-2" />
              Import / Export
            </Button>
            <Button onClick={() => setShowGenerator(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-4 py-3 shadow-sm whitespace-nowrap">
              <Plus className="w-4 h-4 mr-2" />
              Password Generator
            </Button>
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
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center h-full">
              <SecurityRing score={securityScore} totalPasswords={stats.totalPasswords} weakPasswords={weakPasswords} />
            </CardContent>
          </Card>
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
            emptyText="No reminders due today or tomorrow"
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
                      variant={daysLeft === 0 ? 'destructive' : 'secondary'}
                      className="text-[11px] flex-shrink-0"
                    >
                      {daysLeft === 0 ? 'Today' : 'Tomorrow'}
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
