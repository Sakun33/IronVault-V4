import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useVault } from '@/contexts/vault-context';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { loadSeedData, getSeedDataInfo } from '@/lib/seed-data-loader';
import { 
  Database, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Home,
  Key,
  Bookmark,
  BookOpen,
  DollarSign,
  Bell,
  FileText,
  Building2,
  TrendingUp,
  Target,
  Shield,
  User,
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';

export default function QAPage() {
  const { addPassword, addSubscription, addNote, addExpense, addReminder, passwords, subscriptions, notes, expenses, reminders } = useVault();
  const { toast } = useToast();
  const { theme, resolvedTheme } = useTheme();
  const [isSeeding, setIsSeeding] = useState(false);
  const [isLoadingRealistic, setIsLoadingRealistic] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [safeAreas, setSafeAreas] = useState({ top: 0, bottom: 0, left: 0, right: 0 });
  const [platform, setPlatform] = useState('web');

  // Load realistic demo data from JSON
  const loadRealisticData = async () => {
    setIsLoadingRealistic(true);
    try {
      const stats = await loadSeedData();
      const info = getSeedDataInfo();
      toast({
        title: "🎉 Realistic Demo Data Loaded!",
        description: `Added ${info.totalItems} items: ${stats.passwords} passwords, ${stats.subscriptions} subscriptions, ${stats.notes} notes, ${stats.expenses} expenses, ${stats.reminders} reminders, ${stats.investments} investments, ${stats.investmentGoals} goals, ${stats.bankTransactions} transactions`,
      });
    } catch (error) {
      toast({
        title: "❌ Loading Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRealistic(false);
    }
  };
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    if ((window as any).Capacitor) {
      setPlatform((window as any).Capacitor?.getPlatform?.() || 'capacitor');
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      setPlatform('ios-web');
    } else if (ua.includes('android')) {
      setPlatform('android-web');
    } else {
      setPlatform('desktop');
    }

    // Get safe area values
    const computeStyles = getComputedStyle(document.documentElement);
    setSafeAreas({
      top: parseInt(computeStyles.getPropertyValue('--sat') || '0') || 0,
      bottom: parseInt(computeStyles.getPropertyValue('--sab') || '0') || 0,
      left: parseInt(computeStyles.getPropertyValue('--sal') || '0') || 0,
      right: parseInt(computeStyles.getPropertyValue('--sar') || '0') || 0,
    });
  }, []);

  const seedDemoData = async () => {
    setIsSeeding(true);
    try {
      // Seed passwords with long strings to test UI
      const passwords = [
        {
          name: 'Google Account with Very Long Service Name That Should Test Wrapping',
          url: 'https://accounts.google.com',
          username: 'very.long.email.address.for.testing.ui.wrapping@example.com',
          password: 'SuperSecureP@ssw0rd!2024',
          category: 'Social Media',
          notes: 'This is a very long note that should test the UI layout and wrapping behavior. It contains multiple sentences to ensure proper display.'
        },
        {
          name: 'AWS Root Account',
          url: 'https://console.aws.amazon.com',
          username: 'admin@company.com',
          password: 'AWSr00t!P@ss123',
          category: 'Work',
          notes: 'Production root account - handle with care'
        },
        {
          name: 'GitHub Enterprise',
          url: 'https://github.com/enterprise',
          username: 'developer',
          password: 'GitHub!Secure2024',
          category: 'Work',
          notes: ''
        },
        {
          name: 'Netflix',
          url: 'https://netflix.com',
          username: 'user@example.com',
          password: 'Netflix!Pass123',
          category: 'Entertainment',
          notes: 'Family plan'
        },
        {
          name: 'Bank of America Online Banking Portal',
          url: 'https://bankofamerica.com',
          username: 'customer123',
          password: 'B@nk!Secure2024',
          category: 'Finance',
          notes: 'Main checking account'
        }
      ];

      for (const pwd of passwords) {
        await addPassword(pwd);
      }

      // Seed subscriptions
      const subscriptions = [
        {
          name: 'Netflix Premium Plan with Extra Members',
          cost: 19.99,
          currency: 'USD',
          billingCycle: 'monthly' as const,
          nextBillingDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          reminderDays: 7,
          category: 'Entertainment',
          notes: '4K streaming + 2 extra members',
          isActive: true,
          subscriptionType: 'streaming' as const,
          autoRenew: true
        },
        {
          name: 'AWS Cloud Infrastructure',
          cost: 450.00,
          currency: 'USD',
          billingCycle: 'monthly' as const,
          nextBillingDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          reminderDays: 7,
          category: 'Business',
          notes: 'Production environment hosting',
          isActive: true,
          subscriptionType: 'cloud' as const,
          autoRenew: true
        },
        {
          name: 'Spotify Family',
          cost: 16.99,
          currency: 'USD',
          billingCycle: 'monthly' as const,
          nextBillingDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          reminderDays: 7,
          category: 'Entertainment',
          notes: 'Up to 6 accounts',
          isActive: true,
          subscriptionType: 'streaming' as const,
          autoRenew: true
        }
      ];

      for (const sub of subscriptions) {
        await addSubscription(sub);
      }

      // Seed notes with long content
      const notes = [
        {
          title: 'Project Planning Meeting Notes with Extremely Long Title to Test UI Wrapping',
          content: `# Meeting Summary

This is a comprehensive note with markdown formatting to test the UI layout.

## Attendees
- John Doe
- Jane Smith
- Bob Johnson

## Discussion Points
1. Q1 roadmap review
2. Technical debt prioritization
3. Team capacity planning

## Action Items
- [ ] Review architecture proposal
- [ ] Schedule follow-up meeting
- [ ] Update project timeline

This note contains enough content to test scrolling and layout behavior in various screen sizes.`,
          notebook: 'Work',
          tags: ['meeting', 'planning', 'Q1'],
          isPinned: false
        },
        {
          title: 'Personal TODO List',
          content: '- Buy groceries\n- Pay electricity bill\n- Call dentist\n- Renew gym membership',
          notebook: 'Personal',
          tags: ['todo'],
          isPinned: false
        }
      ];

      for (const note of notes) {
        await addNote(note);
      }

      // Seed expenses
      const expenses = [
        {
          title: 'Office Supplies and Equipment Purchase for Remote Team',
          amount: 250.00,
          currency: 'USD',
          category: 'Business',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          notes: 'Keyboards, mice, desk accessories',
          tags: ['office', 'equipment'],
          isRecurring: false
        },
        {
          title: 'Grocery Shopping',
          amount: 125.50,
          currency: 'USD',
          category: 'Food & Dining',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          notes: '',
          tags: ['groceries'],
          isRecurring: false
        },
        {
          title: 'Gas Station',
          amount: 65.00,
          currency: 'USD',
          category: 'Transportation',
          date: new Date(),
          notes: 'Fill up',
          tags: ['fuel'],
          isRecurring: false
        }
      ];

      for (const expense of expenses) {
        await addExpense(expense);
      }

      // Seed reminders
      const reminders = [
        {
          title: 'Renew AWS SSL Certificate Before Expiration',
          description: 'Critical: SSL certificate for *.example.com expires soon',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          priority: 'high' as const,
          category: 'Work',
          isCompleted: false,
          tags: ['ssl', 'certificate', 'urgent'],
          color: '#ef4444',
          notificationEnabled: true,
          isRecurring: false,
          alarmEnabled: false,
          alertMinutesBefore: 15,
          preAlertEnabled: false
        },
        {
          title: 'Quarterly Tax Payment',
          description: 'Submit Q1 estimated tax payment',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          priority: 'medium' as const,
          category: 'Finance',
          isCompleted: false,
          tags: ['tax', 'quarterly'],
          color: '#f59e0b',
          notificationEnabled: true,
          isRecurring: false,
          alarmEnabled: false,
          alertMinutesBefore: 15,
          preAlertEnabled: false
        }
      ];

      for (const reminder of reminders) {
        await addReminder(reminder);
      }

      toast({
        title: "✅ Demo Data Seeded",
        description: `Created ${passwords.length} passwords, ${subscriptions.length} subscriptions, ${notes.length} notes, ${expenses.length} expenses, ${reminders.length} reminders`,
      });
    } catch (error) {
      toast({
        title: "❌ Seeding Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ This will delete ALL data. Are you sure?')) return;
    
    setIsClearing(true);
    try {
      // Note: Manual data clearing - would need deleteAll methods in vault context
      toast({
        title: "ℹ️ Clear Data",
        description: "Please use browser dev tools to clear IndexedDB or logout/login",
      });
    } catch (error) {
      toast({
        title: "❌ Clear Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  const quickLinks = [
    { href: '/', label: 'Dashboard', icon: Home },
    { href: '/passwords', label: 'Passwords', icon: Key },
    { href: '/subscriptions', label: 'Subscriptions', icon: Bookmark },
    { href: '/notes', label: 'Notes', icon: BookOpen },
    { href: '/expenses', label: 'Expenses', icon: DollarSign },
    { href: '/reminders', label: 'Reminders', icon: Bell },
    { href: '/documents', label: 'Documents', icon: FileText },
    { href: '/bank-statements', label: 'Bank Statements', icon: Building2 },
    { href: '/investments', label: 'Investments', icon: TrendingUp },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/api-keys', label: 'API Keys', icon: Shield },
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              QA Testing Mode
            </CardTitle>
            <CardDescription className="text-yellow-800 dark:text-yellow-300">
              Development/Testing Only - Not for production use
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Data Management */}
        <Card data-testid="qa-data-management">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Test Data Management
            </CardTitle>
            <CardDescription>
              Seed realistic data for testing or reset vault to empty state
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={loadRealisticData}
              disabled={isLoadingRealistic}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              data-testid="qa-load-realistic-data-button"
            >
              {isLoadingRealistic ? (
                <>Loading 88+ items...</>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Load Realistic Demo Data (88 items)
                </>
              )}
            </Button>

            <Button
              onClick={seedDemoData}
              disabled={isSeeding}
              className="w-full"
              variant="outline"
              data-testid="qa-seed-data-button"
            >
              {isSeeding ? (
                <>Loading...</>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Seed Basic Demo Data
                </>
              )}
            </Button>

            <Button
              onClick={handleClearAll}
              disabled={isClearing}
              variant="destructive"
              className="w-full"
              data-testid="qa-clear-data-button"
            >
              {isClearing ? (
                <>Clearing...</>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <Card data-testid="qa-quick-nav">
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
            <CardDescription>
              Jump to any page for testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link key={link.href} href={link.href}>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      data-testid={`qa-nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.label}
                    </Button>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card data-testid="qa-debug-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Debug Information
            </CardTitle>
            <CardDescription>Current environment and settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Theme Setting:</span>
                <span className="ml-2 font-medium" data-testid="qa-theme-setting">{theme}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Resolved Theme:</span>
                <span className="ml-2 font-medium" data-testid="qa-resolved-theme">{resolvedTheme}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Platform:</span>
                <span className="ml-2 font-medium" data-testid="qa-platform">{platform}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Viewport:</span>
                <span className="ml-2 font-medium" data-testid="qa-viewport">
                  {typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A'}
                </span>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Safe Areas (px):</span>
              <div className="grid grid-cols-4 gap-2 mt-1 text-xs font-mono" data-testid="qa-safe-areas">
                <span>Top: {safeAreas.top}</span>
                <span>Bottom: {safeAreas.bottom}</span>
                <span>Left: {safeAreas.left}</span>
                <span>Right: {safeAreas.right}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Data Counts:</span>
              <div className="grid grid-cols-3 gap-2 mt-1 text-xs" data-testid="qa-data-counts">
                <span>Passwords: {passwords?.length || 0}</span>
                <span>Subscriptions: {subscriptions?.length || 0}</span>
                <span>Notes: {notes?.length || 0}</span>
                <span>Expenses: {expenses?.length || 0}</span>
                <span>Reminders: {reminders?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Debug Info */}
        <Card data-testid="qa-debug-info">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Debug Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Theme:</span>
                <span className="ml-2 font-medium" data-testid="qa-theme">{theme}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Resolved:</span>
                <span className="ml-2 font-medium" data-testid="qa-resolved-theme">{resolvedTheme}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Platform:</span>
                <span className="ml-2 font-medium" data-testid="qa-platform">{platform}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Viewport:</span>
                <span className="ml-2 font-medium" data-testid="qa-viewport">{viewport.width}x{viewport.height}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Safe Areas (px):</span>
              <div className="grid grid-cols-4 gap-2 mt-1 text-xs font-mono" data-testid="qa-safe-areas">
                <span>T: {safeAreas.top}</span>
                <span>B: {safeAreas.bottom}</span>
                <span>L: {safeAreas.left}</span>
                <span>R: {safeAreas.right}</span>
              </div>
            </div>
            <div className="pt-2 border-t border-border">
              <span className="text-sm text-muted-foreground">Data Counts:</span>
              <div className="grid grid-cols-3 gap-2 mt-1 text-xs" data-testid="qa-data-counts">
                <span>Passwords: {passwords?.length || 0}</span>
                <span>Subs: {subscriptions?.length || 0}</span>
                <span>Notes: {notes?.length || 0}</span>
                <span>Expenses: {expenses?.length || 0}</span>
                <span>Reminders: {reminders?.length || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Testing Info */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Test on multiple viewports: iPhone SE, iPhone 15 Pro, Desktop</p>
            <p>• Verify Light and Dark themes</p>
            <p>• Check all modals and sheets for proper scrolling</p>
            <p>• Ensure bottom tabs don't cover content</p>
            <p>• Validate keyboard doesn't hide focused inputs</p>
            <p>• Test with long strings to catch truncation issues</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
