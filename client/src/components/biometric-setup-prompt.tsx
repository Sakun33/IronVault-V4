import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Fingerprint, ScanFace } from 'lucide-react';
import { isNativeApp, apiBase } from '@/native/platform';
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
 *
 * Two enrolment modes:
 *  - Fast path: account password was stashed by login.tsx (password
 *    sign-in). One tap and we're done.
 *  - Verify path: user signed in via OAuth/Passkey or returned after
 *    sessionStorage was cleared. We ask for the account password
 *    inline and verify it against /api/auth/token before enrolling.
 */
export function BiometricSetupPrompt({ masterPassword, vaultId }: BiometricSetupPromptProps) {
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<'Face ID' | 'Touch ID' | 'Fingerprint' | 'Biometric'>('Biometric');
  const [iconType, setIconType] = useState<'face' | 'finger'>('finger');
  const [isEnabling, setIsEnabling] = useState(false);
  // When we don't have a cached account password (OAuth/Passkey sign-in),
  // ask the user to type it once. We verify against the server before
  // storing — never trust an unverified password in the keystore.
  const [needsPasswordEntry, setNeedsPasswordEntry] = useState(false);
  const [typedAccountPassword, setTypedAccountPassword] = useState('');
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    if (!isNativeApp() || !masterPassword || !vaultId) return;

    let cancelled = false;

    const check = async (force = false) => {
      try {
        const sessionKey = `iv_bio_asked_${vaultId}`;
        // Manual trigger (Settings → "Enable Now") bypasses the dismissal
        // gate so users can pull up the prompt on demand. Auto-prompt path
        // still respects the per-session "asked already" flag.
        if (!force && sessionStorage.getItem(sessionKey)) return;

        // Device capability + not-already-enrolled check. We DO NOT bail
        // when the cached account password is missing anymore — instead
        // we fall through to the inline-password entry path so OAuth and
        // Passkey users can enable biometric too.
        const [capabilities, alreadyEnabled] = await Promise.all([
          checkBiometricCapabilities(),
          hasBiometricEntryForVault(vaultId),
        ]);

        if (cancelled) return;
        if (!capabilities.isAvailable) {
          if (force) {
            toast({
              title: 'Biometric not available',
              description: 'No fingerprint or Face ID is set up on this device.',
              variant: 'destructive',
            });
          }
          return;
        }
        if (alreadyEnabled && !force) return;

        // Need an account email regardless of which path — without it we
        // can't enrol because Stage-1 biometric login needs the email.
        const email = getAccountEmail();
        if (!email) {
          if (force) {
            toast({
              title: 'Sign in first',
              description: 'Sign in to your account before enabling biometric.',
              variant: 'destructive',
            });
          }
          return;
        }

        setBiometricLabel(capabilities.biometricLabel);
        setIconType(capabilities.biometryType === 'faceId' || capabilities.biometryType === 'face' ? 'face' : 'finger');

        // Decide the mode based on whether login.tsx stashed the password.
        const cachedPassword = sessionStorage.getItem('iv_pending_bio_account_pw');
        setNeedsPasswordEntry(!cachedPassword);

        if (force) {
          setShow(true);
        } else {
          // Small delay so the UI settles after unlock before showing prompt.
          setTimeout(() => { if (!cancelled) setShow(true); }, 800);
        }
      } catch {
        // silently ignore
      }
    };

    check();

    // Manual trigger from Settings → "Enable Now" button.
    const onManualTrigger = () => { void check(true); };
    window.addEventListener('iv-biometric-prompt-now', onManualTrigger);

    return () => {
      cancelled = true;
      window.removeEventListener('iv-biometric-prompt-now', onManualTrigger);
    };
  }, [masterPassword, vaultId, toast]);

  const dismiss = () => {
    if (vaultId) sessionStorage.setItem(`iv_bio_asked_${vaultId}`, '1');
    setShow(false);
    setTypedAccountPassword('');
    setVerifyError('');
  };

  /**
   * Verify the typed account password against /api/auth/token before
   * trusting it for enrolment. Returns the password on success so the
   * caller can pass it straight to enrollBiometric.
   */
  const verifyAccountPassword = async (email: string, candidate: string): Promise<string | null> => {
    try {
      // Hash the password client-side the same way account-auth does, then
      // POST to /api/auth/token which returns 200 on valid creds and 401
      // on invalid. We rely on the server side rather than a local hash
      // compare because the user may not yet have an offline hash stored
      // (e.g. fresh OAuth sign-in on this device).
      const { sha256 } = await import('@/lib/account-auth');
      const hash = await sha256(candidate);
      const res = await fetch(`${apiBase()}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, accountPasswordHash: hash }),
      });
      if (res.ok) return candidate;
      if (res.status === 401) {
        setVerifyError('That account password is incorrect.');
        return null;
      }
      setVerifyError('Could not verify password. Check your connection and try again.');
      return null;
    } catch (err) {
      console.error('[biometric-setup] verify failed:', err);
      setVerifyError('Could not reach the server to verify the password.');
      return null;
    }
  };

  const enable = async () => {
    if (!masterPassword || !vaultId) return;
    const email = getAccountEmail();
    if (!email) {
      toast({
        title: 'Could not enable',
        description: 'Sign in again to enable biometric.',
        variant: 'destructive',
      });
      dismiss();
      return;
    }

    setIsEnabling(true);
    setVerifyError('');
    try {
      // Resolve the account password: cached fast-path or inline-verify.
      let accountPassword = sessionStorage.getItem('iv_pending_bio_account_pw');
      if (!accountPassword) {
        if (!typedAccountPassword) {
          setVerifyError('Enter your account password to continue.');
          return;
        }
        const verified = await verifyAccountPassword(email, typedAccountPassword);
        if (!verified) return; // verifyError already set
        accountPassword = verified;
      }

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
        // Once enrolled, biometric reveals the password — no need to keep
        // it in sessionStorage. Also clear the typed password buffer.
        sessionStorage.removeItem('iv_pending_bio_account_pw');
        setTypedAccountPassword('');
        toast({
          title: `${biometricLabel} Enabled`,
          description: `Sign in and unlock with ${biometricLabel} next time.`,
        });
        dismiss();
      } else {
        toast({
          title: 'Could not enable',
          description: 'Make sure biometrics are enrolled on your device.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('[biometric-setup] enrol failed:', err);
      toast({
        title: 'Error',
        description: 'Failed to enable biometric unlock.',
        variant: 'destructive',
      });
    } finally {
      setIsEnabling(false);
    }
  };

  if (!show) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent className="max-w-sm text-center">
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

        {needsPasswordEntry && (
          <div className="text-left space-y-2 mt-2">
            <Label htmlFor="bio-account-pw" className="text-sm">
              Confirm your account password
            </Label>
            <Input
              id="bio-account-pw"
              type="password"
              autoComplete="current-password"
              placeholder="Account password"
              value={typedAccountPassword}
              onChange={(e) => { setTypedAccountPassword(e.target.value); setVerifyError(''); }}
              disabled={isEnabling}
              data-testid="input-bio-account-password"
            />
            <p className="text-xs text-muted-foreground">
              Needed so {biometricLabel} can sign you in next time without typing.
            </p>
            {verifyError && (
              <p className="text-xs text-destructive" role="alert">{verifyError}</p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={enable}
            disabled={isEnabling || (needsPasswordEntry && !typedAccountPassword)}
            className="w-full"
            data-testid="button-enable-biometric"
          >
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
