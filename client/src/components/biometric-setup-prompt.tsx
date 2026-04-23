import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Fingerprint } from 'lucide-react';
import { isNativeApp } from '@/native/platform';
import { checkBiometricCapabilities, enableBiometricUnlock, isBiometricUnlockEnabled, getBiometricKeystore } from '@/native/biometrics';
import { CryptoService } from '@/lib/crypto';
import { useToast } from '@/hooks/use-toast';

interface BiometricSetupPromptProps {
  masterPassword: string | null;
  vaultId: string | null;
}

export function BiometricSetupPrompt({ masterPassword, vaultId }: BiometricSetupPromptProps) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric');
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    if (!isNativeApp() || !masterPassword || !vaultId) return;

    const sessionKey = `iv_bio_asked_${vaultId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    let cancelled = false;

    const check = async () => {
      try {
        const [capabilities, alreadyEnabled] = await Promise.all([
          checkBiometricCapabilities(),
          isBiometricUnlockEnabled(vaultId),
        ]);

        if (cancelled) return;
        if (!capabilities.isAvailable || alreadyEnabled) return;

        const label =
          capabilities.biometryType === 'faceId' ? 'Face ID' :
          capabilities.biometryType === 'touchId' ? 'Touch ID' :
          'Biometric';

        setBiometricLabel(label);
        // Small delay so the UI settles after unlock before showing prompt
        setTimeout(() => { if (!cancelled) setShow(true); }, 800);
      } catch {
        // silently ignore
      }
    };

    check();
    return () => { cancelled = true; };
  }, [masterPassword, vaultId]);

  const dismiss = () => {
    if (vaultId) sessionStorage.setItem(`iv_bio_asked_${vaultId}`, '1');
    setShow(false);
  };

  const enable = async () => {
    if (!masterPassword || !vaultId) return;
    setIsEnabling(true);
    try {
      const salt = CryptoService.generateSalt();
      const keystore = getBiometricKeystore();
      const vaultUnlockKey = await keystore.deriveVaultUnlockKey(masterPassword, salt);
      const success = await enableBiometricUnlock(vaultUnlockKey, vaultId);

      if (success) {
        // Store salt for future key re-derivation
        localStorage.setItem(
          `ironvault_biometric_salt_${vaultId}`,
          btoa(Array.from(salt).map(b => String.fromCharCode(b)).join(''))
        );
        toast({ title: `${biometricLabel} Enabled`, description: `Unlock faster with ${biometricLabel}.` });
      } else {
        toast({ title: 'Could not enable', description: 'Make sure biometrics are enrolled on your device.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to enable biometric unlock.', variant: 'destructive' });
    } finally {
      setIsEnabling(false);
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="max-w-xs text-center">
        <DialogHeader className="items-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <Fingerprint className="w-7 h-7 text-primary" />
          </div>
          <DialogTitle>Enable {biometricLabel}?</DialogTitle>
          <DialogDescription className="text-center">
            Unlock your vault faster with {biometricLabel} instead of typing your master password every time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={enable} disabled={isEnabling} className="w-full">
            {isEnabling ? 'Enabling…' : `Enable ${biometricLabel}`}
          </Button>
          <Button variant="ghost" onClick={dismiss} className="w-full text-muted-foreground">
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
