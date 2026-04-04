import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { FileText, AlertCircle, Shield, CheckCircle } from 'lucide-react';

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
            Last Updated: December 2024
          </p>
        </div>

        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>1. Acceptance of Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              By accessing or using IronVault ("the Service"), you agree to be bound by these Terms of Service ("Terms"). 
              If you do not agree to these Terms, please do not use the Service.
            </p>
            <p className="text-muted-foreground">
              IronVault is provided by IronVault ("we," "us," or "our") and is currently in BETA testing. These Terms 
              apply to all users of the Service.
            </p>
          </CardContent>
        </Card>

        {/* License and Use */}
        <Card>
          <CardHeader>
            <CardTitle>2. License and Use</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">2.1 Grant of License</h4>
              <p className="text-sm text-muted-foreground">
                We grant you a personal, non-exclusive, non-transferable, revocable license to use IronVault for your 
                personal or internal business purposes, subject to these Terms.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">2.2 Acceptable Use</h4>
              <p className="text-sm text-muted-foreground mb-2">You agree to use IronVault only for lawful purposes and in accordance with these Terms. You agree NOT to:</p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4">
                <li>• Use the Service for any illegal or unauthorized purpose</li>
                <li>• Attempt to reverse engineer, decompile, or disassemble the Service</li>
                <li>• Remove or modify any copyright or proprietary notices</li>
                <li>• Use the Service to store or manage illegal content</li>
                <li>• Attempt to gain unauthorized access to the Service or its systems</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Data and Privacy */}
        <Card>
          <CardHeader>
            <CardTitle>3. Your Data</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">3.1 Data Ownership</h4>
              <p className="text-sm text-muted-foreground">
                You retain all rights, title, and interest in and to any data you enter into IronVault. We do not claim 
                any ownership rights to your data.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">3.2 Data Storage and Security</h4>
              <p className="text-sm text-muted-foreground">
                All your data is stored locally on your device using browser-native IndexedDB. We do not have access 
                to your data, and we do not store your data on our servers. You are responsible for creating backups 
                of your data using the Export feature.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">3.3 Master Password</h4>
              <p className="text-sm text-muted-foreground">
                You are solely responsible for maintaining the confidentiality of your master password. We cannot 
                recover your master password or decrypt your data if you lose your master password. We strongly 
                recommend keeping a secure physical backup of your master password.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Beta Status */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              4. BETA Status and Warranty Disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-muted-foreground mb-2">
                <strong>IMPORTANT:</strong> IronVault is currently in BETA testing. The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4.1 No Warranty</h4>
              <p className="text-sm text-muted-foreground">
                We do not warrant that the Service will be uninterrupted, secure, or error-free. We make no 
                representations or warranties about the accuracy or completeness of the Service's content.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">4.2 Beta Testing</h4>
              <p className="text-sm text-muted-foreground">
                As a BETA Service, IronVault may contain bugs, errors, or other problems. Features may be added, 
                modified, or removed during the BETA period. We recommend maintaining regular backups of your data.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Limitation of Liability */}
        <Card>
          <CardHeader>
            <CardTitle>5. Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL IRONVAULT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER 
              INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES 
              RESULTING FROM:
            </p>
            <ul className="space-y-1 text-sm text-foreground ml-4">
              <li>• Your use or inability to use the Service</li>
              <li>• Any unauthorized access to or use of our servers</li>
              <li>• Any bugs, viruses, or other harmful code transmitted to or through the Service</li>
              <li>• Any loss or damage to your data stored in the Service</li>
              <li>• Any errors or omissions in any content</li>
            </ul>
          </CardContent>
        </Card>

        {/* Indemnification */}
        <Card>
          <CardHeader>
            <CardTitle>6. Indemnification</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              You agree to indemnify, defend, and hold harmless IronVault and its officers, directors, employees, 
              and agents from any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, 
              arising out of or in any way connected with your access to or use of the Service, your violation of these 
              Terms, or your violation of any rights of another party.
            </p>
          </CardContent>
        </Card>

        {/* Modifications */}
        <Card>
          <CardHeader>
            <CardTitle>7. Modifications to Service and Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">7.1 Service Modifications</h4>
              <p className="text-sm text-muted-foreground">
                We reserve the right to modify or discontinue the Service (or any part thereof) at any time, with or 
                without notice. We will not be liable to you or any third party for any modification, suspension, or 
                discontinuation of the Service.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">7.2 Terms Modifications</h4>
              <p className="text-sm text-muted-foreground">
                We may revise these Terms from time to time. The most current version will always be posted on this 
                page. By continuing to use the Service after revisions become effective, you agree to be bound by the 
                revised Terms.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Termination */}
        <Card>
          <CardHeader>
            <CardTitle>8. Termination</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              You may stop using the Service at any time. We may terminate or suspend your access to the Service 
              immediately, without prior notice or liability, if you breach these Terms. Upon termination, your right 
              to use the Service will immediately cease. Since all data is stored locally on your device, termination 
              does not result in data deletion—you remain responsible for your local data.
            </p>
          </CardContent>
        </Card>

        {/* Governing Law */}
        <Card>
          <CardHeader>
            <CardTitle>9. Governing Law</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              These Terms shall be governed by and construed in accordance with the laws of India, without regard to 
              its conflict of law provisions. Any disputes arising from these Terms or your use of the Service shall 
              be subject to the exclusive jurisdiction of the courts of India.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-2">Questions About These Terms?</h3>
            <p className="text-sm text-foreground mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <p className="text-sm text-foreground">
              <strong>Email:</strong>{' '}
              <a href="mailto:subsafeironvault@gmail.com" className="text-primary hover:underline">
                subsafeironvault@gmail.com
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

