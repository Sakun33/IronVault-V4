import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { Shield, Eye, Lock, Database, CloudOff, FileText } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <InfoLayout title="Privacy Policy">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            Privacy Policy
          </h2>
          <p className="text-sm text-muted-foreground">
            Last Updated: December 2024
          </p>
          <p className="text-foreground">
            At IronVault, your privacy isn't just important—it's fundamental to our design.
          </p>
        </div>

        {/* Core Privacy Statement */}
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <CloudOff className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  100% Offline, Zero Data Collection
                </h3>
                <p className="text-muted-foreground">
                  IronVault is designed with a **zero-knowledge architecture**. We don't collect, store, or transmit 
                  your data. Everything stays on your device, encrypted with your master password.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What We Don't Collect */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-6 h-6" />
              What We Don't Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-foreground mb-4">
              IronVault does NOT collect or have access to:
            </p>
            <ul className="space-y-2 text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Your passwords or sensitive data:</strong> All data is encrypted and stored locally on your device.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Your master password:</strong> Never stored anywhere, not even on your device.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Usage analytics or telemetry:</strong> We don't track how you use the app.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Personal information:</strong> No email, phone number, or identifying information collected.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Cookies or tracking pixels:</strong> No third-party cookies or trackers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>IP addresses or device information:</strong> No network requests are made to our servers.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6" />
              How Your Data is Stored
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Local Storage Only</h4>
              <p className="text-sm text-muted-foreground">
                All your data is stored in your browser's IndexedDB, a client-side database that exists only on your device. 
                This data never leaves your device unless you explicitly export it.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Client-Side Encryption</h4>
              <p className="text-sm text-muted-foreground">
                Before storage, all sensitive data is encrypted using AES-256-GCM with a key derived from your master 
                password using PBKDF2 with 600,000+ iterations. Even if someone gains physical access to your device, 
                they cannot read your data without your master password.
              </p>
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">No Cloud Sync</h4>
              <p className="text-sm text-muted-foreground">
                We deliberately don't offer cloud sync. While this requires you to manually export/import data for 
                cross-device access, it ensures your data never touches a server where it could be compromised.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Browser Extension */}
        <Card>
          <CardHeader>
            <CardTitle>Browser Extension</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-foreground">
              The IronVault browser extension operates with the same privacy principles:
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Communicates only with the local IronVault app (no external servers)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Does not track browsing history or activity</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>Requires pairing code for authentication (no passwords transmitted)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500">✓</span>
                <span>All data remains encrypted end-to-end</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Your Rights */}
        <Card>
          <CardHeader>
            <CardTitle>Your Data Rights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-foreground">
              Since all your data is stored locally on your device, you have complete control:
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Export:</strong> Export your entire vault at any time in JSON or CSV format</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Delete:</strong> Clear all data with vault reset (irreversible)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Transfer:</strong> Move your data between browsers or devices via export/import</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Control:</strong> No account required, no permissions needed from us</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Third Party Services */}
        <Card>
          <CardHeader>
            <CardTitle>Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground mb-3">
              IronVault does not integrate with or share data with any third-party services. However:
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>The app is hosted/accessed through your web browser, which may have its own privacy policies</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                <span>If you choose to export data and store it elsewhere (cloud storage, email, etc.), those services' privacy policies apply</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Changes to Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Changes to This Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              We may update this privacy policy from time to time. Any changes will be reflected on this page with 
              an updated "Last Updated" date. Since IronVault is offline-first, we cannot notify you of changes 
              automatically, so we recommend checking this page periodically.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-2">Questions About Privacy?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              If you have questions about how IronVault handles your data, please contact us:
            </p>
            <p className="text-sm text-foreground">
              <strong>Email:</strong>{' '}
              <a href="mailto:subsafeironvault@gmail.com" className="text-primary hover:underline">
                subsafeironvault@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/30">
          <p className="text-sm text-foreground">
            <strong>Remember:</strong> IronVault's entire design philosophy is built around your privacy. 
            We can't access your data because we genuinely don't have it—and that's by design.
          </p>
        </div>
      </div>
    </InfoLayout>
  );
}

