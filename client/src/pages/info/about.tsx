import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Database, CloudOff, Key, Users, Award, Target } from 'lucide-react';
import { InfoLayout } from '@/components/info-layout';

export default function AboutPage() {
  return (
    <InfoLayout title="About IronVault">
      <div className="max-w-6xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-bold text-foreground">IronVault</h1>
              <span className="px-3 py-1 text-sm font-bold bg-primary text-primary-foreground rounded-full">BETA</span>
            </div>
          </div>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Your Secure, Offline Password & Subscription Manager
        </p>
        <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
          IronVault is a privacy-first, offline password and subscription management solution developed by IronVault. 
          We believe your data should stay yours - encrypted, secure, and completely offline.
        </p>
      </div>

      {/* Our Mission */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Our Mission
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            At IronVault, our mission is to provide individuals and organizations with a secure, reliable, and easy-to-use 
            password management solution that prioritizes privacy above all else. We developed IronVault with the understanding 
            that your sensitive data should never be at risk of cloud breaches, unauthorized access, or third-party intrusions.
          </p>
          <p className="text-muted-foreground">
            IronVault is designed for users who value complete control over their digital security. By keeping all data encrypted 
            and stored locally on your device, we ensure that you - and only you - have access to your passwords, subscriptions, 
            and sensitive information.
          </p>
        </CardContent>
      </Card>

      {/* Core Values */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Privacy First</h3>
            <p className="text-sm text-muted-foreground">
              Your data never leaves your device. No cloud syncing, no external servers.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Military-Grade Security</h3>
            <p className="text-sm text-muted-foreground">
              AES-256 encryption ensures your data is protected with industry-leading standards.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
              <CloudOff className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Offline-First</h3>
            <p className="text-sm text-muted-foreground">
              Works completely offline. No internet connection required for core functionality.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">User-Centric Design</h3>
            <p className="text-sm text-muted-foreground">
              Intuitive interface designed for both beginners and power users.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Our Story */}
      <Card>
        <CardHeader>
          <CardTitle>Our Story</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            IronVault was born out of frustration with existing password managers that compromise privacy for convenience. 
            After numerous high-profile data breaches affecting cloud-based password managers, our team at IronVault decided 
            to build a solution that truly prioritizes user privacy and security.
          </p>
          <p className="text-muted-foreground">
            Development began in early 2024, with a clear vision: create a password manager that stores everything locally, 
            uses state-of-the-art encryption, and gives users complete control over their data. Today, IronVault is in BETA, 
            continuously evolving based on user feedback and emerging security best practices.
          </p>
        </CardContent>
      </Card>

      {/* Technology Stack */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Technology & Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-foreground mb-3">Encryption</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>AES-256-GCM encryption for all sensitive data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>PBKDF2 key derivation with 600,000+ iterations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Cryptographically secure random number generation</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Storage</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>IndexedDB for local, encrypted storage</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>No cloud syncing or external servers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Export/import functionality for backups and cross-browser access</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            About IronVault
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            IronVault is a technology company focused on developing privacy-centric security solutions. Our team consists 
            of experienced developers, security researchers, and UX designers passionate about creating tools that empower 
            users to take control of their digital security.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-primary mb-1">2024</div>
              <div className="text-sm text-muted-foreground">Founded</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-primary mb-1">100%</div>
              <div className="text-sm text-muted-foreground">Privacy Focused</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-3xl font-bold text-primary mb-1">BETA</div>
              <div className="text-sm text-muted-foreground">Active Development</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Get in Touch</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-foreground mb-4">
            We'd love to hear from you! Whether you have questions, feedback, or just want to say hello, feel free to reach out.
          </p>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-semibold">Email:</span>{' '}
              <a href="mailto:subsafeironvault@gmail.com" className="text-primary hover:underline">
                subsafeironvault@gmail.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
    </InfoLayout>
  );
}

