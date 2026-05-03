import { useState, useMemo } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { ListSkeleton } from '@/components/list-skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calendar,
  Search,
  Filter,
  Download,
  PieChart,
  BarChart3,
  Eye,
  Edit,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useCurrency } from '@/contexts/currency-context';
import { useLogging } from '@/contexts/logging-context';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isWithinInterval, subDays, startOfDay } from 'date-fns';
import { 
  BankTransaction, 
  BankStatement, 
  BANK_TRANSACTION_CATEGORIES,
  BANK_TRANSACTION_SUBCATEGORIES 
} from '@shared/schema';

export default function BankStatements() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();

  const { bankStatements, bankTransactions, addBankStatement, addBankTransaction, deleteBankStatement, deleteBankTransaction, importBankStatementsFromCSV, bulkDeleteBankStatements, isLoading } = useVault();
  const { formatCurrency } = useCurrency();
  const { addLog } = useLogging();
  const { toast } = useToast();
  
  const statements = bankStatements || [];
  const transactions = bankTransactions || [];
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [selectedStatement, setSelectedStatement] = useState<string>('all');
  const [deleteStatementId, setDeleteStatementId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Calculate analytics
  const analytics = useMemo(() => {
    const filteredTransactions = transactions.filter(txn => {
      const matchesSearch = searchQuery === '' ||
        txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.merchant?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.category?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || txn.category === categoryFilter;
      
      const matchesStatement = selectedStatement === 'all' || txn.statementId === selectedStatement;

      const txnDate = startOfDay(txn.date);
      const today = startOfDay(new Date());
      let matchesDateRange = true;

      if (dateRangeFilter === 'today') {
        matchesDateRange = txnDate.getTime() === today.getTime();
      } else if (dateRangeFilter === '7d') {
        const sevenDaysAgo = subDays(today, 7);
        matchesDateRange = isWithinInterval(txnDate, { start: sevenDaysAgo, end: today });
      } else if (dateRangeFilter === '30d') {
        const thirtyDaysAgo = subDays(today, 30);
        matchesDateRange = isWithinInterval(txnDate, { start: thirtyDaysAgo, end: today });
      }

      return matchesSearch && matchesCategory && matchesDateRange && matchesStatement;
    });

    const totalIncome = filteredTransactions
      .filter(txn => txn.transactionType === 'credit')
      .reduce((sum, txn) => sum + txn.amount, 0);

    const totalExpenses = filteredTransactions
      .filter(txn => txn.transactionType === 'debit')
      .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

    const netSavings = totalIncome - totalExpenses;

    // Category breakdown
    const categoryBreakdown = filteredTransactions.reduce((acc, txn) => {
      const category = txn.category || 'Other';
      if (!acc[category]) {
        acc[category] = { amount: 0, count: 0, transactions: [] };
      }
      acc[category].amount += Math.abs(txn.amount);
      acc[category].count += 1;
      acc[category].transactions.push(txn);
      return acc;
    }, {} as Record<string, { amount: number; count: number; transactions: BankTransaction[] }>);

    // Recurring transactions
    const recurringTransactions = filteredTransactions.filter(txn => txn.isRecurring);

    // Monthly trends (simplified - in real app, would group by month)
    const monthlyTrends = {
      income: totalIncome,
      expenses: totalExpenses,
      savings: netSavings
    };

    return {
      totalIncome,
      totalExpenses,
      netSavings,
      categoryBreakdown,
      recurringTransactions,
      monthlyTrends,
      transactionCount: filteredTransactions.length
    };
  }, [transactions, searchQuery, categoryFilter, dateRangeFilter, selectedStatement]);

  const handleAddStatement = async () => {
    try {
      const statementId = `stmt_${Date.now()}`;
      
      // Add the statement first
      await addBankStatement({
        bankName: 'Sample Bank',
        accountName: 'Checking Account',
        accountNumber: '****1234',
        statementPeriod: {
          startDate: new Date(),
          endDate: new Date(),
        },
        currency: 'USD',
        openingBalance: 5000,
        closingBalance: 4850,
        totalCredits: 3500,
        totalDebits: 3650,
        transactionCount: 6,
        fileName: 'sample-statement.pdf',
        fileType: 'pdf' as const,
        importDate: new Date(),
      });

      // Add sample transactions
      const sampleTransactions = [
        { description: 'SALARY DEPOSIT', amount: 3500, type: 'credit', category: 'Income', merchant: 'Employer Inc' },
        { description: 'RENT PAYMENT', amount: -1200, type: 'debit', category: 'Bills & Utilities', merchant: 'Landlord' },
        { description: 'GROCERY STORE', amount: -150, type: 'debit', category: 'Food & Dining', merchant: 'Whole Foods' },
        { description: 'NETFLIX SUBSCRIPTION', amount: -15.99, type: 'debit', category: 'Entertainment', merchant: 'Netflix' },
        { description: 'GAS STATION', amount: -45, type: 'debit', category: 'Transportation', merchant: 'Shell' },
        { description: 'COFFEE SHOP', amount: -8.50, type: 'debit', category: 'Food & Dining', merchant: 'Starbucks' },
      ];

      for (const txn of sampleTransactions) {
        await addBankTransaction({
          statementId,
          date: new Date(),
          description: txn.description,
          amount: txn.amount,
          currency: 'USD',
          transactionType: txn.type as 'credit' | 'debit',
          category: txn.category,
          account: 'Checking Account',
          balance: 5000 + txn.amount,
          merchant: txn.merchant,
          isRecurring: false,
          tags: [],
        });
      }
      
      addLog('Added sample bank data', 'system', 'Sample bank statement and transactions created');
      toast({
        title: "Sample Data Added",
        description: "Sample bank statement with 6 transactions has been added.",
      });
    } catch (error) {
      console.error('Error adding sample data:', error);
      toast({
        title: "Error",
        description: "Failed to add bank statement.",
        variant: "destructive",
      });
    }
  };

  const handleImportStatement = async () => {
    try {
      // Create a file input element
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
          addLog('Import statement initiated', 'system', 'User selected CSV file for import');
          const csvContent = await file.text();
          const result = await importBankStatementsFromCSV(csvContent);
          addLog('Import statement completed', 'system', `Imported ${result.statements} statements and ${result.transactions} transactions`);
          toast({
            title: "Import Successful",
            description: `Successfully imported ${result.statements} bank statements with ${result.transactions} transactions.`,
          });
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (error) {
          console.error('Bank Statements: Import failed:', error);
          const errorMessage = error instanceof Error ? error.message : "Failed to import CSV file";
          addLog('Import statement failed', 'system', errorMessage);
          toast({
            title: "Import Failed",
            description: errorMessage,
            variant: "destructive",
          });
        }
      };
      input.click();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open file dialog",
        variant: "destructive",
      });
    }
  };

  const handleExportData = () => {
    addLog('Export data initiated', 'system', 'User requested data export');
    toast({
      title: "Export Data",
      description: "Bank statement data export functionality will be implemented soon.",
    });
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'debit':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case 'transfer':
        return <Clock className="w-4 h-4 text-primary" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Income': 'bg-green-100 text-green-800',
      'Food & Dining': 'bg-orange-100 text-orange-800',
      'Transportation': 'bg-primary/10 text-primary',
      'Shopping': 'bg-purple-100 text-purple-800',
      'Entertainment': 'bg-pink-100 text-pink-800',
      'Bills & Utilities': 'bg-red-100 text-red-800',
      'Healthcare': 'bg-teal-100 text-teal-800',
      'Travel': 'bg-indigo-100 text-indigo-800',
      'Education': 'bg-yellow-100 text-yellow-800',
      'Business': 'bg-muted text-muted-foreground',
      'Other': 'bg-muted text-muted-foreground',
    };
    return colors[category] || colors['Other'];
  };

  if (!licenseLoading && !isFeatureAvailable('bankStatements')) return <UpgradeGate feature="Bank Statements" />;

  return (
    <div className="p-4 space-y-6 overflow-x-hidden">
      {/* Status Indicator */}
      <div className="bg-primary/10 p-4 rounded-lg border border-primary/30">
        <h3 className="font-semibold text-foreground mb-2">📊 Data Status</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-foreground">Bank Statements:</span> 
            <span className={`ml-2 px-2 py-1 rounded text-xs ${statements.length > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {statements.length} records
            </span>
          </div>
          <div>
            <span className="font-medium text-foreground">Transactions:</span> 
            <span className={`ml-2 px-2 py-1 rounded text-xs ${transactions.length > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {transactions.length} records
            </span>
          </div>
        </div>
        {isLoading && statements.length === 0 && transactions.length === 0 ? (
          <div className="mt-3">
            <ListSkeleton rows={3} showHeader={false} />
          </div>
        ) : statements.length === 0 && transactions.length === 0 && (
          <div className="mt-3 text-sm text-muted-foreground">
            💡 No data found. Try importing a CSV file or adding sample data.
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex justify-between items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bank Statements</h1>
          <p className="text-muted-foreground text-sm">
            Import and analyze statements
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" onClick={handleAddStatement} className="h-9 w-9" title="Add Statement" aria-label="Add Statement">
            <Plus className="w-4 h-4" />
          </Button>
          <Button size="icon" onClick={handleImportStatement} className="h-9 w-9" title="Import" aria-label="Import statement">
            <Upload className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleExportData} className="h-9 w-9" title="Export" aria-label="Export bank statement data">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(analytics.totalIncome, 'USD')}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500/70" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(analytics.totalExpenses, 'USD')}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-red-500/70" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Net Savings</p>
              <p className={`text-2xl font-bold ${analytics.netSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(analytics.netSavings, 'USD')}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-primary/70" />
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm border-border/50 bg-card hover:shadow-md transition-all duration-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-2xl font-bold text-foreground">
                {analytics.transactionCount}
              </p>
            </div>
            <FileText className="w-8 h-8 text-purple-500/70" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Input
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex items-center gap-2"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {BANK_TRANSACTION_CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedStatement} onValueChange={setSelectedStatement}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Statement" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statements</SelectItem>
                {statements.map(stmt => (
                  <SelectItem key={stmt.id} value={stmt.id}>
                    {stmt.bankName} - {format(stmt.statementPeriod.startDate, 'MMM yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Category Breakdown */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Spending by Category
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(analytics.categoryBreakdown)
                  .sort(([,a], [,b]) => b.amount - a.amount)
                  .slice(0, 9)
                  .map(([category, data]) => (
                    <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge className={getCategoryColor(category)}>
                          {category}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {data.count} transactions
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(data.amount, 'USD')}</p>
                        <p className="text-xs text-muted-foreground">
                          {((data.amount / analytics.totalExpenses) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trends */}
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Monthly Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Income</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(analytics.monthlyTrends.income, 'USD')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Expenses</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(analytics.monthlyTrends.expenses, 'USD')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Savings</p>
                  <p className={`text-2xl font-bold ${analytics.monthlyTrends.savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(analytics.monthlyTrends.savings, 'USD')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          {/* Uploaded Statements Management */}
          {statements.length > 0 && (
            <Card className="rounded-2xl shadow-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Uploaded Statements</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  data-testid="button-bulk-delete-statements"
                >
                  <Trash2 className="w-4 h-4 mr-1.5" />
                  Delete All ({statements.length})
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {statements.map(stmt => (
                    <div key={stmt.id} className="flex items-center justify-between p-3 rounded-lg border bg-card/50">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{stmt.bankName}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(stmt.statementPeriod.startDate, 'MMM yyyy')} · {stmt.transactions?.length ?? 0} transactions
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 shrink-0"
                        onClick={() => setDeleteStatementId(stmt.id)}
                        aria-label={`Delete statement ${stmt.bankName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {statements.length} bank statement{statements.length === 1 ? '' : 's'}?</DialogTitle>
                <DialogDescription>
                  This will permanently delete all {statements.length} bank statement{statements.length === 1 ? '' : 's'} and their transactions. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const ids = statements.map(s => s.id);
                    const removed = await bulkDeleteBankStatements(ids);
                    setShowBulkDeleteConfirm(false);
                    toast({ title: 'Deleted', description: `${removed} statement${removed === 1 ? '' : 's'} removed.` });
                  }}
                >
                  Delete {statements.length}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Category Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analytics.categoryBreakdown)
                  .sort(([,a], [,b]) => b.amount - a.amount)
                  .map(([category, data]) => (
                    <div key={category} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={getCategoryColor(category)}>
                          {category}
                        </Badge>
                        <div>
                          <p className="font-medium">{category}</p>
                          <p className="text-sm text-muted-foreground">
                            {data.count} transactions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">
                          {formatCurrency(data.amount, 'USD')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {((data.amount / analytics.totalExpenses) * 100).toFixed(1)}% of expenses
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recurring Tab */}
        <TabsContent value="recurring" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recurring Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.recurringTransactions.map(transaction => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getTransactionTypeIcon(transaction.transactionType)}
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.merchant} • {transaction.recurringPattern}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(transaction.amount), 'USD')}
                      </p>
                      <Badge className={getCategoryColor(transaction.category || 'Other')}>
                        {transaction.category}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <Card className="rounded-2xl shadow-sm border-border/50 overflow-hidden">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div>
                {transactions
                  .filter(txn => {
                    const matchesSearch = searchQuery === '' ||
                      txn.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      txn.merchant?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      txn.category?.toLowerCase().includes(searchQuery.toLowerCase());

                    const matchesCategory = categoryFilter === 'all' || txn.category === categoryFilter;
                    
                    const matchesStatement = selectedStatement === 'all' || txn.statementId === selectedStatement;

                    const txnDate = startOfDay(txn.date);
                    const today = startOfDay(new Date());
                    let matchesDateRange = true;

                    if (dateRangeFilter === 'today') {
                      matchesDateRange = txnDate.getTime() === today.getTime();
                    } else if (dateRangeFilter === '7d') {
                      const sevenDaysAgo = subDays(today, 7);
                      matchesDateRange = isWithinInterval(txnDate, { start: sevenDaysAgo, end: today });
                    } else if (dateRangeFilter === '30d') {
                      const thirtyDaysAgo = subDays(today, 30);
                      matchesDateRange = isWithinInterval(txnDate, { start: thirtyDaysAgo, end: today });
                    }

                    return matchesSearch && matchesCategory && matchesDateRange && matchesStatement;
                  })
                  .sort((a, b) => b.date.getTime() - a.date.getTime())
                  .map((transaction, idx, arr) => (
                    <div key={transaction.id} className={`p-4 hover:bg-muted/50 active:bg-muted transition-colors${idx < arr.length - 1 ? ' border-b border-border/50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getTransactionTypeIcon(transaction.transactionType)}
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{format(transaction.date, 'MMM d, yyyy')}</span>
                              {transaction.merchant && (
                                <>
                                  <span>•</span>
                                  <span>{transaction.merchant}</span>
                                </>
                              )}
                              {transaction.category && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">
                                    {transaction.category}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount, 'USD')}
                          </p>
                          {transaction.balance && (
                            <p className="text-sm text-muted-foreground">
                              Balance: {formatCurrency(transaction.balance, 'USD')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteStatementId} onOpenChange={(open) => { if (!open) setDeleteStatementId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete statement?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the bank statement and all its imported transactions from your vault.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteStatementId) return;
                try {
                  await deleteBankStatement(deleteStatementId);
                  toast({ title: "Statement Deleted", description: "Bank statement removed from your vault." });
                } catch {
                  toast({ title: "Error", description: "Failed to delete statement.", variant: "destructive" });
                } finally {
                  setDeleteStatementId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
