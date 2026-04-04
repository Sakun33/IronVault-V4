import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { 
  BookOpen, Key, Bookmark, FileText, DollarSign, Bell, 
  Building2, TrendingUp, Shield, Download, Upload, 
  Settings, Smartphone, Cloud, HelpCircle, Zap, Lock,
  Database, MessageSquare, Mail
} from 'lucide-react';

export default function DocsPage() {
  const docSections = [
    {
      title: "Getting Started",
      icon: BookOpen,
      items: [
        { name: "Installation & Setup", desc: "How to install and configure IronVault" },
        { name: "Creating Your Vault", desc: "Setting up your master password and first vault" },
        { name: "Browser Extension", desc: "Installing and pairing the browser extension" },
        { name: "Import from Other Managers", desc: "Migrating from LastPass, 1Password, Bitwarden, etc." },
      ]
    },
    {
      title: "Core Features",
      icon: Shield,
      items: [
        { name: "Password Management", desc: "Adding, organizing, and using passwords" },
        { name: "Subscription Tracking", desc: "Managing recurring subscriptions and renewals" },
        { name: "Notes & Documents", desc: "Creating and organizing encrypted notes" },
        { name: "Expense Tracking", desc: "Recording and analyzing expenses" },
        { name: "Bank Statement Analysis", desc: "Importing and analyzing bank statements" },
        { name: "Investment Portfolio", desc: "Tracking investments and goals" },
      ]
    },
    {
      title: "Security",
      icon: Lock,
      items: [
        { name: "Encryption Explained", desc: "Understanding AES-256 and PBKDF2" },
        { name: "Master Password Best Practices", desc: "Creating a strong master password" },
        { name: "Auto-Lock Settings", desc: "Configuring vault timeout" },
        { name: "Biometric Authentication", desc: "Setting up fingerprint/face unlock" },
        { name: "Security Audits", desc: "Our security review process" },
      ]
    },
    {
      title: "Data Management",
      icon: Database,
      items: [
        { name: "Backup & Restore", desc: "Exporting and importing your vault" },
        { name: "Cross-Browser Access", desc: "Using IronVault on multiple browsers" },
        { name: "Data Migration", desc: "Moving data between devices" },
        { name: "Vault Reset", desc: "What to do if you forget your master password" },
      ]
    },
  ];

  return (
    <InfoLayout title="Documentation">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            IronVault Documentation
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Learn how to use IronVault effectively and securely. Complete guides for all features.
          </p>
        </div>

        {/* Quick Start Guide */}
        <Card className="bg-primary/10 border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              Quick Start Guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-card rounded-lg">
                <div className="text-primary font-bold mb-2">Step 1</div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Create Vault</h4>
                <p className="text-xs text-muted-foreground">
                  Set a strong master password (16+ characters recommended)
                </p>
              </div>
              <div className="p-4 bg-card rounded-lg">
                <div className="text-primary font-bold mb-2">Step 2</div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Add Passwords</h4>
                <p className="text-xs text-muted-foreground">
                  Import existing passwords or add new ones manually
                </p>
              </div>
              <div className="p-4 bg-card rounded-lg">
                <div className="text-primary font-bold mb-2">Step 3</div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Install Extension</h4>
                <p className="text-xs text-muted-foreground">
                  Set up browser extension for auto-fill functionality
                </p>
              </div>
              <div className="p-4 bg-card rounded-lg">
                <div className="text-primary font-bold mb-2">Step 4</div>
                <h4 className="font-semibold text-sm text-foreground mb-1">Create Backup</h4>
                <p className="text-xs text-muted-foreground">
                  Export your vault for safekeeping and cross-browser access
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documentation Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {docSections.map((section, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <section.icon className="w-5 h-5 text-primary" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {section.items.map((item, itemIdx) => (
                    <button
                      key={itemIdx}
                      className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors group"
                    >
                      <div className="font-medium text-sm text-foreground mb-1 group-hover:text-primary">
                        {item.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="w-6 h-6" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2">
              <h4 className="font-semibold text-foreground mb-2">
                How secure is IronVault?
              </h4>
              <p className="text-sm text-muted-foreground">
                IronVault uses AES-256-GCM encryption, the same standard used by governments and military. 
                All encryption happens on your device, and your data never leaves your device unencrypted. 
                Your master password is never stored anywhere.
              </p>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-2">
              <h4 className="font-semibold text-foreground mb-2">
                What happens if I forget my master password?
              </h4>
              <p className="text-sm text-muted-foreground">
                Unfortunately, if you forget your master password, there's no way to recover your data due to the 
                zero-knowledge architecture. This is a security feature, not a bug. We recommend keeping a physical 
                backup of your master password in a secure location.
              </p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4 py-2">
              <h4 className="font-semibold text-foreground mb-2">
                Can I use IronVault on multiple browsers?
              </h4>
              <p className="text-sm text-muted-foreground">
                Yes! Use the Import/Export feature to create a vault backup, then import it in another browser. 
                You'll need your master password to decrypt and import the data.
              </p>
            </div>

            <div className="border-l-4 border-orange-500 pl-4 py-2">
              <h4 className="font-semibold text-foreground mb-2">
                Is my data backed up automatically?
              </h4>
              <p className="text-sm text-muted-foreground">
                No. IronVault stores all data locally with no cloud backup. This ensures maximum privacy. 
                You're responsible for creating backups using the Export feature. We recommend regular exports.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Help Resources */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/support">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <MessageSquare className="w-8 h-8 text-primary mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-2">Support Center</h4>
                <p className="text-sm text-muted-foreground">
                  Get help from our support team
                </p>
              </CardContent>
            </Card>
          </a>

          <a href="/contact">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <Mail className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-2">Contact Us</h4>
                <p className="text-sm text-muted-foreground">
                  Reach out for specific questions
                </p>
              </CardContent>
            </Card>
          </a>

          <a href="/blog">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <FileText className="w-8 h-8 text-purple-600 dark:text-purple-400 mx-auto mb-3" />
                <h4 className="font-semibold text-foreground mb-2">Blog & Tutorials</h4>
                <p className="text-sm text-muted-foreground">
                  Learn tips and best practices
                </p>
              </CardContent>
            </Card>
          </a>
        </div>
      </div>
    </InfoLayout>
  );
}

