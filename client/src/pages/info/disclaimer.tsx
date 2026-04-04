import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { AlertTriangle, Shield, FileText } from 'lucide-react';

export default function DisclaimerPage() {
  return (
    <InfoLayout title="Disclaimer">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            Disclaimer
          </h2>
          <p className="text-sm text-muted-foreground">
            Last Updated: December 2024
          </p>
        </div>

        {/* General Disclaimer */}
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              General Disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-sm text-foreground font-semibold mb-2">
                PLEASE READ THIS DISCLAIMER CAREFULLY
              </p>
              <p className="text-sm text-muted-foreground">
                The information provided by IronVault and IronVault ("we," "us," or "our") is for general informational 
                purposes only. All information on the Service is provided in good faith; however, we make no 
                representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, 
                reliability, availability, or completeness of any information on the Service.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Beta Software Disclaimer */}
        <Card>
          <CardHeader>
            <CardTitle>Beta Software Disclaimer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              IronVault is currently in BETA testing phase. This means:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground ml-4">
              <li>• The software may contain bugs, errors, or other problems</li>
              <li>• Features may be incomplete, unstable, or subject to change</li>
              <li>• There may be unexpected behavior or data loss</li>
              <li>• The Service may be modified or discontinued at any time</li>
              <li>• Regular backups of your data are strongly recommended</li>
            </ul>
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-muted-foreground">
                <strong>Important:</strong> We strongly recommend maintaining regular backups of your data using the 
                Export feature. Do not rely solely on IronVault as your only copy of critical information.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* No Professional Advice */}
        <Card>
          <CardHeader>
            <CardTitle>No Professional Advice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              The information provided through IronVault does not constitute:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground ml-4">
              <li>• Financial, investment, or accounting advice</li>
              <li>• Legal advice or guidance</li>
              <li>• Cybersecurity consultation or guarantees</li>
              <li>• Professional recommendations of any kind</li>
            </ul>
            <p className="text-sm text-foreground mt-4">
              The Service is designed to help you organize and manage your personal information, but it is not a 
              substitute for professional advice. Always consult with qualified professionals for specific advice 
              tailored to your situation.
            </p>
          </CardContent>
        </Card>

        {/* Security Disclaimer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Security Disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Encryption and Security</h4>
              <p className="text-sm text-muted-foreground">
                While IronVault uses industry-standard AES-256 encryption and implements security best practices, 
                no system is 100% secure. We cannot guarantee absolute security of your data against all threats, 
                including but not limited to:
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                <li>• Zero-day vulnerabilities in browser or operating system</li>
                <li>• Malware or keyloggers on your device</li>
                <li>• Physical access to your device by unauthorized parties</li>
                <li>• Social engineering or phishing attacks</li>
                <li>• Quantum computing advances (future threat)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Your Responsibility</h4>
              <p className="text-sm text-muted-foreground">
                You are responsible for:
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground ml-4 mt-2">
                <li>• Choosing a strong master password</li>
                <li>• Keeping your device secure and up to date</li>
                <li>• Not sharing your master password with anyone</li>
                <li>• Creating regular backups of your data</li>
                <li>• Understanding the risks of digital data storage</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Data Loss Disclaimer */}
        <Card>
          <CardHeader>
            <CardTitle>Data Loss and Recovery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              IronVault stores all data locally in your browser's IndexedDB. Data loss can occur due to:
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground ml-4">
              <li>• Browser data clearing or reset</li>
              <li>• Operating system reinstallation</li>
              <li>• Browser updates or bugs</li>
              <li>• Storage quota limits</li>
              <li>• Device failure or malfunction</li>
              <li>• Forgetting your master password (no recovery possible)</li>
            </ul>
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-foreground font-semibold mb-2">
                CRITICAL: Master Password Recovery
              </p>
              <p className="text-sm text-muted-foreground">
                If you forget your master password, there is NO WAY to recover your data. This is by design—we cannot 
                decrypt your data without your master password. We strongly recommend keeping a secure physical backup 
                of your master password in a safe location.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Third-Party Links */}
        <Card>
          <CardHeader>
            <CardTitle>Third-Party Content and Links</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              IronVault may contain links to third-party websites or services that are not owned or controlled by 
              IronVault. We have no control over, and assume no responsibility for, the content, privacy policies, 
              or practices of any third-party websites or services. You acknowledge and agree that we shall not be 
              responsible or liable for any damage or loss caused by your use of any such content or services.
            </p>
          </CardContent>
        </Card>

        {/* Limitation of Liability */}
        <Card>
          <CardHeader>
            <CardTitle>Limitation of Liability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              UNDER NO CIRCUMSTANCES SHALL IRONVAULT, ITS OFFICERS, DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE TO YOU 
              FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES WHATSOEVER RESULTING FROM:
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground ml-4">
              <li>• Any errors, mistakes, or inaccuracies of content</li>
              <li>• Personal injury or property damage resulting from your use of the Service</li>
              <li>• Any unauthorized access to or use of our servers</li>
              <li>• Any interruption or cessation of the Service</li>
              <li>• Any bugs, viruses, or malware transmitted through the Service</li>
              <li>• Any loss or damage to any data or content</li>
              <li>• Any loss or corruption of your passwords or other sensitive information</li>
            </ul>
          </CardContent>
        </Card>

        {/* Changes to Disclaimer */}
        <Card>
          <CardHeader>
            <CardTitle>Changes to This Disclaimer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              We reserve the right to modify this disclaimer at any time. Changes and clarifications will take effect 
              immediately upon posting on this page. We encourage you to review this disclaimer periodically for any updates.
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card className="bg-muted">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-2">Questions or Concerns?</h3>
            <p className="text-sm text-foreground mb-4">
              If you have any questions about this disclaimer, please contact us:
            </p>
            <p className="text-sm text-foreground">
              <strong>Email:</strong>{' '}
              <a href="mailto:subsafeironvault@gmail.com" className="text-primary hover:underline">
                subsafeironvault@gmail.com
              </a>
            </p>
          </CardContent>
        </Card>

        {/* Final Notice */}
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/30 text-center">
          <p className="text-sm text-foreground">
            By using IronVault, you acknowledge that you have read, understood, and agree to this Disclaimer and all associated risks.
          </p>
        </div>
      </div>
    </InfoLayout>
  );
}

