import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Shield, Lock } from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { vaultStorage } from '@/lib/storage';
import { vaultManager } from '@/lib/vault-manager';
import { pushCloudVault, queueOfflineSync } from '@/lib/cloud-vault-sync';

export default function CreateVaultPage() {
  const [, setLocation] = useLocation();
  const { createVault } = useAuth();
  const { toast } = useToast();

  const [vaultName, setVaultName] = useState('My Vault');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Master password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      const isFirst = vaultManager.isFirstVault();
      const newVault = await vaultManager.createVault(vaultName.trim() || 'My Vault', isFirst);
      await vaultManager.createVaultPassword(newVault.id, password);
      vaultManager.setActiveVaultId(newVault.id);
      await vaultStorage.switchToVault(newVault.id);
      await createVault(password);

      // If creating as cloud vault, push to server
      const isCloud = new URLSearchParams(window.location.search).get('type') === 'cloud';
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
            toast({ title: 'Cloud vault created', description: 'Your vault is now synced to the cloud.' });
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

          <form onSubmit={handleSubmit} className="space-y-5">
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
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="button-create-vault"
              className="w-full h-11 text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Creating vault…' : 'Create Vault'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
