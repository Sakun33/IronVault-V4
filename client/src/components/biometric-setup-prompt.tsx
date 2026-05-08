import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Fingerprint, ScanFace } from 'lucide-react';
import { isNativeApp } from '@/native/platform';
import {
  checkBiometricCapabilities,
  enrollBiometric,
  hasBiometricEntryForVault,
} from '@/native/biometrics';
import { useToast } from '@/hooks/use-toast';
import { getAccountEmail } from '@/lib/account-auth';
import { vaultManager } from '@/lib/vault-manager';

interface BiometricSetupPromptProps {
  masterPassword: string | null;
  vaultId: string | null;
}

/**
 * One-shot post-unlock dialog. Asks the user to enable biometric for the
 * vault they just unlocked. Stores email + accountPassword + masterPassword
 * together so the next launch can sign them in with a single biometric
 * gesture (no typed password anywhere).
 */
export function BiometricSetupPrompt({ masterPassword, vaultId }: BiometricSetupPromptProps) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<'Face ID' | 'Touch ID' | 'Fingerprint' | 'Biometric'>('Biometric');
  const [iconType, setIconType] = useState<'face' | 'finger'>('finger');
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    if (!isNativeApp() || !masterPassword || !vaultId) return;

    const sessionKey = `iv_bio_asked_${vaultId}`;
    if (sessionStorage.getItem(sessionKey)) return;

    let cancelled = false;

    const check = async () => {
      try {
        // We need both the device biometric capability AND the just-validated
        // account password (stashed by login.tsx). Without the account password
        // we can't enrol a complete entry, so skip the prompt entirely.
        const accountPassword = sessionStorage.getItem('iv_pending_bio_account_pw');
        if (!accountPassword) return;

        const [capabilities, alreadyEnabled] = await Promise.all([
          checkBiometricCapabilities(),
          hasBiometricEntryForVault(vaultId),
        ]);

        if (cancelled) return;
        if (!capabilities.isAvailable || alreadyEnabled) return;

        setBiometricLabel(capabilities.biometricLabel);
        setIconType(capabilities.biometryType === 'faceId' || capabilities.biometryType === 'face' ? 'face' : 'finger');

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
    const email = getAccountEmail();
    const accountPassword = sessionStorage.getItem('iv_pending_bio_account_pw');
    if (!email || !accountPassword) {
      toast({
        title: 'Could not enable',
        description: 'Sign in with your password again to enable biometric.',
        variant: 'destructive',
      });
      dismiss();
      return;
    }

    setIsEnabling(true);
    try {
      const vault = vaultManager.getExistingVaults().find(v => v.id === vaultId);
      const vaultName = vault?.name || 'Vault';

      const success = await enrollBiometric({
        email,
        accountPassword,
        masterPassword,
        vaultId,
        vaultName,
      });

      if (success) {
        // Once enrolled, biometric reveals the password — no need to keep it
        // in sessionStorage.
        sessionStorage.removeItem('iv_pending_bio_account_pw');
        toast({
          title: `${biometricLabel} Enabled`,
          description: `Sign in and unlock with ${biometricLabel} next time.`,
        });
      } else {
        toast({
          title: 'Could not enable',
          description: 'Make sure biometrics are enrolled on your device.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to enable biometric unlock.',
        variant: 'destructive',
      });
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
            {iconType === 'face'
              ? <ScanFace className="w-7 h-7 text-primary" />
              : <Fingerprint className="w-7 h-7 text-primary" />}
          </div>
          <DialogTitle>Enable {biometricLabel}?</DialogTitle>
          <DialogDescription className="text-center">
            One {biometricLabel} gesture will sign you in and unlock this vault — no typed passwords needed.
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
