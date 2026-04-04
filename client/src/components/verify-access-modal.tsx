import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Fingerprint, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { authenticateWithBiometric, isBiometricUnlockEnabled } from '@/native/biometrics';
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
  const { masterPassword } = useAuth();
  const { toast } = useToast();

  // Check biometric availability on mount and when modal opens
  useEffect(() => {
    const checkBiometric = async () => {
      console.log('VerifyModal: Checking biometric...', { isNative: isNativeApp(), open });
      if (isNativeApp()) {
        try {
          // Get the default vault ID from vault manager
          const defaultVault = vaultManager.getDefaultVault();
          const vaultId = defaultVault?.id || 'default';
          console.log('VerifyModal: Default vault ID:', vaultId);
          
          const enabled = await isBiometricUnlockEnabled(vaultId);
          console.log('VerifyModal: Biometric enabled for vault:', enabled);
          setBiometricAvailable(enabled);
        } catch (error) {
          console.error('VerifyModal: Error checking biometric:', error);
          // On iOS, still try to show biometric option
          setBiometricAvailable(true);
        }
      }
    };
    if (open) {
      checkBiometric();
    }
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
    setIsLoading(true);
    try {
      const result = await authenticateWithBiometric('Verify your identity');
      if (result.success) {
        onOpenChange(false);
        onVerified();
      } else {
        toast({
          title: 'Verification Failed',
          description: result.error || 'Biometric verification failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to verify with biometrics',
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

        <div className="space-y-4 py-4">
          {/* Biometric Option */}
          {biometricAvailable && isNativeApp() && (
            <Button
              variant="outline"
              className="w-full h-12 gap-2"
              onClick={handleBiometricVerify}
              disabled={isLoading}
            >
              <Fingerprint className="w-5 h-5" />
              Use Biometric Authentication
            </Button>
          )}

          {biometricAvailable && isNativeApp() && (
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
