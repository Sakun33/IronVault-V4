import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Shield, Lock, Zap, Cloud } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { vaultStorage } from '@/lib/storage';
import { vaultManager } from '@/lib/vault-manager';
import { pushCloudVault, queueOfflineSync, markVaultAsCloudSynced } from '@/lib/cloud-vault-sync';
import { usePlanFeatures } from '@/hooks/use-plan-features';
import { isNativeApp } from '@/native/platform';

export default function CreateVaultPage() {
  const [, setLocation] = useLocation();
  const { createVault, accountEmail } = useAuth();
  const { toast } = useToast();
  const { vaultLimit, isPaid, isLoading: planLoading } = usePlanFeatures();

  const [vaultName, setVaultName] = useState('My Vault');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const onWeb = !isNativeApp();

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      if (typeof window.Razorpay === 'undefined') {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Razorpay failed to load'));
          setTimeout(() => reject(new Error('Razorpay load timeout')), 10000);
          document.head.appendChild(s);
        });
      }
      const email = accountEmail || localStorage.getItem('iv_account_email') || '';
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro_monthly', email }),
      });
      const { orderId, amount, currency, keyId } = await res.json();
      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: 'IronVault',
        description: 'IronVault Pro Monthly',
        order_id: orderId,
        handler: async (response: any) => {
          const verify = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, plan: 'pro_monthly', email }),
          });
          if ((await verify.json()).success) {
            window.location.reload();
          }
        },
        prefill: { email },
        theme: { color: '#4f46e5' },
      });
      rzp.open();
    } catch (err) {
      console.error('Payment error:', err);
      toast({ title: 'Payment error', description: 'Could not open checkout. Try again.', variant: 'destructive' });
    } finally {
      setUpgradeLoading(false);
    }
  };
  // create-vault.tsx is the legacy single-vault create page (used pre-picker).
  // It only knows about local vaults — cloud-only count is unknown here, so the
  // limit is enforced as best-effort against the local registry. The vault
  // picker (vault-picker.tsx) is the authoritative path with combined counting.
  const currentVaultCount = vaultManager.getLocalVaultCount();
  const atLimit = !planLoading && !onWeb && currentVaultCount >= vaultLimit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Master password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      const isFirst = vaultManager.isFirstVault();
      const newVault = await vaultManager.createVault(vaultName.trim() || 'My Vault', isFirst, vaultLimit);
      await vaultManager.createVaultPassword(newVault.id, password);
      vaultManager.setActiveVaultId(newVault.id);
      await vaultStorage.switchToVault(newVault.id);
      await createVault(password);

      // On web, always create as cloud vault (web = cloud only)
      const isCloud = onWeb || new URLSearchParams(window.location.search).get('type') === 'cloud';
      if (isCloud) {
        try {
          const blob = await vaultStorage.exportVault(password);
          const result = await pushCloudVault(newVault.id, newVault.name, blob, false);
          if (result.planError) {
            toast({ title: 'Cloud sync requires Pro', description: 'Vault created locally. Upgrade to enable cloud sync.', variant: 'destructive' });
          } else if (!result.success) {
            toast({ title: 'Cloud sync failed', description: 'Vault created locally. Will retry when online.', variant: 'destructive' });
            queueOfflineSync(newVault.id, newVault.name, 'push');
          } else {
            toast({ variant: 'success', title: 'Cloud vault created', description: 'Your vault is now synced to the cloud.' });
            markVaultAsCloudSynced(newVault.id);
          }
        } catch {
          toast({ title: 'Cloud sync failed', description: 'Vault created locally.', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Vault Created!', description: `"${newVault.name}" is ready.` });
      }

      setLocation('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <AppLogo size={28} />
          <span className="font-bold text-lg">IronVault</span>
        </div>
        <Link href="/">
          <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to vaults
          </a>
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">Create a vault</h1>
            <p className="text-muted-foreground">
              Your vault is encrypted with a master password — keep it safe, we can't recover it.
            </p>
          </div>

          {/* Web upgrade gate — free users on web cannot create vaults */}
          {onWeb && !isPaid && !planLoading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Cloud className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Pro plan required for web access</h2>
              <p className="text-sm text-muted-foreground mb-1">
                Creating vaults on the web requires a Pro, Family, or Lifetime plan.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Free plan users can create local vaults on the mobile app.
              </p>
              <Button onClick={handleUpgrade} disabled={upgradeLoading} className="gap-2">
                <Zap className="w-4 h-4" />
                {upgradeLoading ? 'Loading…' : 'Upgrade to Pro'}
              </Button>
            </div>
          )}

          {/* Plan limit upgrade prompt */}
          {!onWeb && atLimit && (
            <div className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-center">
              <Zap className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="font-semibold text-sm mb-1">
                {vaultLimit === 1 ? 'Free plan: 1 vault limit reached' : `Plan limit reached: ${vaultLimit} vaults total`}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Upgrade to Pro or Lifetime to create up to 5 vaults total (local + cloud combined).
              </p>
              <Link href="/pricing">
                <a className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 border border-amber-400 dark:border-amber-600 rounded-lg px-3 py-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors">
                  <Zap className="w-3 h-3" />
                  Upgrade your plan
                </a>
              </Link>
            </div>
          )}

          {/* Hide form for free users on web — they see the upgrade gate above */}
          <form onSubmit={handleSubmit} className={`space-y-5 ${onWeb && !isPaid && !planLoading ? 'hidden' : ''}`}>
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Vault Name */}
            <div>
              <Label htmlFor="create-vault-name" className="text-sm font-medium">
                Vault Name
              </Label>
              <div className="relative mt-1.5">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="create-vault-name"
                  data-testid="input-vault-name"
                  type="text"
                  placeholder="My Vault"
                  value={vaultName}
                  onChange={e => setVaultName(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* Master Password */}
            <div>
              <Label htmlFor="create-master-password" className="text-sm font-medium">
                Master Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="create-master-password"
                  data-testid="input-create-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This encrypts all data in your vault. Different from your account password.
              </p>
            </div>

            {/* Confirm Master Password */}
            <div>
              <Label htmlFor="create-confirm-password" className="text-sm font-medium">
                Confirm Master Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="create-confirm-password"
                  data-testid="input-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter your master password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  aria-pressed={showConfirm}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="button-create-vault"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading || atLimit}
            >
              {isLoading ? 'Creating vault…' : atLimit ? 'Vault limit reached — upgrade to continue' : 'Create Vault'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
