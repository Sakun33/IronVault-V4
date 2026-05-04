import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Bell, Search, Calendar, DollarSign, BarChart3, Bookmark, Globe, Eye, EyeOff, LogIn, Copy, LayoutTemplate, Tv, Music, Cloud, Newspaper, Dumbbell, ShoppingCart, Gamepad2, BookOpen, ChevronRight, CheckSquare } from 'lucide-react';
import { useMultiSelect } from '@/hooks/use-multi-select';
import { SelectionBar, SelectionCheckbox } from '@/components/selection-bar';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Favicon } from '@/components/favicon';
import { useVault } from '@/contexts/vault-context';
import { useCurrency } from '@/contexts/currency-context';
import { useToast } from '@/hooks/use-toast';
import { SUBSCRIPTION_CATEGORIES } from '@shared/schema';
import { AddSubscriptionModal } from '@/components/add-subscription-modal';
import { SubscriptionAnalytics } from '@/components/subscription-analytics';
import { SubscriptionReminderComponent } from '@/components/subscription-reminder-component';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { format, addDays, differenceInCalendarDays } from 'date-fns';
import { ListSkeleton } from '@/components/list-skeleton';

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
    // If already visible, just hide it
    if (revealedCredentials.has(subscriptionId)) {
      const newRevealed = new Set(revealedCredentials);
      newRevealed.delete(subscriptionId);
      setRevealedCredentials(newRevealed);
      return;
    }
    
    // If not verified yet, require verification
    if (!isVerified) {
      setPendingRevealId(subscriptionId);
      setShowVerifyModal(true);
      return;
    }
    
    // Already verified, show the credentials
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

  const maskCredential = (credential: string) => {
    if (!credential) return '';
    return '•'.repeat(Math.min(credential.length, 8));
  };

  const copyCredential = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCredential(label);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopiedCredential(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const openPlatform = (url: string, subscriptionName: string) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      toast({
        title: "Opening Platform",
        description: `Opening ${subscriptionName} in a new tab`,
      });
    } else {
      toast({
        title: "No Link Available",
        description: "Platform link not configured for this subscription",
        variant: "destructive",
      });
    }
  };

  // Filter and search subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(subscription => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        subscription.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subscription.plan ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (subscription.category ?? '').toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      const matchesCategory = categoryFilter === 'all' || 
        subscription.category === categoryFilter;

      // Status filter
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
      toast({ title: "Deleted", description: "Subscription deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete subscription", variant: "destructive" });
    } finally {
      setDeleteSubTarget(null);
    }
  };

  // Normalize each subscription's cost to a per-month amount before summing,
  // so a yearly $120 sub doesn't get reported as $120/month and a quarterly
  // $30 sub doesn't get reported as $30/month.
  const monthlyCostOf = (s: { cost?: number; billingCycle?: string }): number => {
    const cost = s.cost || 0;
    switch (s.billingCycle) {
      case 'yearly':    return cost / 12;
      case 'quarterly': return cost / 3;
      case 'weekly':    return cost * 4.345; // ~weeks per month
      case 'daily':     return cost * 30.437;
      case 'monthly':
      default:          return cost;
    }
  };

  // Short label suffix that matches the actual billing cycle. Falls back to
  // "mo" when the value is missing or unknown so the UI never shows a blank.
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

  const totalMonthlySpend = subscriptions
    .filter(s => s.isActive)
    .reduce((total, s) => total + monthlyCostOf(s), 0);

  const totalYearlySpend = totalMonthlySpend * 12;

  const activeSubscriptions = subscriptions.filter(s => s.isActive).length;

  const subscriptionLimit = getLimit('subscriptionLimit');
  const atSubscriptionLimit = !isPro && subscriptions.length >= subscriptionLimit;

  return (
    <div className="overflow-x-hidden">
      <div className="space-y-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Bell className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Subscriptions</h1>
                <Badge variant="secondary" className="rounded-full text-xs font-semibold">
                  {subscriptions.length}{!isPro && `/${subscriptionLimit}`}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">Recurring payments &amp; services</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowTemplatesModal(true)} className="rounded-xl hidden sm:flex">
              <LayoutTemplate className="w-4 h-4 mr-1.5" />Templates
            </Button>
            {filteredSubscriptions.length > 0 && !selection.isSelectionMode && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
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
              className="rounded-xl"
              disabled={atSubscriptionLimit}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {atSubscriptionLimit ? 'Upgrade' : 'Add'}
            </Button>
          </div>
        </div>

        {/* Quick Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold tracking-tight text-primary mb-1">
                {formatCurrency(totalMonthlySpend, currency)}
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly ({currency})</div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold tracking-tight text-muted-foreground mb-1">
                {formatCurrency(totalYearlySpend, currency)}
              </div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Yearly ({currency})</div>
            </CardContent>
          </Card>
          
          <Card className="rounded-2xl shadow-sm border-0 bg-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary mb-1">
                {activeSubscriptions}
              </div>
              <div className="text-sm text-muted-foreground">Active Subscriptions</div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Reminders */}
        <SubscriptionReminderComponent 
          subscriptions={subscriptions}
          onReminderAction={(_reminder, _action) => {
          }}
        />

        {/* Navigation Tabs */}
        <Tabs defaultValue="subscriptions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted">
            <TabsTrigger value="subscriptions" className="rounded-xl data-[state=active]:bg-card">
              <Bookmark className="w-4 h-4 mr-2" />
              Subscriptions
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-xl data-[state=active]:bg-card">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions" className="space-y-4">
            {/* Filters */}
            <Card className="rounded-2xl shadow-sm border-0 bg-card">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search subscriptions..."
                      className="pl-10 rounded-xl border-input bg-muted"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="rounded-xl border-input bg-muted">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {SUBSCRIPTION_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="rounded-xl border-input bg-muted">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Subscription List */}
            {isLoading && subscriptions.length === 0 ? (
              <ListSkeleton rows={5} showHeader={false} />
            ) : filteredSubscriptions.length > 0 ? (
              <Card className={`rounded-2xl shadow-sm border-border/50 overflow-hidden ${selection.isSelectionMode ? 'pb-20' : ''}`}>
                <motion.div
                  variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
                  initial="hidden"
                  animate="show"
                >
                {filteredSubscriptions.map((subscription, idx) => {
                  const daysUntilRenewal = differenceInCalendarDays(subscription.nextBillingDate, new Date());
                  const isUpcoming = daysUntilRenewal <= subscription.reminderDays && daysUntilRenewal >= 0;
                  const checked = selection.isSelected(subscription.id);
                  return (
                    <motion.button
                      key={subscription.id}
                      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
                      transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                      whileHover={{ scale: 1.005 }}
                      whileTap={{ scale: 0.995 }}
                      data-testid={`subscription-row-${subscription.id}`}
                      onClick={() => {
                        if (selection.isSelectionMode) selection.toggle(subscription.id);
                        else setDetailSub(subscription);
                      }}
                      onContextMenu={(e) => { e.preventDefault(); selection.enterSelectionMode(subscription.id); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 active:bg-muted transition-colors ${idx < filteredSubscriptions.length - 1 ? 'border-b border-border/50' : ''} ${checked ? 'bg-primary/5' : ''}`}
                    >
                      {selection.isSelectionMode && (
                        <SelectionCheckbox checked={checked} onChange={() => selection.toggle(subscription.id)} label={`Select ${subscription.name}`} />
                      )}
                      <Favicon url={subscription.platformLink || undefined} name={subscription.name} className="w-8 h-8 flex-shrink-0 rounded-lg" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] font-medium text-foreground truncate">{subscription.name}</div>
                        <div className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span className="font-medium">{formatCurrency(subscription.cost || 0, currency)}/{cycleSuffix(subscription.billingCycle)}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <Calendar size={11} className="flex-shrink-0" />
                          <span>{format(subscription.nextBillingDate, 'MMM d')}</span>
                          {isUpcoming && <span className="text-orange-500 font-medium">· due soon</span>}
                        </div>
                      </div>
                      <Badge variant={subscription.isActive ? 'default' : 'secondary'} className="text-[11px] h-5 px-1.5 flex-shrink-0">
                        {subscription.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {!selection.isSelectionMode && (
                        <ChevronRight size={16} className="text-muted-foreground/40 flex-shrink-0" />
                      )}
                    </motion.button>
                  );
                })}
                </motion.div>
              </Card>
            ) : (
              <Card className="rounded-2xl shadow-sm border-0 bg-card">
                <CardContent className="p-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No subscriptions yet</h3>
                  <p className="text-muted-foreground mb-6">Start tracking your recurring subscriptions</p>
                  <Button
                    onClick={() => setShowAddModal(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 py-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Subscription
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics">
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
                <Card
                  key={template.id}
                  className="cursor-pointer hover:shadow-md transition-shadow p-3"
                  onClick={() => handleUseTemplate(template)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{template.name}</p>
                      <p className="text-xs text-muted-foreground">${template.cost}/mo</p>
                    </div>
                  </div>
                </Card>
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
        const daysUntilRenewal = differenceInCalendarDays(sub.nextBillingDate, new Date());
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
                {/* Cost + billing */}
                <div className="rounded-xl bg-muted/50 px-4 py-3">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Billing</div>
                  <div className="text-[15px] font-semibold text-foreground">
                    {formatCurrency(sub.cost || 0, currency)}<span className="text-[13px] font-normal text-muted-foreground">/{cycleSuffix(sub.billingCycle)}</span>
                  </div>
                </div>

                {/* Next billing date */}
                <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Next Payment</div>
                    <div className="text-[14px] text-foreground">{format(sub.nextBillingDate, 'MMM d, yyyy')}</div>
                  </div>
                  {isUpcoming && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">Due soon</span>
                  )}
                </div>

                {/* Plan / Category */}
                {(sub.plan || sub.category) && (
                  <div className="rounded-xl bg-muted/50 px-4 py-3">
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-0.5">Plan</div>
                    <div className="text-[14px] text-foreground">{sub.plan || sub.category}</div>
                  </div>
                )}

                {/* Credentials */}
                {hasCredentials && (
                  <div className="rounded-xl bg-muted/50 overflow-hidden">
                    <div className="px-4 py-2 flex items-center justify-between border-b border-border/40">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Credentials</span>
                      <button
                        onClick={() => toggleCredentialVisibility(sub.id)}
                        className="p-1 rounded-lg hover:bg-muted transition-colors"
                      >
                        {isRevealed ? <EyeOff size={14} className="text-primary" /> : <Eye size={14} className="text-muted-foreground" />}
                      </button>
                    </div>
                    {(['username', 'email', 'password', 'accountId'] as const).map(field => {
                      const val = sub.credentials?.[field];
                      if (!val) return null;
                      return (
                        <div key={field} className="flex items-center gap-2 px-4 py-2 border-b border-border/30 last:border-0">
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-muted-foreground capitalize">{field === 'accountId' ? 'Account ID' : field}</div>
                            <div className="text-[13px] font-mono text-foreground truncate">
                              {isRevealed ? val : '••••••••'}
                            </div>
                          </div>
                          {isRevealed && (
                            <button onClick={() => copyCredential(val, field)} className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0">
                              <Copy size={13} className="text-muted-foreground" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant={sub.isActive ? 'default' : 'secondary'}>{sub.isActive ? 'Active' : 'Inactive'}</Badge>
                  {sub.platformLink && (
                    <button onClick={() => openPlatform(sub.platformLink, sub.name)} className="flex items-center gap-1 text-[12px] text-primary hover:underline">
                      <Globe size={12} /> Open site
                    </button>
                  )}
                </div>

                {/* Actions */}
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