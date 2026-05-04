import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart,
  BarChart3,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Calendar,
  Building2,
  Coins,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react';
import { useCurrency } from '@/contexts/currency-context';
import { useLogging } from '@/contexts/logging-context';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isWithinInterval, subDays, startOfDay } from 'date-fns';
import { 
  Investment, 
  InvestmentGoal,
  InvestmentPerformance,
  INVESTMENT_TYPES,
  INVESTMENT_GOAL_CATEGORIES 
} from '@shared/schema';
import { AddInvestmentModal } from '@/components/add-investment-modal';
import { EditInvestmentModal } from '@/components/edit-investment-modal';
import { ListSkeleton } from '@/components/list-skeleton';

export default function Investments() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();

  const [, setLocation] = useLocation();
  const vaultContext = useVault();
  const currencyContext = useCurrency();
  const loggingContext = useLogging();
  const toastContext = useToast();

    if (!vaultContext) {
      return <div className="p-6 text-red-500">Vault context error</div>;
    }

    if (!currencyContext) {
      return <div className="p-6 text-red-500">Currency context error</div>;
    }

    if (!loggingContext) {
      return <div className="p-6 text-red-500">Logging context error</div>;
    }

    if (!toastContext) {
      return <div className="p-6 text-red-500">Toast context error</div>;
    }

    const { investments, investmentGoals, addInvestment, addInvestmentGoal, deleteInvestment, deleteInvestmentGoal, updateInvestment, updateInvestmentGoal, bulkDeleteInvestments, isLoading } = vaultContext;
    const { formatCurrency } = currencyContext;
    const { addLog } = loggingContext;
    const { toast } = toastContext;
    
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showAddGoalModal, setShowAddGoalModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState<InvestmentGoal | null>(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [deleteTargetInvestment, setDeleteTargetInvestment] = useState<{ id: string; name: string } | null>(null);
    const [deleteTargetGoal, setDeleteTargetGoal] = useState<{ id: string; name: string } | null>(null);
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

    // Calculate portfolio analytics
    const portfolioAnalytics = useMemo(() => {
      const filteredInvestments = investments.filter(inv => {
        const matchesSearch = searchQuery === '' ||
          inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.ticker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.institution?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesType = typeFilter === 'all' || inv.type === typeFilter;
        const matchesStatus = statusFilter === 'all' || 
          (statusFilter === 'active' && inv.isActive) ||
          (statusFilter === 'inactive' && !inv.isActive);

        return matchesSearch && matchesType && matchesStatus;
      });

      const totalInvested = filteredInvestments.reduce((sum, inv) => 
        sum + (inv.purchasePrice * inv.quantity), 0);
      
      const totalCurrentValue = filteredInvestments.reduce((sum, inv) => 
        sum + (inv.currentValue || (inv.currentPrice || inv.purchasePrice) * inv.quantity), 0);
      
      const totalGainLoss = totalCurrentValue - totalInvested;
      const totalReturnPercentage = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

      // Asset allocation
      const assetAllocation = filteredInvestments.reduce((acc, inv) => {
        const currentValue = inv.currentValue || (inv.currentPrice || inv.purchasePrice) * inv.quantity;
        const typeInfo = INVESTMENT_TYPES.find(t => t.value === inv.type);
        const typeLabel = typeInfo?.label || inv.type;
        
        if (!acc[typeLabel]) {
          acc[typeLabel] = { value: 0, count: 0, investments: [] };
        }
        acc[typeLabel].value += currentValue;
        acc[typeLabel].count += 1;
        acc[typeLabel].investments.push(inv);
        return acc;
      }, {} as Record<string, { value: number; count: number; investments: Investment[] }>);

      // Performance analysis
      const bestPerformer = filteredInvestments.reduce((best, inv) => {
        const currentValue = inv.currentValue || (inv.currentPrice || inv.purchasePrice) * inv.quantity;
        const invested = inv.purchasePrice * inv.quantity;
        const returnPct = ((currentValue - invested) / invested) * 100;
        
        if (!best || returnPct > best.returnPct) {
          return { investment: inv, returnPct };
        }
        return best;
      }, null as { investment: Investment; returnPct: number } | null);

      const worstPerformer = filteredInvestments.reduce((worst, inv) => {
        const currentValue = inv.currentValue || (inv.currentPrice || inv.purchasePrice) * inv.quantity;
        const invested = inv.purchasePrice * inv.quantity;
        const returnPct = ((currentValue - invested) / invested) * 100;
        
        if (!worst || returnPct < worst.returnPct) {
          return { investment: inv, returnPct };
        }
        return worst;
      }, null as { investment: Investment; returnPct: number } | null);

      const analytics = {
        totalInvested,
        totalCurrentValue,
        totalGainLoss,
        totalReturnPercentage,
        assetAllocation,
        bestPerformer,
        worstPerformer,
        investmentCount: filteredInvestments.length
      };

      return analytics;
    }, [investments, searchQuery, typeFilter, statusFilter]);

    // Calculate portfolio analytics

    const handleInvestmentAdded = () => {
      toast({
        title: "Investment Added",
        description: "Your investment has been added to the portfolio.",
      });
    };

    const handleEditInvestment = (investment: Investment) => {
      setEditingInvestment(investment);
      setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
      setEditingInvestment(null);
      setIsEditModalOpen(false);
    };

    const handleInvestmentUpdated = () => {
      toast({
        title: "Investment Updated",
        description: "Your investment has been updated successfully.",
      });
    };

    const handleDeleteInvestment = (id: string, name: string) => {
      setDeleteTargetInvestment({ id, name });
    };

    const confirmDeleteInvestment = async () => {
      if (!deleteTargetInvestment) return;
      const { id, name } = deleteTargetInvestment;
      setDeleteTargetInvestment(null);
      try {
        await deleteInvestment(id);
        addLog('Investment deleted', 'system', `Deleted investment: ${name}`);
        toast({ variant: 'success', title: "Investment Deleted", description: `"${name}" has been removed from your portfolio.` });
      } catch (error) {
        console.error('Failed to delete investment:', error);
        toast({ title: "Error", description: "Failed to delete investment. Please try again.", variant: "destructive" });
      }
    };

    const handleAddSampleData = () => {
    const sampleInvestments = [
      {
        name: 'Apple Inc. (AAPL)',
        type: 'stocks' as const,
        institution: 'Robinhood',
        ticker: 'AAPL',
        purchaseDate: new Date('2024-01-15'),
        purchasePrice: 150.00,
        quantity: 10,
        currentPrice: 175.00,
        currentValue: 1750.00,
        currency: 'USD',
        notes: 'Tech stock investment',
        tags: ['tech', 'growth'],
        isActive: true,
        fees: 0
      },
      {
        name: 'S&P 500 Index Fund',
        type: 'mutual_fund' as const,
        institution: 'Vanguard',
        purchaseDate: new Date('2024-01-01'),
        purchasePrice: 100.00,
        quantity: 100,
        currentPrice: 108.00,
        currentValue: 10800.00,
        currency: 'USD',
        notes: 'Diversified index fund',
        tags: ['index', 'diversified'],
        isActive: true,
        fees: 0
      },
      {
        name: 'Bitcoin',
        type: 'crypto' as const,
        institution: 'Coinbase',
        ticker: 'BTC',
        purchaseDate: new Date('2024-02-01'),
        purchasePrice: 40000.00,
        quantity: 0.05,
        currentPrice: 50000.00,
        currentValue: 2500.00,
        currency: 'USD',
        notes: 'Cryptocurrency investment',
        tags: ['crypto', 'volatile'],
        isActive: true,
        fees: 0
      }
    ];

    sampleInvestments.forEach(investment => {
      addInvestment(investment);
    });

    toast({
      title: "Sample Data Added",
      description: "Added 3 sample investments to help you get started.",
    });
  };

  const handleExportData = () => {
    addLog('Export data initiated', 'system', 'User requested data export');
    
    try {
      // Prepare investment data for export
      const exportData = {
        exportDate: new Date().toISOString(),
        summary: {
          totalInvested: portfolioAnalytics.totalInvested,
          totalCurrentValue: portfolioAnalytics.totalCurrentValue,
          totalGainLoss: portfolioAnalytics.totalGainLoss,
          totalReturnPercentage: portfolioAnalytics.totalReturnPercentage,
          investmentCount: portfolioAnalytics.investmentCount
        },
        investments: investments.map(inv => ({
          name: inv.name,
          type: inv.type,
          ticker: inv.ticker || '',
          institution: inv.institution || '',
          purchaseDate: inv.purchaseDate,
          purchasePrice: inv.purchasePrice,
          quantity: inv.quantity,
          currentPrice: inv.currentPrice || inv.purchasePrice,
          currentValue: inv.currentValue || (inv.currentPrice || inv.purchasePrice) * inv.quantity,
          gainLoss: (inv.currentValue || (inv.currentPrice || inv.purchasePrice) * inv.quantity) - (inv.purchasePrice * inv.quantity),
          isActive: inv.isActive
        })),
        goals: investmentGoals.map(goal => ({
          name: goal.name,
          description: goal.description,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          targetDate: goal.targetDate,
          priority: goal.priority,
          category: goal.category,
          progress: ((goal.currentAmount / goal.targetAmount) * 100).toFixed(2) + '%',
          isAchieved: goal.isAchieved
        }))
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `investment-portfolio-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Your investment data has been exported successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export investment data. Please try again.",
        variant: "destructive",
      });
    }
  };

    // Calculate goal analytics
    const goalAnalytics = useMemo(() => {
      if (!investmentGoals || investmentGoals.length === 0) {
        return {
          totalTargetAmount: 0,
          totalCurrentAmount: 0,
          totalProgress: 0,
          achievedGoals: 0,
          activeGoals: 0,
          upcomingGoals: []
        };
      }

      const totalTargetAmount = investmentGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
      const totalCurrentAmount = investmentGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
      const totalProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;
      
      const achievedGoals = investmentGoals.filter(goal => goal.isAchieved).length;
      const activeGoals = investmentGoals.filter(goal => !goal.isAchieved).length;
      
      const upcomingGoals = investmentGoals
        .filter(goal => !goal.isAchieved)
        .sort((a, b) => {
          const dateA = a.targetDate instanceof Date ? a.targetDate : new Date(a.targetDate);
          const dateB = b.targetDate instanceof Date ? b.targetDate : new Date(b.targetDate);
          return dateA.getTime() - dateB.getTime();
        })
        .slice(0, 3);

      return {
        totalTargetAmount,
        totalCurrentAmount,
        totalProgress,
        achievedGoals,
        activeGoals,
        upcomingGoals
      };
    }, [investmentGoals]);

    // Goal management functions
    const handleAddGoal = async (goalData: Omit<InvestmentGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        await addInvestmentGoal(goalData);
        addLog(`Goal added: ${goalData.name}`, 'system', 'User added new investment goal');
        toast({
          title: "Goal Added",
          description: `Successfully added goal: ${goalData.name}`,
        });
        setShowAddGoalModal(false);
      } catch (error) {
        console.error('Error adding goal:', error);
        toast({
          title: "Error",
          description: "Failed to add goal. Please try again.",
          variant: "destructive",
        });
      }
    };

    const handleEditGoal = (goal: InvestmentGoal) => {
      setEditingGoal(goal);
    };

    const handleUpdateGoal = async (goalData: Partial<InvestmentGoal>) => {
      if (!editingGoal) return;
      try {
        await updateInvestmentGoal(editingGoal.id, goalData);
        addLog(`Goal updated: ${editingGoal.name}`, 'system', 'User updated investment goal');
        toast({
          title: "Goal Updated",
          description: `Successfully updated goal: ${editingGoal.name}`,
        });
        setEditingGoal(null);
      } catch (error) {
        console.error('Error updating goal:', error);
        toast({
          title: "Error",
          description: "Failed to update goal. Please try again.",
          variant: "destructive",
        });
      }
    };

    const handleDeleteGoal = (id: string, name: string) => {
      setDeleteTargetGoal({ id, name });
    };

    const confirmDeleteGoal = async () => {
      if (!deleteTargetGoal) return;
      const { id, name } = deleteTargetGoal;
      setDeleteTargetGoal(null);
      try {
        await deleteInvestmentGoal(id);
        addLog(`Goal deleted: ${name}`, 'system', 'User deleted investment goal');
        toast({ variant: 'success', title: "Goal Deleted", description: `Successfully deleted goal: ${name}` });
      } catch (error) {
        console.error('Error deleting goal:', error);
        toast({ title: "Error", description: "Failed to delete goal. Please try again.", variant: "destructive" });
      }
    };

    // Investment management functions

    const getGoalPriorityColor = (priority: string) => {
      const colors: Record<string, string> = {
        'high': 'bg-red-100 text-red-800',
        'medium': 'bg-yellow-100 text-yellow-800',
        'low': 'bg-green-100 text-green-800',
      };
      return colors[priority] || colors['medium'];
    };

    const calculateGoalProgress = (goal: InvestmentGoal) => {
      return goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    };

    const getDaysUntilGoal = (targetDate: Date | string) => {
      const today = new Date();
      const date = targetDate instanceof Date ? targetDate : new Date(targetDate);
      const diffTime = date.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getInvestmentTypeIcon = (type: string) => {
      const typeInfo = INVESTMENT_TYPES.find(t => t.value === type);
      return typeInfo?.icon || '📦';
    };

    const getInvestmentTypeColor = (type: string) => {
      const colors: Record<string, string> = {
        'stocks': 'bg-primary/10 text-primary',
        'crypto': 'bg-orange-100 text-orange-800',
        'fixed_deposit': 'bg-green-100 text-green-800',
        'mutual_fund': 'bg-purple-100 text-purple-800',
        'bonds': 'bg-yellow-100 text-yellow-800',
        'nft': 'bg-pink-100 text-pink-800',
        'futures': 'bg-red-100 text-red-800',
        'debt': 'bg-muted text-muted-foreground',
        'real_estate': 'bg-indigo-100 text-indigo-800',
        'other': 'bg-muted text-muted-foreground',
      };
      return colors[type] || colors['other'];
    };


    if (!licenseLoading && !isFeatureAvailable('investments')) return <UpgradeGate feature="Investments" />;

    return (
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Investments</h1>
            <p className="text-muted-foreground text-sm">Track your portfolio</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setLocation('/goals')} title="Goals">
              <Target className="w-4 h-4 mr-1" />
              Goals
            </Button>
            <AddInvestmentModal onInvestmentAdded={handleInvestmentAdded} />
            <Button variant="outline" size="sm" onClick={handleExportData} title="Export">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Portfolio Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(portfolioAnalytics.totalInvested, 'USD')}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-primary/70" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(portfolioAnalytics.totalCurrentValue, 'USD')}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500/70" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
                <p className={`text-2xl font-bold ${portfolioAnalytics.totalGainLoss >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {portfolioAnalytics.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.totalGainLoss, 'USD')}
                </p>
              </div>
              {portfolioAnalytics.totalGainLoss >= 0 ? (
                <TrendingUp className="w-8 h-8 text-primary/70" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500/70" />
              )}
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p className={`text-2xl font-bold ${portfolioAnalytics.totalReturnPercentage >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {portfolioAnalytics.totalReturnPercentage >= 0 ? '+' : ''}{portfolioAnalytics.totalReturnPercentage.toFixed(2)}%
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-primary/70" />
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="rounded-2xl shadow-sm border-0 bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Search investments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex items-center gap-2"
              />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {INVESTMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Status" />
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

        {/* Goal Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Goal Progress</p>
                <p className="text-2xl font-bold text-foreground">
                  {goalAnalytics.totalProgress.toFixed(1)}%
                </p>
              </div>
              <Award className="w-8 h-8 text-primary/70" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Goals</p>
                <p className="text-2xl font-bold text-foreground">
                  {goalAnalytics.activeGoals}
                </p>
              </div>
              <Clock className="w-8 h-8 text-primary/70" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Achieved Goals</p>
                <p className="text-2xl font-bold text-primary">
                  {goalAnalytics.achievedGoals}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-primary/70" />
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Target</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(goalAnalytics.totalTargetAmount, 'USD')}
                </p>
              </div>
              <Award className="w-8 h-8 text-primary/70" />
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="investments">Investments</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Asset Allocation */}
            <Card className="rounded-2xl shadow-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  Asset Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(portfolioAnalytics.assetAllocation)
                    .sort(([,a], [,b]) => b.value - a.value)
                    .map(([type, data]) => (
                      <div key={type} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getInvestmentTypeIcon(data.investments[0]?.type || 'other')}</span>
                          <div>
                            <p className="font-medium">{type}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.count} investment{data.count !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(data.value, 'USD')}</p>
                          <p className="text-xs text-muted-foreground">
                            {((data.value / portfolioAnalytics.totalCurrentValue) * 100).toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl shadow-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <TrendingUp className="w-5 h-5" />
                    Best Performer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolioAnalytics.bestPerformer ? (
                    <div className="space-y-2">
                      <p className="font-semibold">{portfolioAnalytics.bestPerformer.investment.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {portfolioAnalytics.bestPerformer.investment.ticker}
                      </p>
                      <p className="text-lg font-bold text-primary">
                        +{portfolioAnalytics.bestPerformer.returnPct.toFixed(2)}%
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No investments found</p>
                  )}
                </CardContent>
              </Card>
              <Card className="rounded-2xl shadow-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-600">
                    <TrendingDown className="w-5 h-5" />
                    Worst Performer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {portfolioAnalytics.worstPerformer ? (
                    <div className="space-y-2">
                      <p className="font-semibold">{portfolioAnalytics.worstPerformer.investment.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {portfolioAnalytics.worstPerformer.investment.ticker}
                      </p>
                      <p className="text-lg font-bold text-red-600">
                        {portfolioAnalytics.worstPerformer.returnPct.toFixed(2)}%
                      </p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No investments found</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Upcoming Goals */}
            <Card className="rounded-2xl shadow-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Upcoming Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {goalAnalytics.upcomingGoals.length > 0 ? (
                    goalAnalytics.upcomingGoals.map(goal => (
                      <div key={goal.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold">{goal.name}</p>
                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                          </div>
                          <Badge className={getGoalPriorityColor(goal.priority)}>
                            {goal.priority}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{formatCurrency(goal.currentAmount, 'USD')} / {formatCurrency(goal.targetAmount, 'USD')}</span>
                            <span>{calculateGoalProgress(goal).toFixed(1)}%</span>
                          </div>
                          <Progress value={calculateGoalProgress(goal)} className="h-2" />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Target: {format(goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate), 'MMM d, yyyy')}</span>
                            <span>{getDaysUntilGoal(goal.targetDate)} days left</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No upcoming goals</p>
                      <p className="text-sm">Create your first goal to get started</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Investments Tab */}
          <TabsContent value="investments" className="space-y-6">
            <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Investment Portfolio</CardTitle>
                {investments.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    data-testid="button-bulk-delete-investments"
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete All ({investments.length})
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isLoading && investments.length === 0 ? (
                  <div className="p-6">
                    <ListSkeleton rows={5} showHeader={false} />
                  </div>
                ) : null}
                <div>
                  {investments
                    .filter(inv => {
                      const matchesSearch = searchQuery === '' ||
                        inv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        inv.ticker?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        inv.institution?.toLowerCase().includes(searchQuery.toLowerCase());

                      const matchesType = typeFilter === 'all' || inv.type === typeFilter;
                      const matchesStatus = statusFilter === 'all' || 
                        (statusFilter === 'active' && inv.isActive) ||
                        (statusFilter === 'inactive' && !inv.isActive);

                      return matchesSearch && matchesType && matchesStatus;
                    })
                    .sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0))
                    .map((investment, idx, arr) => {
                      const currentValue = investment.currentValue || (investment.currentPrice || investment.purchasePrice) * investment.quantity;
                      const invested = investment.purchasePrice * investment.quantity;
                      const gainLoss = currentValue - invested;
                      const returnPct = (gainLoss / invested) * 100;

                      return (
                        <div key={investment.id} className={`p-4 hover:bg-muted/50 active:bg-muted transition-colors${idx < arr.length - 1 ? ' border-b border-border/50' : ''}`}>
                          <div className="flex flex-col gap-3">
                            {/* Top row: Info and Value */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-2xl flex-shrink-0">{getInvestmentTypeIcon(investment.type)}</span>
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{investment.name}</p>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                                    {investment.ticker && (
                                      <span className="truncate">{investment.ticker}</span>
                                    )}
                                    {investment.ticker && <span>•</span>}
                                    <span className="truncate">{investment.institution}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-semibold">
                                  {formatCurrency(currentValue, 'USD')}
                                </p>
                                <p className={`text-xs ${gainLoss >= 0 ? 'text-primary' : 'text-destructive'}`}>
                                  {gainLoss >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            {/* Bottom row: Badge and Actions */}
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`text-xs ${getInvestmentTypeColor(investment.type)}`}>
                                {INVESTMENT_TYPES.find(t => t.value === investment.type)?.label}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground mr-2">
                                  Inv: {formatCurrency(invested, 'USD')}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditInvestment(investment)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteInvestment(investment.id, investment.name)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold">Investment Goals</h2>
                <p className="text-muted-foreground">Set and track your financial goals</p>
              </div>
              <Button onClick={() => setShowAddGoalModal(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Goal
              </Button>
            </div>
            
            <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
              <CardHeader>
                <CardTitle>Your Goals</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div>
                  {investmentGoals && investmentGoals.length > 0 ? (
                    investmentGoals
                      .sort((a, b) => {
                        if (a.isAchieved !== b.isAchieved) {
                          return a.isAchieved ? 1 : -1;
                        }
                        const dateA = a.targetDate instanceof Date ? a.targetDate : new Date(a.targetDate);
                        const dateB = b.targetDate instanceof Date ? b.targetDate : new Date(b.targetDate);
                        return dateA.getTime() - dateB.getTime();
                      })
                      .map((goal, idx, arr) => (
                        <div key={goal.id} className={`p-4 hover:bg-muted/50 active:bg-muted transition-colors${idx < arr.length - 1 ? ' border-b border-border/50' : ''}`}>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              {goal.isAchieved ? (
                                <CheckCircle className="w-6 h-6 text-primary" />
                              ) : (
                                <Award className="w-6 h-6 text-primary" />
                              )}
                              <div>
                                <p className="font-semibold">{goal.name}</p>
                                <p className="text-sm text-muted-foreground">{goal.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getGoalPriorityColor(goal.priority)}>
                                {goal.priority}
                              </Badge>
                              <Badge variant="outline">
                                {goal.category}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditGoal(goal)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteGoal(goal.id, goal.name)}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{formatCurrency(goal.currentAmount, 'USD')} / {formatCurrency(goal.targetAmount, 'USD')}</span>
                              <span>{calculateGoalProgress(goal).toFixed(1)}%</span>
                            </div>
                            <Progress value={calculateGoalProgress(goal)} className="h-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Target: {format(goal.targetDate instanceof Date ? goal.targetDate : new Date(goal.targetDate), 'MMM d, yyyy')}</span>
                              {!goal.isAchieved && (
                                <span>{getDaysUntilGoal(goal.targetDate)} days left</span>
                              )}
                              {goal.isAchieved && goal.achievedDate && (
                                <span>Achieved: {format(goal.achievedDate instanceof Date ? goal.achievedDate : new Date(goal.achievedDate), 'MMM d, yyyy')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No goals yet</p>
                      <p className="text-sm">Create your first goal to get started</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl shadow-sm border-border/50">
                <CardHeader>
                  <CardTitle>Goal Statistics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>Active Goals</span>
                    <span className="font-semibold">{goalAnalytics.activeGoals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Achieved Goals</span>
                    <span className="font-semibold text-primary">{goalAnalytics.achievedGoals}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-2xl shadow-sm border-border/50">
                <CardHeader>
                  <CardTitle>Portfolio Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span>Total Return</span>
                      <span className={`font-semibold ${portfolioAnalytics.totalReturnPercentage >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {portfolioAnalytics.totalReturnPercentage >= 0 ? '+' : ''}{portfolioAnalytics.totalReturnPercentage.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Gain/Loss</span>
                      <span className={`font-semibold ${portfolioAnalytics.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolioAnalytics.totalGainLoss >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.totalGainLoss, 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Investment Count</span>
                      <span className="font-semibold">{portfolioAnalytics.investmentCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Add Goal Modal */}
        <Dialog open={showAddGoalModal} onOpenChange={setShowAddGoalModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Investment Goal</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="goalName">Goal Name</Label>
                  <Input id="goalName" placeholder="e.g., Retirement Fund" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goalCategory">Category</Label>
                  <Select>
                    <SelectTrigger id="goalCategory">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retirement">Retirement</SelectItem>
                      <SelectItem value="education">Education</SelectItem>
                      <SelectItem value="home">Home Purchase</SelectItem>
                      <SelectItem value="emergency">Emergency Fund</SelectItem>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalDescription">Description</Label>
                <Textarea id="goalDescription" placeholder="Describe your goal..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetAmount">Target Amount</Label>
                  <Input id="targetAmount" type="number" placeholder="100000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentAmount">Current Amount</Label>
                  <Input id="currentAmount" type="number" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="targetDate">Target Date</Label>
                  <Input id="targetDate" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select>
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddGoalModal(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                const goalNameInput = document.getElementById('goalName') as HTMLInputElement;
                const goalCategorySelect = document.querySelector('#goalCategory') as HTMLSelectElement;
                const goalDescriptionTextarea = document.getElementById('goalDescription') as HTMLTextAreaElement;
                const targetAmountInput = document.getElementById('targetAmount') as HTMLInputElement;
                const currentAmountInput = document.getElementById('currentAmount') as HTMLInputElement;
                const targetDateInput = document.getElementById('targetDate') as HTMLInputElement;
                const prioritySelect = document.querySelector('#priority') as HTMLSelectElement;
                if (goalNameInput?.value && targetAmountInput?.value && targetDateInput?.value) {
                  const goalData = { name: goalNameInput.value, category: goalCategorySelect?.value || 'other', description: goalDescriptionTextarea?.value || '', targetAmount: parseFloat(targetAmountInput.value), currentAmount: parseFloat(currentAmountInput?.value || '0'), targetDate: new Date(targetDateInput.value), priority: (prioritySelect?.value || 'medium') as 'low' | 'medium' | 'high', currency: 'USD', investmentIds: [], isAchieved: false };
                  handleAddGoal(goalData);
                } else {
                  toast({ title: "Error", description: "Please fill in all required fields (Name, Target Amount, Target Date).", variant: "destructive" });
                }
              }}>
                Add Goal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Goal Modal */}
        {editingGoal && (
          <Dialog open={!!editingGoal} onOpenChange={() => setEditingGoal(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Investment Goal</DialogTitle>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editGoalName">Goal Name</Label>
                    <Input id="editGoalName" defaultValue={editingGoal.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editGoalCategory">Category</Label>
                    <Select defaultValue={editingGoal.category}>
                      <SelectTrigger id="editGoalCategory">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retirement">Retirement</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="home">Home Purchase</SelectItem>
                        <SelectItem value="emergency">Emergency Fund</SelectItem>
                        <SelectItem value="vacation">Vacation</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editGoalDescription">Description</Label>
                  <Textarea id="editGoalDescription" defaultValue={editingGoal.description} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editTargetAmount">Target Amount</Label>
                    <Input id="editTargetAmount" type="number" defaultValue={editingGoal.targetAmount} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCurrentAmount">Current Amount</Label>
                    <Input id="editCurrentAmount" type="number" defaultValue={editingGoal.currentAmount} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editTargetDate">Target Date</Label>
                    <Input 
                      id="editTargetDate" 
                      type="date" 
                      defaultValue={editingGoal.targetDate instanceof Date ? editingGoal.targetDate.toISOString().split('T')[0] : new Date(editingGoal.targetDate).toISOString().split('T')[0]} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editPriority">Priority</Label>
                    <Select defaultValue={editingGoal.priority}>
                      <SelectTrigger id="editPriority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingGoal(null)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  const goalNameInput = document.getElementById('editGoalName') as HTMLInputElement;
                  const goalCategorySelect = document.querySelector('#editGoalCategory') as HTMLSelectElement;
                  const goalDescriptionTextarea = document.getElementById('editGoalDescription') as HTMLTextAreaElement;
                  const targetAmountInput = document.getElementById('editTargetAmount') as HTMLInputElement;
                  const currentAmountInput = document.getElementById('editCurrentAmount') as HTMLInputElement;
                  const targetDateInput = document.getElementById('editTargetDate') as HTMLInputElement;
                  const prioritySelect = document.querySelector('#editPriority') as HTMLSelectElement;
                  if (goalNameInput?.value && targetAmountInput?.value && targetDateInput?.value) {
                    const goalData = { name: goalNameInput.value, category: goalCategorySelect?.value || editingGoal?.category || 'other', description: goalDescriptionTextarea?.value || '', targetAmount: parseFloat(targetAmountInput.value), currentAmount: parseFloat(currentAmountInput?.value || '0'), targetDate: new Date(targetDateInput.value), priority: (prioritySelect?.value || 'medium') as 'low' | 'medium' | 'high' };
                    handleUpdateGoal(goalData);
                  } else {
                    toast({ title: "Error", description: "Please fill in all required fields (Name, Target Amount, Target Date).", variant: "destructive" });
                  }
                }}>
                  Update Goal
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <EditInvestmentModal
          investment={editingInvestment}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onInvestmentUpdated={handleInvestmentUpdated}
        />

        <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all {investments.length} investment{investments.length === 1 ? '' : 's'}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete every investment in your portfolio. Investment goals are kept. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const ids = investments.map((inv) => inv.id);
                  const removed = await bulkDeleteInvestments(ids);
                  setShowBulkDeleteConfirm(false);
                  toast({ variant: 'success', title: 'Deleted', description: `${removed} investment${removed === 1 ? '' : 's'} removed.` });
                  addLog('Investments Cleared', 'security', `Bulk-deleted ${removed} investments`);
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTargetInvestment} onOpenChange={(open) => { if (!open) setDeleteTargetInvestment(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete investment?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTargetInvestment?.name}" will be permanently removed from your portfolio. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteInvestment} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteTargetGoal} onOpenChange={(open) => { if (!open) setDeleteTargetGoal(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete goal?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTargetGoal?.name}" will be permanently deleted. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeleteGoal} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
}