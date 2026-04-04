import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { vaultManager, type VaultInfo } from '@/lib/vault-manager';
import { useLicense } from './license-context';

interface VaultSelectionContextType {
  vaults: VaultInfo[];
  activeVault: VaultInfo | null;
  isLoading: boolean;
  canCreateVault: boolean;
  maxVaults: number;
  loadVaults: () => Promise<void>;
  createVault: (name: string) => Promise<VaultInfo>;
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

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  const createVault = async (name: string): Promise<VaultInfo> => {
    if (!canCreateVault) {
      throw new Error(`Maximum of ${maxVaults} vault(s) allowed for your plan`);
    }
    
    const newVault = await vaultManager.createVault(name);
    await loadVaults();
    return newVault;
  };

  const switchVault = async (vaultId: string): Promise<void> => {
    vaultManager.setActiveVaultId(vaultId);
    const vault = vaultManager.getVaultInfo(vaultId);
    if (vault) {
      setActiveVault(vault);
    }
    await loadVaults();
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

  return (
    <VaultSelectionContext.Provider value={{
      vaults,
      activeVault,
      isLoading,
      canCreateVault,
      maxVaults,
      loadVaults,
      createVault,
      switchVault,
      updateVault,
      deleteVault,
      setDefaultVault,
      toggleBiometric,
    }}>
      {children}
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
