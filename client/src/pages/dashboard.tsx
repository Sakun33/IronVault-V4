import { useVault } from "@/contexts/vault-context";
import { useCurrency } from "@/contexts/currency-context";
import { useLogging } from "@/contexts/logging-context";
import { StatCard, SectionCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Lock,
  Bookmark,
  FileText,
  DollarSign,
  Bell,
  Plus,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  Clock,
  Globe,
  Copy,
  Upload,
  Shield,
  RefreshCw,
  Info,
  BarChart3,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, differenceInCalendarDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { PasswordGeneratorModal } from "@/components/password-generator-modal";
import { ImportExportModal } from "@/components/import-export-modal";
import { Favicon } from "@/components/favicon";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ── Security score ring ───────────────────────────────────────────────────────
function SecurityRing({ score }: { score: number }) {
  const r = 30, cx = 38, cy = 38, sw = 8;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'Strong' : score >= 50 ? 'Fair' : 'Weak';
  return (
    <div className="flex items-center gap-3">
      <svg width="76" height="76" viewBox="0 0 76 76" className="flex-shrink-0">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/20" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="700" fill={color}>{score}</text>
      </svg>
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">Security score</p>
      </div>
    </div>
  );
}

// ── Expense mini donut ────────────────────────────────────────────────────────
function polarToXY(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function MiniDonut({ segments }: { segments: { pct: number; color: string }[] }) {
  const cx = 44, cy = 44, r = 34, sw = 14;
  let angle = 0;
  const arcs = segments.map((seg) => {
    const start = angle;
    const sweep = Math.min(seg.pct, 99.9) * 3.6;
    angle += sweep;
    const s = polarToXY(cx, cy, r, start);
    const e = polarToXY(cx, cy, r, angle);
    const large = sweep > 180 ? 1 : 0;
    return { ...seg, d: `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}` };
  });
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={sw} className="text-muted/20" />
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill="none" stroke={arc.color} strokeWidth={sw} strokeLinecap="butt" />
      ))}
    </svg>
  );
}

function pwdStrength(pwd: string): 'weak' | 'fair' | 'strong' {
  if (!pwd || pwd.length < 8) return 'weak';
  const checks = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pwd)).length;
  if (pwd.length < 12 || checks < 3) return 'fair';
  return 'strong';
}

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

  // Check if we should show the cross-browser tip (first time user or after vault creation)
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

  // Auto-refresh every 15 seconds
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
      toast({
        title: "Refreshed",
        description: "Dashboard data updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to refresh dashboard",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();

  // Get recent passwords (last 5), filtered by global search query when present
  const recentPasswords = [...passwords]
    .filter((p) => {
      if (!normalizedSearch) return true;
      return (
        p.name.toLowerCase().includes(normalizedSearch) ||
        p.username.toLowerCase().includes(normalizedSearch) ||
        (p.url || '').toLowerCase().includes(normalizedSearch)
      );
    })
    .sort((a, b) => new Date(b.lastUsed || b.updatedAt).getTime() - new Date(a.lastUsed || a.updatedAt).getTime())
    .slice(0, 5);

  // Get upcoming subscription renewals
  const upcomingRenewals = subscriptions
    .filter(s => s.isActive)
    .filter((s) => {
      if (!normalizedSearch) return true;
      return (
        s.name.toLowerCase().includes(normalizedSearch) ||
        (s.plan || '').toLowerCase().includes(normalizedSearch) ||
        (s.category || '').toLowerCase().includes(normalizedSearch)
      );
    })
    .filter(s => {
      const today = new Date();
      const reminderDate = addDays(today, s.reminderDays);
      return s.nextBillingDate <= reminderDate;
    })
    .sort((a, b) => a.nextBillingDate.getTime() - b.nextBillingDate.getTime())
    .slice(0, 5);

  // Helper functions for activity display
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
      case 'note': return 'text-foreground';
      case 'expense': return 'text-foreground';
      case 'reminder': return 'text-foreground';
      case 'system': return 'text-muted-foreground';
      case 'security': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  // Get recent activity from logs filtered by current vault
  const vaultLogs = getLogsForCurrentVault();
  const recentActivity = (vaultLogs || [])
    .filter((log: any) => {
      if (!normalizedSearch) return true;
      return (
        (log.description || '').toLowerCase().includes(normalizedSearch) ||
        (log.category || '').toLowerCase().includes(normalizedSearch)
      );
    })
    .slice(-10)
    .reverse()
    .map((log: any) => ({
      ...log,
      icon: getActivityIcon(log.category),
      color: getActivityColor(log.category)
    }));

  const getActivityBgColor = (category: string) => {
    switch (category) {
      case 'password': return 'bg-primary/10';
      case 'subscription': return 'bg-primary/10';
      case 'note': return 'bg-accent';
      case 'expense': return 'bg-accent';
      case 'reminder': return 'bg-accent';
      case 'system': return 'bg-muted';
      case 'security': return 'bg-destructive/10';
      default: return 'bg-muted';
    }
  };

  const copyPassword = async (password: string, id: string) => {
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(id);
      toast({
        title: "Copied",
        description: "Password copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy password",
        variant: "destructive",
      });
    }
  };

  // Calculate monthly spend
  const monthlySpend = subscriptions
    .filter(s => s.isActive)
    .reduce((total, s) => total + (s.cost || 0), 0);

  const weakPasswordList = useMemo(() =>
    passwords.filter(p => pwdStrength(p.password || '') === 'weak'),
    [passwords]
  );
  const weakPasswords = weakPasswordList.length;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    try {
      const cp = JSON.parse(localStorage.getItem('customerProfile') || '{}');
      const first = (cp.name || '').split(' ')[0] || '';
      const salute = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      return first ? `${salute}, ${first}` : salute;
    } catch { return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
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
        cat,
        amount,
        pct: (amount / total) * 100,
        color: CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Other'],
      }));
  }, [expenses]);

  const dueReminders = useMemo(() => {
    const now = new Date();
    const in7 = addDays(now, 7);
    return reminders
      .filter(r => !r.isCompleted && r.dueDate)
      .filter(r => isAfter(r.dueDate, startOfDay(now)) && isBefore(r.dueDate, endOfDay(in7)))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5);
  }, [reminders]);

  return (
    <div>
      <div className="space-y-6">
        {/* Cross-Browser Access Tip */}
        {showCrossBrowserTip && (
          <Alert className="border-primary/30 bg-primary/5 relative">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-sm text-foreground">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <strong className="font-semibold">💡 Cross-Browser Access:</strong> Your vault is stored only in <strong>this browser</strong>. 
                  To access your data in another browser (Chrome, Firefox, Safari, etc.), use the{' '}
                  <button 
                    onClick={() => {
                      setShowImportExport(true);
                      dismissCrossBrowserTip();
                    }}
                    className="underline font-semibold hover:text-primary"
                  >
                    Import/Export button
                  </button>
                  {' '}to create a backup and import it in the other browser.
                </div>
                <button
                  onClick={dismissCrossBrowserTip}
                  className="text-primary hover:text-primary/80 font-bold"
                >
                  ✕
                </button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{greeting} 👋</h1>
            <p className="text-sm text-muted-foreground">
              Your vault is secure • Last updated: {format(lastRefresh, 'HH:mm:ss')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
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
            <Button
              onClick={() => setShowImportExport(true)}
              variant="outline"
              className="rounded-xl px-4 py-2 whitespace-nowrap"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import / Export
            </Button>
            <Button
              onClick={() => setShowGenerator(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-4 py-3 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              Password Generator
            </Button>
          </div>
        </div>

        {/* Onboarding CTA for new users */}
        {stats.totalPasswords === 0 && stats.activeSubscriptions === 0 && stats.totalNotes === 0 && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col md:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-semibold text-foreground mb-1">Welcome to IronVault!</h3>
              <p className="text-sm text-muted-foreground">Your vault is ready. Start by adding a password, tracking a subscription, or creating a note.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/passwords">
                <Button size="sm" className="rounded-xl">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Password
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 stagger-children">
          <StatCard
            icon={Lock}
            label="Passwords"
            value={stats.totalPasswords}
            color="text-primary"
          />
          <StatCard
            icon={Bookmark}
            label="Subscriptions"
            value={stats.activeSubscriptions}
            color="text-primary"
          />
          <StatCard
            icon={FileText}
            label="Notes"
            value={stats.totalNotes}
            color="text-foreground"
          />
          <StatCard
            icon={Bell}
            label="Reminders"
            value={stats.totalReminders}
            color="text-foreground"
          />
          <StatCard
            icon={CreditCard}
            label="Monthly Spend"
            value={formatCurrency(monthlySpend, currency)}
            color="text-foreground"
          />
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center h-full">
              <SecurityRing score={securityScore} />
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

        {/* Quick Access Sections */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Quick Access</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/passwords">
              <SectionCard 
                icon={Lock} 
                label="Passwords" 
                count={stats.totalPasswords}
                color="text-primary"
              />
            </Link>
            <Link href="/subscriptions">
              <SectionCard 
                icon={Bookmark} 
                label="Subscriptions" 
                count={stats.activeSubscriptions}
                color="text-primary"
              />
            </Link>
            <Link href="/notes">
              <SectionCard 
                icon={FileText} 
                label="Notes" 
                count={stats.totalNotes}
                color="text-foreground"
              />
            </Link>
            <Link href="/expenses">
              <SectionCard 
                icon={DollarSign} 
                label="Expenses" 
                count={stats.totalExpenses}
                color="text-foreground"
              />
            </Link>
          </div>
        </div>

        {/* Expense Donut */}
        {topExpenseCategories.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Expense Breakdown</h2>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-6">
                  <MiniDonut segments={topExpenseCategories.map(c => ({ pct: c.pct, color: c.color }))} />
                  <div className="flex-1 space-y-2">
                    {topExpenseCategories.map(c => (
                      <div key={c.cat} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-xs text-foreground">{c.cat}</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{c.pct.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Due Soon Reminders */}
        {dueReminders.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Due This Week</h2>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {dueReminders.map(r => {
                    const daysLeft = differenceInCalendarDays(r.dueDate, new Date());
                    const urgentColor = r.priority === 'high' || r.priority === 'urgent' ? 'text-destructive' : daysLeft <= 1 ? 'text-amber-500' : 'text-foreground';
                    return (
                      <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bell className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{r.title}</p>
                            <p className="text-xs text-muted-foreground">{format(r.dueDate, 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs ${urgentColor}`}>
                          {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h2>
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {recentActivity.length > 0 ? (
                  recentActivity.map((log, index) => {
                    const IconComponent = log.icon;
                    return (
                      <div key={log.id || index} className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${getActivityBgColor(log.category)} flex items-center justify-center`}>
                            <IconComponent className={`w-4 h-4 ${log.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{log.description}</p>
                            <p className="text-xs text-muted-foreground">{format(log.timestamp, 'MMM dd, HH:mm')}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {log.category}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Passwords */}
        {recentPasswords.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Recent Passwords</h2>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {recentPasswords.map((password) => (
                    <div key={password.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
                      <div className="flex items-center gap-3">
                        <Favicon url={password.url} name={password.name} className="w-8 h-8 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{password.name}</p>
                          <p className="text-xs text-muted-foreground">{password.username}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyPassword(password.password, password.id)}
                        className="p-2"
                      >
                        {copiedId === password.id ? (
                          <CheckCircle className="w-4 h-4 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upcoming Renewals */}
        {upcomingRenewals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Renewals</h2>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {upcomingRenewals.map((subscription) => (
                    <div key={subscription.id} className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
                      <div className="flex items-center gap-3">
                        <Favicon url={subscription.platformLink} name={subscription.name} className="w-8 h-8 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{subscription.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(subscription.nextBillingDate, 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          {formatCurrency(subscription.cost || 0, currency)}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {differenceInCalendarDays(subscription.nextBillingDate, new Date())} days
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <PasswordGeneratorModal
        open={showGenerator}
        onOpenChange={setShowGenerator}
      />
      
      <ImportExportModal
        open={showImportExport}
        onOpenChange={setShowImportExport}
      />
    </div>
  );
}