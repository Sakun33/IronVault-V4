import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { FileText, AlertCircle, Shield, CreditCard, Lock } from 'lucide-react';

export default function TermsPage() {
  return (
    <InfoLayout title="Terms of Service">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            Terms of Service
          </h2>
          <p className="text-sm text-muted-foreground">
            Last Updated: April 2026
          </p>
        </div>

        {/* 1. Acceptance */}
        <Card>
          <CardHeader>
            <CardTitle>1. Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              By downloading, installing, or using IronVault ("the Service" or "the App"), you agree to be bound by
              these Terms of Service ("Terms"). If you do not agree, do not use the Service.
            </p>
            <p className="text-muted-foreground">
              IronVault is operated by Saket Suman ("we," "us," or "our"). These Terms apply to all users of the Service.
              Use of the Service is also governed by our{' '}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>,
              which is incorporated into these Terms by reference.
            </p>
          </CardContent>
        </Card>

        {/* 2. Service Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              2. Service Description
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              IronVault is a zero-knowledge, offline-first password manager that stores encrypted vault data locally
              on your device. Core features include:
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground ml-4">
              <li>• Encrypted local storage of passwords, notes, and credentials</li>
              <li>• Biometric authentication (fingerprint / face unlock)</li>
              <li>• Password generator and strength analysis</li>
              <li>• Secure export and import of vault data</li>
              <li>• Optional premium features available via subscription</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Because of our zero-knowledge architecture, we cannot access, read, or recover your vault contents.
            </p>
          </CardContent>
        </Card>

        {/* 3. User Responsibilities */}
        <Card>
          <CardHeader>
            <CardTitle>3. User Responsibilities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">3.1 Master Password</h4>
              <p className="text-sm text-muted-foreground">
                You are solely responsible for creating, remembering, and safeguarding your master password. We
                cannot recover your master password or decrypt your vault if it is lost. <strong>We strongly
                recommend maintaining a secure physical backup of your master password stored separately from your device.</strong>
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">3.2 Data Backup</h4>
              <p className="text-sm text-muted-foreground">
                You are responsible for regularly exporting and backing up your vault data. IronVault provides an
                Export feature for this purpose. We are not liable for any data loss resulting from device loss,
                damage, factory reset, app uninstallation, or OS upgrade.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">3.3 Acceptable Use</h4>
              <p className="text-sm text-muted-foreground mb-2">You agree NOT to:</p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                <li>• Use the Service for any illegal or unauthorized purpose</li>
                <li>• Attempt to reverse engineer, decompile, or disassemble the Service</li>
                <li>• Remove or modify any copyright or proprietary notices</li>
                <li>• Attempt to gain unauthorized access to the Service or its backend systems</li>
                <li>• Use the Service to store or facilitate illegal activity</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* 4. Subscriptions & Billing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              4. Subscription Terms & Refund Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">4.1 Subscription Plans</h4>
              <p className="text-sm text-muted-foreground">
                IronVault offers optional premium subscriptions (monthly or annual) that unlock additional features.
                Subscription pricing is displayed in the app before purchase. Subscriptions automatically renew
                unless cancelled at least 24 hours before the end of the current billing period.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4.2 Billing</h4>
              <p className="text-sm text-muted-foreground">
                Web subscriptions are processed by <strong>Stripe</strong>. Android in-app purchases are processed
                by <strong>Google Play</strong> via <strong>RevenueCat</strong>. Billing is charged to your payment
                method at confirmation of purchase and at the start of each renewal period.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4.3 Cancellation</h4>
              <p className="text-sm text-muted-foreground">
                You may cancel your subscription at any time. Cancellation takes effect at the end of the current
                billing period — you retain access to premium features until then. On Android, manage or cancel
                your subscription through Google Play Settings → Subscriptions.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4.4 Refunds</h4>
              <p className="text-sm text-muted-foreground">
                We offer refunds within <strong>7 days of purchase</strong> if you are not satisfied. To request a
                refund, email{' '}
                <a href="mailto:saketsuman1312@gmail.com" className="text-primary hover:underline">
                  saketsuman1312@gmail.com
                </a>{' '}
                with your order details. Android purchases made through Google Play are subject to Google Play's
                refund policy. We do not offer refunds for partial billing periods after cancellation.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4.5 Price Changes</h4>
              <p className="text-sm text-muted-foreground">
                We reserve the right to modify subscription pricing. We will notify existing subscribers of material
                price changes at least 30 days in advance. Continued use after a price change constitutes acceptance.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 5. Your Data */}
        <Card>
          <CardHeader>
            <CardTitle>5. Your Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">5.1 Data Ownership</h4>
              <p className="text-sm text-muted-foreground">
                You retain all rights, title, and interest in any data you enter into IronVault. We do not claim
                any ownership rights to your vault data.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">5.2 Zero-Knowledge & Data Access</h4>
              <p className="text-sm text-muted-foreground">
                IronVault's zero-knowledge design means we are technically incapable of accessing your vault
                contents. Vault data is encrypted with a key derived from your master password before it leaves
                your device's RAM. <strong>We cannot decrypt or recover your vault under any circumstances</strong>,
                including legal requests, forgotten passwords, or account recovery.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 6. Limitation of Liability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              6. Limitation of Liability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground text-sm uppercase font-medium">
              The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind, express or implied.
            </p>
            <p className="text-muted-foreground text-sm">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL IRONVAULT OR SAKET SUMAN BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="space-y-1 text-sm text-foreground ml-4">
              <li>• Loss of vault data due to forgotten master password (we cannot recover it)</li>
              <li>• Loss of data due to device damage, loss, or factory reset without a backup</li>
              <li>• Your use or inability to use the Service</li>
              <li>• Any unauthorized access to your device or local data</li>
              <li>• Any errors or interruptions in the Service</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Our total liability to you for any claim shall not exceed the amount you paid us in the 12 months
              preceding the claim, or $10 USD, whichever is greater.
            </p>
          </CardContent>
        </Card>

        {/* 7. Indemnification */}
        <Card>
          <CardHeader>
            <CardTitle>7. Indemnification</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              You agree to indemnify, defend, and hold harmless IronVault, Saket Suman, and any officers, employees,
              or agents from any claims, liabilities, damages, losses, and expenses arising out of your use of the
              Service, your violation of these Terms, or your violation of any rights of another party.
            </p>
          </CardContent>
        </Card>

        {/* 8. Termination */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              8. Termination
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground">
              You may stop using the Service at any time by uninstalling the app. We may terminate or suspend
              access to the Service immediately, without prior notice, if you breach these Terms.
            </p>
            <p className="text-sm text-foreground">
              Upon termination of your account, your subscription entitlements will cease. Because vault data is
              stored locally on your device, uninstalling the app or resetting it will remove your vault data.
              <strong> Export your vault before uninstalling if you wish to retain your data.</strong>
            </p>
          </CardContent>
        </Card>

        {/* 9. Modifications */}
        <Card>
          <CardHeader>
            <CardTitle>9. Modifications to Service and Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">9.1 Service Modifications</h4>
              <p className="text-sm text-muted-foreground">
                We reserve the right to modify, suspend, or discontinue the Service at any time. We will endeavour
                to provide reasonable advance notice of material changes. We are not liable for any modification,
                suspension, or discontinuation.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">9.2 Terms Modifications</h4>
              <p className="text-sm text-muted-foreground">
                We may revise these Terms at any time. The most current version will be posted in the app and at
                our website. Continued use of the Service after revisions constitutes acceptance of the revised Terms.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 10. Governing Law */}
        <Card>
          <CardHeader>
            <CardTitle>10. Governing Law</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              These Terms shall be governed by and construed in accordance with the laws of India, without regard to
              conflict of law provisions. Any disputes arising under these Terms shall be subject to the exclusive
              jurisdiction of the competent courts of India. You agree to submit to personal jurisdiction in such courts.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-2">Questions About These Terms?</h3>
            <p className="text-sm text-foreground mb-4">
              Contact us at:
            </p>
            <p className="text-sm text-foreground">
              <strong>Email:</strong>{' '}
              <a href="mailto:saketsuman1312@gmail.com" className="text-primary hover:underline">
                saketsuman1312@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Acknowledgment */}
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/30 text-center">
          <p className="text-sm text-foreground">
            By using IronVault, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </div>
    </InfoLayout>
  );
}
