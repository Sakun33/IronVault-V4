import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SwipeRow, type SwipeAction } from '@/components/ios';
import { XCircle, TrendingUp, TrendingDown, AlertTriangle, Sparkles, X } from 'lucide-react';
import { scheduleSubscriptionRenewalNotification } from '@/native/notifications';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Bell, Search, Calendar, BarChart3, Bookmark, Globe, Eye, EyeOff, Copy, LayoutTemplate, Tv, Music, Cloud, Newspaper, Dumbbell, ShoppingCart, Gamepad2, BookOpen, ChevronRight, CheckSquare, CalendarPlus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportToCalendar, downloadICS } from '@/lib/calendar-export';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Favicon } from '@/components/favicon';
import { ViewToggle } from '@/components/view-toggle';
import { useVault } from '@/contexts/vault-context';
import { useCurrency } from '@/contexts/currency-context';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_CATEGORIES } from '@shared/schema';
import { AddSubscriptionModal } from '@/components/add-subscription-modal';
import { SubscriptionAnalytics } from '@/components/subscription-analytics';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { format, differenceInCalendarDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ListSkeleton } from '@/components/list-skeleton';

// Category → accent color mapping for chips and dots.
const CATEGORY_COLORS: Record<string, { dot: string; chip: string; pill: string }> = {
  Entertainment: { dot: 'bg-purple-500', chip: 'from-purple-500 to-fuchsia-500', pill: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  Music:         { dot: 'bg-pink-500',   chip: 'from-pink-500 to-rose-500',     pill: 'bg-pink-500/15 text-pink-300 border-pink-500/30' },
  'Cloud Storage': { dot: 'bg-sky-500',  chip: 'from-sky-500 to-cyan-500',      pill: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  Shopping:      { dot: 'bg-amber-500',  chip: 'from-amber-500 to-orange-500',  pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  'Health & Fitness': { dot: 'bg-emerald-500', chip: 'from-emerald-500 to-teal-500', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  News:          { dot: 'bg-blue-500',   chip: 'from-blue-500 to-indigo-500',   pill: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  Gaming:        { dot: 'bg-rose-500',   chip: 'from-rose-500 to-red-500',      pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  Education:     { dot: 'bg-indigo-500', chip: 'from-indigo-500 to-violet-500', pill: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' },
  Productivity:  { dot: 'bg-teal-500',   chip: 'from-teal-500 to-emerald-500',  pill: 'bg-teal-500/15 text-teal-300 border-teal-500/30' },
  Other:         { dot: 'bg-slate-500',  chip: 'from-slate-500 to-zinc-500',    pill: 'bg-white/10 text-white/70 border-white/15' },
};

function categoryStyle(cat?: string) {
  if (!cat) return CATEGORY_COLORS.Other;
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
}

export default function Subscriptions() {
  const { isPro, getLimit, isLoading: licenseLoading } = useSubscription();

  const { subscriptions, deleteSubscription, bulkDeleteSubscriptions, searchQuery, setSearchQuery, stats, isLoading } = useVault();
  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [revealedCredentials, setRevealedCredentials] = useState<Set<string>>(new Set());
  const [copiedCredential, setCopiedCredential] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [deleteSubTarget, setDeleteSubTarget] = useState<{id: string; name: string} | null>(null);
  const [detailSub, setDetailSub] = useState<any>(null);
  const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('iv_dismissed_reminders');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    return localStorage.getItem('iv_subscriptions_view') === 'grid' ? 'grid' : 'list';
  });
  useEffect(() => {
    try { localStorage.setItem('iv_subscriptions_view', viewMode); } catch {}
  }, [viewMode]);

  useEffect(() => {
    try { localStorage.setItem('iv_dismissed_reminders', JSON.stringify(Array.from(dismissedReminders))); } catch {}
  }, [dismissedReminders]);

  // Deep-link from global search — `?openId=<id>` opens that subscription's
  // detail dialog. Waits until subs load.
  const openIdConsumedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || openIdConsumedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const openId = params.get('openId');
    if (!openId) return;
    if (!subscriptions || subscriptions.length === 0) return;
    const match = subscriptions.find(s => s.id === openId);
    openIdConsumedRef.current = true;
    if (match) setDetailSub(match);
    params.delete('openId');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  }, [subscriptions]);

  // Schedule OS-level renewal notifications (3-day warning + day-of) for any
  // active subscription with a future renewal date.
  useEffect(() => {
    if (!subscriptions || subscriptions.length === 0) return;
    const now = Date.now();
    subscriptions.forEach((sub) => {
      if (!sub.isActive || !sub.nextBillingDate) return;
      const renewal = new Date(sub.nextBillingDate);
      if (renewal.getTime() <= now) return;
      const amount = formatCurrency(sub.cost || 0, currency);
      void scheduleSubscriptionRenewalNotification(sub.id, sub.name, renewal, amount);
    });
  }, [subscriptions, currency, formatCurrency]);

  // Subscription Templates
  const SUBSCRIPTION_TEMPLATES = [
    { id: 'netflix', name: 'Netflix', icon: Tv, category: 'Entertainment', cost: 15.99, billingCycle: 'monthly' },
    { id: 'spotify', name: 'Spotify', icon: Music, category: 'Entertainment', cost: 9.99, billingCycle: 'monthly' },
    { id: 'amazon', name: 'Amazon Prime', icon: ShoppingCart, category: 'Shopping', cost: 14.99, billingCycle: 'monthly' },
    { id: 'icloud', name: 'iCloud Storage', icon: Cloud, category: 'Cloud Storage', cost: 2.99, billingCycle: 'monthly' },
    { id: 'gym', name: 'Gym Membership', icon: Dumbbell, category: 'Health & Fitness', cost: 29.99, billingCycle: 'monthly' },
    { id: 'news', name: 'News Subscription', icon: Newspaper, category: 'News', cost: 9.99, billingCycle: 'monthly' },
    { id: 'gaming', name: 'Gaming Service', icon: Gamepad2, category: 'Gaming', cost: 14.99, billingCycle: 'monthly' },
    { id: 'learning', name: 'Online Learning', icon: BookOpen, category: 'Education', cost: 19.99, billingCycle: 'monthly' },
  ];

  const handleUseTemplate = (template: typeof SUBSCRIPTION_TEMPLATES[0]) => {
    setEditingSubscription({
      name: template.name,
      category: template.category,
      cost: template.cost,
      billingCycle: template.billingCycle,
      isTemplate: true,
    });
    setShowTemplatesModal(false);
    setShowAddModal(true);
  };

  // Helper functions for credential management
  const toggleCredentialVisibility = (subscriptionId: string) => {
    if (revealedCredentials.has(subscriptionId)) {
      const newRevealed = new Set(revealedCredentials);
      newRevealed.delete(subscriptionId);
      setRevealedCredentials(newRevealed);
      return;
    }
    if (!isVerified) {
      setPendingRevealId(subscriptionId);
      setShowVerifyModal(true);
      return;
    }
    const newRevealed = new Set(revealedCredentials);
    newRevealed.add(subscriptionId);
    setRevealedCredentials(newRevealed);
  };

  const handleVerified = () => {
    setIsVerified(true);
    if (pendingRevealId) {
      const newRevealed = new Set(revealedCredentials);
      newRevealed.add(pendingRevealId);
      setRevealedCredentials(newRevealed);
      setPendingRevealId(null);
    }
  };

  const copyCredential = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredential(label);
      toast({ title: "Copied", description: `${label} copied to clipboard` });
      setTimeout(() => setCopiedCredential(null), 2000);
    } catch {
      toast({ title: "Error", description: "Failed to copy to clipboard", variant: "destructive" });
    }
  };

  const openPlatform = async (url: string, subscriptionName: string) => {
    if (url) {
      const safe = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      try {
        const { isNativeApp } = await import('@/native/platform');
        if (isNativeApp()) {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: safe });
        } else {
          window.open(safe, '_blank', 'noopener,noreferrer');
        }
      } catch {
        window.open(safe, '_blank', 'noopener,noreferrer');
      }
      toast({ title: "Opening Platform", description: `Opening ${subscriptionName} in a new tab` });
    } else {
      toast({ title: "No Link Available", description: "Platform link not configured for this subscription", variant: "destructive" });
    }
  };

  // Roll a stored renewal date forward by the billing cycle until it lands
  // on or after today.
  const effectiveNextBilling = (sub: { nextBillingDate?: Date | string | null; billingCycle?: string }): Date => {
    const raw = sub.nextBillingDate ? new Date(sub.nextBillingDate as any) : new Date();
    if (Number.isNaN(raw.getTime())) return new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(raw);
    let guard = 0;
    while (next < today && guard < 400) {
      switch (sub.billingCycle) {
        case 'yearly':    next.setFullYear(next.getFullYear() + 1); break;
        case 'quarterly': next.setMonth(next.getMonth() + 3); break;
        case 'weekly':    next.setDate(next.getDate() + 7); break;
        case 'daily':     next.setDate(next.getDate() + 1); break;
        case 'monthly':
        default:          next.setMonth(next.getMonth() + 1); break;
      }
      guard++;
    }
    return next;
  };

  const monthlyCostOf = (s: { cost?: number; billingCycle?: string }): number => {
    const cost = s.cost || 0;
    switch (s.billingCycle) {
      case 'yearly':    return cost / 12;
      case 'quarterly': return cost / 3;
      case 'weekly':    return cost * 4.345;
      case 'daily':     return cost * 30.437;
      case 'monthly':
      default:          return cost;
    }
  };

  const cycleSuffix = (cycle?: string): string => {
    switch (cycle) {
      case 'yearly':    return 'yr';
      case 'quarterly': return 'qtr';
      case 'weekly':    return 'wk';
      case 'daily':     return 'day';
      case 'monthly':   return 'mo';
      default:          return 'mo';
    }
  };

  // Filter and search subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(subscription => {
      const matchesSearch = searchQuery === '' ||
        subscription.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subscription.plan ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subscription.category ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || subscription.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'active' && subscription.isActive) ||
        (statusFilter === 'inactive' && !subscription.isActive);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [subscriptions, searchQuery, categoryFilter, statusFilter]);

  const selection = useMultiSelect(filteredSubscriptions);

  const handleBulkDeleteSubscriptions = async () => {
    const ids = Array.from(selection.selectedIds);
    if (ids.length === 0) return;
    const removed = await bulkDeleteSubscriptions(ids);
    selection.exitSelectionMode();
    toast({
      title: removed === ids.length ? 'Subscriptions deleted' : 'Some subscriptions could not be deleted',
      description: `${removed} of ${ids.length} removed.`,
      variant: removed === ids.length ? 'default' : 'destructive',
    });
  };

  const handleDeleteSubscription = (id: string, name: string) => {
    setDeleteSubTarget({ id, name });
  };

  const confirmDeleteSubscription = async () => {
    if (!deleteSubTarget) return;
    try {
      await deleteSubscription(deleteSubTarget.id);
      toast({ variant: 'success', title: "Deleted", description: "Subscription deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete subscription", variant: "destructive" });
    } finally {
      setDeleteSubTarget(null);
    }
  };

  // ── Aggregates ────────────────────────────────────────────────────────────
  const totalMonthlySpend = subscriptions
    .filter(s => s.isActive)
    .reduce((total, s) => total + monthlyCostOf(s), 0);

  const activeSubscriptions = subscriptions.filter(s => s.isActive).length;

  // Hero stats — expiring soon (next 7 days) and overdue
  const now = new Date();
  const next7 = new Date();
  next7.setDate(next7.getDate() + 7);

  const expiringSoonCount = subscriptions.filter(s => {
    if (!s.isActive) return false;
    const d = effectiveNextBilling(s);
    return d >= now && d <= next7;
  }).length;

  const overdueCount = subscriptions.filter(s => {
    if (!s.isActive || !s.nextBillingDate) return false;
    return new Date(s.nextBillingDate) < now;
  }).length;

  // Sparkline data — last 6 months total spend.
  // Approximation: each subscription contributes its monthly-normalized
  // cost every month it was active. Without historical state we render a
  // gentle trend by scaling the current total slightly per month.
  const sparklinePoints = useMemo(() => {
    const months = 6;
    const today = new Date();
    return Array.from({ length: months }, (_, i) => {
      const monthDate = subMonths(today, months - 1 - i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const total = subscriptions.reduce((sum, s) => {
        if (!s.isActive) return sum;
        const created = (s as any).createdAt ? new Date((s as any).createdAt) : null;
        if (created && created > monthEnd) return sum;
        return sum + monthlyCostOf(s);
      }, 0);
      return { label: format(monthDate, 'MMM'), value: total };
    });
  }, [subscriptions]);

  const sparkPath = useMemo(() => {
    if (sparklinePoints.length === 0) return '';
    const max = Math.max(...sparklinePoints.map(p => p.value), 1);
    const w = 200, h = 50, pad = 4;
    const step = (w - pad * 2) / Math.max(sparklinePoints.length - 1, 1);
    return sparklinePoints.map((p, i) => {
      const x = pad + i * step;
      const y = h - pad - (p.value / max) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [sparklinePoints]);

  const sparkAreaPath = useMemo(() => {
    if (!sparkPath) return '';
    return `${sparkPath} L 196 46 L 4 46 Z`;
  }, [sparkPath]);

  // Smart reminders — generate from any subscription renewing in next 14 days.
  const smartReminders = useMemo(() => {
    return subscriptions
      .filter(s => s.isActive && s.nextBillingDate)
      .map(s => {
        const renewal = effectiveNextBilling(s);
        const days = differenceInCalendarDays(renewal, now);
        return { sub: s, renewal, days };
      })
      .filter(r => r.days <= 14)
      .filter(r => !dismissedReminders.has(r.sub.id))
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);
  }, [subscriptions, dismissedReminders]);

  const dismissReminder = (id: string) => {
    setDismissedReminders(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const subscriptionLimit = getLimit('subscriptionLimit');
  const atSubscriptionLimit = !isPro && subscriptions.length >= subscriptionLimit;

  // Category list for chips
  const visibleCategories = useMemo(() => {
    const present = new Set(subscriptions.map(s => s.category).filter(Boolean) as string[]);
    return SUBSCRIPTION_CATEGORIES.filter(c => present.has(c));
  }, [subscriptions]);

  return (
    <div className="overflow-x-hidden">
      <div className="space-y-6 overflow-x-hidden">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 backdrop-blur-sm border border-emerald-500/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_-4px_rgba(16,185,129,0.4)]">
              <Bell className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Subscriptions</h1>
                <Badge variant="secondary" className="rounded-full text-xs font-semibold bg-white/5 backdrop-blur-sm border border-white/10" data-testid="subs-count-badge">
                  {subscriptions.length}{!isPro && `/${subscriptionLimit}`}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm" data-testid="subs-active-inactive-summary">
                {subscriptions.length === 0
                  ? 'Recurring payments & services'
                  : (() => {
                      const inactive = subscriptions.length - activeSubscriptions;
                      return inactive > 0
                        ? `${activeSubscriptions} active · ${inactive} inactive · ${subscriptions.length} total`
                        : `${activeSubscriptions} active · Recurring payments & services`;
                    })()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowTemplatesModal(true)} className="rounded-xl hidden sm:flex bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10">
              <LayoutTemplate className="w-4 h-4 mr-1.5" />Templates
            </Button>
            {subscriptions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10" data-testid="export-calendar">
                    <CalendarPlus className="w-4 h-4 mr-1.5" />
                    <span className="hidden sm:inline">Calendar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      const ics = exportToCalendar(subscriptions);
                      downloadICS('ironvault-subscriptions', ics);
                      toast({ title: 'Calendar file downloaded', description: 'Open the .ics to add renewals to your calendar.' });
                    }}
                    data-testid="export-calendar-ics"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Add to Calendar (.ics)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {filteredSubscriptions.length > 0 && !selection.isSelectionMode && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10"
                onClick={() => selection.enterSelectionMode()}
                data-testid="button-enter-selection-subscriptions"
              >
                <CheckSquare className="w-4 h-4 mr-1.5" />Select
              </Button>
            )}
            <Button
              onClick={() => {
                if (atSubscriptionLimit) {
                  toast({ title: "Limit reached", description: `Free plan allows up to ${subscriptionLimit} subscriptions. Upgrade to Pro for unlimited.`, variant: "destructive" });
                  return;
                }
                setEditingSubscription(null);
                setShowAddModal(true);
              }}
              size="sm"
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold shadow-[0_0_16px_-2px_rgba(16,185,129,0.5)] border-0"
              disabled={atSubscriptionLimit}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {atSubscriptionLimit ? 'Upgrade' : 'Add'}
            </Button>
          </div>
        </div>

        {/* ── Hero Summary ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-5 sm:p-6"
        >
          {/* gradient wash */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10" />
          <div className="pointer-events-none absolute -right-20 -top-20 w-64 h-64 rounded-full bg-emerald-500/15 blur-3xl" />

          <div className="relative grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 sm:gap-8 items-center">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-300/80 font-semibold">Total Monthly Spend</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-4xl sm:text-5xl font-bold tabular-nums bg-gradient-to-br from-white to-emerald-200 bg-clip-text text-transparent">
                  {formatCurrency(totalMonthlySpend, currency)}
                </span>
                <span className="text-sm text-white/50">/ month</span>
              </div>
              <div className="text-xs text-white/60">
                <span className="tabular-nums text-white/80">{formatCurrency(totalMonthlySpend * 12, currency)}</span> per year
              </div>
            </div>

            {/* Sparkline */}
            <div className="flex flex-col items-end gap-1">
              <div className="text-[10px] uppercase tracking-wider text-white/50">Last 6 months</div>
              <svg width="200" height="50" viewBox="0 0 200 50" className="overflow-visible">
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(16,185,129)" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="rgb(16,185,129)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {sparkAreaPath && <path d={sparkAreaPath} fill="url(#sparkGrad)" />}
                {sparkPath && (
                  <path
                    d={sparkPath}
                    fill="none"
                    stroke="rgb(52,211,153)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
              </svg>
            </div>
          </div>

          {/* mini stat cards */}
          <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-emerald-500/20 p-3 hover:border-emerald-500/40 transition-colors">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-emerald-300/80 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                Active
              </div>
              <div className="text-2xl font-bold tabular-nums text-white mt-1">{activeSubscriptions}</div>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-amber-500/20 p-3 hover:border-amber-500/40 transition-colors">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300/80 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                Soon (7d)
              </div>
              <div className="text-2xl font-bold tabular-nums text-white mt-1">{expiringSoonCount}</div>
            </div>
            <div className={`rounded-xl bg-white/5 backdrop-blur-sm border p-3 transition-colors ${
              overdueCount > 0 ? 'border-rose-500/30 hover:border-rose-500/50' : 'border-white/10'
            }`}>
              <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold ${
                overdueCount > 0 ? 'text-rose-300/90' : 'text-white/50'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  overdueCount > 0 ? 'bg-rose-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]' : 'bg-white/30'
                }`} />
                Overdue
              </div>
              <div className="text-2xl font-bold tabular-nums text-white mt-1">{overdueCount}</div>
            </div>
          </div>
        </motion.div>

        {/* ── Smart Reminders ──────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {smartReminders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h2 className="text-sm font-semibold text-white/90">Upcoming Renewals</h2>
                <span className="text-[11px] text-white/40">next 14 days</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <AnimatePresence initial={false}>
                  {smartReminders.map(({ sub, renewal, days }) => {
                    const urgent = days <= 2;
                    return (
                      <motion.div
                        key={sub.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96, x: 30 }}
                        className={`relative overflow-hidden rounded-xl bg-white/5 backdrop-blur-sm border p-3 group ${
                          urgent ? 'border-rose-500/30' : 'border-amber-500/20'
                        }`}
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${urgent ? 'bg-rose-500' : 'bg-amber-400'}`} />
                        <div className="flex items-center gap-3 pl-2">
                          <Favicon url={sub.platformLink || undefined} name={sub.name} className="w-9 h-9 rounded-lg flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-white truncate">{sub.name}</div>
                            <div className="text-[11px] text-white/60">
                              Renewing in <span className={`font-semibold ${urgent ? 'text-rose-300' : 'text-amber-300'}`}>{days <= 0 ? 'today' : `${days} day${days === 1 ? '' : 's'}`}</span>
                              <span className="mx-1.5 text-white/30">·</span>
                              <span className="tabular-nums">{formatCurrency(sub.cost || 0, currency)}/{cycleSuffix(sub.billingCycle)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => dismissReminder(sub.id)}
                            aria-label="Dismiss reminder"
                            className="opacity-60 hover:opacity-100 p-1 rounded-md hover:bg-white/10 transition-all"
                          >
                            <X className="w-3.5 h-3.5 text-white/70" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Navigation Tabs ──────────────────────────────────────────────── */}
        <Tabs defaultValue="subscriptions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-1">
            <TabsTrigger value="subscriptions" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-[0_0_12px_-4px_rgba(16,185,129,0.5)]">
              <Bookmark className="w-4 h-4 mr-2" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-[0_0_12px_-4px_rgba(16,185,129,0.5)]">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="space-y-4 mt-4">
            {/* Search + view toggle */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 w-4 h-4 pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search subscriptions..."
                  className="pl-10 h-11 rounded-xl bg-white/5 backdrop-blur-sm border-white/10 placeholder:text-white/30 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/20"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 justify-between sm:justify-end">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-11 px-3 text-sm rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 text-white/80 focus:outline-none focus:border-emerald-500/50"
                  aria-label="Filter status"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <ViewToggle view={viewMode} onChange={setViewMode} />
              </div>
            </div>

            {/* Category chips */}
            <div className="-mx-1 px-1 overflow-x-auto scrollbar-none">
              <div className="flex items-center gap-2 pb-1 min-w-min">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`flex-shrink-0 px-3.5 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap font-medium ${
                    categoryFilter === 'all'
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-200 border-emerald-500/40 shadow-[0_0_12px_-4px_rgba(16,185,129,0.6)]'
                      : 'bg-white/5 backdrop-blur-sm border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  All <span className="ml-1 opacity-70 tabular-nums">{subscriptions.length}</span>
                </button>
                {visibleCategories.map(cat => {
                  const styl = categoryStyle(cat);
                  const count = subscriptions.filter(s => s.category === cat).length;
                  const active = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`flex-shrink-0 px-3.5 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap font-medium inline-flex items-center gap-1.5 ${
                        active
                          ? `bg-gradient-to-r ${styl.chip} bg-opacity-20 text-white border-white/20 shadow-[0_0_12px_-4px_rgba(255,255,255,0.3)]`
                          : 'bg-white/5 backdrop-blur-sm border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${styl.dot}`} />
                      {cat} <span className="opacity-70 tabular-nums">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subscription List or Grid */}
            {isLoading && subscriptions.length === 0 ? (
              <ListSkeleton rows={5} showHeader={false} />
            ) : filteredSubscriptions.length > 0 && viewMode === 'grid' ? (
              <motion.div
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                initial="hidden"
                animate="show"
                className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${selection.isSelectionMode ? 'pb-20' : ''}`}
              >
                {filteredSubscriptions.map((subscription) => {
                  const renewalDate = effectiveNextBilling(subscription);
                  const daysUntilRenewal = differenceInCalendarDays(renewalDate, new Date());
                  const styl = categoryStyle(subscription.category);
                  const isOverdue = subscription.isActive && subscription.nextBillingDate && new Date(subscription.nextBillingDate) < now;
                  const isExpiringSoon = subscription.isActive && daysUntilRenewal >= 0 && daysUntilRenewal <= 7;
                  const statusDot = !subscription.isActive
                    ? 'bg-slate-500'
                    : isOverdue ? 'bg-rose-500 shadow-[0_0_8px_rgba(248,113,113,0.7)]'
                    : isExpiringSoon ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                    : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
                  const checked = selection.isSelected(subscription.id);
                  const countdownLabel = isOverdue ? 'Overdue!'
                    : daysUntilRenewal === 0 ? 'Today'
                    : daysUntilRenewal === 1 ? '1 day'
                    : `${daysUntilRenewal} days`;
                  const countdownColor = isOverdue ? 'text-rose-300'
                    : isExpiringSoon ? 'text-amber-300'
                    : 'text-white/50';

                  return (
                    <motion.div
                      key={subscription.id}
                      data-testid={`subscription-card-${subscription.id}`}
                      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        if (selection.isSelectionMode) selection.toggle(subscription.id);
                        else setDetailSub(subscription);
                      }}
                      onContextMenu={(e) => { e.preventDefault(); selection.enterSelectionMode(subscription.id); }}
                      className={`group relative overflow-hidden cursor-pointer rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-4 hover:border-emerald-500/30 hover:bg-white/[0.07] transition-colors ${checked ? 'ring-2 ring-emerald-400/50 border-emerald-500/40' : ''}`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${styl.chip}`} />
                      <div className="pl-2">
                        <div className="flex items-start gap-3 mb-3">
                          <Favicon url={subscription.platformLink || undefined} name={subscription.name} className="w-10 h-10 flex-shrink-0 rounded-xl ring-1 ring-white/10" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-[15px] text-white truncate">{subscription.name}</h3>
                              {selection.isSelectionMode && (
                                <SelectionCheckbox checked={checked} onChange={() => selection.toggle(subscription.id)} label={`Select ${subscription.name}`} />
                              )}
                            </div>
                            {subscription.category && (
                              <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full border ${styl.pill}`}>
                                {subscription.category}
                              </span>
                            )}
                          </div>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${statusDot}`} title={subscription.isActive ? (isOverdue ? 'Overdue' : isExpiringSoon ? 'Expiring soon' : 'Active') : 'Inactive'} />
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold tabular-nums text-white">{formatCurrency(subscription.cost || 0, currency)}</span>
                          <span className="text-xs text-white/50">/{cycleSuffix(subscription.billingCycle)}</span>
                        </div>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-white/50">
                            <Calendar size={12} />
                            <span>{format(renewalDate, 'MMM d')}</span>
                          </div>
                          {subscription.isActive && (
                            <span className={`font-medium ${countdownColor} tabular-nums`}>
                              {countdownLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : filteredSubscriptions.length > 0 ? (
              <div className={`rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden ${selection.isSelectionMode ? 'pb-20' : ''}`}>
                <motion.div
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
                  initial="hidden"
                  animate="show"
                >
                  {filteredSubscriptions.map((subscription, idx) => {
                    const renewalDate = effectiveNextBilling(subscription);
                    const daysUntilRenewal = differenceInCalendarDays(renewalDate, new Date());
                    const styl = categoryStyle(subscription.category);
                    const isOverdue = subscription.isActive && subscription.nextBillingDate && new Date(subscription.nextBillingDate) < now;
                    const isExpiringSoon = subscription.isActive && daysUntilRenewal >= 0 && daysUntilRenewal <= 7;
                    const statusDot = !subscription.isActive
                      ? 'bg-slate-500'
                      : isOverdue ? 'bg-rose-500 shadow-[0_0_8px_rgba(248,113,113,0.7)]'
                      : isExpiringSoon ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                      : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
                    const checked = selection.isSelected(subscription.id);
                    const countdownLabel = isOverdue ? 'Overdue'
                      : daysUntilRenewal === 0 ? 'Today'
                      : daysUntilRenewal === 1 ? '1 day'
                      : `${daysUntilRenewal} days`;
                    const countdownColor = isOverdue ? 'text-rose-300'
                      : isExpiringSoon ? 'text-amber-300'
                      : 'text-white/50';
                    const swipeActions: SwipeAction[] = [
                      { id: 'edit', label: 'Edit', icon: Edit, background: 'bg-blue-500',
                        onAction: () => { setEditingSubscription(subscription); setShowAddModal(true); } },
                      { id: 'cancel', label: subscription.isActive ? 'Cancel' : 'Resume', icon: subscription.isActive ? XCircle : Bell, background: 'bg-orange-500',
                        onAction: () => { setEditingSubscription({ ...subscription, isActive: !subscription.isActive, _autoSaveOnOpen: true }); setShowAddModal(true); } },
                      { id: 'delete', label: 'Delete', icon: Trash2, background: 'bg-red-600', destructive: true,
                        onAction: () => handleDeleteSubscription(subscription.id, subscription.name) },
                    ];
                    return (
                      <SwipeRow
                        key={subscription.id}
                        actions={swipeActions}
                        disabled={selection.isSelectionMode}
                        className={idx < filteredSubscriptions.length - 1 ? 'border-b border-white/[0.06]' : ''}
                      >
                        <motion.button
                          variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                          whileTap={{ scale: 0.995 }}
                          data-testid={`subscription-row-${subscription.id}`}
                          onClick={() => {
                            if (selection.isSelectionMode) selection.toggle(subscription.id);
                            else setDetailSub(subscription);
                          }}
                          onContextMenu={(e) => { e.preventDefault(); selection.enterSelectionMode(subscription.id); }}
                          className={`w-full relative flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors min-h-[64px] ${checked ? 'bg-emerald-500/10' : ''}`}
                        >
                          <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-gradient-to-b ${styl.chip} opacity-80`} />
                          {selection.isSelectionMode && (
                            <SelectionCheckbox checked={checked} onChange={() => selection.toggle(subscription.id)} label={`Select ${subscription.name}`} />
                          )}
                          <Favicon url={subscription.platformLink || undefined} name={subscription.name} className="w-9 h-9 flex-shrink-0 rounded-lg ring-1 ring-white/10" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot}`} />
                              <span className="text-[15px] font-semibold text-white truncate leading-tight">{subscription.name}</span>
                            </div>
                            <div className="text-[12px] text-white/55 flex items-center gap-1.5 mt-0.5 truncate">
                              {subscription.category && (
                                <span className={`text-[10px] px-1.5 py-px rounded-full border ${styl.pill}`}>{subscription.category}</span>
                              )}
                              <Calendar size={10} className="flex-shrink-0" />
                              <span>{format(renewalDate, 'MMM d')}</span>
                              {subscription.isActive && (
                                <>
                                  <span className="text-white/25">·</span>
                                  <span className={`font-medium ${countdownColor}`}>{countdownLabel}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-[15px] font-bold tabular-nums text-white">{formatCurrency(subscription.cost || 0, currency)}</div>
                            <div className="text-[10px] text-white/40">/{cycleSuffix(subscription.billingCycle)}</div>
                          </div>
                          {!selection.isSelectionMode && (
                            <ChevronRight size={16} className="text-white/30 flex-shrink-0" />
                          )}
                        </motion.button>
                      </SwipeRow>
                    );
                  })}
                </motion.div>
              </div>
            ) : (
              <Card className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-emerald-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {subscriptions.length === 0 ? 'No subscriptions yet' : 'No matches'}
                  </h3>
                  <p className="text-white/50 mb-6 text-sm">
                    {subscriptions.length === 0 ? 'Start tracking your recurring subscriptions' : 'Try adjusting your filters'}
                  </p>
                  {subscriptions.length === 0 && (
                    <Button
                      onClick={() => setShowAddModal(true)}
                      className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold shadow-[0_0_20px_-4px_rgba(16,185,129,0.5)] border-0"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Your First Subscription
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <SubscriptionAnalytics subscriptions={subscriptions} />
          </TabsContent>
        </Tabs>
      </div>

      <AddSubscriptionModal
        open={showAddModal || !!editingSubscription}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingSubscription(null);
          } else {
            setShowAddModal(true);
          }
        }}
        editingSubscription={editingSubscription}
      />

      <VerifyAccessModal
        open={showVerifyModal}
        onOpenChange={setShowVerifyModal}
        onVerified={handleVerified}
        title="Reveal Credentials"
        description="Verify your identity to view subscription login details."
      />

      {/* Templates Modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" />
              Subscription Templates
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid grid-cols-2 gap-3">
            {SUBSCRIPTION_TEMPLATES.map(template => {
              const IconComponent = template.icon;
              return (
                <button
                  key={template.id}
                  className="text-left rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-emerald-500/40 hover:bg-white/10 transition-colors p-3"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/20 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-white">{template.name}</p>
                      <p className="text-xs text-white/50">${template.cost}/mo</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSubTarget} onOpenChange={(o) => !o && setDeleteSubTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteSubTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSubscription} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscription Detail Modal */}
      {detailSub && (() => {
        const sub = detailSub;
        const renewalDate = effectiveNextBilling(sub);
        const daysUntilRenewal = differenceInCalendarDays(renewalDate, new Date());
        const isUpcoming = daysUntilRenewal <= sub.reminderDays && daysUntilRenewal >= 0;
        const hasCredentials = sub.credentials && (sub.credentials.username || sub.credentials.email || sub.credentials.password || sub.credentials.accountId);
        const isRevealed = revealedCredentials.has(sub.id);
        return (
          <Dialog open={!!detailSub} onOpenChange={(open) => { if (!open) setDetailSub(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Favicon url={sub.platformLink || undefined} name={sub.name} className="w-9 h-9 rounded-lg flex-shrink-0" />
                  <span className="truncate">{sub.name}</span>
                </DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-3">
                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <div className="text-[11px] text-white/50 uppercase tracking-wide mb-0.5">Billing</div>
                  <div className="text-[15px] font-semibold text-white">
                    {formatCurrency(sub.cost || 0, currency)}<span className="text-[13px] font-normal text-white/50">/{cycleSuffix(sub.billingCycle)}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-white/50 uppercase tracking-wide mb-0.5">Next Payment</div>
                    <div className="text-[14px] text-white">{format(renewalDate, 'MMM d, yyyy')}</div>
                  </div>
                  {isUpcoming && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">Due soon</span>
                  )}
                </div>

                {(sub.plan || sub.category) && (
                  <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                    <div className="text-[11px] text-white/50 uppercase tracking-wide mb-0.5">Plan</div>
                    <div className="text-[14px] text-white">{sub.plan || sub.category}</div>
                  </div>
                )}

                {hasCredentials && (
                  <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                    <div className="px-4 py-2 flex items-center justify-between border-b border-white/[0.06]">
                      <span className="text-[11px] text-white/50 uppercase tracking-wide">Credentials</span>
                      <button
                        onClick={() => toggleCredentialVisibility(sub.id)}
                        className="p-1 rounded-lg hover:bg-white/10 transition-colors"
                      >
                        {isRevealed ? <EyeOff size={14} className="text-emerald-300" /> : <Eye size={14} className="text-white/60" />}
                      </button>
                    </div>
                    {(['username', 'email', 'password', 'accountId'] as const).map(field => {
                      const val = sub.credentials?.[field];
                      if (!val) return null;
                      return (
                        <div key={field} className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.05] last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-white/50 capitalize">{field === 'accountId' ? 'Account ID' : field}</div>
                            <div className="text-[13px] font-mono text-white truncate">
                              {isRevealed ? val : '••••••••'}
                            </div>
                          </div>
                          {isRevealed && (
                            <button onClick={() => copyCredential(val, field)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0">
                              <Copy size={13} className="text-white/60" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={sub.isActive ? 'default' : 'secondary'}>{sub.isActive ? 'Active' : 'Inactive'}</Badge>
                  {sub.platformLink && (
                    <button onClick={() => openPlatform(sub.platformLink, sub.name)} className="flex items-center gap-1 text-[12px] text-emerald-300 hover:underline">
                      <Globe size={12} /> Open site
                    </button>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setDetailSub(null); setEditingSubscription(sub); setShowAddModal(true); }}>
                    <Edit size={14} className="mr-1.5" /> Edit
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl text-destructive hover:text-destructive border-destructive/30"
                    onClick={() => { setDetailSub(null); handleDeleteSubscription(sub.id, sub.name); }}>
                    <Trash2 size={14} className="mr-1.5" /> Delete
                  </Button>
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        );
      })()}

      {selection.isSelectionMode && (
        <SelectionBar
          selectedCount={selection.selectedCount}
          totalCount={filteredSubscriptions.length}
          allSelected={selection.allSelected}
          itemLabel="subscription"
          onSelectAll={selection.selectAll}
          onClear={selection.clear}
          onExit={selection.exitSelectionMode}
          onBulkDelete={handleBulkDeleteSubscriptions}
        />
      )}
    </div>
  );
}
