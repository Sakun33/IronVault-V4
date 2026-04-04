import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Shield, Trash2, RotateCcw } from 'lucide-react';
import { vaultManager, VaultInfo } from '@/lib/vault-manager';
import { vaultStorage } from '@/lib/storage';
import { vaultIndex } from '@/lib/vault-index';

interface ResetVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResetComplete: () => void;
}

export function ResetVaultDialog({ open, onOpenChange, onResetComplete }: ResetVaultDialogProps) {
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [selectedVaults, setSelectedVaults] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [isPaidUser, setIsPaidUser] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('select');
      // Load vaults and handle auto-selection
      try {
        let vaultList = vaultManager.getExistingVaults();
        
        // Handle edge case: registry exists but vault data is corrupted
        // If vault list is empty but registry indicates vaults exist, create a fallback entry
        if (vaultList.length === 0) {
          // Check if there's any vault-related data in localStorage that indicates a corrupted state
          const hasVaultData = localStorage.getItem('ironvault_registry') || 
                               localStorage.getItem('ironvault_has_vault') ||
                               localStorage.getItem('ironvault_passwords');
          if (hasVaultData) {
            // Create a fallback vault entry for reset purposes
            vaultList = [{
              id: 'corrupted_vault',
              name: 'Corrupted Vault',
              createdAt: new Date(),
              lastAccessedAt: new Date(),
              isDefault: true,
              biometricEnabled: false,
              itemCount: 0,
              iconColor: '#6366f1',
            }];
            console.log('⚠️ Detected corrupted vault state, showing fallback reset option');
          }
        }
        
        setVaults(vaultList);
        
        const paid = vaultManager.isPaidUser();
        setIsPaidUser(paid);
        
        // Auto-select vault(s) for single vault scenario OR if vault is corrupted
        if (vaultList.length === 1) {
          setSelectedVaults(new Set([vaultList[0].id]));
        } else if (vaultList.length > 0) {
          // For multiple vaults, don't auto-select
          setSelectedVaults(new Set());
        } else {
          setSelectedVaults(new Set());
        }
      } catch (error) {
        console.error('Error loading vaults:', error);
        // Even on error, allow reset if any vault data exists
        const hasVaultData = localStorage.getItem('ironvault_registry') || 
                             localStorage.getItem('ironvault_has_vault');
        if (hasVaultData) {
          const fallbackVault = {
            id: 'corrupted_vault',
            name: 'Vault (Recovery Mode)',
            createdAt: new Date(),
            lastAccessedAt: new Date(),
            isDefault: true,
            biometricEnabled: false,
            itemCount: 0,
            iconColor: '#ef4444',
          };
          setVaults([fallbackVault]);
          setSelectedVaults(new Set(['corrupted_vault']));
        } else {
          setSelectedVaults(new Set());
        }
      }
    }
  }, [open]);

  const handleVaultToggle = (vaultId: string) => {
    const newSelected = new Set(selectedVaults);
    if (newSelected.has(vaultId)) {
      newSelected.delete(vaultId);
    } else {
      newSelected.add(vaultId);
    }
    setSelectedVaults(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVaults.size === vaults.length) {
      setSelectedVaults(new Set());
    } else {
      setSelectedVaults(new Set(vaults.map(v => v.id)));
    }
  };

  const handleContinue = () => {
    if (selectedVaults.size === 0) return;
    setStep('confirm');
  };

  const handleReset = async () => {
    if (selectedVaults.size === 0) return;
    
    setIsLoading(true);
    try {
      const selectedArray = Array.from(selectedVaults);
      const isResetAll = selectedArray.length === vaults.length;
      
      if (isResetAll) {
        // Reset all vaults - clear EVERYTHING
        console.log('🔄 Starting full vault reset...');
        
        // Step 0: Close ALL open database connections FIRST
        // This is critical - open connections block deleteDatabase() calls
        try {
          vaultIndex.close();
          console.log('🗑️ Closed vaultIndex DB connection');
        } catch (e) {
          console.warn('Could not close vaultIndex:', e);
        }
        try {
          vaultStorage.resetState();
          console.log('🗑️ Closed vaultStorage DB connection');
        } catch (e) {
          console.warn('Could not close vaultStorage:', e);
        }
        try {
          vaultManager.clearInternalState();
          console.log('🗑️ Cleared vaultManager internal state');
        } catch (e) {
          console.warn('Could not clear vaultManager:', e);
        }
        
        // Small delay to let connections fully close
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Step 1: Clear ALL localStorage - be aggressive
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('ironvault') || 
            key.startsWith('IronVault') ||
            key === 'customerProfile' ||
            key === 'showExportReminder'
          )) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ Removed localStorage: ${key}`);
        });
        
        // Explicitly ensure registry is empty
        localStorage.removeItem('ironvault_registry');
        localStorage.removeItem('ironvault_passwords');
        localStorage.removeItem('ironvault_active_vault');
        localStorage.removeItem('ironvault_has_vault');
        
        console.log('🗑️ localStorage cleared');
        
        // Step 2: Delete all IndexedDB databases
        const dbsToDelete = [
          'IronVault',
          'IronVault-Index',
          ...vaults.map(v => `IronVault_${v.id}`)
        ];
        
        for (const dbName of dbsToDelete) {
          try {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            await new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                console.warn(`⏱️ Timeout deleting ${dbName}, continuing...`);
                resolve();
              }, 3000);
              deleteReq.onsuccess = () => {
                clearTimeout(timeout);
                console.log(`🗑️ Deleted database: ${dbName}`);
                resolve();
              };
              deleteReq.onerror = () => {
                clearTimeout(timeout);
                console.warn(`⚠️ Error deleting ${dbName}`);
                resolve();
              };
              deleteReq.onblocked = () => {
                clearTimeout(timeout);
                console.warn(`⚠️ Database ${dbName} deletion blocked, continuing...`);
                resolve();
              };
            });
          } catch (e) {
            console.error(`Failed to delete database ${dbName}:`, e);
          }
        }
        
        // Step 3: Force clear session storage too
        sessionStorage.clear();
        
        console.log('✅ All vaults reset successfully - ready for fresh start');
      } else {
        // Reset only selected vaults
        for (const vaultId of selectedArray) {
          await vaultManager.resetVault(vaultId);
        }
        console.log(`✅ Reset ${selectedArray.length} vault(s)`);
      }
      
      onOpenChange(false);
      onResetComplete();
    } catch (error) {
      console.error('Error resetting vault(s):', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCount = selectedVaults.size;
  const isResetAll = selectedCount === vaults.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <RotateCcw className="w-6 h-6 text-destructive" />
          </div>
          <DialogTitle className="text-center text-xl">
            {step === 'select' ? 'Reset Vault' : 'Confirm Reset'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 'select' 
              ? 'Forgot your Master Password? Reset your vault to start fresh.'
              : 'This action cannot be undone. All data in selected vault(s) will be permanently deleted.'
            }
          </DialogDescription>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 py-4">
            <Alert className="border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-sm">
                <strong>Warning:</strong> Resetting a vault will permanently delete all passwords, subscriptions, notes, and other data stored in it.
              </AlertDescription>
            </Alert>

            {isPaidUser && vaults.length > 1 ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Select vaults to reset:</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAll}
                    className="text-xs"
                  >
                    {selectedVaults.size === vaults.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {vaults.map((vault) => (
                    <div
                      key={vault.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedVaults.has(vault.id)
                          ? 'border-destructive/50 bg-destructive/5'
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                      onClick={() => handleVaultToggle(vault.id)}
                    >
                      <Checkbox
                        id={vault.id}
                        checked={selectedVaults.has(vault.id)}
                        onCheckedChange={() => handleVaultToggle(vault.id)}
                      />
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: vault.iconColor }}
                      >
                        <Shield className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <Label
                          htmlFor={vault.id}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {vault.name}
                        </Label>
                        {vault.isDefault && (
                          <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div 
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedVaults.size > 0 
                    ? 'border-destructive/50 bg-destructive/10' 
                    : 'border-destructive/30 bg-destructive/5 hover:border-destructive/50'
                }`}
                onClick={() => {
                  if (vaults[0]) {
                    const newSelected = new Set<string>();
                    if (!selectedVaults.has(vaults[0].id)) {
                      newSelected.add(vaults[0].id);
                    }
                    setSelectedVaults(newSelected);
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={vaults[0] ? selectedVaults.has(vaults[0].id) : false}
                    onCheckedChange={() => {
                      if (vaults[0]) {
                        const newSelected = new Set<string>();
                        if (!selectedVaults.has(vaults[0].id)) {
                          newSelected.add(vaults[0].id);
                        }
                        setSelectedVaults(newSelected);
                      }
                    }}
                  />
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: vaults[0]?.iconColor || '#6366f1' }}
                  >
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{vaults[0]?.name || 'My Vault'}</p>
                    <p className="text-xs text-muted-foreground">
                      All data in this vault will be deleted
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <Trash2 className="h-4 w-4" />
              <AlertDescription>
                You are about to permanently delete {selectedCount} vault{selectedCount > 1 ? 's' : ''}.
                {isResetAll && ' This will reset your entire IronVault setup.'}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <p className="text-sm font-medium">Vaults to be deleted:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {vaults
                  .filter(v => selectedVaults.has(v.id))
                  .map(v => (
                    <li key={v.id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      {v.name}
                    </li>
                  ))}
              </ul>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">
                After reset, you will be able to create a new vault with a new Master Password.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'select' ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleContinue}
                disabled={selectedCount === 0}
                className="w-full sm:w-auto"
              >
                Continue ({selectedCount} selected)
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('select')}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleReset}
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? 'Resetting...' : `Reset ${selectedCount} Vault${selectedCount > 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
