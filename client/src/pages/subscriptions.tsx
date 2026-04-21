import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Edit, Trash2, Bell, Search, Calendar, DollarSign, BarChart3, Bookmark, Globe, ExternalLink, User, Mail, Key, Clock, AlertTriangle, Eye, EyeOff, LogIn, Copy, Check, LayoutTemplate, Tv, Music, Cloud, Newspaper, Dumbbell, ShoppingCart, Gamepad2, BookOpen, MoreVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { BrandCard } from '@/components/brand-card';
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

export default function Subscriptions() {
  const { isPro, getLimit, isLoading: licenseLoading } = useSubscription();

  const { subscriptions, deleteSubscription, searchQuery, setSearchQuery, stats } = useVault();
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
      window.open(url, '_blank');
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

  // Calculate totals
  const totalMonthlySpend = subscriptions
    .filter(s => s.isActive)
    .reduce((total, s) => total + (s.cost || 0), 0);

  const totalYearlySpend = subscriptions
    .filter(s => s.isActive)
    .reduce((total, s) => {
      const monthlyCost = s.cost || 0;
      return total + (s.billingCycle === 'yearly' ? monthlyCost : monthlyCost * 12);
    }, 0);

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
          onReminderAction={(reminder, action) => {
            console.log(`Reminder ${action}:`, reminder);
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
            {filteredSubscriptions.length > 0 ? (
              <div className="space-y-3 stagger-children">
                {filteredSubscriptions.map((subscription) => {
                  const daysUntilRenewal = differenceInCalendarDays(subscription.nextBillingDate, new Date());
                  const isUpcoming = daysUntilRenewal <= subscription.reminderDays && daysUntilRenewal >= 0;

                  return (
                    <BrandCard key={subscription.id} name={subscription.name} url={subscription.platformLink || undefined}>
                      <div className="px-4 py-3">
                        {/* Main row: favicon + name/plan + kebab */}
                        <div className="flex items-center gap-3">
                          <Favicon url={subscription.platformLink || undefined} name={subscription.name} className="w-10 h-10 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[15px] text-foreground truncate leading-tight">{subscription.name}</h3>
                            <p className="text-[13px] text-muted-foreground truncate leading-tight mt-0.5">
                              {subscription.plan || subscription.category || subscription.billingCycle}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                <MoreVertical className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              {subscription.platformLink && (
                                <DropdownMenuItem onClick={() => openPlatform(subscription.platformLink || '', subscription.name)}>
                                  <LogIn className="w-4 h-4 mr-2" /> Open site
                                </DropdownMenuItem>
                              )}
                              {subscription.credentials && (subscription.credentials.username || subscription.credentials.email || subscription.credentials.password) && (
                                <DropdownMenuItem onClick={() => toggleCredentialVisibility(subscription.id)}>
                                  {revealedCredentials.has(subscription.id)
                                    ? <><EyeOff className="w-4 h-4 mr-2" /> Hide credentials</>
                                    : <><Eye className="w-4 h-4 mr-2" /> Reveal credentials</>}
                                </DropdownMenuItem>
                              )}
                              {revealedCredentials.has(subscription.id) && subscription.credentials?.username && (
                                <DropdownMenuItem onClick={() => copyCredential(subscription.credentials!.username!, 'Username')}>
                                  <Copy className="w-4 h-4 mr-2" /> Copy username
                                </DropdownMenuItem>
                              )}
                              {revealedCredentials.has(subscription.id) && subscription.credentials?.email && (
                                <DropdownMenuItem onClick={() => copyCredential(subscription.credentials!.email!, 'Email')}>
                                  <Copy className="w-4 h-4 mr-2" /> Copy email
                                </DropdownMenuItem>
                              )}
                              {revealedCredentials.has(subscription.id) && subscription.credentials?.password && (
                                <DropdownMenuItem onClick={() => copyCredential(subscription.credentials!.password!, 'Password')}>
                                  <Copy className="w-4 h-4 mr-2" /> Copy password
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setEditingSubscription(subscription)}>
                                <Edit className="w-4 h-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteSubscription(subscription.id, subscription.name)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Revealed credentials */}
                        {revealedCredentials.has(subscription.id) && subscription.credentials && (
                          <div className="mt-2.5 px-3 py-2 bg-muted/60 rounded-lg text-[13px] font-mono space-y-1">
                            {subscription.credentials.username && (
                              <div><span className="text-muted-foreground text-[12px]">user </span>{subscription.credentials.username}</div>
                            )}
                            {subscription.credentials.email && (
                              <div><span className="text-muted-foreground text-[12px]">email </span>{subscription.credentials.email}</div>
                            )}
                            {subscription.credentials.password && (
                              <div><span className="text-muted-foreground text-[12px]">pass </span>{subscription.credentials.password}</div>
                            )}
                            {subscription.credentials.accountId && (
                              <div><span className="text-muted-foreground text-[12px]">id </span>{subscription.credentials.accountId}</div>
                            )}
                          </div>
                        )}

                        {/* Bottom: cost + renewal + status */}
                        <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-border/40">
                          <span className="text-[13px] font-semibold text-foreground">
                            {formatCurrency(subscription.cost || 0, currency)}
                            <span className="text-[11px] font-normal text-muted-foreground ml-0.5">
                              /{subscription.billingCycle === 'yearly' ? 'yr' : 'mo'}
                            </span>
                          </span>
                          <span className="text-muted-foreground/40 text-[11px]">•</span>
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">
                            {format(subscription.nextBillingDate, 'MMM dd')}
                          </span>
                          <div className="ml-auto flex items-center gap-1.5">
                            {isUpcoming && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                                Due soon
                              </span>
                            )}
                            <Badge
                              variant={subscription.isActive ? "default" : "secondary"}
                              className="text-[11px] h-5 px-1.5"
                            >
                              {subscription.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </BrandCard>
                  );
                })}
              </div>
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
        <DialogContent className="max-w-lg max-h-[80svh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" />
              Subscription Templates
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
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
          </div>
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
    </div>
  );
}