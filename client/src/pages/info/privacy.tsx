import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { Shield, Eye, Lock, Database, CloudOff, Users, Trash2, Mail } from 'lucide-react';

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
            Last Updated: April 2026
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
                  Zero-Knowledge Architecture
                </h3>
                <p className="text-muted-foreground">
                  IronVault is built on a zero-knowledge design. Your vault contents — passwords, notes, and sensitive data —
                  are encrypted on your device before storage. We cannot read, access, or recover your vault data under
                  any circumstances.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What We Collect */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-6 h-6" />
              What Data We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Account & CRM Data</h4>
              <p className="text-sm text-muted-foreground">
                When you register or subscribe, we collect your <strong>email address</strong> for account management,
                subscription billing, and customer support. This is stored on our servers and processed by our payment
                and subscription providers.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Anonymous Usage Analytics</h4>
              <p className="text-sm text-muted-foreground">
                We collect anonymous, aggregated usage data (e.g., feature interaction counts, session length, crash
                reports) to improve the app. This data cannot be linked back to you and contains no vault contents
                or personal identifiers.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Subscription & Billing Data</h4>
              <p className="text-sm text-muted-foreground">
                Payment information is handled entirely by Stripe (web) and RevenueCat / Google Play (mobile). We
                receive only a subscription status token — no raw payment card data is ever stored by us.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* What We Don't Collect */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-6 h-6" />
              What We Never Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Your vault contents:</strong> Passwords, notes, and credentials are encrypted locally and never sent to our servers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Your master password:</strong> Never stored anywhere — not on your device, not on our servers.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Location data:</strong> IronVault does not access your GPS or location.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Contacts, camera, or microphone:</strong> These device permissions are not requested or used.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 font-bold">✗</span>
                <span><strong>Third-party tracking or ad data:</strong> No advertising SDKs or tracking pixels are included.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Data Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-6 h-6" />
              How Your Data Is Stored
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Vault Data — Local Only</h4>
              <p className="text-sm text-muted-foreground">
                All vault data is stored in encrypted form on your device (Capacitor Preferences / SQLite on mobile,
                IndexedDB on web). It is encrypted with AES-256-GCM using a key derived from your master password via
                PBKDF2 with 600,000+ iterations. This data never leaves your device.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Account Data — Server</h4>
              <p className="text-sm text-muted-foreground">
                Your email address and subscription status are stored on our servers hosted on Vercel infrastructure,
                protected by industry-standard security practices. We do not store payment card numbers or bank details.
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">Analytics — Anonymous & Aggregated</h4>
              <p className="text-sm text-muted-foreground">
                Anonymous analytics data is stored in aggregate form and cannot be used to identify individual users.
                No vault content is ever included in analytics payloads.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Third-Party Services */}
        <Card>
          <CardHeader>
            <CardTitle>Third-Party Services</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-foreground mb-3">
              IronVault integrates with the following third-party services. Each has its own privacy policy:
            </p>
            <ul className="space-y-3 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong>Stripe</strong> — Processes web subscription payments. Stripe may collect your email,
                  billing address, and payment card details. See stripe.com/privacy.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong>RevenueCat</strong> — Manages in-app purchase entitlements on Android. RevenueCat
                  receives your anonymized app user ID and purchase receipts. See revenuecat.com/privacy.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong>Google Play</strong> — Processes Android in-app purchases. Subject to Google's privacy
                  policy at policies.google.com/privacy.
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">•</span>
                <div>
                  <strong>Vercel</strong> — Hosts our web application and backend API. Vercel may log standard
                  server request metadata (IP, user agent). See vercel.com/legal/privacy-policy.
                </div>
              </li>
            </ul>
            <p className="text-sm text-muted-foreground mt-3">
              None of these services have access to your vault contents, which remain encrypted on your device.
            </p>
          </CardContent>
        </Card>

        {/* Data Deletion & Your Rights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="w-6 h-6" />
              Your Rights & Data Deletion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              You have full control over your data. You may exercise the following rights at any time:
            </p>
            <ul className="space-y-2 text-sm text-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Access:</strong> Request a copy of any personal data we hold about you (email, subscription status).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Correction:</strong> Request correction of inaccurate personal data.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Deletion (Right to be Forgotten):</strong> Email us at saketsuman1312@gmail.com to request deletion of your account and all associated personal data. We will process deletion requests within 30 days.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Vault deletion:</strong> You can delete all local vault data at any time from Settings → Danger Zone → Reset Vault. This is immediate and irreversible.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">✓</span>
                <span><strong>Export:</strong> Export your entire vault at any time in JSON or encrypted format before deletion.</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Children's Privacy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-6 h-6" />
              Children's Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              IronVault is not intended for use by children under the age of 13. We do not knowingly collect
              personal information from children under 13. If you are a parent or guardian and believe your child
              has provided us with personal information, please contact us at{' '}
              <a href="mailto:saketsuman1312@gmail.com" className="text-primary hover:underline">
                saketsuman1312@gmail.com
              </a>{' '}
              and we will delete such information promptly.
            </p>
          </CardContent>
        </Card>

        {/* Changes to Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Updates to This Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">
              We may update this privacy policy from time to time to reflect changes in our practices or applicable law.
              We will notify you of material changes by updating the "Last Updated" date at the top of this page and,
              where appropriate, via email or an in-app notification. Continued use of IronVault after changes become
              effective constitutes acceptance of the revised policy.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-2">Contact Us</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  For privacy questions, data requests, or deletion requests, contact us at:
                </p>
                <p className="text-sm text-foreground">
                  <strong>Email:</strong>{' '}
                  <a href="mailto:saketsuman1312@gmail.com" className="text-primary hover:underline">
                    saketsuman1312@gmail.com
                  </a>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  We respond to all privacy inquiries within 7 business days.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/30">
          <p className="text-sm text-foreground">
            <strong>Remember:</strong> IronVault's zero-knowledge design means we genuinely cannot access
            your vault contents — the encryption key is derived solely from your master password, which we never see.
          </p>
        </div>
      </div>
    </InfoLayout>
  );
}
