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
import { acquireCloudToken, clearCloudToken } from '@/lib/cloud-vault-sync';
import { vaultManager } from '@/lib/vault-manager';
import { clearPlanCache } from '@/hooks/use-plan-features';

// Server returns `{ requires2FA: true, tempToken }` when password auth succeeds
// but the user has 2FA enabled. We surface this to the login page via
// `pendingTwoFactor` state — the caller shows a code prompt and finishes the
// login through `verifyTwoFactor`. Until verifyTwoFactor succeeds, no session
// state is set (isAccountLoggedIn stays false).
export interface PendingTwoFactor {
  email: string;
  tempToken: string;
  // The plaintext password is held in memory only for the duration of the
  // 2FA challenge so we can run the post-login side-effects (vault data wipe
  // for previous user, saveAccountCredentials) once the code is verified.
  password: string;
}

interface AuthContextType {
  isUnlocked: boolean;
  vaultExists: boolean;
  masterPassword: string | null;
  isAccountLoggedIn: boolean;
  accountEmail: string | null;
  pendingTwoFactor: PendingTwoFactor | null;
  login: (masterPassword: string) => Promise<boolean>;
  loginWithKey: (base64Key: string) => Promise<boolean>;
  loginWithoutVerification: (masterPassword: string) => void;
  createVault: (masterPassword: string) => Promise<void>;
  logout: () => void;
  accountLogin: (email: string, password: string) => Promise<boolean>;
  verifyTwoFactor: (code: string) => Promise<boolean>;
  cancelTwoFactor: () => void;
  accountLogout: () => void;
  isLoading: boolean;
  getMasterKey: () => Promise<CryptoKey | null>;
  changeMasterPassword: (
    currentPassword: string,
    newPassword: string,
    onProgress?: (p: number) => void,
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Legacy key — older builds wrote the master password here. We never write it
// anymore (security: master password must not be persisted), but we still
// remove the key on every relevant transition to clean up old sessions.
const SESSION_KEY = 'iv_session';

// Set of emails for which the server has previously reported 2FA is enabled.
// We use this as a hint to refuse the local-hash fallback when the server is
// unreachable — otherwise an attacker who can MITM /api/auth/token (return 5xx)
// could bypass 2FA using only the password.
const TWO_FA_HINT_KEY = 'iv_2fa_enabled_emails';
function get2faHintSet(): Set<string> {
  try {
    const raw = localStorage.getItem(TWO_FA_HINT_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map((e) => String(e).toLowerCase()) : []);
  } catch { return new Set(); }
}
function add2faHint(email: string) {
  const s = get2faHintSet();
  s.add(email.toLowerCase());
  try { localStorage.setItem(TWO_FA_HINT_KEY, JSON.stringify(Array.from(s))); } catch { /* noop */ }
}
function has2faHint(email: string): boolean {
  return get2faHintSet().has(email.toLowerCase());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [masterPassword, setMasterPassword] = useState<string | null>(null);
  const [isAccountLoggedIn, setIsAccountLoggedIn] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [pendingTwoFactor, setPendingTwoFactor] = useState<PendingTwoFactor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { clearLogs, addLog } = useLogging();

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

      // Sync vaultStorage to the persisted active vault (e.g. a cloud vault) before
      // calling init, so we open the right IndexedDB instead of always defaulting to
      // the bare "IronVault" database.
      const activeVaultId = vaultManager.getActiveVaultId();
      if (activeVaultId) {
        await vaultStorage.switchToVault(activeVaultId);
      } else {
        await vaultStorage.init();
      }
      const exists = await vaultStorage.vaultExists();
      setVaultExists(exists);

      // SECURITY: Master password is NEVER persisted. Older builds wrote it to
      // sessionStorage; clear any legacy value here. The user must re-enter the
      // master password on every page load / new session.
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Shared post-auth side-effects. Runs AFTER both password and (if enabled) 2FA
  // succeed. Pulled out so accountLogin (no-2FA path), verifyTwoFactor, and the
  // offline fallback can share the same identity-handover logic.
  const finalizeAccountLogin = async (email: string, password: string, normalizedEmail: string, passwordHash: string) => {
    // SECURITY: wipe any cloud token from a previous user's session BEFORE
    // setting isAccountLoggedIn. Without this, the old token stays in
    // localStorage and vault listing runs with it, leaking another user's vaults.
    clearCloudToken();

    const previousEmail = (() => {
      try {
        const raw = localStorage.getItem('iv_account');
        return raw ? (JSON.parse(raw)?.email || null) : null;
      } catch { return null; }
    })();
    if (previousEmail && previousEmail.toLowerCase().trim() !== normalizedEmail) {
      vaultStorage.setEncryptionKey(null as any);
      sessionStorage.removeItem(SESSION_KEY);
      await vaultManager.wipeOtherAccountVaultData(normalizedEmail);
    }

    await saveAccountCredentials(email, password);
    saveAccountSession(normalizedEmail);
    vaultManager.setAccountEmail(normalizedEmail);
    clearPlanCache();
    addLog('Account Login', 'security', `Signed in as ${normalizedEmail}`);
    await acquireCloudToken(normalizedEmail, passwordHash).catch(() => null);
    setIsAccountLoggedIn(true);
    setAccountEmail(normalizedEmail);
  };

  const accountLogin = async (email: string, password: string): Promise<boolean> => {
    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await sha256(password);

    // Server is the primary source of truth for cross-device auth.
    // Trust-on-first-use: if no hash stored server-side yet, it stores and accepts.
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, accountPasswordHash: passwordHash }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({} as any));
        // 2FA gate: server says "password OK, now I need a code". Stash the
        // pending state and return false — the login UI watches pendingTwoFactor
        // and pivots to the code prompt. The caller's `success === false` here
        // is NOT a failure — it just means "more steps needed".
        if (data.requires2FA && data.tempToken) {
          // Record the 2FA hint so we never fall back to local-hash auth for
          // this email when the server is unreachable.
          add2faHint(normalizedEmail);
          setPendingTwoFactor({ email: normalizedEmail, tempToken: data.tempToken, password });
          return false;
        }
        await finalizeAccountLogin(email, password, normalizedEmail, passwordHash);
        return true;
      }
      // 401 from server means wrong password — don't fall back to local
      if (res.status === 401) return false;
      // 403 means email not yet verified
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'email_not_verified') throw new Error('EMAIL_NOT_VERIFIED');
        return false;
      }
      // 5xx or unexpected: fall through to localStorage fallback below
      console.error('[auth] /api/auth/token returned', res.status, '— falling back to local');
    } catch (err) {
      // Re-throw EMAIL_NOT_VERIFIED — do not swallow it
      if (err instanceof Error && err.message === 'EMAIL_NOT_VERIFIED') throw err;
      // Network error — fall back to localStorage so offline still works
      console.error('[auth] /api/auth/token network error:', err);
    }
    // SECURITY: if this email has 2FA enabled (per the cached server hint),
    // refuse the offline fallback entirely — otherwise an attacker who can
    // induce a 5xx on /api/auth/token would bypass 2FA with just the password.
    if (has2faHint(normalizedEmail)) {
      throw new Error('SERVER_UNREACHABLE_2FA');
    }
    // Offline / server-error fallback (only for accounts not known to have
    // 2FA): verify against locally-stored hash.
    const localValid = await verifyAccountCredentials(email, password);
    if (localValid) {
      await finalizeAccountLogin(email, password, normalizedEmail, passwordHash);
      return true;
    }
    return false;
  };

  const verifyTwoFactor = async (code: string): Promise<boolean> => {
    const pending = pendingTwoFactor;
    if (!pending) return false;
    try {
      const res = await fetch('/api/auth/2fa/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken: pending.tempToken, code: code.trim() }),
      });
      if (!res.ok) return false;
      const passwordHash = await sha256(pending.password);
      await finalizeAccountLogin(pending.email, pending.password, pending.email, passwordHash);
      setPendingTwoFactor(null);
      return true;
    } catch (err) {
      console.error('[auth] verifyTwoFactor network error:', err);
      return false;
    }
  };

  const cancelTwoFactor = () => setPendingTwoFactor(null);

  const accountLogout = () => {
    clearAccountSession();
    clearPlanCache();
    clearCloudToken(); // SECURITY: prevent stale token from leaking to next user
    // BUG-04: drop unscoped legacy registry/active-vault pointers and the
    // cached cloud-synced list so the next account login starts clean.
    // Per-account scoped registries are kept (so re-login is fast).
    try {
      localStorage.removeItem('ironvault_registry');
      localStorage.removeItem('ironvault_active_vault');
      localStorage.removeItem('ironvault_passwords');
      localStorage.removeItem('ironvault_has_vault');
      localStorage.removeItem('iv_cloud_synced_vaults');
    } catch { /* noop */ }
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
        addLog('Vault Unlock', 'security', 'Vault unlocked successfully');
      }
      return success;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  // Vault storage already has the encryption key set (e.g. after createVault + importVault).
  // Just set auth state — skip redundant unlockVault verification.
  const loginWithoutVerification = (password: string): void => {
    setIsUnlocked(true);
    setMasterPassword(password);
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

  const changeMasterPassword = async (
    currentPassword: string,
    newPassword: string,
    onProgress?: (p: number) => void,
  ): Promise<void> => {
    if (!isUnlocked) throw new Error('Vault must be unlocked');
    await vaultStorage.changeMasterPassword(currentPassword, newPassword, onProgress);
    // Update in-memory state so the rest of the app keeps working with the
    // same vault under the new password. (Master password is NEVER persisted.)
    setMasterPassword(newPassword);
    addLog('Master Password Changed', 'security', 'Vault re-encrypted with new master password');
    // Force the cloud sync hook to push the freshly re-encrypted blob so other
    // devices receive the new copy. The hook reads masterPassword from props,
    // so by the time this event fires the new value is already in state.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('vault:force-cloud-push'));
    }, 100);
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
    pendingTwoFactor,
    login,
    loginWithKey,
    loginWithoutVerification,
    createVault,
    logout,
    accountLogin,
    verifyTwoFactor,
    cancelTwoFactor,
    accountLogout,
    isLoading,
    getMasterKey,
    changeMasterPassword,
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
