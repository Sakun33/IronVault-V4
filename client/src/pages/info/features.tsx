import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { 
  Shield, Lock, Key, Bookmark, FileText, DollarSign, Bell, 
  Building2, TrendingUp, FileArchive, Smartphone, Cloud, 
  Search, Download, Upload, Zap, Eye, Copy, Calendar,
  BarChart3, PieChart, Tag, Filter, CheckSquare, Target,
  Link as LinkIcon, MessageSquare, Mail
} from 'lucide-react';

export default function FeaturesPage() {
  const features = [
    {
      category: "Password Management",
      icon: Key,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900",
      items: [
        { icon: Lock, title: "Secure Storage", description: "Client-side encrypted password vault with AES-256-GCM encryption" },
        { icon: Zap, title: "Password Generator", description: "Customizable strong password generation with strength analysis" },
        { icon: Shield, title: "Strength Analysis", description: "Password strength analysis and weak password alerts" },
        { icon: Tag, title: "Categories & Tags", description: "Organize passwords with flexible categorization" },
        { icon: Upload, title: "Import/Export", description: "Support for popular password managers (CSV, JSON formats)" },
        { icon: Eye, title: "Secure Reveal", description: "Master password or biometric verification to view passwords" },
      ]
    },
    {
      category: "Subscription Tracking",
      icon: Bookmark,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900",
      items: [
        { icon: BarChart3, title: "Visual Analytics", description: "Interactive charts showing spending patterns and trends" },
        { icon: Bell, title: "Renewal Alerts", description: "Customizable reminder notifications for upcoming renewals" },
        { icon: DollarSign, title: "Cost Analysis", description: "Track monthly, yearly spending with multi-currency support" },
        { icon: PieChart, title: "Category Insights", description: "Detailed breakdown by service type and spending category" },
        { icon: Calendar, title: "Payment History", description: "Complete subscription lifecycle management and history" },
        { icon: TrendingUp, title: "Spending Trends", description: "Visualize subscription costs over time with projections" },
      ]
    },
    {
      category: "Notes & Knowledge Management",
      icon: FileText,
      color: "text-orange-600 dark:text-orange-400",
      bgColor: "bg-orange-100 dark:bg-orange-900",
      items: [
        { icon: FileText, title: "Rich Text Editor", description: "Full markdown support with live preview and formatting" },
        { icon: CheckSquare, title: "Checklist Support", description: "Interactive checklists with completion tracking" },
        { icon: FileArchive, title: "Syntax Highlighting", description: "Code blocks with language-specific highlighting" },
        { icon: Tag, title: "Organization", description: "Notebooks and tags for structured note-taking" },
        { icon: Search, title: "Full-Text Search", description: "Powerful search across all notes with instant results" },
        { icon: Download, title: "Export Options", description: "Markdown export for portability and backups" },
      ]
    },
    {
      category: "Expense Tracking",
      icon: DollarSign,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900",
      items: [
        { icon: PieChart, title: "Visual Analytics", description: "Interactive pie charts and bar graphs for insights" },
        { icon: Tag, title: "Smart Categorization", description: "15+ expense categories with custom tags" },
        { icon: Calendar, title: "Recurring Expenses", description: "Track and predict recurring costs automatically" },
        { icon: DollarSign, title: "Multi-Currency", description: "Handle expenses in different currencies seamlessly" },
        { icon: Filter, title: "Advanced Filtering", description: "Filter by date, category, tags, and amount ranges" },
        { icon: Copy, title: "Duplicate Detection", description: "Smart duplicate expense prevention" },
      ]
    },
    {
      category: "Bank Statement Analysis",
      icon: Building2,
      color: "text-primary",
      bgColor: "bg-primary/10",
      items: [
        { icon: FileArchive, title: "CSV Import", description: "Auto-detect and import CSV bank statements from any bank" },
        { icon: Tag, title: "Smart Categorization", description: "Automatic transaction categorization based on description" },
        { icon: BarChart3, title: "Spending Analytics", description: "Detailed spending and earnings reports with charts" },
        { icon: TrendingUp, title: "Transaction Insights", description: "Income vs expense tracking and analysis" },
        { icon: Shield, title: "Offline Processing", description: "Complete analysis without internet connection" },
        { icon: PieChart, title: "Category Breakdown", description: "Visual breakdown of spending by category" },
      ]
    },
    {
      category: "Investment Tracking",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900",
      items: [
        { icon: PieChart, title: "Comprehensive Portfolio", description: "Track FDs, RDs, Mutual Funds, Stocks, Crypto, NFTs" },
        { icon: TrendingUp, title: "Performance Analytics", description: "Real-time portfolio value and returns calculation" },
        { icon: Target, title: "Goal Setting", description: "Investment goals with progress tracking" },
        { icon: Shield, title: "Offline Analysis", description: "Complete portfolio analysis without internet" },
        { icon: BarChart3, title: "Multi-Asset Support", description: "Support for all major investment types" },
        { icon: PieChart, title: "Risk Assessment", description: "Portfolio diversification and risk analysis" },
      ]
    },
    {
      category: "Task & Reminder System",
      icon: Bell,
      color: "text-yellow-600 dark:text-yellow-400",
      bgColor: "bg-yellow-100 dark:bg-yellow-900",
      items: [
        { icon: Calendar, title: "Due Date Tracking", description: "Never miss important deadlines with alerts" },
        { icon: Bell, title: "Smart Notifications", description: "Browser notifications for upcoming tasks" },
        { icon: Tag, title: "Priority Levels", description: "Organize tasks by urgency and importance" },
        { icon: Calendar, title: "Recurring Tasks", description: "Set up daily, weekly, or monthly reminders" },
        { icon: CheckSquare, title: "Task Completion", description: "Track completion history and patterns" },
        { icon: LinkIcon, title: "Subscription Links", description: "Link reminders to subscription renewals" },
      ]
    },
    {
      category: "Documents & Files",
      icon: FileArchive,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-100 dark:bg-indigo-900",
      items: [
        { icon: Upload, title: "Secure Upload", description: "Client-side encrypted document storage" },
        { icon: Eye, title: "Document Viewer", description: "Preview PDFs, images, and documents in-app" },
        { icon: Tag, title: "Organization", description: "Folders and tags for structured file management" },
        { icon: Search, title: "Smart Search", description: "Search by filename, tags, and metadata" },
        { icon: Download, title: "Encrypted Export", description: "Export documents with password protection" },
        { icon: Shield, title: "Scan & Store", description: "Scan important documents with encryption" },
      ]
    },
  ];

  return (
    <InfoLayout title="Features">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-bold text-foreground">
            Everything You Need to Manage Your Digital Life
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            IronVault combines powerful features with uncompromising security to give you complete 
            control over your passwords, subscriptions, expenses, and more - all offline and encrypted.
          </p>
        </div>

        {/* Core Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">AES-256</div>
              <div className="text-sm text-muted-foreground">Military-Grade Encryption</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Cloud className="w-6 h-6 text-green-600 dark:text-green-400 line-through" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">100%</div>
              <div className="text-sm text-muted-foreground">Offline & Private</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">8+</div>
              <div className="text-sm text-muted-foreground">Integrated Tools</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="text-2xl font-bold text-foreground mb-1">Zero</div>
              <div className="text-sm text-muted-foreground">Cloud Dependencies</div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Categories */}
        {features.map((category, idx) => (
          <Card key={idx}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className={`w-10 h-10 ${category.bgColor} rounded-lg flex items-center justify-center`}>
                  <category.icon className={`w-5 h-5 ${category.color}`} />
                </div>
                <span>{category.category}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="flex gap-3 p-3 rounded-lg hover:bg-accent transition-colors">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm mb-1">
                        {item.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Additional Features */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">Security & Privacy</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Zero-knowledge architecture</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Master password with PBKDF2 (600,000+ iterations)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Client-side encryption/decryption only</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Optional biometric authentication</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Automatic vault locking after inactivity</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-foreground">User Experience</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Dark/Light mode with system sync</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Global search across all data types</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Keyboard shortcuts for power users</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Progressive Web App (PWA) support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary">✓</span>
                    <span>Responsive design for mobile and desktop</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="pt-6 text-center">
            <h3 className="text-2xl font-bold text-foreground mb-2">
              Ready to Get Started?
            </h3>
            <p className="text-muted-foreground mb-4">
              Create your secure vault now and take control of your digital life.
            </p>
            <a href="/" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
              Go to Dashboard
            </a>
          </CardContent>
        </Card>
      </div>
    </InfoLayout>
  );
}

