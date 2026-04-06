import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoLayout } from '@/components/info-layout';
import { 
  Shield, Lock, Key, Database, CloudOff, Eye, EyeOff,
  Server, CheckCircle, AlertTriangle, FileKey, Fingerprint
} from 'lucide-react';

export default function SecurityPage() {
  return (
    <InfoLayout title="Security">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <Shield className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            Security Architecture
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            IronVault is built with security at its core. Every design decision prioritizes the protection 
            and privacy of your sensitive data.
          </p>
        </div>

        {/* Security Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-center font-bold text-foreground mb-2">
                Military-Grade Encryption
              </h3>
              <p className="text-sm text-center text-muted-foreground">
                AES-256-GCM encryption protects all your data with the same standards used by governments and military organizations worldwide.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <CloudOff className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-center font-bold text-foreground mb-2">
                Zero-Knowledge Architecture
              </h3>
              <p className="text-sm text-center text-muted-foreground">
                Your data never leaves your device unencrypted. We have zero knowledge of your passwords or sensitive information.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-center font-bold text-foreground mb-2">
                Local-Only Storage
              </h3>
              <p className="text-sm text-center text-muted-foreground">
                All data is stored locally in your browser's IndexedDB. No cloud servers, no external databases, complete privacy.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Encryption Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileKey className="w-6 h-6" />
              Encryption Implementation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold text-foreground mb-3">AES-256-GCM Encryption</h4>
              <p className="text-muted-foreground mb-4">
                IronVault uses AES-256 in Galois/Counter Mode (GCM), which provides both confidentiality and authenticity. 
                This means your data is not only encrypted but also protected against tampering.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>256-bit key length:</strong> Provides 2^256 possible keys, making brute-force attacks computationally infeasible</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>GCM mode:</strong> Authenticated encryption prevents unauthorized data modification</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>Unique IV per encryption:</strong> Each piece of data gets a cryptographically random initialization vector</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Key Derivation (PBKDF2)</h4>
              <p className="text-muted-foreground mb-4">
                Your master password is transformed into an encryption key using PBKDF2 (Password-Based Key Derivation Function 2) 
                with a high iteration count to protect against brute-force attacks.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>600,000+ iterations (Default):</strong> OWASP recommended minimum for 2024</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>Unique salt per vault:</strong> Prevents rainbow table attacks</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span><strong>Adjustable iterations:</strong> Configurable for different security levels (100K to 2M)</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Security Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Security Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Lock className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      Auto-Lock Protection
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Vault automatically locks after configurable inactivity period to prevent unauthorized access.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <EyeOff className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      Password Masking
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Passwords hidden by default with optional reveal functionality for enhanced privacy.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Fingerprint className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      Biometric Authentication
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Support for fingerprint and face recognition on compatible devices using Web Authentication API.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      Breach Prevention
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Failed login attempt tracking with automatic lockout to prevent brute-force attacks.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      Secure Password Generation
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Cryptographically secure random number generation for passwords using Web Crypto API.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Server className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      No External Dependencies
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      All encryption happens client-side. No API calls, no external servers, no data transmission.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Guarantees */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-6 h-6" />
              Privacy Guarantees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              At IronVault, we take your privacy seriously. Here's what we guarantee:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h4 className="font-semibold text-foreground">We DO</h4>
                </div>
                <ul className="space-y-1 text-sm text-foreground">
                  <li>✓ Encrypt all data client-side before storage</li>
                  <li>✓ Store everything locally on your device</li>
                  <li>✓ Use industry-standard encryption algorithms</li>
                  <li>✓ Provide export/import for your control</li>
                  <li>✓ Open-source our code for transparency</li>
                </ul>
              </div>

              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <h4 className="font-semibold text-foreground">We DON'T</h4>
                </div>
                <ul className="space-y-1 text-sm text-foreground">
                  <li>✗ Send your data to any server</li>
                  <li>✗ Store your master password</li>
                  <li>✗ Track your usage or behavior</li>
                  <li>✗ Share data with third parties</li>
                  <li>✗ Use analytics or telemetry</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Implementation */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Implementation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Data Storage
              </h4>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-foreground mb-3">
                  IronVault uses IndexedDB, a browser-native database that stores data locally on your device. 
                  All data is encrypted before being written to IndexedDB, ensuring that even if someone gains 
                  physical access to your device, they cannot read your data without your master password.
                </p>
                <code className="block p-3 bg-muted text-primary text-xs rounded">
                  Data Flow: Plain Text → AES-256-GCM Encryption → IndexedDB → Decryption → Plain Text
                </code>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Key className="w-5 h-5 text-primary" />
                Master Password Security
              </h4>
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <p className="text-sm text-foreground">
                  Your master password is never stored. Instead, it's used to derive an encryption key through PBKDF2:
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-primary mt-1">1.</span>
                    <span className="text-foreground">Master password entered by user</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-primary mt-1">2.</span>
                    <span className="text-foreground">PBKDF2 with 600,000+ iterations + unique salt</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-primary mt-1">3.</span>
                    <span className="text-foreground">Derived key used for AES-256-GCM encryption/decryption</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-primary mt-1">4.</span>
                    <span className="text-foreground">Key exists only in memory during active session</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-3">Security Best Practices</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                  <h5 className="font-medium text-sm text-foreground mb-1">For Users</h5>
                  <ul className="space-y-1 text-xs text-foreground">
                    <li>• Use a strong, unique master password (16+ characters)</li>
                    <li>• Enable auto-lock after inactivity</li>
                    <li>• Regular backups using Export feature</li>
                    <li>• Keep your browser and OS updated</li>
                    <li>• Never share your master password</li>
                  </ul>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h5 className="font-medium text-sm text-foreground mb-1">Technical Measures</h5>
                  <ul className="space-y-1 text-xs text-foreground">
                    <li>• Web Crypto API for all cryptographic operations</li>
                    <li>• Secure random number generation (crypto.getRandomValues)</li>
                    <li>• Memory cleanup after encryption operations</li>
                    <li>• Content Security Policy (CSP) headers</li>
                    <li>• No inline scripts or eval() usage</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit & Compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Security Audits & Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-foreground">
              IronVault undergoes continuous security review. We follow industry best practices
              and standards to ensure your data remains secure.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-xl font-bold text-foreground mb-1">OWASP</div>
                <div className="text-xs text-muted-foreground">Security Guidelines</div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-xl font-bold text-foreground mb-1">NIST</div>
                <div className="text-xs text-muted-foreground">Encryption Standards</div>
              </div>
              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-xl font-bold text-foreground mb-1">GDPR</div>
                <div className="text-xs text-muted-foreground">Privacy Compliant</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="pt-6">
            <h3 className="text-xl font-bold text-foreground mb-4 text-center">
              Questions About Security?
            </h3>
            <p className="text-center text-foreground mb-4">
              We're happy to discuss our security measures in detail.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="mailto:subsafeironvault@gmail.com" className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                Email Security Team
              </a>
              <a href="/docs" className="px-6 py-3 bg-card text-foreground border border-border rounded-lg hover:bg-accent transition-colors">
                Read Documentation
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </InfoLayout>
  );
}

