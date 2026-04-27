import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { Eye, EyeOff, Shield, Mail, KeyRound, CheckCircle2, Loader2 } from 'lucide-react';

type Step = 'current' | 'new' | 'code' | 'rotating' | 'done';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** User's account email — code is sent here. */
  accountEmail: string | null;
}

export function ChangeMasterPasswordDialog({ open, onOpenChange, accountEmail }: Props) {
  const { toast } = useToast();
  const { changeMasterPassword } = useAuth();
  const [step, setStep] = useState<Step>('current');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('current');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCode('');
    setShowCurrent(false);
    setShowNew(false);
    setBusy(false);
    setProgress(0);
    setError(null);
  };

  const handleClose = (next: boolean) => {
    if (busy && step === 'rotating') return; // no closing mid-rotation
    if (!next) reset();
    onOpenChange(next);
  };

  const handleVerifyCurrent = async () => {
    setError(null);
    if (!currentPassword) { setError('Enter your current master password'); return; }
    setBusy(true);
    try {
      const { vaultStorage } = await import('@/lib/storage');
      const ok = await vaultStorage.verifyMasterPassword(currentPassword);
      if (!ok) { setError('That master password is incorrect'); return; }
      setStep('new');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitNew = async () => {
    setError(null);
    if (newPassword.length < 8) { setError('New master password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    if (newPassword === currentPassword) { setError('New password must differ from current password'); return; }
    if (!accountEmail) {
      setError('No account email on file. Sign in to your IronVault account first.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountEmail, purpose: 'master_password_change' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to send verification code');
        return;
      }
      toast({
        title: 'Code sent',
        description: `Check ${accountEmail} for a 6-digit code (expires in 10 min).`,
      });
      setStep('code');
    } catch (e: any) {
      setError(e?.message || 'Network error sending code');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCodeAndRotate = async () => {
    setError(null);
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) { setError('Enter the 6-digit code from your email'); return; }
    if (!accountEmail) { setError('Account email missing'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accountEmail, code: trimmed, purpose: 'master_password_change' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Code verification failed');
        return;
      }
      // Code accepted — perform the re-encryption.
      setStep('rotating');
      setProgress(0);
      await changeMasterPassword(currentPassword, newPassword, (p) => setProgress(p));
      setStep('done');
      toast({
        title: 'Master password changed',
        description: 'Your vault has been re-encrypted with the new master password.',
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to change master password');
      setStep('code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="change-master-password-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Change Master Password
          </DialogTitle>
          <DialogDescription>
            {step === 'current' && 'Confirm your current master password to continue.'}
            {step === 'new' && 'Choose a new master password (min. 8 characters).'}
            {step === 'code' && `We emailed a 6-digit code to ${accountEmail}.`}
            {step === 'rotating' && 'Re-encrypting your vault with the new key…'}
            {step === 'done' && 'Your vault is now secured with the new master password.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'current' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cmp-current">Current master password</Label>
              <div className="relative">
                <Input
                  id="cmp-current"
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                  data-testid="input-current-master-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive" data-testid="cmp-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>Cancel</Button>
              <Button onClick={handleVerifyCurrent} disabled={busy} data-testid="button-cmp-verify-current">
                {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'new' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cmp-new">New master password</Label>
              <div className="relative">
                <Input
                  id="cmp-new"
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                  data-testid="input-new-master-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cmp-confirm">Confirm new master password</Label>
              <Input
                id="cmp-confirm"
                type={showNew ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                data-testid="input-confirm-master-password"
              />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                We'll email a 6-digit verification code to <strong>{accountEmail || 'your account email'}</strong> before re-encrypting.
              </span>
            </div>
            {error && <p className="text-sm text-destructive" data-testid="cmp-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('current')} disabled={busy}>Back</Button>
              <Button onClick={handleSubmitNew} disabled={busy} data-testid="button-cmp-send-code">
                {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                <Mail className="w-4 h-4 mr-1" />
                Send code
              </Button>
            </div>
          </div>
        )}

        {step === 'code' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cmp-code">6-digit code</Label>
              <Input
                id="cmp-code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
                data-testid="input-verification-code"
              />
            </div>
            {error && <p className="text-sm text-destructive" data-testid="cmp-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('new')} disabled={busy}>Back</Button>
              <Button onClick={handleVerifyCodeAndRotate} disabled={busy || code.length !== 6} data-testid="button-cmp-verify-code">
                {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Verify & change password
              </Button>
            </div>
          </div>
        )}

        {step === 'rotating' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-center">Re-encrypting vault… {progress}%</div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Please don't close this window until it's done.
              </p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Use your new master password the next time you unlock the vault.
              If you have other devices signed in, log out and back in there with
              the new password to pick up the change.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => handleClose(false)} data-testid="button-cmp-done">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
