import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Smartphone,
  Key,
  CheckCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
} from 'lucide-react';

export interface TwoFactorSetupPayload {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

interface TwoFactorAuthProps {
  isEnabled: boolean;
  // Begin setup: server generates a secret and returns the otpauth URI + QR.
  // Returns null if setup is unavailable (e.g. user not authenticated).
  onSetup: () => Promise<TwoFactorSetupPayload | null>;
  // Verify the first TOTP code the user types in. Returns the issued backup
  // codes on success, or null on invalid code.
  onVerifyEnable: (code: string) => Promise<string[] | null>;
  // Disable 2FA after verifying a current code (TOTP or backup).
  onDisable: (code: string) => Promise<boolean>;
  // Regenerate backup codes (requires a current code). Replaces the existing
  // set — the user is told the old codes are no longer valid.
  onRegenerateBackupCodes: (code: string) => Promise<string[] | null>;
}

export function TwoFactorAuth({
  isEnabled,
  onSetup,
  onVerifyEnable,
  onDisable,
  onRegenerateBackupCodes,
}: TwoFactorAuthProps) {
  const { toast } = useToast();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [setupStep, setSetupStep] = useState<'intro' | 'verify' | 'complete'>('intro');
  const [savedCodesConfirmed, setSavedCodesConfirmed] = useState(false);
  const [setupPayload, setSetupPayload] = useState<TwoFactorSetupPayload | null>(null);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [regenerateMode, setRegenerateMode] = useState(false);

  const beginSetup = async () => {
    setIsLoading(true);
    try {
      const payload = await onSetup();
      if (!payload) {
        toast({
          title: 'Setup unavailable',
          description: 'Could not start 2FA setup. Make sure you are signed in and try again.',
          variant: 'destructive',
        });
        return;
      }
      setSetupPayload(payload);
      setSetupStep('intro');
      setShowSetupModal(true);
    } catch {
      toast({ title: 'Setup unavailable', description: 'Could not start 2FA setup.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: 'Invalid Code',
        description: 'Please enter a 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const codes = await onVerifyEnable(verificationCode);
      if (codes) {
        setBackupCodes(codes);
        setSetupStep('complete');
        toast({
          title: '2FA Enabled',
          description: 'Two-factor authentication has been enabled for your account',
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: 'The code you entered is incorrect. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to enable 2FA. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    const trimmed = verificationCode.trim();
    if (trimmed.length < 6) {
      toast({
        title: 'Invalid Code',
        description: 'Enter a 6-digit code or a backup code.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await onDisable(trimmed);
      if (success) {
        setShowDisableModal(false);
        setVerificationCode('');
        toast({
          title: '2FA Disabled',
          description: 'Two-factor authentication has been disabled',
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: 'The code you entered is incorrect. Please try again.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to disable 2FA. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Copied to clipboard',
    });
  };

  const handleGenerateNewBackupCodes = async () => {
    const trimmed = regenerateCode.trim();
    if (trimmed.length < 6) {
      toast({ title: 'Invalid Code', description: 'Enter a 6-digit code or backup code.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const codes = await onRegenerateBackupCodes(trimmed);
      if (codes) {
        setBackupCodes(codes);
        setRegenerateCode('');
        setRegenerateMode(false);
        toast({
          title: 'New Codes Generated',
          description: 'Your old backup codes are no longer valid',
        });
      } else {
        toast({
          title: 'Verification Failed',
          description: 'The code you entered is incorrect.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to generate backup codes',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your vault
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEnabled ? 'bg-green-100' : 'bg-muted'}`}>
                {isEnabled ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium">
                  {isEnabled ? '2FA is enabled' : '2FA is not enabled'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isEnabled
                    ? 'Your account is protected with 2FA'
                    : 'Enable 2FA for enhanced security'}
                </p>
              </div>
            </div>
            <Badge variant={isEnabled ? 'default' : 'secondary'}>
              {isEnabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          <div className="flex gap-2">
            {isEnabled ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRegenerateMode(false);
                    setRegenerateCode('');
                    setShowBackupCodesModal(true);
                  }}
                  className="flex-1"
                >
                  <Key className="w-4 h-4 mr-2" />
                  Backup Codes
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDisableModal(true)}
                  className="flex-1"
                >
                  Disable 2FA
                </Button>
              </>
            ) : (
              <Button
                onClick={beginSetup}
                disabled={isLoading}
                className="w-full"
                data-testid="button-enable-2fa"
              >
                <Shield className="w-4 h-4 mr-2" />
                {isLoading ? 'Starting…' : 'Enable 2FA'}
              </Button>
            )}
          </div>

          {!isEnabled && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium text-sm">Why enable 2FA?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Protects against unauthorized access
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Adds security even if passcode is compromised
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  Industry-standard TOTP authentication
                </li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Setup Modal */}
      <Dialog open={showSetupModal} onOpenChange={(open) => {
        if (!open) {
          setShowSetupModal(false);
          setVerificationCode('');
          setSetupStep('intro');
          setSavedCodesConfirmed(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {setupStep === 'complete' ? 'Setup Complete' : 'Set Up 2FA'}
            </DialogTitle>
            <DialogDescription>
              {setupStep === 'intro' && 'Use an authenticator app to generate verification codes'}
              {setupStep === 'verify' && 'Enter the 6-digit code from your authenticator app'}
              {setupStep === 'complete' && 'Two-factor authentication is now enabled'}
            </DialogDescription>
          </DialogHeader>

          {setupStep === 'intro' && setupPayload && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Scan this QR code or enter the key manually:
                </p>
                <img
                  src={setupPayload.qrDataUrl}
                  alt="Scan with your authenticator app"
                  className="w-40 h-40 mx-auto rounded-lg bg-white p-2"
                  data-testid="img-2fa-qr"
                />
                <div className="mt-3 flex items-center justify-center gap-2">
                  <code className="bg-background px-2 py-1 rounded text-xs font-mono break-all max-w-[200px]" data-testid="text-2fa-secret">
                    {setupPayload.secret}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(setupPayload.secret)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-medium text-sm">Recommended Apps:</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                    <Smartphone className="w-4 h-4" />
                    Google Authenticator
                  </div>
                  <div className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                    <Smartphone className="w-4 h-4" />
                    Authy
                  </div>
                </div>
              </div>

              <Button onClick={() => setSetupStep('verify')} className="w-full">
                Continue
              </Button>
            </div>
          )}

          {setupStep === 'verify' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification-code">Verification Code</Label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest font-mono"
                  data-testid="input-2fa-verify"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSetupStep('intro')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleEnable2FA}
                  disabled={isLoading || verificationCode.length !== 6}
                  className="flex-1"
                  data-testid="button-2fa-verify"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Enable'}
                </Button>
              </div>
            </div>
          )}

          {setupStep === 'complete' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Save these backup codes in a safe place. You can use them if you lose access to your authenticator app.
                </p>
              </div>

              <div className="bg-muted rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="text-xs font-mono bg-background p-2 rounded text-center">
                      {code}
                    </code>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => copyToClipboard(backupCodes.join('\n'))}
                className="w-full"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy All Codes
              </Button>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={savedCodesConfirmed}
                  onChange={(e) => setSavedCodesConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-sm text-muted-foreground">
                  I've saved these backup codes in a safe place
                </span>
              </label>

              <Button
                onClick={() => {
                  setShowSetupModal(false);
                  setVerificationCode('');
                  setSetupStep('intro');
                  setSavedCodesConfirmed(false);
                }}
                className="w-full"
                disabled={!savedCodesConfirmed}
              >
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable Modal */}
      <Dialog open={showDisableModal} onOpenChange={setShowDisableModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Disable 2FA
            </DialogTitle>
            <DialogDescription>
              Enter your 6-digit code (or a backup code) to disable two-factor authentication
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-code">Verification Code</Label>
              <Input
                id="disable-code"
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="text-center text-2xl tracking-widest font-mono"
                data-testid="input-2fa-disable"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDisableModal(false);
                  setVerificationCode('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisable2FA}
                disabled={isLoading || verificationCode.trim().length < 6}
                className="flex-1"
                data-testid="button-2fa-disable"
              >
                {isLoading ? 'Disabling...' : 'Disable'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Modal */}
      <Dialog open={showBackupCodesModal} onOpenChange={(open) => {
        setShowBackupCodesModal(open);
        if (!open) {
          setRegenerateMode(false);
          setRegenerateCode('');
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Backup Codes
            </DialogTitle>
            <DialogDescription>
              Use these codes if you lose access to your authenticator app
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {backupCodes.length > 0 ? (
              <div className="bg-muted rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="text-xs font-mono bg-background p-2 rounded text-center">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-center text-sm text-muted-foreground py-4">
                  Backup codes are only shown once when generated. Generate a new set below if you've lost yours.
                </p>
              </div>
            )}

            {regenerateMode ? (
              <div className="space-y-2">
                <Label htmlFor="regen-code" className="text-sm">
                  Verify with a current code to regenerate
                </Label>
                <Input
                  id="regen-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code or backup code"
                  value={regenerateCode}
                  onChange={(e) => setRegenerateCode(e.target.value)}
                  className="font-mono"
                  data-testid="input-2fa-regen"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRegenerateMode(false);
                      setRegenerateCode('');
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGenerateNewBackupCodes}
                    disabled={isLoading || regenerateCode.trim().length < 6}
                    className="flex-1"
                    data-testid="button-2fa-regen"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setRegenerateMode(true)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Generate New
                </Button>
                {backupCodes.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(backupCodes.join('\n'))}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TwoFactorAuth;
