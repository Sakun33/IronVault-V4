/**
 * Vault Management Component
 * 
 * Provides UI for managing multiple vaults in the Profile page:
 * - View all vaults with name, default badge, lock status
 * - Set default vault
 * - Rename vault
 * - Delete vault
 * - Create new vault
 * - Show vault counter (X/Y)
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  Plus, 
  Star, 
  Lock, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Crown,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { useMultiVaultAuth, VaultInfo } from '@/contexts/multi-vault-auth-context';
import { useToast } from '@/hooks/use-toast';

interface CreateVaultDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, password: string) => Promise<void>;
  canCreate: boolean;
  maxVaults: number;
  currentCount: number;
}

function CreateVaultDialog({ open, onClose, onSubmit, canCreate, maxVaults, currentCount }: CreateVaultDialogProps) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    
    if (!name.trim()) {
      setError('Vault name is required');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    try {
      await onSubmit(name.trim(), password);
      setName('');
      setPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vault');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Create New Vault
          </DialogTitle>
          <DialogDescription>
            <span className="flex items-center gap-2 mt-1">
              Vaults: {currentCount}/{maxVaults}
              {!canCreate && (
                <Badge variant="destructive" className="text-xs">Limit Reached</Badge>
              )}
            </span>
          </DialogDescription>
        </DialogHeader>

        {!canCreate ? (
          <Alert variant="destructive" className="mt-4">
            <Crown className="w-4 h-4" />
            <AlertDescription>
              You've reached the maximum number of vaults for your plan. 
              Upgrade to Premium to create up to 5 vaults.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="vaultName">Vault Name</Label>
              <Input
                id="vaultName"
                placeholder="My Vault"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="vaultPassword">Master Password</Label>
              <div className="relative mt-1">
                <Input
                  id="vaultPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmVaultPassword">Confirm Password</Label>
              <Input
                id="confirmVaultPassword"
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {canCreate && (
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Vault'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteVaultDialogProps {
  open: boolean;
  vault: VaultInfo | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

function DeleteVaultDialog({ open, vault, onClose, onConfirm }: DeleteVaultDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete Vault
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{vault?.name}"? This action cannot be undone.
            All passwords, notes, and data in this vault will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            This will permanently delete all data stored in this vault.
          </AlertDescription>
        </Alert>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Deleting...' : 'Delete Vault'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VaultManagement() {
  const { 
    vaults, 
    activeVault,
    vaultCount, 
    maxVaults, 
    canCreateVault,
    userTier,
    createVault: createVaultFn,
    setDefaultVault,
    renameVault: renameVaultFn,
    deleteVault: deleteVaultFn,
  } = useMultiVaultAuth();
  
  const { toast } = useToast();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [vaultToDelete, setVaultToDelete] = useState<VaultInfo | null>(null);
  const [editingVault, setEditingVault] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Sort vaults: default first, then by name
  const sortedVaults = [...vaults].sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleCreateVault = async (name: string, password: string) => {
    await createVaultFn(name, password, false);
    toast({
      title: 'Vault Created',
      description: `"${name}" has been created successfully.`,
    });
  };

  const handleSetDefault = async (vaultId: string) => {
    await setDefaultVault(vaultId);
    toast({
      title: 'Default Vault Updated',
      description: 'Your default vault has been changed.',
    });
  };

  const handleStartRename = (vault: VaultInfo) => {
    setEditingVault(vault.id);
    setEditName(vault.name);
  };

  const handleSaveRename = async (vaultId: string) => {
    if (!editName.trim()) return;
    
    await renameVaultFn(vaultId, editName.trim());
    setEditingVault(null);
    setEditName('');
    
    toast({
      title: 'Vault Renamed',
      description: `Vault has been renamed to "${editName.trim()}"`,
    });
  };

  const handleCancelRename = () => {
    setEditingVault(null);
    setEditName('');
  };

  const handleDeleteClick = (vault: VaultInfo) => {
    setVaultToDelete(vault);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!vaultToDelete) return;
    
    await deleteVaultFn(vaultToDelete.id);
    toast({
      title: 'Vault Deleted',
      description: `"${vaultToDelete.name}" has been deleted.`,
      variant: 'destructive',
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Vaults
            </CardTitle>
            <Badge variant="outline" className="text-sm">
              {vaultCount} / {maxVaults}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Vault List */}
          <div className="space-y-3">
            {sortedVaults.map((vault) => (
              <div
                key={vault.id}
                className={`p-4 rounded-lg border transition-colors ${
                  vault.id === activeVault?.id
                    ? 'border-primary bg-primary/5'
                    : vault.isLocked
                    ? 'border-muted bg-muted/30 opacity-60'
                    : 'border-border bg-card hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {editingVault === vault.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(vault.id);
                            if (e.key === 'Escape') handleCancelRename();
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleSaveRename(vault.id)}>
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelRename}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground truncate">{vault.name}</span>
                        {vault.isDefault && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {vault.isLocked && (
                          <Badge variant="destructive" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        )}
                        {vault.id === activeVault?.id && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {format(vault.createdAt, 'MMM d, yyyy')}
                      </span>
                      {vault.lastUnlockedAt && (
                        <span>Last opened {format(vault.lastUnlockedAt, 'MMM d')}</span>
                      )}
                    </div>

                    {vault.isLocked && (
                      <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                        <Crown className="w-3 h-3" />
                        Upgrade to Premium to access
                      </p>
                    )}
                  </div>

                  {!vault.isLocked && editingVault !== vault.id && (
                    <div className="flex items-center gap-1 ml-2">
                      {!vault.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetDefault(vault.id)}
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleStartRename(vault)}
                        title="Rename"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {vaults.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteClick(vault)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Create New Vault Button */}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowCreateDialog(true)}
            disabled={!canCreateVault && userTier === 'free'}
          >
            <Plus className="w-4 h-4 mr-2" />
            {canCreateVault ? 'Create New Vault' : 'Upgrade to Create More Vaults'}
          </Button>

          {userTier === 'free' && (
            <p className="text-xs text-muted-foreground text-center">
              Free plan allows 1 vault. Upgrade to Premium for up to 5 vaults.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateVaultDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateVault}
        canCreate={canCreateVault}
        maxVaults={maxVaults}
        currentCount={vaultCount}
      />

      <DeleteVaultDialog
        open={showDeleteDialog}
        vault={vaultToDelete}
        onClose={() => {
          setShowDeleteDialog(false);
          setVaultToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
