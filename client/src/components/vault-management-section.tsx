import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield, Plus, Edit, Trash2, Star, StarOff, Cloud, HardDrive,
  AlertTriangle, Fingerprint, Eye, EyeOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { vaultManager, type VaultInfo } from '@/lib/vault-manager';
import { vaultStorage } from '@/lib/storage';
import {
  pushCloudVault, deleteCloudVault, listCloudVaults,
  markVaultAsCloudSynced, markVaultAsNotCloudSynced, isVaultCloudSynced,
  getCloudToken, acquireCloudToken,
} from '@/lib/cloud-vault-sync';
import { getAccountPasswordHash } from '@/lib/account-auth';
import { isBiometricUnlockEnabled, enableBiometricUnlock, disableBiometricUnlock } from '@/native/biometrics';
import { isNativeApp } from '@/native/platform';
import { usePlanFeatures } from '@/hooks/use-plan-features';

interface VaultRow extends VaultInfo {
  biometricEnabled: boolean;
  isCloudSynced: boolean;
  itemCount?: number;
}

export function VaultManagementSection() {
  const { toast } = useToast();
  const { masterPassword, accountEmail } = useAuth();
  const { vaultLimit, isPaid } = usePlanFeatures();
  const onWeb = !isNativeApp();

  const [vaults, setVaults] = useState<VaultRow[]>([]);
  // Cloud-only vault IDs (cloud vaults that are NOT in the local registry).
  // Counted toward the plan's TOTAL vault limit alongside local vaults.
  const [cloudOnlyCount, setCloudOnlyCount] = useState(0);
  const [activeVaultId, setActiveVaultId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [vaultToDelete, setVaultToDelete] = useState<VaultRow | null>(null);
  const [renameTarget, setRenameTarget] = useState<VaultRow | null>(null);

  // Create form state
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPassword, setNewVaultPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newVaultType, setNewVaultType] = useState<'local' | 'cloud'>('local');
  const [showNewPw, setShowNewPw] = useState(false);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Rename state
  const [renameValue, setRenameValue] = useState('');

  // Delete state
  const [isDeleting, setIsDeleting] = useState(false);

  const loadVaults = useCallback(async () => {
    const list = vaultManager.getExistingVaults();
    const active = vaultManager.getActiveVaultId();
    setActiveVaultId(active);

    // Try to merge cloud-vault metadata so we can show Cloud vs Local badges
    let cloudIds = new Set<string>();
    try {
      let token = getCloudToken();
      if (!token && accountEmail) {
        const hash = getAccountPasswordHash();
        if (hash) token = await acquireCloudToken(accountEmail, hash);
      }
      if (token) {
        const remote = await listCloudVaults();
        cloudIds = new Set(remote.map(v => v.vaultId));
      }
    } catch {
      // Offline / no cloud — fall back to local cloud-synced flag
    }

    const rows: VaultRow[] = await Promise.all(
      list.map(async v => ({
        ...v,
        biometricEnabled: await isBiometricUnlockEnabled(v.id),
        isCloudSynced: cloudIds.has(v.id) || isVaultCloudSynced(v.id),
        itemCount: v.id === active ? await getActiveVaultItemCount() : undefined,
      })),
    );
    setVaults(rows);
    // Cloud vaults that don't appear in the local registry — these still
    // count toward the plan's TOTAL vault limit.
    const localIds = new Set(list.map(v => v.id));
    let extra = 0;
    cloudIds.forEach(id => { if (!localIds.has(id)) extra += 1; });
    setCloudOnlyCount(extra);
  }, [accountEmail]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  // TOTAL count = local registry + cloud-only vaults (cloud-synced locals are counted once).
  const combinedVaultCount = vaults.length + cloudOnlyCount;
  const canCreateVault = combinedVaultCount < vaultLimit;

  const resetCreateForm = () => {
    setNewVaultName('');
    setNewVaultPassword('');
    setConfirmPassword('');
    setShowNewPw(false);
    setNewVaultType(onWeb ? 'cloud' : 'local');
    setCreateError('');
  };

  const handleOpenCreate = () => {
    resetCreateForm();
    setShowCreateDialog(true);
  };

  const handleCreateVault = async () => {
    setCreateError('');
    if (!newVaultName.trim()) { setCreateError('Vault name is required'); return; }
    if (newVaultPassword.length < 8) { setCreateError('Master password must be at least 8 characters'); return; }
    if (newVaultPassword !== confirmPassword) { setCreateError('Passwords do not match'); return; }

    setIsCreating(true);
    const previousActive = vaultManager.getActiveVaultId();
    const previousKey = (vaultStorage as unknown as { encryptionKey?: CryptoKey }).encryptionKey ?? null;

    try {
      // 1) Register the new vault in the email-scoped registry.
      //    Pass cloud-only count so the limit check uses the COMBINED total.
      const newVault = await vaultManager.createVault(
        newVaultName.trim(),
        combinedVaultCount === 0,
        vaultLimit,
        cloudOnlyCount,
      );

      // 2) Provision IndexedDB + encryption key for it
      vaultManager.setActiveVaultId(newVault.id);
      await vaultStorage.switchToVault(newVault.id);
      await vaultStorage.createVault(newVaultPassword);

      // 3) Save password verification hash so this vault can be unlocked later
      await vaultManager.createVaultPassword(newVault.id, newVaultPassword);

      // 4) Push to cloud if requested
      const wantsCloud = newVaultType === 'cloud' || onWeb;
      if (wantsCloud) {
        try {
          const blob = await vaultStorage.exportVault(newVaultPassword);
          const result = await pushCloudVault(newVault.id, newVault.name, blob, false);
          if (result.planError) {
            toast({
              title: 'Cloud sync requires Pro',
              description: 'Vault was created locally. Upgrade to enable cloud sync.',
              variant: 'destructive',
            });
          } else if (result.success) {
            markVaultAsCloudSynced(newVault.id);
          } else {
            toast({
              title: 'Cloud sync failed',
              description: 'Vault was created locally — sync will retry when online.',
              variant: 'destructive',
            });
          }
        } catch {
          toast({
            title: 'Cloud sync failed',
            description: 'Vault was created locally.',
            variant: 'destructive',
          });
        }
      }

      // 5) Restore the previously active vault — we don't want to silently
      //    switch the user out of their unlocked vault into a brand-new locked one.
      if (previousActive && previousActive !== newVault.id) {
        vaultManager.setActiveVaultId(previousActive);
        await vaultStorage.switchToVault(previousActive);
        if (previousKey) vaultStorage.setEncryptionKey(previousKey);
      }

      toast({
        title: 'Vault created',
        description: `"${newVault.name}" is ready. Unlock it from the vault picker after locking.`,
      });

      setShowCreateDialog(false);
      resetCreateForm();
      await loadVaults();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create vault';
      setCreateError(message.startsWith('PLAN_LIMIT:') ? message.slice('PLAN_LIMIT:'.length).trim() : message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartRename = (vault: VaultRow) => {
    setRenameTarget(vault);
    setRenameValue(vault.name);
    setShowRenameDialog(true);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renameTarget.name) {
      setShowRenameDialog(false);
      return;
    }
    try {
      await vaultManager.updateVault(renameTarget.id, { name: trimmed });
      // If the renamed vault is cloud-synced, push the new name up so it shows
      // correctly on other devices. Best-effort: only works if it's the active
      // vault (we have the key) — otherwise the next push from that vault will
      // pick it up.
      if (renameTarget.isCloudSynced && renameTarget.id === activeVaultId && masterPassword) {
        try {
          const blob = await vaultStorage.exportVault(masterPassword);
          await pushCloudVault(renameTarget.id, trimmed, blob, renameTarget.isDefault);
        } catch {
          // Non-fatal — local rename already persisted
        }
      }
      toast({ title: 'Vault renamed', description: `Renamed to "${trimmed}"` });
      setShowRenameDialog(false);
      setRenameTarget(null);
      setRenameValue('');
      await loadVaults();
    } catch (err) {
      toast({
        title: 'Rename failed',
        description: err instanceof Error ? err.message : 'Could not rename vault',
        variant: 'destructive',
      });
    }
  };

  const handleSetDefault = async (vault: VaultRow) => {
    try {
      await vaultManager.updateVault(vault.id, { isDefault: true });
      toast({ title: 'Default vault changed', description: `"${vault.name}" is now your default.` });
      await loadVaults();
    } catch (err) {
      toast({
        title: 'Failed',
        description: err instanceof Error ? err.message : 'Could not set default',
        variant: 'destructive',
      });
    }
  };

  const handleToggleBiometric = async (vault: VaultRow) => {
    try {
      if (vault.biometricEnabled) {
        await disableBiometricUnlock(vault.id);
        toast({ title: 'Biometric disabled', description: `Disabled for "${vault.name}"` });
      } else {
        if (vault.id !== activeVaultId || !masterPassword) {
          toast({
            title: 'Unlock vault first',
            description: 'Switch to and unlock this vault before enabling biometric unlock.',
            variant: 'destructive',
          });
          return;
        }
        const ok = await enableBiometricUnlock(masterPassword, vault.id);
        if (ok) {
          toast({ title: 'Biometric enabled', description: `Enabled for "${vault.name}"` });
        } else {
          toast({ title: 'Biometric failed', description: 'Could not enable biometric unlock', variant: 'destructive' });
          return;
        }
      }
      await loadVaults();
    } catch {
      toast({ title: 'Error', description: 'Could not update biometric setting', variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!vaultToDelete) return;
    if (vaults.length <= 1) {
      toast({
        title: 'Cannot delete last vault',
        description: 'You must keep at least one vault.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);
    try {
      // Cloud delete first — if the local registry entry is gone but cloud
      // still has it, the vault would reappear in the picker on next sync.
      if (vaultToDelete.isCloudSynced) {
        const ok = await deleteCloudVault(vaultToDelete.id);
        if (!ok) {
          toast({
            title: 'Cloud delete failed',
            description: 'Could not remove from cloud. Aborting so the vault can be retried.',
            variant: 'destructive',
          });
          setIsDeleting(false);
          return;
        }
        markVaultAsNotCloudSynced(vaultToDelete.id);
      }

      // Local delete: removes from registry, deletes IndexedDB, repoints active vault
      await vaultManager.deleteVault(vaultToDelete.id);
      vaultManager.removeVaultPassword(vaultToDelete.id);
      vaultManager.removeBiometricKey(vaultToDelete.id);

      toast({
        title: 'Vault deleted',
        description: `"${vaultToDelete.name}" and all its data have been deleted.`,
      });
      setVaultToDelete(null);
      await loadVaults();
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Could not delete vault',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Your Vaults
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs whitespace-nowrap" data-testid="badge-vault-usage">
                {combinedVaultCount}/{vaultLimit === -1 ? '∞' : vaultLimit} vaults
              </Badge>
              <Button
                size="sm"
                onClick={handleOpenCreate}
                disabled={!canCreateVault}
                className="text-xs h-7 px-2"
                data-testid="button-create-vault-section"
              >
                <Plus className="w-3 h-3 mr-1" />
                New vault
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {vaults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No vaults yet</p>
              <Button className="mt-4" onClick={handleOpenCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Create your first vault
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {vaults.map(vault => {
                const isActive = vault.id === activeVaultId;
                return (
                  <div
                    key={vault.id}
                    data-testid={`vault-row-${vault.id}`}
                    className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border bg-card transition-colors ${
                      isActive ? 'border-primary/40 bg-primary/5' : 'hover:bg-accent/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${vault.iconColor}20` }}
                      >
                        <Shield className="w-5 h-5" style={{ color: vault.iconColor }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{vault.name}</span>
                          {vault.isDefault && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5">
                              <Star className="w-3 h-3" />
                              Default
                            </Badge>
                          )}
                          {vault.isCloudSynced ? (
                            <Badge variant="outline" className="text-[10px] gap-0.5 text-blue-600 border-blue-200 dark:border-blue-700 dark:text-blue-400">
                              <Cloud className="w-3 h-3" />
                              Cloud
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-0.5 text-muted-foreground">
                              <HardDrive className="w-3 h-3" />
                              Local
                            </Badge>
                          )}
                          {vault.biometricEnabled && (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              <Fingerprint className="w-3 h-3" />
                              Biometric
                            </Badge>
                          )}
                          {isActive && (
                            <Badge variant="outline" className="text-[10px] bg-green-500/10 text-green-600 border-green-500/30">
                              Active
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Created {format(vault.createdAt, 'MMM d, yyyy')}
                          {typeof vault.itemCount === 'number' && ` · ${vault.itemCount} items`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {!vault.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(vault)}
                          title="Set as default"
                          aria-label="Set as default"
                        >
                          <StarOff className="w-4 h-4" />
                        </Button>
                      )}
                      {isNativeApp() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleBiometric(vault)}
                          title={vault.biometricEnabled ? 'Disable biometric' : 'Enable biometric'}
                          aria-label={vault.biometricEnabled ? 'Disable biometric' : 'Enable biometric'}
                        >
                          <Fingerprint className={`w-4 h-4 ${vault.biometricEnabled ? 'text-primary' : ''}`} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartRename(vault)}
                        title="Rename vault"
                        aria-label="Rename vault"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={vaults.length <= 1}
                        onClick={() => setVaultToDelete(vault)}
                        title={vaults.length <= 1 ? 'Cannot delete the last vault' : 'Delete vault'}
                        aria-label="Delete vault"
                        className="text-destructive hover:text-destructive disabled:text-muted-foreground"
                        data-testid={`button-delete-vault-${vault.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!canCreateVault && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Vault limit reached</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                {isPaid
                  ? `Your plan allows up to ${vaultLimit} vaults total (local + cloud combined).`
                  : 'Upgrade to Pro for up to 5 vaults total (local + cloud combined).'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Vault Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open && !isCreating) { setShowCreateDialog(false); resetCreateForm(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create new vault
            </DialogTitle>
            <DialogDescription>
              Vaults are encrypted with their own master password. Pick a name and choose where to store it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-vault-name">Vault name</Label>
              <Input
                id="new-vault-name"
                data-testid="input-new-vault-name"
                placeholder="e.g. Work, Personal, Family"
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                className="mt-1.5"
                autoFocus
              />
            </div>

            {/* Vault type — only meaningful when running natively. On web we always create cloud. */}
            {!onWeb && (
              <div>
                <Label className="text-sm">Where to store</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setNewVaultType('local')}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                      newVaultType === 'local'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    data-testid="button-vault-type-local"
                  >
                    <HardDrive className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Local only</p>
                      <p className="text-[11px] text-muted-foreground">This device</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewVaultType('cloud')}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                      newVaultType === 'cloud'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    data-testid="button-vault-type-cloud"
                  >
                    <Cloud className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Cloud sync</p>
                      <p className="text-[11px] text-muted-foreground">All devices</p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="new-vault-password">Master password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="new-vault-password"
                  data-testid="input-new-vault-password"
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={newVaultPassword}
                  onChange={(e) => setNewVaultPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  aria-label={showNewPw ? 'Hide password' : 'Show password'}
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="new-vault-confirm">Confirm master password</Label>
              <Input
                id="new-vault-confirm"
                data-testid="input-confirm-vault-password"
                type={showNewPw ? 'text' : 'password'}
                placeholder="Re-enter master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5"
                autoComplete="new-password"
              />
            </div>

            {createError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                {createError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleCreateVault} disabled={isCreating} data-testid="button-confirm-create-vault">
              {isCreating ? 'Creating…' : 'Create vault'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={(open) => { if (!open) { setShowRenameDialog(false); setRenameTarget(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Rename vault
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label htmlFor="rename-vault">New name</Label>
            <Input
              id="rename-vault"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmRename(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
            <Button onClick={handleConfirmRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!vaultToDelete} onOpenChange={(open) => { if (!open && !isDeleting) setVaultToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete &ldquo;{vaultToDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the vault and{' '}
              <strong>all data inside it</strong>
              {typeof vaultToDelete?.itemCount === 'number'
                ? ` (${vaultToDelete.itemCount} items)`
                : ' (passwords, notes, documents, subscriptions, expenses)'}
              .{' '}
              {vaultToDelete?.isCloudSynced
                ? 'It will be removed from the cloud and from this device. This cannot be undone.'
                : 'This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-vault"
            >
              {isDeleting ? 'Deleting…' : 'Delete vault'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

async function getActiveVaultItemCount(): Promise<number | undefined> {
  try {
    // Storage might not be unlocked yet. Wrap each call so a single failure
    // doesn't blow up the whole count.
    const safe = async (fn: () => Promise<unknown[]>) => {
      try { return (await fn()).length; } catch { return 0; }
    };
    const [pw, notes, subs, exp] = await Promise.all([
      safe(() => vaultStorage.getAllPasswords()),
      safe(() => vaultStorage.getAllNotes()),
      safe(() => vaultStorage.getAllSubscriptions()),
      safe(() => vaultStorage.getAllExpenses()),
    ]);
    return pw + notes + subs + exp;
  } catch {
    return undefined;
  }
}
