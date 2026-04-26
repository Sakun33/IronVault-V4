import { useState, useMemo } from 'react';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeGate } from '@/components/upgrade-gate';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BrandCard } from '@/components/brand-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { 
  Plus, 
  Target,
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar as CalendarIcon,
  PieChart,
  BarChart3,
  Search,
  Filter,
  Edit,
  Trash2,
  Award,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Coins,
  Zap,
  Shield,
  Globe,
  Home,
  Car,
  GraduationCap,
  Heart,
  Plane,
  Gift,
  ArrowLeft
} from 'lucide-react';
import { useCurrency } from '@/contexts/currency-context';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { format, addYears, differenceInMonths, differenceInYears } from 'date-fns';
import { InvestmentGoal, INVESTMENT_GOAL_CATEGORIES } from '@shared/schema';

interface SIPCalculatorResult {
  monthlyInvestment: number;
  totalInvestment: number;
  expectedReturns: number;
  totalValue: number;
  timePeriod: number;
  annualReturnRate: number;
}

interface MFCalculatorResult {
  lumpSum: number;
  expectedReturns: number;
  totalValue: number;
  timePeriod: number;
  annualReturnRate: number;
}

const GOAL_ICONS = {
  'Retirement': Building2,
  'Education': GraduationCap,
  'Home': Home,
  'Car': Car,
  'Wedding': Heart,
  'Vacation': Plane,
  'Emergency Fund': Shield,
  'Business': Globe,
  'Other': Gift
};

const INVESTMENT_OPTIONS = [
  { value: 'sip', label: 'SIP (Systematic Investment Plan)', description: 'Regular monthly investments' },
  { value: 'lumpsum', label: 'Lump Sum Investment', description: 'One-time investment' },
  { value: 'mf', label: 'Mutual Fund Calculator', description: 'Calculate mutual fund returns' },
  { value: 'fd', label: 'Fixed Deposit Calculator', description: 'Calculate FD returns' },
  { value: 'ppf', label: 'PPF Calculator', description: 'Calculate PPF returns' },
  { value: 'nps', label: 'NPS Calculator', description: 'Calculate NPS returns' },
  { value: 'retirement', label: 'Retirement Planner', description: 'Comprehensive retirement planning' },
  { value: 'education', label: 'Education Fund', description: 'Plan for education expenses' },
  { value: 'home', label: 'Home Purchase', description: 'Calculate home down payment' }
];

const GOAL_TEMPLATES = [
  {
    id: 'retirement',
    name: 'Retirement Fund',
    category: 'Retirement',
    description: 'Build a comfortable retirement fund',
    targetAmount: 1000000,
    timePeriod: 30,
    monthlyContribution: 2000,
    priority: 'high' as const,
    icon: Building2
  },
  {
    id: 'education',
    name: 'Child Education Fund',
    category: 'Education',
    description: 'Save for your child\'s higher education',
    targetAmount: 500000,
    timePeriod: 18,
    monthlyContribution: 1500,
    priority: 'high' as const,
    icon: GraduationCap
  },
  {
    id: 'home',
    name: 'Home Purchase Fund',
    category: 'Home',
    description: 'Save for home down payment',
    targetAmount: 200000,
    timePeriod: 5,
    monthlyContribution: 3000,
    priority: 'medium' as const,
    icon: Home
  },
  {
    id: 'emergency',
    name: 'Emergency Fund',
    category: 'Emergency Fund',
    description: 'Build 6 months of expenses',
    targetAmount: 50000,
    timePeriod: 2,
    monthlyContribution: 2000,
    priority: 'high' as const,
    icon: Shield
  },
  {
    id: 'vacation',
    name: 'Dream Vacation',
    category: 'Vacation',
    description: 'Save for your dream vacation',
    targetAmount: 30000,
    timePeriod: 3,
    monthlyContribution: 800,
    priority: 'low' as const,
    icon: Plane
  }
];

export default function Goals() {
  const { isFeatureAvailable, isLoading: licenseLoading } = useSubscription();

  const [, setLocation] = useLocation();
  
  // Goal Templates - Expanded with more options
  const GOAL_TEMPLATES = [
    {
      id: 'retirement',
      name: 'Retirement Fund',
      description: 'Build a secure retirement corpus for financial independence',
      icon: Award,
      targetAmount: 1000000,
      timePeriod: 30,
      monthlyContribution: 5000,
      category: 'Retirement',
      priority: 'high' as const
    },
    {
      id: 'education',
      name: 'Education Fund',
      description: 'Save for children\'s higher education expenses',
      icon: GraduationCap,
      targetAmount: 500000,
      timePeriod: 15,
      monthlyContribution: 3000,
      category: 'Education',
      priority: 'high' as const
    },
    {
      id: 'home',
      name: 'Home Purchase',
      description: 'Down payment for your dream home',
      icon: Home,
      targetAmount: 2000000,
      timePeriod: 10,
      monthlyContribution: 15000,
      category: 'Real Estate',
      priority: 'medium' as const
    },
    {
      id: 'emergency',
      name: 'Emergency Fund',
      description: '6 months of expenses as safety net',
      icon: Shield,
      targetAmount: 300000,
      timePeriod: 2,
      monthlyContribution: 12500,
      category: 'Emergency',
      priority: 'high' as const
    },
    {
      id: 'vacation',
      name: 'Dream Vacation',
      description: 'Save for your dream travel experience',
      icon: Plane,
      targetAmount: 200000,
      timePeriod: 3,
      monthlyContribution: 5500,
      category: 'Lifestyle',
      priority: 'low' as const
    },
    {
      id: 'car',
      name: 'New Car Fund',
      description: 'Save for your next vehicle purchase',
      icon: Car,
      targetAmount: 800000,
      timePeriod: 4,
      monthlyContribution: 16000,
      category: 'Lifestyle',
      priority: 'medium' as const
    },
    {
      id: 'wedding',
      name: 'Wedding Fund',
      description: 'Plan and save for wedding expenses',
      icon: Heart,
      targetAmount: 1500000,
      timePeriod: 3,
      monthlyContribution: 40000,
      category: 'Lifestyle',
      priority: 'medium' as const
    },
    {
      id: 'business',
      name: 'Business Startup',
      description: 'Capital for starting your own business',
      icon: Building2,
      targetAmount: 1000000,
      timePeriod: 5,
      monthlyContribution: 16000,
      category: 'Business',
      priority: 'medium' as const
    },
    {
      id: 'medical',
      name: 'Medical Reserve',
      description: 'Healthcare and medical emergency fund',
      icon: Shield,
      targetAmount: 500000,
      timePeriod: 5,
      monthlyContribution: 8000,
      category: 'Emergency',
      priority: 'high' as const
    },
    {
      id: 'gadgets',
      name: 'Tech & Gadgets',
      description: 'Save for electronics and gadgets',
      icon: Zap,
      targetAmount: 100000,
      timePeriod: 1,
      monthlyContribution: 8000,
      category: 'Lifestyle',
      priority: 'low' as const
    },
    {
      id: 'debt_free',
      name: 'Debt Freedom',
      description: 'Pay off all debts and become debt-free',
      icon: CheckCircle,
      targetAmount: 500000,
      timePeriod: 3,
      monthlyContribution: 14000,
      category: 'Financial Freedom',
      priority: 'high' as const
    },
    {
      id: 'wealth',
      name: 'Wealth Building',
      description: 'Long-term wealth accumulation goal',
      icon: Coins,
      targetAmount: 5000000,
      timePeriod: 20,
      monthlyContribution: 15000,
      category: 'Investment',
      priority: 'medium' as const
    }
  ];

  const { investmentGoals, addInvestmentGoal, updateInvestmentGoal, deleteInvestmentGoal } = useVault();
  const { formatCurrency, currency } = useCurrency();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<InvestmentGoal | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [deleteGoalTarget, setDeleteGoalTarget] = useState<{ id: string; name: string } | null>(null);
  
  // Enhanced goal form state
  const [goalForm, setGoalForm] = useState({
    name: '',
    description: '',
    category: '',
    targetAmount: '',
    currentAmount: '',
    targetDate: new Date(),
    priority: 'medium' as 'low' | 'medium' | 'high',
    monthlyContribution: '',
    notes: '',
    milestones: [] as Array<{id: string, name: string, amount: number, date: Date, achieved: boolean}>
  });
  
  // Calculator state
  const [calculatorType, setCalculatorType] = useState('sip');
  const [calculatorData, setCalculatorData] = useState({
    targetAmount: '',
    timePeriod: '',
    annualReturnRate: '12',
    monthlyInvestment: '',
    lumpSum: '',
    currentAge: '',
    retirementAge: ''
  });
  const [calculatorResult, setCalculatorResult] = useState<SIPCalculatorResult | MFCalculatorResult | null>(null);

  // Filter goals
  const filteredGoals = useMemo(() => {
    return investmentGoals.filter(goal => {
      const matchesSearch = searchQuery === '' ||
        goal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (goal.category || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = categoryFilter === 'all' || goal.category === categoryFilter;
      
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'achieved' && goal.isAchieved) ||
        (statusFilter === 'active' && !goal.isAchieved);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [investmentGoals, searchQuery, categoryFilter, statusFilter]);

  // Calculate goal progress
  const calculateGoalProgress = (goal: InvestmentGoal) => {
    const currentValue = goal.currentAmount || 0;
    const targetAmount = goal.targetAmount;
    const progress = targetAmount > 0 ? (currentValue / targetAmount) * 100 : 0;
    return Math.min(progress, 100);
  };

  // SIP Calculator
  const calculateSIP = (): SIPCalculatorResult => {
    const monthlyInvestment = parseFloat(calculatorData.monthlyInvestment) || 0;
    const timePeriod = parseFloat(calculatorData.timePeriod) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 12;
    
    const monthlyRate = annualReturnRate / 12 / 100;
    const totalMonths = timePeriod * 12;
    
    // SIP formula: FV = P * [((1 + r)^n - 1) / r] * (1 + r)
    const totalInvestment = monthlyInvestment * totalMonths;
    const futureValue = monthlyInvestment * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
    const expectedReturns = futureValue - totalInvestment;
    
    return {
      monthlyInvestment,
      totalInvestment,
      expectedReturns,
      totalValue: futureValue,
      timePeriod,
      annualReturnRate
    };
  };

  // Lump Sum Calculator
  const calculateLumpSum = (): MFCalculatorResult => {
    const lumpSum = parseFloat(calculatorData.lumpSum) || 0;
    const timePeriod = parseFloat(calculatorData.timePeriod) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 12;
    
    const futureValue = lumpSum * Math.pow(1 + (annualReturnRate / 100), timePeriod);
    const expectedReturns = futureValue - lumpSum;
    
    return {
      lumpSum,
      expectedReturns,
      totalValue: futureValue,
      timePeriod,
      annualReturnRate
    };
  };

  // Mutual Fund Calculator
  const calculateMF = (): MFCalculatorResult => {
    return calculateLumpSum(); // Same calculation as lump sum
  };

  // Fixed Deposit Calculator
  const calculateFD = (): MFCalculatorResult => {
    const lumpSum = parseFloat(calculatorData.lumpSum) || 0;
    const timePeriod = parseFloat(calculatorData.timePeriod) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 7; // Lower rate for FD
    
    const futureValue = lumpSum * Math.pow(1 + (annualReturnRate / 100), timePeriod);
    const expectedReturns = futureValue - lumpSum;
    
    return {
      lumpSum,
      expectedReturns,
      totalValue: futureValue,
      timePeriod,
      annualReturnRate
    };
  };

  // PPF Calculator
  const calculatePPF = (): SIPCalculatorResult => {
    const monthlyInvestment = parseFloat(calculatorData.monthlyInvestment) || 0;
    const timePeriod = parseFloat(calculatorData.timePeriod) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 7.1; // PPF rate
    
    const monthlyRate = annualReturnRate / 12 / 100;
    const totalMonths = timePeriod * 12;
    
    const totalInvestment = monthlyInvestment * totalMonths;
    const futureValue = monthlyInvestment * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
    const expectedReturns = futureValue - totalInvestment;
    
    return {
      monthlyInvestment,
      totalInvestment,
      expectedReturns,
      totalValue: futureValue,
      timePeriod,
      annualReturnRate
    };
  };

  // NPS Calculator
  const calculateNPS = (): SIPCalculatorResult => {
    const monthlyInvestment = parseFloat(calculatorData.monthlyInvestment) || 0;
    const timePeriod = parseFloat(calculatorData.timePeriod) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 10; // NPS rate
    
    const monthlyRate = annualReturnRate / 12 / 100;
    const totalMonths = timePeriod * 12;
    
    const totalInvestment = monthlyInvestment * totalMonths;
    const futureValue = monthlyInvestment * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
    const expectedReturns = futureValue - totalInvestment;
    
    return {
      monthlyInvestment,
      totalInvestment,
      expectedReturns,
      totalValue: futureValue,
      timePeriod,
      annualReturnRate
    };
  };

  // Retirement Planner
  const calculateRetirement = (): SIPCalculatorResult => {
    const currentAge = parseFloat(calculatorData.currentAge) || 30;
    const retirementAge = parseFloat(calculatorData.retirementAge) || 60;
    const monthlyInvestment = parseFloat(calculatorData.monthlyInvestment) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 12;
    
    const timePeriod = retirementAge - currentAge;
    const monthlyRate = annualReturnRate / 12 / 100;
    const totalMonths = timePeriod * 12;
    
    const totalInvestment = monthlyInvestment * totalMonths;
    const futureValue = monthlyInvestment * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
    const expectedReturns = futureValue - totalInvestment;
    
    return {
      monthlyInvestment,
      totalInvestment,
      expectedReturns,
      totalValue: futureValue,
      timePeriod,
      annualReturnRate
    };
  };

  // Education Fund Calculator
  const calculateEducationFund = (): SIPCalculatorResult => {
    const targetAmount = parseFloat(calculatorData.targetAmount) || 0;
    const timePeriod = parseFloat(calculatorData.timePeriod) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 12;
    
    const monthlyRate = annualReturnRate / 12 / 100;
    const totalMonths = timePeriod * 12;
    
    // Calculate required monthly investment to reach target
    const monthlyInvestment = targetAmount / (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
    const totalInvestment = monthlyInvestment * totalMonths;
    const expectedReturns = targetAmount - totalInvestment;
    
    return {
      monthlyInvestment,
      totalInvestment,
      expectedReturns,
      totalValue: targetAmount,
      timePeriod,
      annualReturnRate
    };
  };

  // Home Purchase Calculator
  const calculateHomePurchase = (): SIPCalculatorResult => {
    const targetAmount = parseFloat(calculatorData.targetAmount) || 0;
    const timePeriod = parseFloat(calculatorData.timePeriod) || 0;
    const annualReturnRate = parseFloat(calculatorData.annualReturnRate) || 8;
    
    const monthlyRate = annualReturnRate / 12 / 100;
    const totalMonths = timePeriod * 12;
    
    // Calculate required monthly investment for down payment
    const monthlyInvestment = targetAmount / (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
    const totalInvestment = monthlyInvestment * totalMonths;
    const expectedReturns = targetAmount - totalInvestment;
    
    return {
      monthlyInvestment,
      totalInvestment,
      expectedReturns,
      totalValue: targetAmount,
      timePeriod,
      annualReturnRate
    };
  };

  const runCalculator = () => {
    let result: SIPCalculatorResult | MFCalculatorResult | null = null;
    
    switch (calculatorType) {
      case 'sip':
        result = calculateSIP();
        break;
      case 'lumpsum':
        result = calculateLumpSum();
        break;
      case 'mf':
        result = calculateMF();
        break;
      case 'fd':
        result = calculateFD();
        break;
      case 'ppf':
        result = calculatePPF();
        break;
      case 'nps':
        result = calculateNPS();
        break;
      case 'retirement':
        result = calculateRetirement();
        break;
      case 'education':
        result = calculateEducationFund();
        break;
      case 'home':
        result = calculateHomePurchase();
        break;
    }
    
    setCalculatorResult(result);
  };

  const handleAddGoal = async () => {
    if (!calculatorResult) return;
    
    const goalData = {
      name: `Goal ${Date.now()}`,
      category: 'Other',
      targetAmount: calculatorResult.totalValue,
      currentAmount: 0,
      targetDate: addYears(new Date(), calculatorResult.timePeriod),
      isAchieved: false,
      notes: `Calculated using ${calculatorType.toUpperCase()}`,
      currency: 'USD',
      priority: 'medium' as const,
      investmentIds: []
    };
    
    try {
      await addInvestmentGoal(goalData);
      setShowCalculatorModal(false);
      setCalculatorResult(null);
      toast({
        title: "Success",
        description: "Goal created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive",
      });
    }
  };

  // Helper function to get priority color
  const getGoalPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const handleCreateFromTemplate = (templateId: string) => {
    const template = GOAL_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    // Populate the form with template values so user can customize before saving
    setGoalForm({
      name: template.name,
      description: template.description,
      category: template.category,
      targetAmount: template.targetAmount.toString(),
      currentAmount: '0',
      targetDate: addYears(new Date(), template.timePeriod),
      priority: template.priority,
      monthlyContribution: template.monthlyContribution.toString(),
      notes: '',
      milestones: [],
    });
    
    // Close templates modal and open the add/edit modal
    setShowTemplatesModal(false);
    setEditingGoal(null); // Ensure we're in "add" mode, not "edit" mode
    setShowAddModal(true);
    
    toast({
      title: "Template Loaded",
      description: "Customize the goal values and save when ready",
    });
  };

  const handleCreateCustomGoal = async () => {
    if (!goalForm.name || !goalForm.targetAmount) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const goalData = {
      name: goalForm.name,
      description: goalForm.description,
      category: goalForm.category,
      targetAmount: parseFloat(goalForm.targetAmount),
      currentAmount: parseFloat(goalForm.currentAmount) || 0,
      targetDate: goalForm.targetDate,
      isAchieved: false,
      currency: currency,
      priority: goalForm.priority,
      investmentIds: [],
      monthlyContribution: parseFloat(goalForm.monthlyContribution) || undefined,
      notes: goalForm.notes
    };
    
    try {
      await addInvestmentGoal(goalData);
      setShowAddModal(false);
      setGoalForm({
        name: '',
        description: '',
        category: '',
        targetAmount: '',
        currentAmount: '',
        targetDate: new Date(),
        priority: 'medium' as const,
        monthlyContribution: '',
        notes: '',
        milestones: []
      });
      toast({
        title: "Success",
        description: "Custom goal created successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create custom goal",
        variant: "destructive",
      });
    }
  };

  const handleDeleteGoal = (id: string, name: string) => {
    setDeleteGoalTarget({ id, name });
  };

  const confirmDeleteGoal = async () => {
    if (!deleteGoalTarget) return;
    try {
      await deleteInvestmentGoal(deleteGoalTarget.id);
      toast({ title: "Success", description: "Goal deleted successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to delete goal", variant: "destructive" });
    } finally {
      setDeleteGoalTarget(null);
    }
  };

  const handleToggleGoal = async (goal: InvestmentGoal) => {
    try {
      await updateInvestmentGoal(goal.id, { isAchieved: !goal.isAchieved });
      toast({
        title: "Success",
        description: goal.isAchieved ? "Goal marked as incomplete" : "Goal marked as achieved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update goal",
        variant: "destructive",
      });
    }
  };

  const getGoalIcon = (category: string) => {
    const IconComponent = GOAL_ICONS[category as keyof typeof GOAL_ICONS] || Target;
    return <IconComponent className="w-5 h-5" />;
  };

  const getGoalStatusColor = (goal: InvestmentGoal) => {
    if (goal.isAchieved) return 'bg-green-500';
    const progress = calculateGoalProgress(goal);
    if (progress >= 80) return 'bg-primary';
    if (progress >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (!licenseLoading && !isFeatureAvailable('investments')) return <UpgradeGate feature="Goals & Investments" />;

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setLocation('/investments')}
          className="flex items-center gap-1 px-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
              <Target className="w-5 h-5" />
              Goals
            </h1>
            <p className="text-muted-foreground text-sm">
              Track your financial goals
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button 
              size="icon"
              variant="outline"
              onClick={() => setShowTemplatesModal(true)}
              className="h-9 w-9"
              title="Templates"
            >
              <Target className="w-4 h-4" />
            </Button>
            <Button 
              size="icon"
              variant="outline"
              onClick={() => setShowCalculatorModal(true)}
              className="h-9 w-9"
              title="Calculator"
            >
              <Calculator className="w-4 h-4" />
            </Button>
            <Button onClick={() => setShowAddModal(true)} className="h-9 flex items-center gap-1">
              <Plus className="w-4 h-4" />
              <span>Add Goal</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="rounded-2xl shadow-sm border-0 bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search goals by name or category..."
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {INVESTMENT_GOAL_CATEGORIES.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="achieved">Achieved</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Goals</Label>
              <div className="text-sm text-muted-foreground">
                Showing {filteredGoals.length} of {investmentGoals.length} goals
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <Card className="rounded-2xl shadow-sm border-0 bg-card">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No Goals Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {investmentGoals.length === 0
                ? "Get started by creating your first investment goal"
                : "Try adjusting your search or filter criteria"
              }
            </p>
            {investmentGoals.length === 0 && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Goal
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
          {filteredGoals.map(goal => {
            const progress = calculateGoalProgress(goal);
            const IconComponent = GOAL_ICONS[goal.category as keyof typeof GOAL_ICONS] || Target;

            return (
              <BrandCard key={goal.id} name={goal.name} className="cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-2 flex items-center gap-2">
                      <IconComponent className="w-5 h-5 text-primary flex-shrink-0" />
                      <span>{goal.name}</span>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleGoal(goal);
                        }}
                        className="p-1 h-auto"
                      >
                        <Switch
                          checked={goal.isAchieved}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGoal(goal);
                        }}
                        className="p-1 h-auto"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGoal(goal.id, goal.name);
                        }}
                        className="p-1 h-auto text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{goal.category}</Badge>
                    <CalendarIcon className="w-3 h-3" />
                    {format(new Date(goal.targetDate), 'MMM yyyy')}
                  </div>
                </CardHeader>

                <CardContent className="pt-2">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span className="font-medium">{progress.toFixed(1)}%</span>
                    </div>
                    
                    <Progress value={progress} className="h-2" />
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Current</div>
                        <div className="font-medium">{formatCurrency(goal.currentAmount || 0, currency)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Target</div>
                        <div className="font-medium">{formatCurrency(goal.targetAmount, currency)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getGoalStatusColor(goal)}`} />
                      <span className="text-xs text-muted-foreground">
                        {goal.isAchieved ? 'Achieved' : 'Active'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </BrandCard>
            );
          })}
        </div>
      )}

      {/* Templates Modal */}
      <Dialog open={showTemplatesModal} onOpenChange={setShowTemplatesModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Goal Templates
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GOAL_TEMPLATES.map(template => {
              const IconComponent = template.icon;
              return (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <IconComponent className="w-5 h-5 text-primary" />
                      {template.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Target Amount:</span>
                        <span className="font-medium">{formatCurrency(template.targetAmount, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time Period:</span>
                        <span className="font-medium">{template.timePeriod} years</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Monthly Contribution:</span>
                        <span className="font-medium">{formatCurrency(template.monthlyContribution, currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Priority:</span>
                        <Badge className={getGoalPriorityColor(template.priority)}>
                          {template.priority}
                        </Badge>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleCreateFromTemplate(template.id)}
                      className="w-full mt-4"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Goal
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Custom Goal Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Custom Goal
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goalName">Goal Name *</Label>
                <Input
                  id="goalName"
                  value={goalForm.name}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Dream Vacation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goalCategory">Category</Label>
                <Select value={goalForm.category} onValueChange={(value) => setGoalForm(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_GOAL_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goalDescription">Description</Label>
              <Textarea
                id="goalDescription"
                value={goalForm.description}
                onChange={(e) => setGoalForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your goal..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetAmount">Target Amount *</Label>
                <Input
                  id="targetAmount"
                  type="number"
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, targetAmount: e.target.value }))}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentAmount">Current Amount</Label>
                <Input
                  id="currentAmount"
                  type="number"
                  value={goalForm.currentAmount}
                  onChange={(e) => setGoalForm(prev => ({ ...prev, currentAmount: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetDate">Target Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(goalForm.targetDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[200]" align="start" side="bottom" sideOffset={4} avoidCollisions={true}>
                    <Calendar
                      mode="single"
                      selected={goalForm.targetDate}
                      onSelect={(date) => {
                        if (!date) return;
                        setGoalForm(prev => ({ ...prev, targetDate: date }));
                        if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
                          toast({ title: 'Past date selected', description: 'Goal target dates are typically in the future.' });
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={goalForm.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setGoalForm(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyContribution">Monthly Contribution (Optional)</Label>
              <Input
                id="monthlyContribution"
                type="number"
                value={goalForm.monthlyContribution}
                onChange={(e) => setGoalForm(prev => ({ ...prev, monthlyContribution: e.target.value }))}
                placeholder="1000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={goalForm.notes}
                onChange={(e) => setGoalForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about your goal..."
                rows={3}
              />
            </div>

          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomGoal}>
              <Plus className="w-4 h-4 mr-2" />
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calculator Modal */}
      <Dialog open={showCalculatorModal} onOpenChange={setShowCalculatorModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Investment Calculator
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-6">
            {/* Calculator Type Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Calculator Type</Label>
              <Select value={calculatorType} onValueChange={setCalculatorType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select calculator type" />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Calculator Content */}
            <div className="space-y-4">
              {INVESTMENT_OPTIONS.map(option => (
                calculatorType === option.value && (
                  <div key={option.value} className="space-y-4">
                    <div className="text-left">
                      <h3 className="text-lg font-semibold">{option.label}</h3>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(option.value === 'sip' || option.value === 'ppf' || option.value === 'nps') && (
                        <div className="space-y-2">
                          <Label htmlFor="monthlyInvestment">Monthly Investment</Label>
                          <Input
                            id="monthlyInvestment"
                            type="number"
                            value={calculatorData.monthlyInvestment}
                            onChange={(e) => setCalculatorData(prev => ({ ...prev, monthlyInvestment: e.target.value }))}
                            placeholder="5000"
                          />
                        </div>
                      )}

                      {(option.value === 'lumpsum' || option.value === 'mf' || option.value === 'fd') && (
                        <div className="space-y-2">
                          <Label htmlFor="lumpSum">Lump Sum Amount</Label>
                          <Input
                            id="lumpSum"
                            type="number"
                            value={calculatorData.lumpSum}
                            onChange={(e) => setCalculatorData(prev => ({ ...prev, lumpSum: e.target.value }))}
                            placeholder="100000"
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="timePeriod">Time Period (Years)</Label>
                        <Input
                          id="timePeriod"
                          type="number"
                          value={calculatorData.timePeriod}
                          onChange={(e) => setCalculatorData(prev => ({ ...prev, timePeriod: e.target.value }))}
                          placeholder="10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="annualReturnRate">Expected Annual Return Rate (%)</Label>
                        <Input
                          id="annualReturnRate"
                          type="number"
                          step="0.1"
                          value={calculatorData.annualReturnRate}
                          onChange={(e) => setCalculatorData(prev => ({ ...prev, annualReturnRate: e.target.value }))}
                          placeholder="12"
                        />
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <Button onClick={runCalculator} className="w-full md:w-auto">
                        <Calculator className="w-4 h-4 mr-2" />
                        Calculate
                      </Button>
                    </div>

                    {calculatorResult && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Calculation Results</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            {(calculatorResult as SIPCalculatorResult).monthlyInvestment && (
                              <div className="text-center p-3 bg-primary/10 rounded-lg">
                                <div className="text-sm text-muted-foreground">Monthly Investment</div>
                                <div className="text-lg font-semibold">
                                  {formatCurrency((calculatorResult as SIPCalculatorResult).monthlyInvestment, currency)}
                                </div>
                              </div>
                            )}
                            
                            {(calculatorResult as MFCalculatorResult).lumpSum && (
                              <div className="text-center p-3 bg-primary/10 rounded-lg">
                                <div className="text-sm text-muted-foreground">Lump Sum</div>
                                <div className="text-lg font-semibold">
                                  {formatCurrency((calculatorResult as MFCalculatorResult).lumpSum, currency)}
                                </div>
                              </div>
                            )}

                            <div className="text-center p-3 bg-orange-50 rounded-lg">
                              <div className="text-sm text-muted-foreground">Total Invested</div>
                              <div className="text-lg font-semibold text-orange-600">
                                {formatCurrency(
                                  (calculatorResult as SIPCalculatorResult).totalInvestment || 
                                  (calculatorResult as MFCalculatorResult).lumpSum, 
                                  currency
                                )}
                              </div>
                            </div>

                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <div className="text-sm text-muted-foreground">Expected Returns</div>
                              <div className="text-lg font-semibold text-green-600">
                                {formatCurrency(calculatorResult.expectedReturns, currency)}
                              </div>
                            </div>

                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                              <div className="text-sm text-muted-foreground">Total Value</div>
                              <div className="text-lg font-semibold text-purple-600">
                                {formatCurrency(calculatorResult.totalValue, currency)}
                              </div>
                            </div>
                          </div>

                          <div className="text-center">
                            <Button onClick={handleAddGoal} className="w-full md:w-auto">
                              <Target className="w-4 h-4 mr-2" />
                              Create Goal from Calculation
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )
              ))}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteGoalTarget} onOpenChange={(open) => !open && setDeleteGoalTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteGoalTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGoal} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
