/**
 * Biometric Keystore Service
 *
 * SECURITY ARCHITECTURE:
 * - Uses @aparajita/capacitor-biometric-auth for the biometric prompt
 * - Stores encrypted vault unlock keys in @capacitor/preferences (software-backed)
 * - The vault unlock key is AES-GCM encrypted with a per-device random key
 * - Biometric authentication is the gate before the device key is used
 *
 * THREAT MODEL:
 * - Attacker who steals the device must pass biometric to unlock the vault
 * - Master password is NEVER stored — only a derived unlock secret
 * - Per-vault isolation: each vault has its own preference entry
 *
 * TRADE-OFF vs old plugin:
 * - The old capacitor-native-biometric plugin stored credentials in the OS keychain
 *   (hardware-backed on most devices). The new plugin only provides auth prompts.
 * - We compensate by AES-256-GCM encrypting the vault key before storing it in
 *   Preferences, using a per-install device key also stored in Preferences.
 * - The biometric auth prompt is enforced at the app layer before decryption.
 */

import { BiometricAuth, CheckBiometryResult } from '@aparajita/capacitor-biometric-auth';
import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from '@/native/platform';
import { CryptoService } from './crypto';

const DEVICE_KEY_PREF = 'iv_dk';          // base64 raw 32-byte AES key
const VAULT_KEY_PREFIX = 'iv_bkey_';      // iv_bkey_<vaultId> → base64 JSON {iv, ct}
const VAULT_REGISTRY_KEY = 'ironvault_registry';
const ACCOUNT_CRED_PREF = 'iv_account_bio';     // encrypted blob {iv, ct} of {email,password}
const ACCOUNT_BIO_FLAG = 'iv_account_bio_enabled';
const ACCOUNT_BIO_EMAIL = 'iv_account_bio_email';

export interface BiometricKeyEntry {
  vaultId: string;
  isEnabled: boolean;
}

export interface StoreBiometricResult {
  success: boolean;
  error?: string;
}

export interface RetrieveBiometricResult {
  success: boolean;
  vaultUnlockKey?: string;
  error?: string;
}

/**
 * BiometricKeystore — Secure per-vault biometric credential storage
 */
export class BiometricKeystore {
  private static instance: BiometricKeystore;
  private deviceKey: CryptoKey | null = null;

  private constructor() {}

  static getInstance(): BiometricKeystore {
    if (!BiometricKeystore.instance) {
      BiometricKeystore.instance = new BiometricKeystore();
    }
    return BiometricKeystore.instance;
  }

  /** Get or create the per-install device key (AES-256-GCM). */
  private async getDeviceKey(): Promise<CryptoKey> {
    if (this.deviceKey) return this.deviceKey;

    const { value } = await Preferences.get({ key: DEVICE_KEY_PREF });
    if (value) {
      const rawBytes = CryptoService.base64ToUint8Array(value);
      this.deviceKey = await crypto.subtle.importKey(
        'raw', rawBytes.buffer as ArrayBuffer, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
      );
    } else {
      // First run — generate and persist the device key
      this.deviceKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      );
      const rawBytes = await crypto.subtle.exportKey('raw', this.deviceKey);
      await Preferences.set({
        key: DEVICE_KEY_PREF,
        value: CryptoService.arrayBufferToBase64(rawBytes),
      });
    }
    return this.deviceKey;
  }

  /**
   * Store a vault unlock key in Preferences, encrypted with the device key.
   */
  async storeVaultKey(vaultId: string, vaultUnlockKey: string): Promise<StoreBiometricResult> {
    if (!isNativeApp()) {
      return { success: false, error: 'Biometric storage not available on web' };
    }
    try {
      const dk = await this.getDeviceKey();
      const { encrypted, iv } = await CryptoService.encrypt(vaultUnlockKey, dk);
      const blob = JSON.stringify({
        iv: CryptoService.uint8ArrayToBase64(iv),
        ct: CryptoService.uint8ArrayToBase64(encrypted),
      });
      await Preferences.set({ key: `${VAULT_KEY_PREFIX}${vaultId}`, value: blob });
      this.updateVaultBiometricFlag(vaultId, true);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store biometric credentials',
      };
    }
  }

  /**
   * Prompt biometric auth, then decrypt and return the stored vault key.
   */
  async retrieveVaultKey(vaultId: string): Promise<RetrieveBiometricResult> {
    if (!isNativeApp()) {
      return { success: false, error: 'Biometric storage not available on web' };
    }
    try {
      // Trigger the biometric prompt
      await BiometricAuth.authenticate({
        reason: 'Unlock your IronVault',
        cancelTitle: 'Cancel',
        allowDeviceCredential: false,
      });

      // Auth passed — decrypt the stored key
      const { value: blob } = await Preferences.get({ key: `${VAULT_KEY_PREFIX}${vaultId}` });
      if (!blob) return { success: false, error: 'No credentials found for this vault' };

      const { iv: ivB64, ct: ctB64 } = JSON.parse(blob);
      const iv = CryptoService.base64ToUint8Array(ivB64);
      const ct = CryptoService.base64ToUint8Array(ctB64);

      const dk = await this.getDeviceKey();
      const decrypted = await CryptoService.decrypt(ct, dk, iv);
      const vaultUnlockKey = new TextDecoder().decode(decrypted);

      return { success: true, vaultUnlockKey };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Biometric authentication failed',
      };
    }
  }

  /**
   * Remove the stored vault key from Preferences.
   */
  async deleteVaultKey(vaultId: string): Promise<boolean> {
    localStorage.removeItem(`ironvault_biometric_enabled_${vaultId}`);
    localStorage.removeItem(`ironvault_biometric_salt_${vaultId}`);
    try {
      await Preferences.remove({ key: `${VAULT_KEY_PREFIX}${vaultId}` });
      this.updateVaultBiometricFlag(vaultId, false);
      return true;
    } catch {
      this.updateVaultBiometricFlag(vaultId, false);
      return false;
    }
  }

  isBiometricEnabledForVault(vaultId: string): boolean {
    try {
      const directFlag = localStorage.getItem(`ironvault_biometric_enabled_${vaultId}`);
      if (directFlag === 'true') return true;
      if (directFlag === 'false') return false;
      const registry = this.getVaultRegistry();
      const vault = registry.find((v: any) => v.id === vaultId);
      return vault?.biometricEnabled === true;
    } catch {
      return false;
    }
  }

  getVaultsWithBiometricEnabled(): string[] {
    try {
      const enabledVaults: string[] = [];
      const registry = this.getVaultRegistry();
      for (const vault of registry) {
        if (vault.id) {
          const directFlag = localStorage.getItem(`ironvault_biometric_enabled_${vault.id}`);
          if (directFlag === 'true' || (vault.biometricEnabled === true && directFlag !== 'false')) {
            enabledVaults.push(vault.id);
          }
        }
      }
      const defaultFlag = localStorage.getItem('ironvault_biometric_enabled_default');
      if (defaultFlag === 'true' && !enabledVaults.includes('default')) {
        enabledVaults.push('default');
      }
      return enabledVaults;
    } catch {
      return [];
    }
  }

  private updateVaultBiometricFlag(vaultId: string, enabled: boolean): void {
    try {
      const registry = this.getVaultRegistry();
      const idx = registry.findIndex((v: any) => v.id === vaultId);
      if (idx !== -1) {
        registry[idx].biometricEnabled = enabled;
        localStorage.setItem(VAULT_REGISTRY_KEY, JSON.stringify(registry));
      } else if (enabled) {
        registry.push({
          id: vaultId,
          biometricEnabled: true,
          name: 'Vault',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isDefault: registry.length === 0,
          iconColor: '#6366f1',
        });
        localStorage.setItem(VAULT_REGISTRY_KEY, JSON.stringify(registry));
      }
      localStorage.setItem(`ironvault_biometric_enabled_${vaultId}`, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('BiometricKeystore: Failed to update vault registry:', error);
    }
  }

  private getVaultRegistry(): any[] {
    try {
      const data = localStorage.getItem(VAULT_REGISTRY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Derive a vault unlock key from master password (extractable, base64-encoded).
   */
  async deriveVaultUnlockKey(masterPassword: string, salt: Uint8Array): Promise<string> {
    const derivedKey = await CryptoService.deriveKeyWithConfig(
      masterPassword,
      salt,
      CryptoService.KDF_PRESETS.standard,
      true
    );
    const exportedKey = await crypto.subtle.exportKey('raw', derivedKey);
    return btoa(Array.from(new Uint8Array(exportedKey)).map(b => String.fromCharCode(b)).join(''));
  }

  async importVaultUnlockKey(base64Key: string): Promise<CryptoKey> {
    const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  // ── Account-level biometric credentials ───────────────────────────────────
  // Stores account email + account password (the Stage-1 login secret) so a
  // single biometric prompt can sign the user in without a password.

  async storeAccountCredentials(email: string, accountPassword: string): Promise<StoreBiometricResult> {
    if (!isNativeApp()) return { success: false, error: 'Account biometric requires native app' };
    try {
      const dk = await this.getDeviceKey();
      const payload = JSON.stringify({ email: email.toLowerCase().trim(), password: accountPassword });
      const { encrypted, iv } = await CryptoService.encrypt(payload, dk);
      const blob = JSON.stringify({
        iv: CryptoService.uint8ArrayToBase64(iv),
        ct: CryptoService.uint8ArrayToBase64(encrypted),
      });
      await Preferences.set({ key: ACCOUNT_CRED_PREF, value: blob });
      localStorage.setItem(ACCOUNT_BIO_FLAG, 'true');
      localStorage.setItem(ACCOUNT_BIO_EMAIL, email.toLowerCase().trim());
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store account credentials',
      };
    }
  }

  async retrieveAccountCredentials(): Promise<{ success: boolean; email?: string; password?: string; error?: string }> {
    if (!isNativeApp()) return { success: false, error: 'Account biometric requires native app' };
    try {
      await BiometricAuth.authenticate({
        reason: 'Sign in to IronVault',
        cancelTitle: 'Cancel',
        allowDeviceCredential: false,
      });
      const { value: blob } = await Preferences.get({ key: ACCOUNT_CRED_PREF });
      if (!blob) return { success: false, error: 'No biometric credentials found' };

      const { iv: ivB64, ct: ctB64 } = JSON.parse(blob);
      const iv = CryptoService.base64ToUint8Array(ivB64);
      const ct = CryptoService.base64ToUint8Array(ctB64);
      const dk = await this.getDeviceKey();
      const decrypted = await CryptoService.decrypt(ct, dk, iv);
      const { email, password } = JSON.parse(new TextDecoder().decode(decrypted));
      return { success: true, email, password };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Biometric authentication failed',
      };
    }
  }

  async deleteAccountCredentials(): Promise<void> {
    try {
      await Preferences.remove({ key: ACCOUNT_CRED_PREF });
    } catch {}
    localStorage.removeItem(ACCOUNT_BIO_FLAG);
    localStorage.removeItem(ACCOUNT_BIO_EMAIL);
  }

  isAccountBiometricEnabled(): boolean {
    return localStorage.getItem(ACCOUNT_BIO_FLAG) === 'true';
  }

  getAccountBiometricEmail(): string | null {
    return localStorage.getItem(ACCOUNT_BIO_EMAIL);
  }

  /**
   * Authoritative probe: returns true if encrypted account credentials exist
   * in Capacitor Preferences, regardless of the localStorage flag. Used to
   * recover the "enrolled" state when localStorage was cleared (webview
   * cache wipe, app reinstall on some platforms) but the secure-storage
   * blob survived. Re-syncs the localStorage flag as a side-effect so the
   * sync `isAccountBiometricEnabled()` is correct on subsequent calls.
   */
  async hasAccountBiometricCredentials(): Promise<boolean> {
    if (!isNativeApp()) return false;
    try {
      const { value } = await Preferences.get({ key: ACCOUNT_CRED_PREF });
      const exists = !!value;
      const flag = localStorage.getItem(ACCOUNT_BIO_FLAG) === 'true';
      if (exists && !flag) {
        // Recover the localStorage flag — the synchronous getter is now consistent.
        localStorage.setItem(ACCOUNT_BIO_FLAG, 'true');
      } else if (!exists && flag) {
        // Stale flag pointing at non-existent creds — clear it.
        localStorage.removeItem(ACCOUNT_BIO_FLAG);
        localStorage.removeItem(ACCOUNT_BIO_EMAIL);
      }
      return exists;
    } catch {
      return false;
    }
  }
}

export const biometricKeystore = BiometricKeystore.getInstance();
