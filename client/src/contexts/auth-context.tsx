import React, { createContext, useContext, useState, useEffect } from 'react';
import { vaultStorage } from '@/lib/storage';
import { useLogging } from './logging-context';
import { deriveAutofillKey, generateSalt } from '@/lib/vault-autofill-crypto';
import { autoLockService } from '@/native/auto-lock';

interface AuthContextType {
  isUnlocked: boolean;
  vaultExists: boolean;
  masterPassword: string | null;
  login: (masterPassword: string) => Promise<boolean>;
  loginWithKey: (base64Key: string) => Promise<boolean>;
  createVault: (masterPassword: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  getMasterKey: () => Promise<CryptoKey | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'iv_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { clearLogs } = useLogging();

  useEffect(() => {
    initializeAuth();
  }, []);

  // Initialize auto-lock for inactivity/background events
  useEffect(() => {
    autoLockService.init(() => {
      if (isUnlocked) {
        console.log('[Auth] Auto-locking vault due to background/idle');
        setIsUnlocked(false);
        setMasterPassword(null);
        sessionStorage.removeItem(SESSION_KEY);
        vaultStorage.setEncryptionKey(null as any);
      }
    });
  }, [isUnlocked]);

  const initializeAuth = async () => {
    try {
      await vaultStorage.init();
      const exists = await vaultStorage.vaultExists();
      setVaultExists(exists);

      // Restore session if vault exists and a saved session is present
      if (exists) {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          try {
            const success = await vaultStorage.unlockVault(saved);
            if (success) {
              setIsUnlocked(true);
              setMasterPassword(saved);
            } else {
              sessionStorage.removeItem(SESSION_KEY);
            }
          } catch {
            sessionStorage.removeItem(SESSION_KEY);
          }
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (password: string): Promise<boolean> => {
    try {
      const success = await vaultStorage.unlockVault(password);
      if (success) {
        setIsUnlocked(true);
        setMasterPassword(password);
        sessionStorage.setItem(SESSION_KEY, password);
      }
      return success;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const loginWithKey = async (base64Key: string): Promise<boolean> => {
    try {
      const success = await vaultStorage.unlockVaultWithKey(base64Key);
      if (success) {
        setIsUnlocked(true);
        // Master password not available via biometric unlock
        setMasterPassword(null);
      }
      return success;
    } catch (error) {
      console.error('Login with key failed:', error);
      return false;
    }
  };

  const createVault = async (password: string): Promise<void> => {
    try {
      await vaultStorage.createVault(password);
      setVaultExists(true);
      setIsUnlocked(true);
      setMasterPassword(password);
      sessionStorage.setItem(SESSION_KEY, password);
      
      // Clear activity logs when creating a new vault
      clearLogs();
    } catch (error) {
      console.error('Failed to create vault:', error);
      throw error;
    }
  };

  const logout = () => {
    setIsUnlocked(false);
    setMasterPassword(null);
    sessionStorage.removeItem(SESSION_KEY);
    // Clear encryption key from storage
    vaultStorage.setEncryptionKey(null as any);
  };

  /**
   * Get the master key for vault autofill encryption
   * Derives a separate key from the master password for autofill vault
   */
  const getMasterKey = async (): Promise<CryptoKey | null> => {
    if (!masterPassword || !isUnlocked) {
      return null;
    }

    try {
      // Get or create salt for autofill vault
      let salt = localStorage.getItem('autofillVaultSalt');
      let saltBytes: Uint8Array;
      
      if (!salt) {
        // Generate new salt for autofill vault
        saltBytes = generateSalt();
        salt = btoa(String.fromCharCode(...Array.from(saltBytes)));
        localStorage.setItem('autofillVaultSalt', salt);
      } else {
        // Convert stored salt back to Uint8Array
        const binary = atob(salt);
        saltBytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          saltBytes[i] = binary.charCodeAt(i);
        }
      }

      // Derive autofill key from master password
      const key = await deriveAutofillKey(masterPassword, saltBytes);
      return key;
    } catch (error) {
      console.error('Failed to derive autofill key:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    isUnlocked,
    vaultExists,
    masterPassword,
    login,
    loginWithKey,
    createVault,
    logout,
    isLoading,
    getMasterKey,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
