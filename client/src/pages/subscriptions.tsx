import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Bell, Search, Calendar, DollarSign, BarChart3, Bookmark, Globe, ExternalLink, User, Mail, Key, Clock, AlertTriangle, Eye, EyeOff, LogIn, Copy, Check, LayoutTemplate, Tv, Music, Cloud, Newspaper, Dumbbell, ShoppingCart, Gamepad2, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  const { isFeatureAvailable } = useSubscription();
  if (!isFeatureAvailable('subscriptions')) return <UpgradeGate feature="Subscription Tracker" />;

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

  const handleDeleteSubscription = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the subscription for "${name}"?`)) {
      try {
        await deleteSubscription(id);
        toast({
          title: "Deleted",
          description: "Subscription deleted successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete subscription",
          variant: "destructive",
        });
      }
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

  return (
    <div className="overflow-x-hidden">
      <div className="space-y-6 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Subscriptions</h1>
            <p className="text-muted-foreground text-sm">Track and manage your recurring subscriptions</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatesModal(true)}
              className="rounded-xl"
            >
              <LayoutTemplate className="w-4 h-4 mr-1" />
              Templates
            </Button>
            <Button
              onClick={() => {
                setEditingSubscription(null);
                setShowAddModal(true);
              }}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
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
              <div className="space-y-3">
                {filteredSubscriptions.map((subscription) => {
                  const daysUntilRenewal = differenceInCalendarDays(subscription.nextBillingDate, new Date());
                  const isUpcoming = daysUntilRenewal <= subscription.reminderDays && daysUntilRenewal >= 0;
                  
                  return (
                    <Card key={subscription.id} className="rounded-2xl shadow-sm border-border/40 bg-card hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                      <CardContent className="p-5">
                        {/* Header Section - Redesigned for mobile */}
                        <div className="mb-4">
                          {/* Row 1: Icon + Name + Status Badge */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Bookmark className="w-5 h-5 text-primary" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-base text-foreground leading-tight mb-1">
                                {subscription.name}
                              </h3>
                              {subscription.plan && (
                                <p className="text-sm text-muted-foreground">
                                  {subscription.plan}
                                </p>
                              )}
                            </div>
                            
                            <Badge 
                              variant={subscription.isActive ? "default" : "secondary"}
                              className="text-xs flex-shrink-0"
                            >
                              {subscription.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          
                          {/* Row 2: Action Buttons - Right aligned */}
                          <div className="flex items-center justify-end gap-2 border-b border-border pb-3">
                            {subscription.platformLink && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPlatform(subscription.platformLink || '', subscription.name)}
                                className="h-8 px-3 rounded-lg text-xs gap-1.5"
                              >
                                <LogIn className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingSubscription(subscription)}
                              className="h-8 px-3 rounded-lg text-xs gap-1.5"
                            >
                              <Edit className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteSubscription(subscription.id, subscription.name)}
                              className="h-8 px-3 rounded-lg text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </Button>
                          </div>
                        </div>

                        {/* Main Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* Left Column - Billing Info */}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Next Billing:</span>
                              <span className="font-medium text-foreground">
                                {format(subscription.nextBillingDate, 'MMM dd, yyyy')}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="w-4 h-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Cost:</span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(subscription.cost || 0, currency)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {subscription.billingCycle}
                              </Badge>
                            </div>

                            {subscription.expiryDate && (
                              <div className="flex items-center gap-2 text-sm">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Expires:</span>
                                <span className="font-medium text-foreground">
                                  {format(subscription.expiryDate, 'MMM dd, yyyy')}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Right Column - Status & Type */}
                          <div className="space-y-3">
                            {subscription.subscriptionType && (
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground">Type:</span>
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                  {subscription.subscriptionType}
                                </Badge>
                              </div>
                            )}

                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Auto-renew:</span>
                              <span className={`font-medium ${subscription.autoRenew ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {subscription.autoRenew ? 'On' : 'Off'}
                              </span>
                            </div>

                            {/* Warning Badges */}
                            <div className="flex flex-wrap gap-2">
                              {isUpcoming && (
                                <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                                  <Bell className="w-3 h-3 mr-1" />
                                  Due Soon
                                </Badge>
                              )}
                              
                              {subscription.expiryDate && new Date(subscription.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) && (
                                <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                                  <AlertTriangle className="w-3 h-3 mr-1" />
                                  Expires Soon
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Credentials Section */}
                        {subscription.credentials && (subscription.credentials.username || subscription.credentials.email || subscription.credentials.accountId) && (
                          <div className="border-t border-border pt-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                                <Key className="w-4 h-4" />
                                Login Credentials
                              </h4>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleCredentialVisibility(subscription.id)}
                                className="text-xs h-6 px-2"
                              >
                                {revealedCredentials.has(subscription.id) ? (
                                  <>
                                    <EyeOff className="w-3 h-3 mr-1" />
                                    Hide
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3 mr-1" />
                                    Reveal
                                  </>
                                )}
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              {subscription.credentials.username && (
                                <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <User className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-muted-foreground flex-shrink-0">Username:</span>
                                    <span className="font-mono text-foreground truncate">
                                      {revealedCredentials.has(subscription.id) 
                                        ? subscription.credentials.username 
                                        : maskCredential(subscription.credentials.username)
                                      }
                                    </span>
                                  </div>
                                  {revealedCredentials.has(subscription.id) && subscription.credentials?.username && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={() => copyCredential(subscription.credentials!.username!, 'Username')}
                                    >
                                      {copiedCredential === 'Username' ? (
                                        <Check className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                              
                              {subscription.credentials.email && (
                                <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-muted-foreground flex-shrink-0">Email:</span>
                                    <span className="font-mono text-foreground truncate">
                                      {revealedCredentials.has(subscription.id) 
                                        ? subscription.credentials.email 
                                        : maskCredential(subscription.credentials.email)
                                      }
                                    </span>
                                  </div>
                                  {revealedCredentials.has(subscription.id) && subscription.credentials?.email && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={() => copyCredential(subscription.credentials!.email!, 'Email')}
                                    >
                                      {copiedCredential === 'Email' ? (
                                        <Check className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                              
                              {subscription.credentials.accountId && (
                                <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Key className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-muted-foreground flex-shrink-0">Account ID:</span>
                                    <span className="font-mono text-foreground truncate">
                                      {revealedCredentials.has(subscription.id) 
                                        ? subscription.credentials.accountId 
                                        : maskCredential(subscription.credentials.accountId)
                                      }
                                    </span>
                                  </div>
                                  {revealedCredentials.has(subscription.id) && subscription.credentials?.accountId && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={() => copyCredential(subscription.credentials!.accountId!, 'Account ID')}
                                    >
                                      {copiedCredential === 'Account ID' ? (
                                        <Check className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                              
                              {/* Password field */}
                              {subscription.credentials.password && (
                                <div className="flex items-center justify-between gap-2 p-2 bg-muted rounded-lg col-span-full">
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <Key className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    <span className="text-muted-foreground flex-shrink-0">Password:</span>
                                    <span className="font-mono text-foreground truncate">
                                      {revealedCredentials.has(subscription.id) 
                                        ? subscription.credentials.password 
                                        : maskCredential(subscription.credentials.password)
                                      }
                                    </span>
                                  </div>
                                  {revealedCredentials.has(subscription.id) && subscription.credentials?.password && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 flex-shrink-0"
                                      onClick={() => copyCredential(subscription.credentials!.password!, 'Password')}
                                    >
                                      {copiedCredential === 'Password' ? (
                                        <Check className="w-3 h-3 text-green-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
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
    </div>
  );
}