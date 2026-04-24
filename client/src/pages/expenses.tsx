import { useState, useMemo, useEffect, useCallback } from 'react';
import { useFormDefaults } from '@/hooks/use-form-defaults';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { useVault } from '@/contexts/vault-context';
import { useCurrency } from '@/contexts/currency-context';
import { ExpenseEntry, EXPENSE_CATEGORIES } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  DollarSign, 
  Tag, 
  Calendar, 
  Filter,
  PieChart as PieIcon,
  BarChart3,
  TrendingUp,
  Receipt,
  Archive,
  Repeat,
  AlertCircle,
  LayoutTemplate,
  Coffee,
  Car,
  ShoppingCart,
  Utensils,
  Home,
  Zap,
  Phone,
  Plane
} from 'lucide-react';
import { format, isSameMonth } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Color palette for charts
const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316', '#6b7280'];

export default function Expenses() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();
  const { expenses, addExpense, updateExpense, deleteExpense, searchQuery, setSearchQuery } = useVault();
  const { formatCurrency, currency, currencies } = useCurrency();
  const { toast } = useToast();
  const { lastExpenseCategory, saveExpenseCategory } = useFormDefaults();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'categories' | 'trends'>('overview');
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'week' | 'year'>('all');
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<{id: string; title: string} | null>(null);
  const [pendingDuplicateExpense, setPendingDuplicateExpense] = useState<{expense: any; message: string} | null>(null);

  // Expense Templates - More practical with common expenses
  const EXPENSE_TEMPLATES = [
    { id: 'groceries', name: 'Groceries', icon: ShoppingCart, category: 'Food & Dining', amount: '', notes: 'Weekly grocery shopping' },
    { id: 'dining', name: 'Restaurant', icon: Utensils, category: 'Food & Dining', amount: '', notes: 'Dining out' },
    { id: 'coffee', name: 'Coffee/Snacks', icon: Coffee, category: 'Food & Dining', amount: '5.00', notes: '' },
    { id: 'gas', name: 'Gas/Fuel', icon: Car, category: 'Transportation', amount: '', notes: 'Vehicle fuel' },
    { id: 'uber', name: 'Uber/Taxi', icon: Car, category: 'Transportation', amount: '', notes: 'Ride share' },
    { id: 'parking', name: 'Parking', icon: Car, category: 'Transportation', amount: '', notes: '' },
    { id: 'rent', name: 'Rent/Mortgage', icon: Home, category: 'Housing', amount: '', isRecurring: true, notes: 'Monthly rent payment' },
    { id: 'electricity', name: 'Electricity', icon: Zap, category: 'Bills & Utilities', amount: '', isRecurring: true, notes: 'Monthly electric bill' },
    { id: 'water', name: 'Water Bill', icon: Home, category: 'Bills & Utilities', amount: '', isRecurring: true, notes: '' },
    { id: 'internet', name: 'Internet', icon: Phone, category: 'Bills & Utilities', amount: '', isRecurring: true, notes: 'Monthly internet' },
    { id: 'phone', name: 'Phone Bill', icon: Phone, category: 'Bills & Utilities', amount: '', isRecurring: true, notes: 'Mobile phone plan' },
    { id: 'insurance', name: 'Insurance', icon: Home, category: 'Insurance', amount: '', isRecurring: true, notes: '' },
    { id: 'medical', name: 'Medical/Health', icon: Home, category: 'Healthcare', amount: '', notes: 'Doctor visit / Medicine' },
    { id: 'gym', name: 'Gym Membership', icon: Home, category: 'Health & Fitness', amount: '', isRecurring: true, notes: '' },
    { id: 'shopping', name: 'Online Shopping', icon: ShoppingCart, category: 'Shopping', amount: '', notes: '' },
    { id: 'subscription', name: 'Subscription', icon: Repeat, category: 'Subscriptions', amount: '', isRecurring: true, notes: '' },
    { id: 'travel', name: 'Travel/Vacation', icon: Plane, category: 'Travel', amount: '', notes: '' },
    { id: 'entertainment', name: 'Entertainment', icon: Receipt, category: 'Entertainment', amount: '', notes: 'Movies, events, etc.' },
  ];

  const handleUseTemplate = (template: typeof EXPENSE_TEMPLATES[0]) => {
    setFormData({
      title: template.name,
      amount: template.amount || '',
      currency: currency,
      category: template.category,
      date: new Date().toISOString().split('T')[0],
      notes: '',
      isRecurring: template.isRecurring || false,
      recurringFrequency: 'monthly',
      nextDueDate: '',
      tags: [],
    });
    setShowTemplatesModal(false);
    setShowAddModal(true);
  };

  // Form state for add/edit modal
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    currency: currency, // Use user's selected currency as default
    category: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    isRecurring: false,
    recurringFrequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'yearly',
    nextDueDate: '',
    tags: [] as string[],
  });
  
  const [newTag, setNewTag] = useState('');

  // Reset form when modal opens for adding new expense
  useEffect(() => {
    if (showAddModal && !editingExpense) {
      setFormData({
        title: '',
        amount: '',
        currency: currency,
        category: lastExpenseCategory,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        isRecurring: false,
        recurringFrequency: 'monthly',
        nextDueDate: '',
        tags: [],
      });
      setNewTag('');
    }
  }, [showAddModal, editingExpense, currency]);

  // Get all unique tags from expenses
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    expenses.forEach(expense => {
      if (expense.tags && Array.isArray(expense.tags)) {
        expense.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [expenses]);

  // Filter expenses based on various criteria
  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      // Search filter
      const matchesSearch = !searchQuery || 
        expense.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (expense.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      // Category filter
      const matchesCategory = selectedCategory === 'all' || expense.category === selectedCategory;
      
      // Tag filter
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => (expense.tags || []).includes(tag));

      // Recurring filter
      const matchesRecurring = !showRecurringOnly || expense.isRecurring;

      // Date filter
      let matchesDate = true;
      const expenseDate = new Date(expense.date);
      const now = new Date();

      switch (dateFilter) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = expenseDate >= weekAgo;
          break;
        case 'month':
          matchesDate = expenseDate.getMonth() === now.getMonth() && 
                       expenseDate.getFullYear() === now.getFullYear();
          break;
        case 'year':
          matchesDate = expenseDate.getFullYear() === now.getFullYear();
          break;
        case 'all':
        default:
          matchesDate = true;
          break;
      }

      return matchesSearch && matchesCategory && matchesTags && matchesRecurring && matchesDate;
    });
  }, [expenses, searchQuery, selectedCategory, selectedTags, showRecurringOnly, dateFilter]);

  // Sort expenses by date (newest first)
  const sortedExpenses = useMemo(() => {
    return [...filteredExpenses].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [filteredExpenses]);

  // Calculate analytics data
  const analytics = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    const monthlyTotals: Record<string, number> = {};
    let totalAmount = 0;

    filteredExpenses.forEach(expense => {
      // Category breakdown
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
      
      // Monthly breakdown
      const monthKey = format(new Date(expense.date), 'MMM yyyy');
      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + expense.amount;
      
      totalAmount += expense.amount;
    });

    // Pie chart data
    const pieChartData = Object.entries(categoryTotals).map(([category, amount]) => ({
      name: category,
      value: amount,
      percentage: (amount / totalAmount) * 100
    })).sort((a, b) => b.value - a.value);

    // Bar chart data (last 6 months)
    const barChartData = Object.entries(monthlyTotals)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-6)
      .map(([month, amount]) => ({
        month: month.split(' ')[0], // Just month name
        amount: amount
      }));

    return {
      totalAmount,
      categoryTotals,
      monthlyTotals,
      pieChartData,
      barChartData,
      averageExpense: totalAmount / filteredExpenses.length || 0,
      recurringExpenses: filteredExpenses.filter(e => e.isRecurring).length
    };
  }, [filteredExpenses]);

  // Monthly hero stats (always current calendar month regardless of filter)
  const monthlyHero = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter(e => isSameMonth(new Date(e.date), now));
    const total = thisMonth.reduce((s, e) => s + e.amount, 0);
    const byCategory: Record<string, number> = {};
    thisMonth.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    const topCat = Object.entries(byCategory).sort(([, a], [, b]) => b - a)[0];
    return { total, count: thisMonth.length, topCat: topCat?.[0] ?? null, topCatAmount: topCat?.[1] ?? 0 };
  }, [expenses]);

  // Auto-navigate away from "this month" if no data exists for current month
  useEffect(() => {
    if (dateFilter === 'month' && expenses.length > 0 && filteredExpenses.length === 0) {
      setDateFilter('all');
    }
  }, [expenses.length, filteredExpenses.length, dateFilter]);

  // Daily-grouped list for the filtered expense list
  const groupedByDay = useMemo(() => {
    const groups: Record<string, typeof sortedExpenses> = {};
    sortedExpenses.forEach(e => {
      const key = format(new Date(e.date), 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [sortedExpenses]);

  // Smart duplicate detection
  const detectPotentialDuplicate = (newExpense: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    const similar = expenses.filter(existing => {
      const titleSimilar = (existing.title?.toLowerCase() ?? '').includes(newExpense.title.toLowerCase()) ||
                          newExpense.title.toLowerCase().includes(existing.title?.toLowerCase() ?? '');
      const amountSimilar = Math.abs(existing.amount - newExpense.amount) < 0.01;
      const categorySame = existing.category === newExpense.category;
      const dateSimilar = Math.abs(new Date(existing.date).getTime() - new Date(newExpense.date).getTime()) < 24 * 60 * 60 * 1000; // Within 24 hours

      return (titleSimilar || (amountSimilar && categorySame)) && dateSimilar;
    });

    return similar.length > 0 ? similar[0] : null;
  };

  const handleAddExpense = async () => {
    if (!formData.title.trim() || !formData.amount || !formData.category) {
      toast({
        title: "Error",
        description: "Title, amount, and category are required",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    const newExpense = {
      title: formData.title.trim(),
      amount,
      currency: formData.currency,
      category: formData.category,
      date: new Date(formData.date),
      notes: formData.notes,
      isRecurring: formData.isRecurring,
      recurringFrequency: formData.isRecurring ? formData.recurringFrequency : undefined,
      nextDueDate: formData.isRecurring && formData.nextDueDate ? new Date(formData.nextDueDate) : undefined,
      tags: formData.tags,
    };

    const potentialDuplicate = detectPotentialDuplicate(newExpense);
    if (potentialDuplicate) {
      setPendingDuplicateExpense({
        expense: newExpense,
        message: `Similar expense found: "${potentialDuplicate.title}" ($${potentialDuplicate.amount}) on ${format(new Date(potentialDuplicate.date), 'MMM dd, yyyy')}. Add anyway?`,
      });
      return;
    }

    await doAddExpense(newExpense);
  };

  const doAddExpense = async (expense: any) => {
    try {
      await addExpense(expense);
      saveExpenseCategory(expense.category);
      setFormData({
        title: '',
        amount: '',
        currency: currency,
        category: lastExpenseCategory,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        isRecurring: false,
        recurringFrequency: 'monthly',
        nextDueDate: '',
        tags: [],
      });
      setShowAddModal(false);
      toast({ title: "Success", description: "Expense added successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    }
  };

  const handleEditExpense = (expense: ExpenseEntry) => {
    setEditingExpense(expense);
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      currency: expense.currency,
      category: expense.category,
      date: format(new Date(expense.date), 'yyyy-MM-dd'),
      notes: expense.notes || '',
      isRecurring: expense.isRecurring,
      recurringFrequency: expense.recurringFrequency || 'monthly',
      nextDueDate: expense.nextDueDate ? format(new Date(expense.nextDueDate), 'yyyy-MM-dd') : '',
      tags: [...expense.tags],
    });
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense || !formData.title.trim() || !formData.amount || !formData.category) {
      toast({
        title: "Error", 
        description: "Title, amount, and category are required",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateExpense(editingExpense.id, {
        title: formData.title.trim(),
        amount,
        currency: formData.currency,
        category: formData.category,
        date: new Date(formData.date),
        notes: formData.notes,
        isRecurring: formData.isRecurring,
        recurringFrequency: formData.isRecurring ? formData.recurringFrequency : undefined,
        nextDueDate: formData.isRecurring && formData.nextDueDate ? new Date(formData.nextDueDate) : undefined,
        tags: formData.tags,
      });

      setEditingExpense(null);
      setFormData({
        title: '',
        amount: '',
        currency: currency,
        category: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        isRecurring: false,
        recurringFrequency: 'monthly',
        nextDueDate: '',
        tags: [],
      });

      toast({
        title: "Success",
        description: "Expense updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update expense",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExpense = (id: string, title: string) => {
    setDeleteExpenseTarget({ id, title });
  };

  const confirmDeleteExpense = async () => {
    if (!deleteExpenseTarget) return;
    try {
      await deleteExpense(deleteExpenseTarget.id);
      toast({ title: "Success", description: "Expense deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    } finally {
      setDeleteExpenseTarget(null);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const toggleTagFilter = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedTags([]);
    setShowRecurringOnly(false);
    setDateFilter('month');
    setSearchQuery('');
  };

  const formatCurrencyLocal = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const renderExpenseModal = () => (
    <Dialog open={showAddModal || !!editingExpense} onOpenChange={(open) => {
      if (!open) {
        setShowAddModal(false);
        setEditingExpense(null);
        setFormData({
          title: '',
          amount: '',
          currency: currency,
          category: '',
          date: new Date().toISOString().split('T')[0],
          notes: '',
          isRecurring: false,
          recurringFrequency: 'monthly',
          nextDueDate: '',
          tags: [],
        });
        setNewTag('');
      }
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            {editingExpense ? 'Edit Expense' : 'Add New Expense'}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); (editingExpense ? handleUpdateExpense : handleAddExpense)(); } }}>
          {/* Title and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                data-testid="input-expense-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter expense title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                data-testid="input-expense-amount"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
              <div className="flex gap-1.5 flex-wrap">
                {[10, 50, 100, 500, 1000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, amount: amt.toString() }))}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${formData.amount === amt.toString() ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 bg-muted/40 hover:bg-muted text-foreground'}`}
                  >
                    {amt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Category and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger data-testid="select-expense-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select 
                value={formData.currency} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger data-testid="select-expense-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      <div className="flex items-center gap-2">
                        <span>{curr.flag}</span>
                        <span>{curr.code} ({curr.symbol})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              data-testid="input-expense-date"
              value={formData.date}
              onChange={(e) => {
                const val = e.target.value;
                setFormData(prev => ({ ...prev, date: val }));
                if (val) {
                  const today = new Date().setHours(0, 0, 0, 0);
                  if (new Date(val).getTime() > today) {
                    toast({ title: 'Future date selected', description: 'Expense dates are typically today or earlier.' });
                  }
                }
              }}
            />
          </div>

          {/* Recurring Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked }))}
              />
              <Label className="flex items-center gap-2">
                <Repeat className="w-4 h-4" />
                Make this a recurring expense
              </Label>
            </div>
            
            {formData.isRecurring && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select 
                    value={formData.recurringFrequency} 
                    onValueChange={(value: any) => setFormData(prev => ({ ...prev, recurringFrequency: value }))}
                  >
                    <SelectTrigger data-testid="select-expense-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Next Due Date</Label>
                  <Input
                    type="date"
                    data-testid="input-expense-next-due"
                    value={formData.nextDueDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, nextDueDate: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                data-testid="input-expense-tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1"
              />
              <Button 
                type="button"
                onClick={addTag}
                data-testid="button-add-expense-tag"
                variant="outline"
                size="sm"
              >
                <Tag className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer"
                    onClick={() => removeTag(tag)}
                    data-testid={`badge-expense-tag-${tag}`}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              data-testid="textarea-expense-notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Optional notes about this expense..."
              className="min-h-20"
            />
          </div>

        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setShowAddModal(false);
              setEditingExpense(null);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            data-testid="button-save-expense"
            onClick={editingExpense ? handleUpdateExpense : handleAddExpense}
          >
            {editingExpense ? 'Update Expense' : 'Add Expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!licenseLoading && !isFeatureAvailable('expenses')) return <UpgradeGate feature="Expense Tracking" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <DollarSign className="w-6 h-6" />
            Expenses
          </h1>
          <p className="text-muted-foreground text-sm">
            Track and analyze your spending patterns
          </p>
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
          <Button size="sm" onClick={() => setShowAddModal(true)} data-testid="button-add-expense">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Monthly Hero */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{format(new Date(), 'MMMM yyyy')} spending</p>
              <p className="text-4xl font-bold text-foreground" data-testid="monthly-hero-total">
                {formatCurrency(monthlyHero.total)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{monthlyHero.count} expense{monthlyHero.count !== 1 ? 's' : ''} this month</p>
            </div>
            {monthlyHero.topCat && (
              <div className="flex flex-col items-start sm:items-end gap-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Top category</p>
                <Badge variant="secondary" className="text-sm px-3 py-1">{monthlyHero.topCat}</Badge>
                <p className="text-sm font-semibold text-foreground">{formatCurrency(monthlyHero.topCatAmount)}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Analytics Tabs */}
      <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" data-testid="tab-expenses-overview">
            <PieIcon className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-expenses-categories">
            <BarChart3 className="w-4 h-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-expenses-trends">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Spent</p>
                    <p className="text-xl font-bold" data-testid="total-spent">
                      {formatCurrency(analytics.totalAmount)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Expenses</p>
                    <p className="text-xl font-bold" data-testid="total-expenses">
                      {filteredExpenses.length}
                    </p>
                  </div>
                  <Receipt className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Average Expense</p>
                    <p className="text-xl font-bold" data-testid="average-expense">
                      {formatCurrency(analytics.averageExpense)}
                    </p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Recurring</p>
                    <p className="text-xl font-bold" data-testid="recurring-expenses">
                      {analytics.recurringExpenses}
                    </p>
                  </div>
                  <Repeat className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieIcon className="w-5 h-5" />
                Spending by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.pieChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
                    >
                      {analytics.pieChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36}
                      wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No expenses to analyze
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Category Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.pieChartData.length > 0 ? (
                <div className="space-y-4">
                  {analytics.pieChartData.map((item, index) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                          <span className="font-medium text-foreground">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{item.percentage.toFixed(1)}%</span>
                          <span className="font-semibold text-foreground w-24 text-right">{formatCurrency(item.value)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${item.percentage}%`, backgroundColor: COLORS[index % COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No expenses to analyze
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Monthly Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={analytics.barChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="amount" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                  Not enough data for trend analysis
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              data-testid="input-expenses-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses by title, category, or tags..."
              className="pl-10"
            />
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXPENSE_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger data-testid="select-date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Filters */}
            <div className="space-y-2">
              <Label>Quick Filters</Label>
              <div className="flex gap-2">
                <Button
                  variant={showRecurringOnly ? "default" : "outline"}
                  size="sm"
                  data-testid="button-filter-recurring"
                  onClick={() => setShowRecurringOnly(!showRecurringOnly)}
                >
                  <Repeat className="w-4 h-4 mr-1" />
                  Recurring
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-clear-filters"
                  onClick={clearFilters}
                >
                  Clear All
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-2">
              <Label>Expenses</Label>
              <div className="text-sm text-muted-foreground">
                Showing {sortedExpenses.length} of {expenses.length} expenses
              </div>
            </div>
          </div>

          {/* Tag Filters */}
          {allTags.length > 0 && (
            <div className="space-y-2">
              <Label>Filter by Tags</Label>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTagFilter(tag)}
                    data-testid={`filter-tag-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily-grouped expense list */}
      {sortedExpenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Archive className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Expenses Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {expenses.length === 0
                ? "Get started by adding your first expense"
                : "Try adjusting your search or filter criteria"}
            </p>
            {expenses.length === 0 && (
              <Button onClick={() => setShowAddModal(true)} data-testid="button-create-first-expense">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Expense
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedByDay.map(([dateKey, dayExpenses]) => {
            const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);
            const dayDate = new Date(dateKey + 'T12:00:00');
            return (
              <div key={dateKey}>
                {/* Day header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <p className="text-sm font-semibold text-foreground">
                    {format(dayDate, 'EEEE, MMM d')}
                  </p>
                  <p className="text-sm font-semibold text-muted-foreground">{formatCurrency(dayTotal)}</p>
                </div>
                <Card className="rounded-2xl shadow-sm overflow-hidden">
                  <CardContent className="p-0">
                    {dayExpenses.map((expense, i) => (
                      <div
                        key={expense.id}
                        className={`group flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors ${i < dayExpenses.length - 1 ? 'border-b border-border/50' : ''}`}
                      >
                        {/* Category dot */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                          style={{ backgroundColor: COLORS[EXPENSE_CATEGORIES.indexOf(expense.category) % COLORS.length] }}
                        >
                          {expense.category.charAt(0)}
                        </div>
                        {/* Title + category */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate" data-testid={`expense-title-${expense.id}`}>
                            {expense.title}
                            {expense.isRecurring && <Repeat className="w-3 h-3 text-orange-400 inline ml-1.5" />}
                          </p>
                          <p className="text-xs text-muted-foreground">{expense.category}</p>
                        </div>
                        {/* Amount + actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-semibold text-foreground" data-testid={`expense-amount-${expense.id}`}>
                            {formatCurrency(expense.amount, expense.currency)}
                          </span>
                          <Button variant="ghost" size="sm" className="p-1 h-auto opacity-0 group-hover:opacity-100 hover:opacity-100"
                            data-testid={`button-edit-${expense.id}`}
                            onClick={() => handleEditExpense(expense)}>
                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-1 h-auto opacity-0 group-hover:opacity-100 hover:opacity-100"
                            data-testid={`button-delete-${expense.id}`}
                            onClick={() => handleDeleteExpense(expense.id, expense.title)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {renderExpenseModal()}

      {/* Templates Modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5" />
              Expense Templates
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="grid grid-cols-2 gap-3">
            {EXPENSE_TEMPLATES.map(template => {
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
                      <p className="text-xs text-muted-foreground">{template.category}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteExpenseTarget} onOpenChange={(o) => !o && setDeleteExpenseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deleteExpenseTarget?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteExpense} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDuplicateExpense} onOpenChange={(o) => !o && setPendingDuplicateExpense(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Possible Duplicate</AlertDialogTitle>
            <AlertDialogDescription>{pendingDuplicateExpense?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pendingDuplicateExpense) { doAddExpense(pendingDuplicateExpense.expense); setPendingDuplicateExpense(null); } }}>
              Add Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}