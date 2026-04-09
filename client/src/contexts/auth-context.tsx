import React, { createContext, useContext, useState, useEffect } from 'react';
import { vaultStorage } from '@/lib/storage';
import { useLogging } from './logging-context';
import { deriveAutofillKey, generateSalt } from '@/lib/vault-autofill-crypto';
import { autoLockService } from '@/native/auto-lock';
import {
  isAccountSessionActive,
  getAccountSessionEmail,
  saveAccountSession,
  clearAccountSession,
  verifyAccountCredentials,
  saveAccountCredentials,
  getAccountPasswordHash,
  sha256,
} from '@/lib/account-auth';
import { acquireCloudToken } from '@/lib/cloud-vault-sync';
import { vaultManager } from '@/lib/vault-manager';
import { clearPlanCache } from '@/hooks/use-plan-features';

interface AuthContextType {
  isUnlocked: boolean;
  vaultExists: boolean;
  masterPassword: string | null;
  isAccountLoggedIn: boolean;
  accountEmail: string | null;
  login: (masterPassword: string) => Promise<boolean>;
  loginWithKey: (base64Key: string) => Promise<boolean>;
  createVault: (masterPassword: string) => Promise<void>;
  logout: () => void;
  accountLogin: (email: string, password: string) => Promise<boolean>;
  accountLogout: () => void;
  isLoading: boolean;
  getMasterKey: () => Promise<CryptoKey | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'iv_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isAccountLoggedIn, setIsAccountLoggedIn] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
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
      // Restore account session from localStorage (persists across page loads)
      if (isAccountSessionActive()) {
        const email = getAccountSessionEmail();
        setIsAccountLoggedIn(true);
        setAccountEmail(email);
        if (email) {
          vaultManager.setAccountEmail(email);
          // Silently sync stored hash to server in background so cross-device login works.
          // Trust-on-first-use: if server has no hash yet it stores it; if it does, it verifies.
          const storedHash = getAccountPasswordHash();
          if (storedHash) {
            fetch('/api/auth/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, accountPasswordHash: storedHash }),
            }).catch(() => {});
          }
        }
      }

      await vaultStorage.init();
      const exists = await vaultStorage.vaultExists();
      setVaultExists(exists);

      // Restore vault session if vault exists and a saved session is present
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

  const accountLogin = async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await sha256(password);

    const onSuccess = async () => {
      // Persist credentials locally for offline access
      await saveAccountCredentials(email, password);
      saveAccountSession(normalizedEmail);
      vaultManager.setAccountEmail(normalizedEmail);
      setIsAccountLoggedIn(true);
      setAccountEmail(normalizedEmail);
      // Clear stale plan cache so the plan hook re-fetches on next render
      clearPlanCache();
      acquireCloudToken(normalizedEmail, passwordHash).catch(() => {});
    };

    // Server is the primary source of truth for cross-device auth.
    // Trust-on-first-use: if no hash stored server-side yet, it stores and accepts.
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, accountPasswordHash: passwordHash }),
      });
      if (res.ok) {
        await onSuccess();
        return true;
      }
      // 401 from server means wrong password — don't fall back to local
      if (res.status === 401) return false;
      // 5xx or unexpected: fall through to localStorage fallback below
      console.error('[auth] /api/auth/token returned', res.status, '— falling back to local');
    } catch (err) {
      // Network error — fall back to localStorage so offline still works
      console.error('[auth] /api/auth/token network error:', err);
    }
    // Offline / server-error fallback: verify against locally-stored hash
    const localValid = await verifyAccountCredentials(email, password);
    if (localValid) {
      await onSuccess();
      return true;
    }
    return false;
  };

  const accountLogout = () => {
    clearAccountSession();
    clearPlanCache();
    vaultManager.clearAccountEmail();
    vaultManager.clearInternalState();
    setIsAccountLoggedIn(false);
    setAccountEmail(null);
    // Also lock the vault session
    setIsUnlocked(false);
    setMasterPassword(null);
    sessionStorage.removeItem(SESSION_KEY);
    vaultStorage.setEncryptionKey(null as any);
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
    isAccountLoggedIn,
    accountEmail,
    login,
    loginWithKey,
    createVault,
    logout,
    accountLogin,
    accountLogout,
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
