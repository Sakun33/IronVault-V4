import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Star, 
  StarOff,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  Fingerprint
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import { isBiometricUnlockEnabled, enableBiometricUnlock, disableBiometricUnlock } from '@/native/biometrics';

interface VaultInfo {
  id: string;
  name: string;
  createdAt: string;
  isDefault: boolean;
  biometricEnabled?: boolean;
}

export function VaultManagementSection() {
  const { toast } = useToast();
  const { masterPassword } = useAuth();
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVault, setSelectedVault] = useState<VaultInfo | null>(null);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPassword, setNewVaultPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load vaults from localStorage
  useEffect(() => {
    loadVaults();
  }, []);

  const loadVaults = async () => {
    try {
      const registryData = localStorage.getItem('ironvault_registry');
      if (registryData) {
        const parsedVaults = JSON.parse(registryData);
        // Check biometric status for each vault
        const vaultsWithBiometric = await Promise.all(
          parsedVaults.map(async (vault: VaultInfo) => ({
            ...vault,
            biometricEnabled: await isBiometricUnlockEnabled(vault.id)
          }))
        );
        setVaults(vaultsWithBiometric);
      } else {
        // If no vaults registered, check if there's an active vault
        const activeVaultId = localStorage.getItem('activeVaultId');
        if (activeVaultId) {
          const defaultVault: VaultInfo = {
            id: activeVaultId,
            name: 'My Vault',
            createdAt: new Date().toISOString(),
            isDefault: true,
            biometricEnabled: await isBiometricUnlockEnabled(activeVaultId)
          };
          setVaults([defaultVault]);
          localStorage.setItem('ironvault_registry', JSON.stringify([defaultVault]));
        }
      }
    } catch (error) {
      console.error('Error loading vaults:', error);
    }
  };

  const getUserPlan = () => {
    try {
      const profile = localStorage.getItem('customerProfile');
      if (profile) {
        const parsed = JSON.parse(profile);
        const subscription = parsed.subscription || parsed.plan || '';
        // Check for any lifetime or pro variant
        if (subscription.toLowerCase().includes('lifetime') || 
            subscription.toLowerCase().includes('pro') ||
            subscription === 'pro_monthly' || 
            subscription === 'pro_yearly') {
          return { plan: 'lifetime', maxVaults: 5, canUpgrade: false };
        }
      }
    } catch (error) {
      console.error('Error checking plan:', error);
    }
    return { plan: 'free', maxVaults: 1, canUpgrade: true };
  };

  const getMaxVaults = () => {
    return getUserPlan().maxVaults;
  };

  const canUpgrade = () => {
    return getUserPlan().canUpgrade;
  };

  const canCreateVault = () => {
    return vaults.length < getMaxVaults();
  };

  const handleCreateVault = async () => {
    if (!newVaultName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a vault name",
        variant: "destructive",
      });
      return;
    }

    if (!newVaultPassword || newVaultPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (newVaultPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const vaultId = crypto.randomUUID();
      const newVault: VaultInfo = {
        id: vaultId,
        name: newVaultName.trim(),
        createdAt: new Date().toISOString(),
        isDefault: vaults.length === 0,
        biometricEnabled: false,
      };

      const updatedVaults = [...vaults, newVault];
      setVaults(updatedVaults);
      localStorage.setItem('ironvault_registry', JSON.stringify(updatedVaults));

      toast({
        title: "Vault Created",
        description: `"${newVault.name}" has been created successfully`,
      });

      setShowCreateDialog(false);
      setNewVaultName('');
      setNewVaultPassword('');
      setConfirmPassword('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create vault",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRenameVault = () => {
    if (!selectedVault || !newVaultName.trim()) return;

    const updatedVaults = vaults.map(v =>
      v.id === selectedVault.id ? { ...v, name: newVaultName.trim() } : v
    );
    setVaults(updatedVaults);
    localStorage.setItem('ironvault_registry', JSON.stringify(updatedVaults));

    toast({
      title: "Vault Renamed",
      description: `Vault renamed to "${newVaultName.trim()}"`,
    });

    setShowRenameDialog(false);
    setSelectedVault(null);
    setNewVaultName('');
  };

  const handleDeleteVault = () => {
    if (!selectedVault) return;

    if (selectedVault.isDefault && vaults.length > 1) {
      toast({
        title: "Cannot Delete",
        description: "Please set another vault as default first",
        variant: "destructive",
      });
      return;
    }

    const updatedVaults = vaults.filter(v => v.id !== selectedVault.id);
    setVaults(updatedVaults);
    localStorage.setItem('ironvault_registry', JSON.stringify(updatedVaults));

    toast({
      title: "Vault Deleted",
      description: `"${selectedVault.name}" has been deleted`,
    });

    setShowDeleteDialog(false);
    setSelectedVault(null);
  };

  const handleSetDefault = (vault: VaultInfo) => {
    const updatedVaults = vaults.map(v => ({
      ...v,
      isDefault: v.id === vault.id
    }));
    setVaults(updatedVaults);
    localStorage.setItem('ironvault_registry', JSON.stringify(updatedVaults));

    toast({
      title: "Default Vault Changed",
      description: `"${vault.name}" is now your default vault`,
    });
  };

  const handleToggleBiometric = async (vault: VaultInfo) => {
    try {
      if (vault.biometricEnabled) {
        await disableBiometricUnlock(vault.id);
        toast({
          title: "Biometric Disabled",
          description: `Biometric unlock disabled for "${vault.name}"`,
        });
      } else {
        if (!masterPassword) {
          toast({
            title: "Error",
            description: "Please unlock the vault first to enable biometric",
            variant: "destructive",
          });
          return;
        }
        const success = await enableBiometricUnlock(masterPassword, vault.id);
        if (success) {
          toast({
            title: "Biometric Enabled",
            description: `Biometric unlock enabled for "${vault.name}"`,
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to enable biometric unlock",
            variant: "destructive",
          });
          return;
        }
      }
      loadVaults(); // Reload to update biometric status
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update biometric settings",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Vault Overview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Your Vaults
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {vaults.length}/{getMaxVaults()} used
              </Badge>
              <Button 
                size="sm" 
                onClick={() => setShowCreateDialog(true)}
                disabled={!canCreateVault()}
                className="text-xs h-7 px-2"
              >
                <Plus className="w-3 h-3 mr-1" />
                New
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {vaults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No vaults created yet</p>
              <Button 
                className="mt-4" 
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Vault
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {vaults.map((vault) => (
                <div
                  key={vault.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${vault.isDefault ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Shield className={`w-5 h-5 ${vault.isDefault ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{vault.name}</span>
                        {vault.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {vault.biometricEnabled && (
                          <Badge variant="outline" className="text-xs">
                            <Fingerprint className="w-3 h-3 mr-1" />
                            Biometric
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {format(new Date(vault.createdAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!vault.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(vault)}
                        title="Set as default"
                      >
                        <StarOff className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleBiometric(vault)}
                      title={vault.biometricEnabled ? "Disable biometric" : "Enable biometric"}
                    >
                      <Fingerprint className={`w-4 h-4 ${vault.biometricEnabled ? 'text-primary' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedVault(vault);
                        setNewVaultName(vault.name);
                        setShowRenameDialog(true);
                      }}
                      title="Rename vault"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedVault(vault);
                        setShowDeleteDialog(true);
                      }}
                      title="Delete vault"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!canCreateVault() && canUpgrade() && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">Vault limit reached</span>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Upgrade to Premium to create up to 5 vaults
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Vault Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create New Vault
            </DialogTitle>
            <DialogDescription>
              Create a new secure vault with its own master password
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-vault-name">Vault Name</Label>
              <Input
                id="new-vault-name"
                placeholder="e.g., Work, Personal, Family"
                value={newVaultName}
                onChange={(e) => setNewVaultName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="new-vault-password">Master Password</Label>
              <Input
                id="new-vault-password"
                type="password"
                placeholder="Enter master password"
                value={newVaultPassword}
                onChange={(e) => setNewVaultPassword(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 8 characters
              </p>
            </div>
            <div>
              <Label htmlFor="confirm-vault-password">Confirm Password</Label>
              <Input
                id="confirm-vault-password"
                type="password"
                placeholder="Confirm master password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateVault} disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Vault'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Vault Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Rename Vault
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-vault">New Name</Label>
            <Input
              id="rename-vault"
              value={newVaultName}
              onChange={(e) => setNewVaultName(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameVault}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Vault Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Vault
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedVault?.name}"? This action cannot be undone and all data in this vault will be permanently lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteVault}>
              Delete Vault
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
