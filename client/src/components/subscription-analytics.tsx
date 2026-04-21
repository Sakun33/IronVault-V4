import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Target, AlertTriangle, DollarSign, PieChart as PieIcon, BarChart3, Settings, Globe } from 'lucide-react';
import { SubscriptionEntry, SUBSCRIPTION_CATEGORIES } from '@shared/schema';
import { useCurrency } from '@/contexts/currency-context';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionAnalyticsProps {
  subscriptions: SubscriptionEntry[];
  allSubscriptions?: SubscriptionEntry[];
  searchQuery?: string;
  categoryFilter?: string;
  statusFilter?: string;
}

// Color palette for charts
const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b',
  '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'
];

interface BudgetSettings {
  [category: string]: number;
}

interface CurrencySettings {
  baseCurrency: string;
  exchangeRates: { [currency: string]: number };
}

const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  baseCurrency: 'USD',
  exchangeRates: {
    'USD': 1.0,
    'EUR': 0.85,
    'GBP': 0.73,
    'CAD': 1.36,
    'AUD': 1.52,
    'JPY': 149.5,
  }
};

export function SubscriptionAnalytics({ 
  subscriptions, 
  allSubscriptions = [], 
  searchQuery = '', 
  categoryFilter = '', 
  statusFilter = '' 
}: SubscriptionAnalyticsProps) {
  const { currency, formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [budgetSettings, setBudgetSettings] = useState<BudgetSettings>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('subscription-budgets');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [currencySettings, setCurrencySettings] = useState<CurrencySettings>(() => {
    const saved = localStorage.getItem('subscription-currency-settings');
    return saved ? JSON.parse(saved) : DEFAULT_CURRENCY_SETTINGS;
  });
  
  const [viewMode, setViewMode] = useState<'overview' | 'categories' | 'trends'>('overview');
  const [chartType, setChartType] = useState<'pie' | 'donut' | 'bar' | 'horizontal'>('pie');

  // Currency conversion helper
  const convertToBaseCurrency = (amount: number, fromCurrency: string): number => {
    const fromRate = currencySettings.exchangeRates[fromCurrency] || 1;
    const baseCurrencyRate = currencySettings.exchangeRates[currencySettings.baseCurrency] || 1;
    // Convert from source currency to USD, then to base currency
    return (amount / fromRate) * baseCurrencyRate;
  };

  // Calculate category spending breakdown
  const categoryAnalytics = useMemo(() => {
    const activeSubscriptions = subscriptions.filter(s => s.isActive);
    const categoryData: { [key: string]: { monthly: number, yearly: number, count: number, subscriptions: SubscriptionEntry[] } } = {};
    
    // Initialize all predefined categories with zero spending
    SUBSCRIPTION_CATEGORIES.forEach(category => {
      categoryData[category] = { monthly: 0, yearly: 0, count: 0, subscriptions: [] };
    });
    
    activeSubscriptions.forEach(sub => {
      const category = sub.category || 'Other';
      
      // Initialize category if it doesn't exist (for dynamic categories from CSV)
      if (!categoryData[category]) {
        categoryData[category] = { monthly: 0, yearly: 0, count: 0, subscriptions: [] };
      }
      
      let monthlyAmount = sub.cost;
      
      // Normalize to monthly spending
      switch (sub.billingCycle) {
        case 'yearly':
          monthlyAmount /= 12;
          break;
        case 'weekly':
          monthlyAmount *= 4.33;
          break;
        case 'daily':
          monthlyAmount *= 30;
          break;
      }
      
      // Convert to base currency
      const convertedMonthlyAmount = convertToBaseCurrency(monthlyAmount, sub.currency);
      
      categoryData[category].monthly += convertedMonthlyAmount;
      categoryData[category].yearly += convertedMonthlyAmount * 12;
      categoryData[category].count += 1;
      categoryData[category].subscriptions.push(sub);
    });
    
    return categoryData;
  }, [subscriptions, currencySettings]);

  // Prepare chart data
  const pieChartData = useMemo(() => {
    return Object.entries(categoryAnalytics)
      .filter(([_, data]) => data.monthly > 0)
      .map(([category, data]) => ({
        name: category,
        value: data.monthly,
        count: data.count
      }))
      .sort((a, b) => b.value - a.value);
  }, [categoryAnalytics]);

  const barChartData = useMemo(() => {
    return Object.entries(categoryAnalytics)
      .filter(([_, data]) => data.monthly > 0)
      .map(([category, data]) => ({
        category: category.length > 10 ? category.slice(0, 10) + '...' : category,
        monthly: data.monthly,
        yearly: data.yearly,
        budget: budgetSettings[category] || 0,
        over: budgetSettings[category] ? Math.max(0, data.monthly - budgetSettings[category]) : 0
      }))
      .sort((a, b) => b.monthly - a.monthly);
  }, [categoryAnalytics, budgetSettings]);

  // Calculate total spending
  const totalSpending = useMemo(() => {
    const monthly = Object.values(categoryAnalytics).reduce((sum, data) => sum + data.monthly, 0);
    return {
      monthly,
      yearly: monthly * 12,
      totalBudget: Object.values(budgetSettings).reduce((sum, budget) => sum + budget, 0)
    };
  }, [categoryAnalytics, budgetSettings]);

  // Budget alerts
  const budgetAlerts = useMemo(() => {
    const alerts: { category: string, spending: number, budget: number, percentage: number }[] = [];
    
    Object.entries(categoryAnalytics).forEach(([category, data]) => {
      const budget = budgetSettings[category];
      if (budget && budget > 0 && data.monthly > 0) {
        const percentage = (data.monthly / budget) * 100;
        if (percentage >= 80) { // Alert at 80% or over budget
          alerts.push({
            category,
            spending: data.monthly,
            budget,
            percentage
          });
        }
      }
    });
    
    return alerts.sort((a, b) => b.percentage - a.percentage);
  }, [categoryAnalytics, budgetSettings]);

  const formatCurrencyLocal = (amount: number, currency?: string) => {
    const targetCurrency = currency || currencySettings.baseCurrency;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: targetCurrency,
    }).format(amount);
  };

  const saveBudgetSettings = (newBudgets: BudgetSettings) => {
    setBudgetSettings(newBudgets);
    localStorage.setItem('subscription-budgets', JSON.stringify(newBudgets));
    toast({
      title: "Budget Settings Saved",
      description: "Your budget limits have been updated successfully.",
    });
  };

  const saveCurrencySettings = (newSettings: CurrencySettings) => {
    setCurrencySettings(newSettings);
    localStorage.setItem('subscription-currency-settings', JSON.stringify(newSettings));
    toast({
      title: "Currency Settings Saved",
      description: "Your currency preferences have been updated successfully.",
    });
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.dataKey === 'monthly' ? 'Monthly' : 'Budget'}: ${formatCurrency(entry.value, currency)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header with View Mode Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Spending Analytics
          </h2>
          <p className="text-muted-foreground text-sm">
            Detailed insights into your subscription spending patterns
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
            <SelectTrigger className="w-32" data-testid="analytics-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="categories">Categories</SelectItem>
              <SelectItem value="trends">Trends</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={showBudgetModal} onOpenChange={setShowBudgetModal}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="budget-settings-button">
                <Settings className="w-4 h-4 mr-2" />
                Budgets
              </Button>
            </DialogTrigger>
            <BudgetSettingsModal 
              budgetSettings={budgetSettings} 
              onSave={saveBudgetSettings} 
              categoryAnalytics={categoryAnalytics}
            />
          </Dialog>
        </div>
      </div>

      {/* Budget Alerts */}
      {budgetAlerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4" />
              Budget Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {budgetAlerts.map(alert => (
                <div key={alert.category} className="flex justify-between items-center text-sm">
                  <span className="font-medium text-amber-800 dark:text-amber-200">
                    {alert.category}
                  </span>
                  <div className="text-right">
                    <span className={alert.percentage >= 100 ? 'text-red-600 font-medium' : 'text-amber-700 dark:text-amber-300'}>
                      {formatCurrency(alert.spending, currency)} / {formatCurrency(alert.budget, currency)}
                    </span>
                    <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                      ({Math.round(alert.percentage)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Mode */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Total Spending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Monthly</span>
                  <span className="text-2xl font-bold" data-testid="total-monthly-spending">
                    {formatCurrency(totalSpending.monthly, currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Yearly</span>
                  <span className="text-xl font-semibold text-muted-foreground">
                    {formatCurrency(totalSpending.yearly, currency)}
                  </span>
                </div>
                {totalSpending.totalBudget > 0 && (
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Budget Usage</span>
                      <span className={`font-medium ${
                        totalSpending.monthly > totalSpending.totalBudget 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {Math.round((totalSpending.monthly / totalSpending.totalBudget) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div 
                        className={`h-2 rounded-full ${
                          totalSpending.monthly > totalSpending.totalBudget 
                            ? 'bg-red-500' 
                            : 'bg-green-500'
                        }`}
                        style={{ 
                          width: `${Math.min(100, (totalSpending.monthly / totalSpending.totalBudget) * 100)}%` 
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Chart with Multiple Options */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <PieIcon className="w-5 h-5" />
                  Spending by Category
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={chartType === 'pie' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('pie')}
                    className="h-7 px-2 text-xs"
                  >
                    Pie
                  </Button>
                  <Button
                    variant={chartType === 'donut' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('donut')}
                    className="h-7 px-2 text-xs"
                  >
                    Donut
                  </Button>
                  <Button
                    variant={chartType === 'bar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('bar')}
                    className="h-7 px-2 text-xs"
                  >
                    Bar
                  </Button>
                  <Button
                    variant={chartType === 'horizontal' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('horizontal')}
                    className="h-7 px-2 text-xs"
                  >
                    H-Bar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  {chartType === 'pie' ? (
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                    </PieChart>
                  ) : chartType === 'donut' ? (
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        innerRadius={50}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                    </PieChart>
                  ) : chartType === 'bar' ? (
                    <BarChart data={pieChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={(value) => `$${value}`} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                      <Bar dataKey="value" fill="#6366f1">
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <BarChart data={pieChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                      <Bar dataKey="value" fill="#6366f1">
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No active subscriptions to analyze
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Categories Mode */}
      {viewMode === 'categories' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis tickFormatter={(value) => formatCurrency(value, currency)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="monthly" name="Monthly Spending" fill="#6366f1" />
                    <Bar dataKey="budget" name="Budget" fill="#e5e7eb" opacity={0.6} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                  No spending data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Category Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categoryAnalytics)
              .filter(([_, data]) => data.monthly > 0)
              .sort(([, a], [, b]) => b.monthly - a.monthly)
              .map(([category, data]) => {
                const budget = budgetSettings[category] || 0;
                const budgetUsage = budget > 0 ? (data.monthly / budget) * 100 : 0;
                
                return (
                  <Card key={category} className="relative">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">{category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Monthly</span>
                          <span className="font-semibold" data-testid={`category-${category}-monthly`}>
                            {formatCurrency(data.monthly, currency)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">Subscriptions</span>
                          <span className="text-sm">{data.count}</span>
                        </div>
                        {budget > 0 && (
                          <div className="pt-2 border-t">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs text-muted-foreground">Budget</span>
                              <span className={`text-xs ${budgetUsage >= 100 ? 'text-red-600' : budgetUsage >= 80 ? 'text-amber-600' : 'text-green-600'}`}>
                                {Math.round(budgetUsage)}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  budgetUsage >= 100 ? 'bg-red-500' : budgetUsage >= 80 ? 'bg-amber-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, budgetUsage)}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* Trends Mode */}
      {viewMode === 'trends' && (
        <Card>
          <CardHeader>
            <CardTitle>Spending Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Trend analysis coming soon!</p>
                <p className="text-sm">We're working on historical spending trends.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type BudgetSettingsModalProps = {
  budgetSettings: BudgetSettings;
  onSave: (budgets: BudgetSettings) => void;
  categoryAnalytics: Record<string, { monthly: number; yearly: number; count: number; subscriptions: SubscriptionEntry[] }>;
};

function BudgetSettingsModal(props: BudgetSettingsModalProps) {
  const { currency, formatCurrency } = useCurrency();
  const { budgetSettings, onSave, categoryAnalytics } = props;
  const [localBudgets, setLocalBudgets] = useState<BudgetSettings>(budgetSettings);

  const handleSave = () => {
    onSave(localBudgets);
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Target className="w-5 h-5" />
          Budget Settings
        </DialogTitle>
      </DialogHeader>

      <DialogBody className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set monthly budget limits for each category to track your spending goals.
        </p>
        
        <div className="space-y-4">
          {SUBSCRIPTION_CATEGORIES.map(category => {
            const currentSpending = categoryAnalytics[category]?.monthly || 0;
            const hasSpending = currentSpending > 0;
            
            return (
              <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <Label className="text-sm font-medium">{category}</Label>
                  {hasSpending && (
                    <p className="text-xs text-muted-foreground">
                      Current: {formatCurrency(currentSpending, currency)}
                    </p>
                  )}
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={localBudgets[category] || ''}
                    onChange={(e) => setLocalBudgets(prev => ({
                      ...prev,
                      [category]: parseFloat(e.target.value) || 0
                    }))}
                    className="text-right"
                    data-testid={`budget-input-${category}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => setLocalBudgets({})}
          data-testid="clear-budgets-button"
        >
          Clear All
        </Button>
        <Button onClick={handleSave} data-testid="save-budgets-button">
          Save Budgets
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}