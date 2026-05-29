import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Fingerprint, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import {
  unlockVaultWithBiometric,
  hasBiometricEntryForVault,
  checkBiometricCapabilities,
} from '@/native/biometrics';
import { isNativeApp } from '@/native/platform';
import { vaultManager } from '@/lib/vault-manager';

interface VerifyAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export function VerifyAccessModal({
  open,
  onOpenChange,
  onVerified,
  title = 'Verify Access',
  description = 'Please verify your identity to view sensitive information.',
}: VerifyAccessModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Face ID');
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const { masterPassword } = useAuth();
  const { toast } = useToast();

  // Detect biometric availability — requires (1) native app, (2) hardware
  // capability, (3) a stored credential for the currently active vault.
  // Falls back to default vault if no active vault is set.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const checkBiometric = async () => {
      if (!isNativeApp()) {
        setBiometricAvailable(false);
        return;
      }
      try {
        const vaultId = vaultManager.getActiveVaultId()
          || vaultManager.getDefaultVault()?.id
          || 'default';
        if (cancelled) return;
        setActiveVaultId(vaultId);

        const [caps, hasEntry] = await Promise.all([
          checkBiometricCapabilities(),
          hasBiometricEntryForVault(vaultId),
        ]);
        if (cancelled) return;

        setBiometricLabel(caps.biometricLabel || 'Face ID');
        setBiometricAvailable(caps.isAvailable && caps.isEnrolled && hasEntry);
      } catch (error) {
        console.error('VerifyModal: biometric probe failed', error);
        if (!cancelled) setBiometricAvailable(false);
      }
    };

    checkBiometric();
    return () => { cancelled = true; };
  }, [open]);

  const handlePasswordVerify = () => {
    if (password === masterPassword) {
      setPassword('');
      onOpenChange(false);
      onVerified();
    } else {
      toast({
        title: 'Invalid Password',
        description: 'The master password you entered is incorrect.',
        variant: 'destructive',
      });
    }
  };

  const handleBiometricVerify = async () => {
    if (!activeVaultId) return;
    setIsLoading(true);
    try {
      // Retrieve the stored master password via biometric and verify it
      // matches the unlocked vault's master password. This guards against
      // a stale enrolment unlocking the wrong vault.
      const result = await unlockVaultWithBiometric(activeVaultId);
      if (!result.success || !result.masterPassword) {
        toast({
          title: 'Verification Failed',
          description: result.error || 'Biometric verification failed',
          variant: 'destructive',
        });
        return;
      }
      if (result.masterPassword !== masterPassword) {
        toast({
          title: 'Verification Failed',
          description: 'Stored biometric credentials do not match the active vault. Re-enrol from Profile → Security.',
          variant: 'destructive',
        });
        return;
      }
      setPassword('');
      onOpenChange(false);
      onVerified();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to verify with biometrics',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 pt-4 pb-4 overflow-y-auto">
          {/* Biometric Option */}
          {biometricAvailable && (
            <Button
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={handleBiometricVerify}
              disabled={isLoading}
              data-testid="verify-biometric-button"
            >
              <Fingerprint className="w-5 h-5" />
              {isLoading ? 'Verifying…' : `Use ${biometricLabel}`}
            </Button>
          )}

          {biometricAvailable && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>
          )}

          {/* Password Option */}
          <div className="space-y-2">
            <Label htmlFor="verify-password">Master Password</Label>
            <div className="relative">
              <Input
                id="verify-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your master password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerify()}
                className="pr-10"
                autoFocus={!biometricAvailable}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <Button className="w-full" onClick={handlePasswordVerify} disabled={!password}>
            Verify
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
