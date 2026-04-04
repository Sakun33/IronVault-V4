/**
 * Multi-Vault Auth Context
 * 
 * This context manages authentication and vault access for the multi-vault system.
 * It handles:
 * - Vault listing and selection
 * - Password verification across vaults
 * - Lockout state (3 attempts = 1 hour lockout)
 * - Plan-based vault access control
 * - Biometric authentication for default vault
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { vaultIndex, VaultIndexEntry, MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS } from '@/lib/vault-index';
import { vaultManager, MultiVaultStorage } from '@/lib/multi-vault-storage';
import { migrateLegacyVault, needsMigration } from '@/lib/vault-migration';
import { useLogging } from './logging-context';
import { deriveAutofillKey, generateSalt } from '@/lib/vault-autofill-crypto';
import { CryptoService } from '@/lib/crypto';
import { autoLockService } from '@/native/auto-lock';

// Re-export for consumers
export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS };

// Types
export interface VaultInfo {
  id: string;
  name: string;
  isDefault: boolean;
  isLocked: boolean; // Locked by plan
  createdAt: Date;
  lastUnlockedAt: Date | null;
}

export interface LockoutState {
  isLocked: boolean;
  remainingMs: number;
  failedAttempts: number;
}

export interface UnlockResult {
  success: boolean;
  matchingVaults?: VaultInfo[];
  error?: string;
  isLockedOut?: boolean;
  lockoutRemainingMs?: number;
  vaultLockedByPlan?: boolean;
}

export interface MultiVaultAuthContextType {
  // State
  isLoading: boolean;
  isUnlocked: boolean;
  vaults: VaultInfo[];
  activeVault: VaultInfo | null;
  defaultVaultId: string | null;
  lockoutState: LockoutState;
  masterPassword: string | null;
  
  // Vault count info
  vaultCount: number;
  maxVaults: number;
  canCreateVault: boolean;
  
  // Methods
  refreshVaults: () => Promise<void>;
  tryUnlock: (masterPassword: string) => Promise<UnlockResult>;
  unlockVault: (vaultId: string, masterPassword: string) => Promise<boolean>;
  unlockVaultWithKey: (vaultId: string, base64Key: string) => Promise<boolean>;
  createVault: (name: string, masterPassword: string, isDefault?: boolean) => Promise<string>;
  switchVault: (vaultId: string, masterPassword: string) => Promise<boolean>;
  logout: () => void;
  
  // Vault management
  setDefaultVault: (vaultId: string) => Promise<void>;
  renameVault: (vaultId: string, newName: string) => Promise<void>;
  deleteVault: (vaultId: string) => Promise<void>;
  
  // Storage access
  getActiveStorage: () => MultiVaultStorage | null;
  getMasterKey: () => Promise<CryptoKey | null>;
  
  // Plan tier (to be set by license context)
  userTier: 'free' | 'pro' | 'lifetime' | 'trial';
  setUserTier: (tier: 'free' | 'pro' | 'lifetime' | 'trial') => void;
}

const MultiVaultAuthContext = createContext<MultiVaultAuthContextType | undefined>(undefined);

interface Props {
  children: React.ReactNode;
}

export function MultiVaultAuthProvider({ children }: Props) {
  const { clearLogs } = useLogging();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaults, setVaults] = useState<VaultInfo[]>([]);
  const [activeVault, setActiveVault] = useState<VaultInfo | null>(null);
  const [defaultVaultId, setDefaultVaultIdState] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [userTier, setUserTier] = useState<'free' | 'pro' | 'lifetime' | 'trial'>('free');
  const [lockoutState, setLockoutState] = useState<LockoutState>({
    isLocked: false,
    remainingMs: 0,
    failedAttempts: 0,
  });
  
  // Refs for lockout timer
  const lockoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Computed values
  const maxVaults = vaultManager.getMaxVaultsForPlan(userTier);
  const vaultCount = vaults.length;
  const canCreateVault = vaultCount < maxVaults;

  /**
   * Update lockout state from vault index
   */
  const updateLockoutState = useCallback(async () => {
    const isLocked = await vaultManager.isLockedOut();
    const remainingMs = await vaultManager.getLockoutTimeRemaining();
    const failedAttempts = await vaultManager.getFailedAttemptCount();
    
    setLockoutState({ isLocked, remainingMs, failedAttempts });
    
    // Set up timer to update countdown
    if (isLocked && remainingMs > 0) {
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current);
      }
      
      lockoutTimerRef.current = setInterval(async () => {
        const newRemaining = await vaultManager.getLockoutTimeRemaining();
        const stillLocked = await vaultManager.isLockedOut();
        
        setLockoutState(prev => ({
          ...prev,
          isLocked: stillLocked,
          remainingMs: newRemaining,
        }));
        
        if (!stillLocked || newRemaining <= 0) {
          if (lockoutTimerRef.current) {
            clearInterval(lockoutTimerRef.current);
            lockoutTimerRef.current = null;
          }
        }
      }, 1000);
    }
  }, []);

  /**
   * Convert VaultIndexEntry to VaultInfo with plan lock status
   */
  const toVaultInfo = useCallback((entry: VaultIndexEntry): VaultInfo => {
    const canAccess = vaultManager.canAccessVault(entry, userTier);
    return {
      id: entry.id,
      name: entry.name,
      isDefault: entry.isDefault,
      isLocked: !canAccess,
      createdAt: entry.createdAt,
      lastUnlockedAt: entry.lastUnlockedAt,
    };
  }, [userTier]);

  /**
   * Refresh vault list from index
   */
  const refreshVaults = useCallback(async () => {
    const entries = await vaultManager.getAllVaults();
    const vaultInfos = entries.map(toVaultInfo);
    setVaults(vaultInfos);
    
    // Update default vault ID
    const defaultVault = entries.find(v => v.isDefault);
    setDefaultVaultIdState(defaultVault?.id || null);
  }, [toVaultInfo]);

  /**
   * Initialize the auth system
   */
  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('🔐 Initializing multi-vault auth...');
        
        // Initialize vault manager
        await vaultManager.init();
        
        // Check for and run migration if needed
        const shouldMigrate = await needsMigration();
        if (shouldMigrate) {
          console.log('🔄 Running legacy vault migration...');
          const result = await migrateLegacyVault();
          if (!result.success) {
            console.error('❌ Migration failed:', result.error);
          } else if (result.migrated) {
            console.log('✅ Migration complete');
          }
        }
        
        // Load vaults and lockout state
        await refreshVaults();
        await updateLockoutState();
        
        console.log('✅ Multi-vault auth initialized');
      } catch (error) {
        console.error('❌ Failed to initialize auth:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initialize();
    
    return () => {
      if (lockoutTimerRef.current) {
        clearInterval(lockoutTimerRef.current);
      }
    };
  }, [refreshVaults, updateLockoutState]);

  /**
   * Refresh vault info when tier changes
   */
  useEffect(() => {
    if (!isLoading) {
      refreshVaults();
    }
  }, [userTier, isLoading, refreshVaults]);

  /**
   * Try to unlock with a password (checks all vaults)
   */
  const tryUnlock = useCallback(async (password: string): Promise<UnlockResult> => {
    // Check lockout first
    if (lockoutState.isLocked) {
      return {
        success: false,
        isLockedOut: true,
        lockoutRemainingMs: lockoutState.remainingMs,
        error: 'Account is locked. Please wait.',
      };
    }
    
    try {
      // Find matching vaults
      const matchingEntries = await vaultManager.tryUnlockWithPassword(password);
      
      if (matchingEntries.length === 0) {
        // Wrong password
        const triggeredLockout = await vaultManager.recordFailedAttempt();
        await updateLockoutState();
        
        const attempts = await vaultManager.getFailedAttemptCount();
        
        return {
          success: false,
          error: `Incorrect password (attempt ${Math.min(attempts, MAX_FAILED_ATTEMPTS)}/${MAX_FAILED_ATTEMPTS})`,
          isLockedOut: triggeredLockout,
          lockoutRemainingMs: triggeredLockout ? await vaultManager.getLockoutTimeRemaining() : 0,
        };
      }
      
      // Convert to VaultInfo with plan lock status
      const matchingVaults = matchingEntries.map(toVaultInfo);
      
      // Check if all matching vaults are locked by plan
      const accessibleVaults = matchingVaults.filter(v => !v.isLocked);
      
      if (accessibleVaults.length === 0) {
        // All matching vaults are locked by plan
        return {
          success: false,
          matchingVaults,
          vaultLockedByPlan: true,
          error: 'This vault is locked. Upgrade to Premium to access.',
        };
      }
      
      // If exactly one accessible vault, auto-unlock it
      if (accessibleVaults.length === 1) {
        const vault = accessibleVaults[0];
        const storage = await vaultManager.unlockVault(vault.id, password);
        
        setIsUnlocked(true);
        setActiveVault(vault);
        setMasterPassword(password);
        
        return { success: true, matchingVaults: [vault] };
      }
      
      // Multiple matching accessible vaults - let user choose
      return {
        success: true,
        matchingVaults: accessibleVaults,
      };
    } catch (error) {
      console.error('Unlock error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unlock failed',
      };
    }
  }, [lockoutState, toVaultInfo, updateLockoutState]);

  /**
   * Unlock a specific vault
   */
  const unlockVault = useCallback(async (vaultId: string, password: string): Promise<boolean> => {
    try {
      // Check lockout
      if (lockoutState.isLocked) {
        return false;
      }
      
      // Get vault info
      const vaultEntry = await vaultIndex.getVault(vaultId);
      if (!vaultEntry) {
        throw new Error('Vault not found');
      }
      
      const vaultInfo = toVaultInfo(vaultEntry);
      
      // Check plan lock
      if (vaultInfo.isLocked) {
        throw new Error('Vault is locked by plan');
      }
      
      // Try to unlock
      const storage = await vaultManager.unlockVault(vaultId, password);
      
      setIsUnlocked(true);
      setActiveVault(vaultInfo);
      setMasterPassword(password);
      
      return true;
    } catch (error) {
      console.error('Unlock vault error:', error);
      
      // Record failed attempt if password was wrong
      if (error instanceof Error && error.message === 'Invalid password') {
        await vaultManager.recordFailedAttempt();
        await updateLockoutState();
      }
      
      return false;
    }
  }, [lockoutState, toVaultInfo, updateLockoutState]);

  /**
   * Unlock a vault with a pre-derived biometric key (bypasses KDF)
   */
  const unlockVaultWithKey = useCallback(async (vaultId: string, base64Key: string): Promise<boolean> => {
    try {
      if (lockoutState.isLocked) return false;

      const vaultEntry = await vaultIndex.getVault(vaultId);
      if (!vaultEntry) throw new Error('Vault not found');

      const vaultInfo = toVaultInfo(vaultEntry);
      if (vaultInfo.isLocked) throw new Error('Vault is locked by plan');

      const storage = await vaultManager.unlockVaultWithKey(vaultId, base64Key);

      setIsUnlocked(true);
      setActiveVault(vaultInfo);
      setMasterPassword(null); // Not available via biometric

      return true;
    } catch (error) {
      console.error('Unlock vault with key error:', error);
      return false;
    }
  }, [lockoutState, toVaultInfo]);

  /**
   * Create a new vault
   */
  const createVault = useCallback(async (
    name: string,
    password: string,
    isDefault: boolean = false
  ): Promise<string> => {
    if (!canCreateVault) {
      throw new Error(`Maximum vault limit (${maxVaults}) reached. Upgrade to create more vaults.`);
    }
    
    const { vaultId, storage } = await vaultManager.createVault(name, password, isDefault);
    
    // Refresh vault list
    await refreshVaults();
    
    // Set as active vault
    const entries = await vaultManager.getAllVaults();
    const entry = entries.find(e => e.id === vaultId);
    if (entry) {
      setActiveVault(toVaultInfo(entry));
    }
    
    setIsUnlocked(true);
    setMasterPassword(password);
    
    // Clear logs for new vault
    clearLogs();
    
    return vaultId;
  }, [canCreateVault, maxVaults, refreshVaults, toVaultInfo, clearLogs]);

  /**
   * Switch to a different vault
   */
  const switchVault = useCallback(async (vaultId: string, password: string): Promise<boolean> => {
    // Lock current vault first
    vaultManager.lockVault();
    setIsUnlocked(false);
    setActiveVault(null);
    setMasterPassword(null);
    
    // Unlock the new vault
    return unlockVault(vaultId, password);
  }, [unlockVault]);

  /**
   * Logout / lock vault
   */
  const logout = useCallback(() => {
    vaultManager.lockVault();
    setIsUnlocked(false);
    setActiveVault(null);
    setMasterPassword(null);
  }, []);

  /**
   * Initialize auto-lock service
   */
  useEffect(() => {
    autoLockService.init(() => {
      // Lock vault when app goes to background or idle timeout reached
      if (isUnlocked) {
        console.log('[Auth] Auto-locking vault due to background/idle');
        vaultManager.lockVault();
        setIsUnlocked(false);
        setActiveVault(null);
        setMasterPassword(null);
      }
    });
  }, [isUnlocked]);

  /**
   * Set default vault
   */
  const setDefaultVault = useCallback(async (vaultId: string) => {
    await vaultManager.setDefaultVault(vaultId);
    await refreshVaults();
  }, [refreshVaults]);

  /**
   * Rename vault
   */
  const renameVault = useCallback(async (vaultId: string, newName: string) => {
    await vaultManager.renameVault(vaultId, newName);
    await refreshVaults();
    
    // Update active vault if it's the one being renamed
    if (activeVault?.id === vaultId) {
      setActiveVault(prev => prev ? { ...prev, name: newName } : null);
    }
  }, [refreshVaults, activeVault]);

  /**
   * Delete vault
   */
  const deleteVault = useCallback(async (vaultId: string) => {
    // Can't delete the only vault
    if (vaults.length <= 1) {
      throw new Error('Cannot delete the only vault');
    }
    
    // Can't delete default vault without setting another as default first
    const vault = vaults.find(v => v.id === vaultId);
    if (vault?.isDefault) {
      const otherVault = vaults.find(v => v.id !== vaultId);
      if (otherVault) {
        await setDefaultVault(otherVault.id);
      }
    }
    
    // If deleting active vault, logout first
    if (activeVault?.id === vaultId) {
      logout();
    }
    
    await vaultManager.deleteVault(vaultId);
    await refreshVaults();
  }, [vaults, activeVault, setDefaultVault, logout, refreshVaults]);

  /**
   * Get active storage
   */
  const getActiveStorage = useCallback((): MultiVaultStorage | null => {
    return vaultManager.getActiveStorage();
  }, []);

  /**
   * Get master key for autofill
   */
  const getMasterKey = useCallback(async (): Promise<CryptoKey | null> => {
    if (!masterPassword || !isUnlocked) {
      return null;
    }

    try {
      // Get or create salt for autofill vault
      let salt = localStorage.getItem('autofillVaultSalt');
      let saltBytes: Uint8Array;
      
      if (!salt) {
        saltBytes = generateSalt();
        salt = btoa(String.fromCharCode(...Array.from(saltBytes)));
        localStorage.setItem('autofillVaultSalt', salt);
      } else {
        const binary = atob(salt);
        saltBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          saltBytes[i] = binary.charCodeAt(i);
        }
      }

      const key = await deriveAutofillKey(masterPassword, saltBytes);
      return key;
    } catch (error) {
      console.error('Failed to derive autofill key:', error);
      return null;
    }
  }, [masterPassword, isUnlocked]);

  const value: MultiVaultAuthContextType = {
    isLoading,
    isUnlocked,
    vaults,
    activeVault,
    defaultVaultId,
    lockoutState,
    masterPassword,
    vaultCount,
    maxVaults,
    canCreateVault,
    refreshVaults,
    tryUnlock,
    unlockVault,
    unlockVaultWithKey,
    createVault,
    switchVault,
    logout,
    setDefaultVault,
    renameVault,
    deleteVault,
    getActiveStorage,
    getMasterKey,
    userTier,
    setUserTier,
  };

  return (
    <MultiVaultAuthContext.Provider value={value}>
      {children}
    </MultiVaultAuthContext.Provider>
  );
}

export function useMultiVaultAuth() {
  const context = useContext(MultiVaultAuthContext);
  if (context === undefined) {
    throw new Error('useMultiVaultAuth must be used within a MultiVaultAuthProvider');
  }
  return context;
}

// Re-export types
export type { VaultIndexEntry };
