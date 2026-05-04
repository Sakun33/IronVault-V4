import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useVaultSelection } from '@/contexts/vault-selection-context';
import { useLicense } from '@/contexts/license-context';
import { useAuth } from '@/contexts/auth-context';
import {
  pushCloudVault,
  deleteCloudVault,
  listCloudVaults,
  queueOfflineSync,
  getCloudToken,
  acquireCloudToken,
  getOrCreateDeviceId,
  markVaultAsCloudSynced,
  markVaultAsNotCloudSynced,
  type CloudVaultMeta,
} from '@/lib/cloud-vault-sync';
import { getAccountPasswordHash } from '@/lib/account-auth';
import { vaultStorage } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { VerifyAccessModal } from '@/components/verify-access-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  ShieldCheck,
  Check,
  MoreVertical,
  Star,
  Fingerprint,
  Trash2,
  Edit,
  Lock,
  Crown,
  ExternalLink,
  Cloud,
  CloudOff,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import type { VaultInfo } from '@/lib/vault-manager';

interface VaultCardProps {
  vault: VaultInfo;
  isActive: boolean;
  isCloudSynced: boolean;
  isSourceDevice: boolean;
  isPaidUser: boolean;
  onSwitch: () => void;
  onOpen: () => void;
  onSetDefault: () => void;
  onToggleBiometric: (enabled: boolean) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onEnableCloud: () => void;
  onDisableCloud: () => void;
  canDelete: boolean;
}

function VaultCard({
  vault, isActive, isCloudSynced, isSourceDevice, isPaidUser,
  onSwitch, onOpen, onSetDefault, onToggleBiometric, onRename,
  onDelete, onEnableCloud, onDisableCloud, canDelete,
}: VaultCardProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(vault.name);
  const { toast } = useToast();

  const handleRename = () => {
    if (newName.trim() && newName !== vault.name) {
      onRename(newName.trim());
    }
    setIsRenaming(false);
  };

  const handleCloudToggle = (checked: boolean) => {
    if (!isPaidUser) {
      toast({ title: 'Pro feature', description: 'Upgrade to Pro to enable cloud sync.', variant: 'destructive' });
      return;
    }
    if (checked) {
      onEnableCloud();
    } else {
      if (!isSourceDevice) {
        toast({
          title: 'Use your original device',
          description: 'Cloud sync can only be disabled from the device that originally uploaded this vault.',
          variant: 'destructive',
        });
        return;
      }
      onDisableCloud();
    }
  };

  return (
    <Card
      className={`relative transition-all cursor-pointer overflow-hidden ${isActive ? 'ring-2 ring-primary' : 'hover-elevate'}`}
      onClick={() => !isActive && onSwitch()}
      data-testid={`card-vault-${vault.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: vault.iconColor + '20' }}
            >
              <ShieldCheck className="w-5 h-5" style={{ color: vault.iconColor }} />
            </div>
            <div className="min-w-0 flex-1">
              {isRenaming ? (
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                  className="h-7"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  data-testid="input-vault-rename"
                />
              ) : (
                <CardTitle className="text-base truncate">{vault.name}</CardTitle>
              )}
              <CardDescription className="text-xs truncate">
                Created {formatDistanceToNow(vault.createdAt, { addSuffix: true })}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {vault.isDefault && (
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                <Star className="w-3 h-3 mr-1" />
                Default
              </Badge>
            )}
            {vault.biometricEnabled && (
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                <Fingerprint className="w-3 h-3 mr-1" />
                Biometric
              </Badge>
            )}
            {isCloudSynced && (
              <Badge variant="outline" className="text-xs whitespace-nowrap text-blue-500 border-blue-300">
                <Cloud className="w-3 h-3 mr-1" />
                Cloud
              </Badge>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`button-vault-menu-${vault.id}`}
                  aria-label={`Vault menu for ${vault.name}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isActive && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onOpen(); }}
                    data-testid="menu-item-open"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Vault
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
                  data-testid="menu-item-rename"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Rename
                </DropdownMenuItem>
                {!vault.isDefault && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
                    data-testid="menu-item-set-default"
                  >
                    <Star className="w-4 h-4 mr-2" />
                    Set as Default
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {canDelete && !vault.isDefault && (
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="text-destructive"
                    data-testid="menu-item-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Biometric toggle */}
        <div
          className="flex items-center justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Fingerprint className="w-4 h-4" />
            <span>Biometric Unlock</span>
          </div>
          <Switch
            checked={vault.biometricEnabled}
            onCheckedChange={onToggleBiometric}
            data-testid={`switch-biometric-${vault.id}`}
          />
        </div>

        {/* Cloud sync toggle */}
        <div
          className="flex items-center justify-between"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {isCloudSynced ? (
              <Cloud className="w-4 h-4 text-blue-500" />
            ) : (
              <CloudOff className="w-4 h-4" />
            )}
            <span>Cloud Sync</span>
            {!isPaidUser && (
              <Crown className="w-3 h-3 text-yellow-500" />
            )}
          </div>
          <Switch
            checked={isCloudSynced}
            onCheckedChange={handleCloudToggle}
            disabled={!isPaidUser}
            data-testid={`switch-cloud-sync-${vault.id}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function VaultManagerUI() {
  const {
    vaults,
    activeVault,
    isLoading,
    canCreateVault,
    maxVaults,
    createVault,
    requestVaultSwitch,
    updateVault,
    deleteVault,
    setDefaultVault,
    toggleBiometric
  } = useVaultSelection();
  const { license } = useLicense();
  const { accountEmail } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newVaultName, setNewVaultName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteVaultId, setDeleteVaultId] = useState<string | null>(null);
  const [pendingBiometricVaultId, setPendingBiometricVaultId] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Cloud sync state
  const [cloudVaultMap, setCloudVaultMap] = useState<Map<string, CloudVaultMeta>>(new Map());
  const [syncDialogVaultId, setSyncDialogVaultId] = useState<string | null>(null);
  const [syncPassword, setSyncPassword] = useState('');
  const [syncShowPw, setSyncShowPw] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [disableCloudVaultId, setDisableCloudVaultId] = useState<string | null>(null);
  const [isDisablingCloud, setIsDisablingCloud] = useState(false);

  const isPaidUser = license.tier === 'pro' || license.tier === 'lifetime' || license.status === 'trial';
  const myDeviceId = getOrCreateDeviceId();

  // Load cloud vault list on mount and when account changes
  useEffect(() => {
    const loadCloudVaults = async () => {
      if (!accountEmail) return;
      let token = getCloudToken();
      if (!token) {
        const hash = getAccountPasswordHash();
        if (hash) token = await acquireCloudToken(accountEmail, hash);
      }
      if (!token) return;
      const remote = await listCloudVaults();
      const map = new Map<string, CloudVaultMeta>();
      for (const v of remote) map.set(v.vaultId, v);
      setCloudVaultMap(map);
    };
    loadCloudVaults();
  }, [accountEmail]);

  const handleCreateVault = async () => {
    if (!newVaultName.trim()) {
      toast({ title: 'Name Required', description: 'Please enter a name for your new vault.', variant: 'destructive' });
      return;
    }
    try {
      setIsCreating(true);
      await createVault(newVaultName.trim());
      toast({ variant: 'success', title: 'Vault Created', description: `"${newVaultName.trim()}" has been created successfully.` });
      setNewVaultName('');
      setIsCreateOpen(false);
    } catch (error) {
      toast({ title: 'Failed to Create Vault', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteVault = async () => {
    if (!deleteVaultId) return;
    try {
      await deleteVault(deleteVaultId);
      toast({ title: 'Vault Deleted', description: 'The vault has been permanently deleted.' });
    } catch (error) {
      toast({ title: 'Failed to Delete Vault', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setDeleteVaultId(null);
    }
  };

  const handleOpenVault = (vaultId: string) => {
    requestVaultSwitch(vaultId);
  };

  const handleRename = async (vaultId: string, name: string) => {
    try {
      await updateVault(vaultId, { name });
      toast({ title: 'Vault Renamed', description: `Vault has been renamed to "${name}".` });
    } catch (error) {
      toast({ title: 'Failed to Rename Vault', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
  };

  const handleToggleBiometric = async (vaultId: string, enabled: boolean) => {
    if (enabled) {
      setPendingBiometricVaultId(vaultId);
      setShowVerifyModal(true);
    } else {
      try {
        await toggleBiometric(vaultId, false);
        toast({ title: 'Biometric Disabled', description: 'Biometric unlock has been disabled for this vault.' });
      } catch (error) {
        toast({ title: 'Failed to Update Settings', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
      }
    }
  };

  const handleVerifiedBiometricEnable = async () => {
    if (!pendingBiometricVaultId) return;
    try {
      await toggleBiometric(pendingBiometricVaultId, true);
      toast({ title: 'Biometric Enabled', description: 'You can now unlock this vault with your fingerprint or face.' });
    } catch (error) {
      toast({ title: 'Failed to Update Settings', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setPendingBiometricVaultId(null);
    }
  };

  const handleSyncToCloud = async () => {
    if (!syncDialogVaultId || !syncPassword) return;
    const vault = vaults.find(v => v.id === syncDialogVaultId);
    if (!vault) return;
    setIsSyncing(true);
    try {
      const blob: string = await vaultStorage.exportVault(syncPassword);
      const result = await pushCloudVault(vault.id, vault.name, blob, vault.isDefault);
      if (result.planError) {
        toast({ title: 'Upgrade required', description: 'Cloud sync is a Pro feature. Please upgrade your plan.', variant: 'destructive' });
      } else if (result.serverNewer) {
        toast({ title: 'Server has newer data', description: 'Cloud already has a newer version of this vault.', variant: 'destructive' });
      } else if (result.success) {
        toast({ title: 'Cloud sync enabled', description: `"${vault.name}" is now synced to the cloud.` });
        markVaultAsCloudSynced(vault.id);
        // Refresh the cloud vault map
        const remote = await listCloudVaults();
        const map = new Map<string, CloudVaultMeta>();
        for (const v of remote) map.set(v.vaultId, v);
        setCloudVaultMap(map);
        setSyncDialogVaultId(null);
        setSyncPassword('');
      } else {
        toast({ title: 'Sync failed', description: 'Could not sync vault. Queued for retry.', variant: 'destructive' });
        queueOfflineSync(vault.id, vault.name, 'push');
        setSyncDialogVaultId(null);
        setSyncPassword('');
      }
    } catch (err) {
      toast({ title: 'Sync failed', description: err instanceof Error ? err.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisableCloudSync = async () => {
    if (!disableCloudVaultId) return;
    const vault = vaults.find(v => v.id === disableCloudVaultId);
    setIsDisablingCloud(true);
    try {
      const ok = await deleteCloudVault(disableCloudVaultId);
      if (ok) {
        toast({ title: 'Cloud sync disabled', description: `"${vault?.name ?? 'Vault'}" removed from cloud. Other devices will no longer see it.` });
        markVaultAsNotCloudSynced(disableCloudVaultId);
        setCloudVaultMap(prev => {
          const next = new Map(prev);
          next.delete(disableCloudVaultId);
          return next;
        });
      } else {
        toast({ title: 'Failed to remove from cloud', description: 'Please try again.', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'An error occurred', variant: 'destructive' });
    } finally {
      setIsDisablingCloud(false);
      setDisableCloudVaultId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse text-muted-foreground">Loading vaults...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Your Vaults</h2>
          <p className="text-sm text-muted-foreground">
            {vaults.length} of {maxVaults} vault{maxVaults !== 1 ? 's' : ''} used
          </p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canCreateVault} data-testid="button-create-vault">
              <Plus className="w-4 h-4 mr-2" />
              New Vault
              {!canCreateVault && !isPaidUser && (
                <Crown className="w-4 h-4 ml-2 text-yellow-500" />
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Vault</DialogTitle>
              <DialogDescription>
                Create a separate vault to organize your passwords and sensitive data.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="vault-name">Vault Name</Label>
                <Input
                  id="vault-name"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  placeholder="e.g., Work, Personal, Family"
                  data-testid="input-new-vault-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button onClick={handleCreateVault} disabled={isCreating || !newVaultName.trim()} data-testid="button-confirm-create">
                {isCreating ? 'Creating...' : 'Create Vault'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!isPaidUser && vaults.length >= 1 && (
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Unlock More Vaults</p>
                <p className="text-sm text-muted-foreground">
                  Upgrade to Pro to create up to 5 separate vaults
                </p>
              </div>
            </div>
            <Button variant="default" size="sm" data-testid="button-upgrade-vaults">
              Upgrade
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {vaults.map((vault) => {
          const cloudMeta = cloudVaultMap.get(vault.id);
          const isCloudSynced = !!cloudMeta;
          const isSourceDevice = !cloudMeta?.sourceDeviceId || cloudMeta.sourceDeviceId === myDeviceId;
          return (
            <VaultCard
              key={vault.id}
              vault={vault}
              isActive={activeVault?.id === vault.id}
              isCloudSynced={isCloudSynced}
              isSourceDevice={isSourceDevice}
              isPaidUser={isPaidUser}
              onSwitch={() => requestVaultSwitch(vault.id)}
              onOpen={() => requestVaultSwitch(vault.id)}
              onSetDefault={() => setDefaultVault(vault.id)}
              onToggleBiometric={(enabled) => handleToggleBiometric(vault.id, enabled)}
              onRename={(name) => handleRename(vault.id, name)}
              onDelete={() => setDeleteVaultId(vault.id)}
              onEnableCloud={() => { setSyncDialogVaultId(vault.id); setSyncPassword(''); setSyncShowPw(false); }}
              onDisableCloud={() => setDisableCloudVaultId(vault.id)}
              canDelete={vaults.length > 1}
            />
          );
        })}
      </div>

      {/* Delete vault confirmation */}
      <AlertDialog open={!!deleteVaultId} onOpenChange={(open) => !open && setDeleteVaultId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vault</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this vault? This action cannot be undone.
              All passwords, notes, and other data in this vault will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVault}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete Vault
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable cloud sync confirmation */}
      <AlertDialog open={!!disableCloudVaultId} onOpenChange={(open) => !open && setDisableCloudVaultId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Cloud Sync</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the cloud copy of this vault. Other browsers and devices will no longer see it in their vault picker.
              Your local copy on this device remains intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisablingCloud}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableCloudSync}
              disabled={isDisablingCloud}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-disable-cloud"
            >
              {isDisablingCloud ? 'Removing…' : 'Remove from Cloud'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Verification modal for enabling biometric */}
      <VerifyAccessModal
        open={showVerifyModal}
        onOpenChange={(open) => {
          setShowVerifyModal(open);
          if (!open) setPendingBiometricVaultId(null);
        }}
        onVerified={handleVerifiedBiometricEnable}
        title="Verify Identity"
        description="Please verify your identity to enable biometric unlock for this vault."
      />

      {/* Enable cloud sync dialog — requires master password to export */}
      <Dialog open={!!syncDialogVaultId} onOpenChange={(open) => { if (!open) { setSyncDialogVaultId(null); setSyncPassword(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enable Cloud Sync</DialogTitle>
            <DialogDescription>
              Enter your master password to encrypt and upload this vault to the cloud.
              It will then be accessible from any browser where you log in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sync-master-password">Master Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="sync-master-password"
                  data-testid="input-sync-master-password"
                  type={syncShowPw ? 'text' : 'password'}
                  placeholder="Enter your master password"
                  value={syncPassword}
                  onChange={e => setSyncPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isSyncing && handleSyncToCloud()}
                  className="pl-10 pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setSyncShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {syncShowPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSyncDialogVaultId(null); setSyncPassword(''); }} disabled={isSyncing}>
              Cancel
            </Button>
            <Button onClick={handleSyncToCloud} disabled={isSyncing || !syncPassword} data-testid="button-confirm-sync-cloud">
              {isSyncing ? 'Uploading…' : 'Enable Cloud Sync'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
