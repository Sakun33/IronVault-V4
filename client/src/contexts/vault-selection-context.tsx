import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { vaultManager, type VaultInfo } from '@/lib/vault-manager';
import { vaultStorage } from '@/lib/storage';
import { useLicense } from './license-context';
import { useAuth } from './auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface VaultSelectionContextType {
  vaults: VaultInfo[];
  activeVault: VaultInfo | null;
  isLoading: boolean;
  canCreateVault: boolean;
  maxVaults: number;
  loadVaults: () => Promise<void>;
  createVault: (name: string) => Promise<VaultInfo>;
  /** Initiates a secure vault switch — shows a master-password dialog. */
  requestVaultSwitch: (vaultId: string) => void;
  /** Low-level switch used internally (no auth check). Prefer requestVaultSwitch. */
  switchVault: (vaultId: string) => Promise<void>;
  updateVault: (vaultId: string, updates: Partial<Pick<VaultInfo, 'name' | 'isDefault' | 'biometricEnabled'>>) => Promise<void>;
  deleteVault: (vaultId: string) => Promise<void>;
  setDefaultVault: (vaultId: string) => Promise<void>;
  toggleBiometric: (vaultId: string, enabled: boolean) => Promise<void>;
}

const VaultSelectionContext = createContext<VaultSelectionContextType | undefined>(undefined);

export function VaultSelectionProvider({ children }: { children: ReactNode }) {
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { license } = useLicense();
  const { accountEmail, login } = useAuth();

  // --- Vault-switch auth dialog state ---
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [switchError, setSwitchError] = useState('');
  const [isSwitching, setIsSwitching] = useState(false);
  const [showSwitchPassword, setShowSwitchPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const isPaidUser = license.tier === 'pro' || license.tier === 'lifetime' || license.status === 'trial';
  const maxVaults = vaultManager.getMaxVaults(isPaidUser);
  const canCreateVault = vaultManager.canCreateVault(isPaidUser);

  const loadVaults = useCallback(async () => {
    try {
      setIsLoading(true);
      vaultManager.migrateExistingVault();

      const vaultList = await vaultManager.listVaults();
      setVaults(vaultList);

      const activeId = vaultManager.getActiveVaultId();
      if (activeId) {
        const active = vaultList.find(v => v.id === activeId);
        setActiveVault(active || vaultList[0] || null);
      } else if (vaultList.length > 0) {
        setActiveVault(vaultList[0]);
        vaultManager.setActiveVaultId(vaultList[0].id);
      }
    } catch (error) {
      console.error('Failed to load vaults:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Re-run whenever the logged-in account changes so the dropdown always shows
  // vaults belonging to the current email, not a previous session.
  useEffect(() => {
    loadVaults();
  }, [loadVaults, accountEmail]);

  const createVault = async (name: string): Promise<VaultInfo> => {
    if (!vaultManager.canCreateVault(isPaidUser)) {
      throw new Error(`Maximum of ${vaultManager.getMaxVaults(isPaidUser)} vault(s) allowed for your plan`);
    }

    const newVault = await vaultManager.createVault(name);
    await loadVaults();
    return newVault;
  };

  /** Low-level switch: updates active vault ID, swaps the open IndexedDB
   * connection, and refreshes the vault list. No auth check — caller is
   * expected to have verified the password (or the vault is already
   * unlocked). The `vaultStorage.switchToVault` call is *critical*:
   * without it, the singleton's open DB stays on the previous vault and
   * subsequent reads/writes silently target the wrong vault. */
  const switchVault = async (vaultId: string): Promise<void> => {
    vaultManager.setActiveVaultId(vaultId);
    await vaultStorage.switchToVault(vaultId);
    const vault = vaultManager.getVaultInfo(vaultId);
    if (vault) {
      setActiveVault(vault);
    }
    await loadVaults();
  };

  /**
   * Secure vault switch — shows a master-password dialog.
   * The user must prove they know the target vault's password before we unlock it.
   */
  const requestVaultSwitch = (vaultId: string) => {
    if (vaultId === vaultManager.getActiveVaultId()) return;
    setSwitchPassword('');
    setSwitchError('');
    setShowSwitchPassword(false);
    setPendingSwitchId(vaultId);
    // Focus password input once dialog is open
    setTimeout(() => passwordInputRef.current?.focus(), 100);
  };

  const handleSwitchConfirm = async () => {
    if (!pendingSwitchId) return;
    setIsSwitching(true);
    setSwitchError('');

    const previousId = vaultManager.getActiveVaultId();
    try {
      // Point vaultStorage at the new vault BEFORE login() so unlockVault
      // verifies the password against the target vault's DB. Without the
      // switchToVault call here, login() would unlock the *previous*
      // vault's DB — and if both vaults share a master password, that
      // unlock silently succeeds while the registry now claims the new
      // vault is active. Subsequent imports / cloud pushes then leak
      // data across vault boundaries.
      vaultManager.setActiveVaultId(pendingSwitchId);
      await vaultStorage.switchToVault(pendingSwitchId);

      const success = await login(switchPassword);
      if (success) {
        const vault = vaultManager.getVaultInfo(pendingSwitchId);
        if (vault) setActiveVault(vault);
        await loadVaults();
        setPendingSwitchId(null);
      } else {
        // Wrong password — revert both the registry pointer and the open DB.
        if (previousId) {
          vaultManager.setActiveVaultId(previousId);
          try { await vaultStorage.switchToVault(previousId); } catch { /* noop */ }
        }
        setSwitchError('Incorrect master password. Please try again.');
      }
    } catch {
      if (previousId) {
        vaultManager.setActiveVaultId(previousId);
        try { await vaultStorage.switchToVault(previousId); } catch { /* noop */ }
      }
      setSwitchError('Failed to switch vault. Please try again.');
    } finally {
      setIsSwitching(false);
    }
  };

  const handleSwitchCancel = () => {
    setPendingSwitchId(null);
    setSwitchPassword('');
    setSwitchError('');
  };

  const updateVault = async (vaultId: string, updates: Partial<Pick<VaultInfo, 'name' | 'isDefault' | 'biometricEnabled'>>): Promise<void> => {
    await vaultManager.updateVault(vaultId, updates);
    await loadVaults();
  };

  const deleteVault = async (vaultId: string): Promise<void> => {
    await vaultManager.deleteVault(vaultId);
    await loadVaults();
  };

  const setDefaultVault = async (vaultId: string): Promise<void> => {
    await vaultManager.updateVault(vaultId, { isDefault: true });
    await loadVaults();
  };

  const toggleBiometric = async (vaultId: string, enabled: boolean): Promise<void> => {
    await vaultManager.updateVault(vaultId, { biometricEnabled: enabled });
    await loadVaults();
  };

  const pendingVault = pendingSwitchId ? vaults.find(v => v.id === pendingSwitchId) : null;

  return (
    <VaultSelectionContext.Provider value={{
      vaults,
      activeVault,
      isLoading,
      canCreateVault,
      maxVaults,
      loadVaults,
      createVault,
      requestVaultSwitch,
      switchVault,
      updateVault,
      deleteVault,
      setDefaultVault,
      toggleBiometric,
    }}>
      {children}

      {/* Vault-switch master-password dialog */}
      <Dialog open={!!pendingSwitchId} onOpenChange={(open) => { if (!open) handleSwitchCancel(); }}>
        <DialogContent className="sm:max-w-[380px]" data-testid="vault-switch-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Unlock Vault
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {pendingVault && (
              <p className="text-sm text-muted-foreground">
                Enter the master password for{' '}
                <span className="font-semibold text-foreground">{pendingVault.name}</span>.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="vault-switch-password">Master Password</Label>
              <div className="relative">
                <Input
                  id="vault-switch-password"
                  ref={passwordInputRef}
                  type={showSwitchPassword ? 'text' : 'password'}
                  placeholder="Enter master password"
                  value={switchPassword}
                  onChange={(e) => { setSwitchPassword(e.target.value); setSwitchError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSwitchConfirm(); }}
                  disabled={isSwitching}
                  data-testid="input-vault-switch-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSwitchPassword(p => !p)}
                  tabIndex={-1}
                >
                  {showSwitchPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {switchError && (
                <p className="text-xs text-destructive" data-testid="vault-switch-error">{switchError}</p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleSwitchCancel} disabled={isSwitching}>
              Cancel
            </Button>
            <Button
              onClick={handleSwitchConfirm}
              disabled={isSwitching || !switchPassword.trim()}
              data-testid="button-vault-switch-confirm"
            >
              {isSwitching ? 'Unlocking…' : 'Unlock Vault'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VaultSelectionContext.Provider>
  );
}

export function useVaultSelection() {
  const context = useContext(VaultSelectionContext);
  if (!context) {
    throw new Error('useVaultSelection must be used within a VaultSelectionProvider');
  }
  return context;
}
