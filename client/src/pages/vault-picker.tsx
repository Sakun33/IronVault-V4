import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Eye, EyeOff, Lock, Plus, Cloud, ShieldCheck, LogOut, Fingerprint, Zap,
} from 'lucide-react';
import { AppLogo } from '@/components/app-logo';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { vaultStorage } from '@/lib/storage';
import { vaultManager, type VaultInfo } from '@/lib/vault-manager';
import { checkBiometricCapabilities, unlockWithBiometric, isBiometricUnlockEnabled } from '@/native/biometrics';
import { isNativeApp } from '@/native/platform';
import { listCloudVaults, downloadCloudVault, getCloudToken, acquireCloudToken, markVaultAsCloudSynced, type CloudVaultMeta } from '@/lib/cloud-vault-sync';
import { getAccountPasswordHash } from '@/lib/account-auth';
import { useLicense } from '@/contexts/license-context';
import { usePlanFeatures } from '@/hooks/use-plan-features';

export default function VaultPickerPage() {
  const [, setLocation] = useLocation();
  const { login, loginWithKey, accountEmail, accountLogout } = useAuth();
  const { toast } = useToast();
  const { license } = useLicense();

  const { localVaultLimit, isLoading: planLoading } = usePlanFeatures();

  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricVaultId, setBiometricVaultId] = useState<string | null>(null);

  const [cloudVaults, setCloudVaults] = useState<CloudVaultMeta[]>([]);
  const [cloudDownloading, setCloudDownloading] = useState<string | null>(null);
  const [cloudPasswordInput, setCloudPasswordInput] = useState<Record<string, string>>({});
  const [cloudShowPw, setCloudShowPw] = useState<Record<string, boolean>>({});
  const [cloudErrors, setCloudErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Always re-read local vaults from the (now email-scoped) registry
    const list = vaultManager.getExistingVaults();
    setVaults(list);

    // Check biometric availability for the default vault
    const checkBiometric = async () => {
      if (!isNativeApp()) return;
      try {
        const caps = await checkBiometricCapabilities();
        if (!caps.isAvailable) return;
        const defaultVault = vaultManager.getDefaultVault();
        if (!defaultVault) return;
        const enabled = await isBiometricUnlockEnabled(defaultVault.id);
        if (enabled) {
          setBiometricAvailable(true);
          setBiometricVaultId(defaultVault.id);
        }
      } catch {
        // Biometric check failed silently
      }
    };
    checkBiometric();

    // Load cloud vaults — only possible once we know the account email
    const loadCloudVaults = async () => {
      if (!accountEmail) return;
      // Ensure we have a cloud token
      let token = getCloudToken();
      if (!token) {
        const hash = getAccountPasswordHash();
        if (hash) token = await acquireCloudToken(accountEmail, hash);
      }
      if (!token) return;
      const remote = await listCloudVaults();
      setCloudVaults(remote);
    };
    loadCloudVaults();
  }, [accountEmail]); // re-run when email is set (e.g. after initializeAuth completes)

  const handleUnlock = async (vaultId: string, vaultName: string) => {
    const pw = passwords[vaultId] || '';
    if (!pw) {
      setErrors(e => ({ ...e, [vaultId]: 'Please enter your master password.' }));
      return;
    }
    setErrors(e => ({ ...e, [vaultId]: '' }));
    setLoading(vaultId);
    try {
      vaultManager.setActiveVaultId(vaultId);
      await vaultStorage.switchToVault(vaultId);
      const success = await login(pw);
      if (success) {
        await vaultManager.resetFailedAttempts();
        toast({ title: 'Vault Unlocked', description: `Welcome back! Opened "${vaultName}"` });
        setLocation('/');
      } else {
        setErrors(e => ({ ...e, [vaultId]: 'Incorrect master password. Please try again.' }));
      }
    } catch {
      setErrors(e => ({ ...e, [vaultId]: 'Failed to unlock vault.' }));
    } finally {
      setLoading(null);
    }
  };

  const handleBiometricUnlock = async () => {
    if (!biometricVaultId) return;
    setLoading('biometric');
    try {
      const vault = vaultManager.getDefaultVault();
      if (!vault) return;
      vaultManager.setActiveVaultId(vault.id);
      await vaultStorage.switchToVault(vault.id);

      const storedKey = vaultManager.getBiometricKey(vault.id);
      if (storedKey) {
        // Try master password stored for biometric
        const success = await login(storedKey);
        if (success) {
          toast({ title: 'Vault Unlocked', description: `Opened "${vault.name}" via biometric` });
          setLocation('/');
          return;
        }
      }

      // Fall back to native biometric key unlock
      const result = await unlockWithBiometric(vault.id);
      if (result.success && result.vaultUnlockKey) {
        const success = await loginWithKey(result.vaultUnlockKey);
        if (success) {
          toast({ title: 'Vault Unlocked', description: `Opened "${vault.name}" via biometric` });
          setLocation('/');
          return;
        }
      }
      toast({ title: 'Biometric failed', description: 'Please enter your master password.', variant: 'destructive' });
    } catch {
      toast({ title: 'Biometric error', description: 'Please enter your master password.', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleCloudUnlock = async (cloudVault: CloudVaultMeta) => {
    const pw = cloudPasswordInput[cloudVault.vaultId] || '';
    if (!pw) {
      setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: 'Please enter your master password.' }));
      return;
    }
    setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: '' }));
    setCloudDownloading(cloudVault.vaultId);
    try {
      // Pull encrypted blob
      const full = await downloadCloudVault(cloudVault.vaultId);
      if (!full) throw new Error('Failed to download vault from cloud');

      // Register vault in local registry if not already present
      const existing = vaultManager.getExistingVaults().find(v => v.id === cloudVault.vaultId);
      if (!existing) {
        // New device — add to local registry, initialise the vault encryption, then restore items
        vaultManager.addToRegistry({
          id: cloudVault.vaultId,
          name: cloudVault.vaultName,
          createdAt: cloudVault.createdAt || new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isDefault: cloudVault.isDefault,
          biometricEnabled: false,
          iconColor: '#6366f1',
        });
        vaultManager.setActiveVaultId(cloudVault.vaultId);
        await vaultStorage.switchToVault(cloudVault.vaultId);
        // Initialise vault encryption before importing items (fixes blank-IndexedDB unlock failure)
        await vaultStorage.createVault(pw);
        await vaultStorage.importVault(full.encryptedBlob, pw);
      } else {
        // Same device — vault exists locally; re-import from cloud to pick up changes from other devices
        vaultManager.setActiveVaultId(cloudVault.vaultId);
        await vaultStorage.switchToVault(cloudVault.vaultId);
        // Unlock first so encryptionKey is available for re-import
        const unlocked = await vaultStorage.unlockVault(pw);
        if (!unlocked) {
          setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: 'Incorrect master password.' }));
          setCloudDownloading(null);
          return;
        }
        // Replace local items with cloud version
        await vaultStorage.clearEncryptedItems();
        await vaultStorage.importVault(full.encryptedBlob, pw);
      }

      // Now unlock using the master password
      const success = await login(pw);
      if (success) {
        markVaultAsCloudSynced(cloudVault.vaultId);
        toast({ title: 'Cloud Vault Unlocked', description: `Welcome back! Opened "${cloudVault.vaultName}" from cloud` });
        setLocation('/');
      } else {
        setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: 'Incorrect master password.' }));
      }
    } catch (err: any) {
      setCloudErrors(e => ({ ...e, [cloudVault.vaultId]: err?.message || 'Failed to unlock cloud vault.' }));
    } finally {
      setCloudDownloading(null);
    }
  };

  const handleLogout = () => {
    accountLogout();
    setLocation('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <AppLogo size={28} />
          <span className="font-bold text-lg">IronVault</span>
        </div>
        <div className="flex items-center gap-3">
          {accountEmail && (
            <span className="text-sm text-muted-foreground hidden sm:block">{accountEmail}</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-2 text-muted-foreground"
            data-testid="button-account-logout"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Your Vaults</h1>
            <p className="text-muted-foreground">Enter your master password to unlock a vault.</p>
          </div>

          {/* Biometric shortcut (default vault, native only) */}
          {biometricAvailable && biometricVaultId && (
            <Button
              variant="outline"
              className="w-full mb-6 gap-2 h-12"
              onClick={handleBiometricUnlock}
              disabled={loading === 'biometric'}
              data-testid="button-biometric-unlock"
            >
              <Fingerprint className="w-5 h-5 text-primary" />
              {loading === 'biometric' ? 'Unlocking…' : 'Unlock with biometric'}
            </Button>
          )}

          {/* Local vaults */}
          {vaults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No vaults yet. Create your first vault below.</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {vaults.map(vault => (
                <div key={vault.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{vault.name}</span>
                    {vault.isDefault && (
                      <span className="ml-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">Default</span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Local</span>
                  </div>
                  {errors[vault.id] && (
                    <p className="text-destructive text-sm mb-2">{errors[vault.id]}</p>
                  )}
                  <div className="relative mb-3">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-unlock-password"
                      type={showPw[vault.id] ? 'text' : 'password'}
                      placeholder="Master password"
                      value={passwords[vault.id] || ''}
                      onChange={e => setPasswords(p => ({ ...p, [vault.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleUnlock(vault.id, vault.name)}
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(s => ({ ...s, [vault.id]: !s[vault.id] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPw[vault.id] ? 'Hide password' : 'Show password'}
                    >
                      {showPw[vault.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    data-testid="button-unlock-vault"
                    className="w-full"
                    onClick={() => handleUnlock(vault.id, vault.name)}
                    disabled={loading === vault.id}
                  >
                    {loading === vault.id ? 'Unlocking…' : 'Unlock Vault'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Create new vault */}
          {!planLoading && vaults.length >= localVaultLimit ? (
            <div className="w-full mb-8 p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-800 dark:text-amber-300 truncate">
                  {localVaultLimit === 1 ? 'Free plan: 1 vault max' : `Plan limit: ${localVaultLimit} vaults`}
                </span>
              </div>
              <Button
                data-testid="button-upgrade-plan"
                variant="outline"
                size="sm"
                className="shrink-0 text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={() => setLocation('/pricing')}
              >
                <Zap className="w-3 h-3 mr-1" />
                Upgrade
              </Button>
            </div>
          ) : (
            <Button
              data-testid="button-create-new-vault"
              variant="outline"
              className="w-full mb-8 gap-2"
              onClick={() => setLocation('/auth/create-vault')}
            >
              <Plus className="w-4 h-4" />
              Add a vault
            </Button>
          )}

          {/* Cloud vaults section */}
          {cloudVaults.length > 0 ? (
            <div className="space-y-4 mb-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cloud Vaults</p>
              {cloudVaults.map(cv => (
                <div key={cv.vaultId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Cloud className="w-5 h-5 text-blue-500" />
                    <span className="font-semibold">{cv.vaultName}</span>
                    {cv.isDefault && (
                      <span className="ml-1 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">Default</span>
                    )}
                    <span className="ml-auto text-xs text-blue-500 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">Cloud</span>
                  </div>
                  {cloudErrors[cv.vaultId] && (
                    <p className="text-destructive text-sm mb-2">{cloudErrors[cv.vaultId]}</p>
                  )}
                  <div className="relative mb-3">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      data-testid="input-unlock-password"
                      type={cloudShowPw[cv.vaultId] ? 'text' : 'password'}
                      placeholder="Master password"
                      value={cloudPasswordInput[cv.vaultId] || ''}
                      onChange={e => setCloudPasswordInput(p => ({ ...p, [cv.vaultId]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleCloudUnlock(cv)}
                      className="pl-10 pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setCloudShowPw(s => ({ ...s, [cv.vaultId]: !s[cv.vaultId] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={cloudShowPw[cv.vaultId] ? 'Hide password' : 'Show password'}
                    >
                      {cloudShowPw[cv.vaultId] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    data-testid="button-unlock-cloud-vault"
                    className="w-full"
                    onClick={() => handleCloudUnlock(cv)}
                    disabled={cloudDownloading === cv.vaultId}
                  >
                    {cloudDownloading === cv.vaultId ? 'Downloading…' : 'Unlock Vault'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-5 text-center mb-4">
              <Cloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
              {license.tier === 'free' ? (
                <>
                  <p className="text-sm font-medium text-muted-foreground">Cloud Sync — Pro feature</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Upgrade to Pro to sync your vault across devices.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation('/pricing')}>
                    Upgrade to Pro
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-muted-foreground">No cloud vaults yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Create a cloud vault or convert an existing local vault.</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => setLocation('/auth/create-vault?type=cloud')}>
                    <Plus className="w-4 h-4" /> Create cloud vault
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
