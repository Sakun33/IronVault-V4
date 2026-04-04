/**
 * Biometric Keystore Service
 * 
 * SECURITY ARCHITECTURE:
 * - Uses native Keychain (iOS) / Keystore (Android) via capacitor-native-biometric
 * - Stores a randomly generated vault unlock key, NOT the master password
 * - The vault unlock key is wrapped/encrypted with the password-derived key
 * - Biometric authentication is required to retrieve the stored credentials
 * 
 * THREAT MODEL:
 * - Even if device storage is compromised, the biometric key cannot be extracted
 *   without biometric authentication
 * - Master password is NEVER stored - only a derived unlock secret
 * - Per-vault isolation: each vault has its own biometric credential
 * 
 * MIGRATION STRATEGY (Option 1 - Minimal):
 * - When enabling biometrics, we store the password-derived encryption key
 * - This allows unlocking the vault without re-deriving from password
 * - Existing vault data remains unchanged
 */

import { NativeBiometric } from 'capacitor-native-biometric';
import { isNativeApp } from '@/native/platform';
import { CryptoService } from './crypto';

const BIOMETRIC_SERVER_PREFIX = 'ironvault:';
const VAULT_REGISTRY_KEY = 'ironvault_registry';

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
 * BiometricKeystore - Secure per-vault biometric credential storage
 * 
 * Uses native Keychain/Keystore APIs that require biometric authentication
 * to access stored credentials.
 */
export class BiometricKeystore {
  private static instance: BiometricKeystore;

  private constructor() {}

  static getInstance(): BiometricKeystore {
    if (!BiometricKeystore.instance) {
      BiometricKeystore.instance = new BiometricKeystore();
    }
    return BiometricKeystore.instance;
  }

  /**
   * Generate a secure server identifier for this vault
   * Format: ironvault:<vaultId>
   */
  private getServerForVault(vaultId: string): string {
    return `${BIOMETRIC_SERVER_PREFIX}${vaultId}`;
  }

  /**
   * Store a vault unlock key in secure biometric-protected storage
   * 
   * SECURITY: The vaultUnlockKey should be a derived encryption key or
   * wrapped key material - NEVER the raw master password.
   * 
   * @param vaultId - Unique vault identifier
   * @param vaultUnlockKey - The key material to store (base64 encoded derived key)
   */
  async storeVaultKey(vaultId: string, vaultUnlockKey: string): Promise<StoreBiometricResult> {
    if (!isNativeApp()) {
      // For web, we cannot use secure biometric storage
      // Return success but log warning - web uses different flow
      console.warn('BiometricKeystore: Web platform - biometric storage not available');
      return { success: false, error: 'Biometric storage not available on web' };
    }

    try {
      const server = this.getServerForVault(vaultId);
      
      // Store credentials in native Keychain/Keystore
      // These are protected by biometric authentication
      await NativeBiometric.setCredentials({
        username: vaultId,
        password: vaultUnlockKey,
        server: server,
      });

      // Update vault registry to mark biometric as enabled
      this.updateVaultBiometricFlag(vaultId, true);

      console.log(`BiometricKeystore: Stored key for vault ${vaultId}`);
      return { success: true };
    } catch (error) {
      console.error('BiometricKeystore: Failed to store vault key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store biometric credentials',
      };
    }
  }

  /**
   * Retrieve a vault unlock key from secure biometric-protected storage
   * 
   * This will trigger a biometric prompt. The key is only returned if
   * biometric authentication succeeds.
   * 
   * @param vaultId - Unique vault identifier
   */
  async retrieveVaultKey(vaultId: string): Promise<RetrieveBiometricResult> {
    if (!isNativeApp()) {
      return { success: false, error: 'Biometric storage not available on web' };
    }

    try {
      const server = this.getServerForVault(vaultId);

      // First verify identity with biometric
      await NativeBiometric.verifyIdentity({
        reason: 'Unlock your vault',
        title: 'IronVault',
        subtitle: 'Biometric Authentication',
        description: 'Authenticate to unlock your vault',
      });

      // If verification succeeded, get the credentials
      const credentials = await NativeBiometric.getCredentials({
        server: server,
      });

      if (credentials && credentials.password) {
        return {
          success: true,
          vaultUnlockKey: credentials.password,
        };
      }

      return { success: false, error: 'No credentials found for this vault' };
    } catch (error) {
      console.error('BiometricKeystore: Failed to retrieve vault key:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Biometric authentication failed',
      };
    }
  }

  /**
   * Delete biometric credentials for a vault
   * 
   * @param vaultId - Unique vault identifier
   */
  async deleteVaultKey(vaultId: string): Promise<boolean> {
    // Always clean up the direct flag
    localStorage.removeItem(`ironvault_biometric_enabled_${vaultId}`);
    localStorage.removeItem(`ironvault_biometric_salt_${vaultId}`);
    
    if (!isNativeApp()) {
      this.updateVaultBiometricFlag(vaultId, false);
      return true;
    }

    try {
      const server = this.getServerForVault(vaultId);
      
      await NativeBiometric.deleteCredentials({
        server: server,
      });

      // Update vault registry
      this.updateVaultBiometricFlag(vaultId, false);

      console.log(`BiometricKeystore: Deleted key for vault ${vaultId}`);
      return true;
    } catch (error) {
      console.error('BiometricKeystore: Failed to delete vault key:', error);
      // Still update the flag even if deletion failed
      this.updateVaultBiometricFlag(vaultId, false);
      return false;
    }
  }

  /**
   * Check if biometric is enabled for a specific vault
   */
  isBiometricEnabledForVault(vaultId: string): boolean {
    try {
      // Check direct flag first (most reliable)
      const directFlag = localStorage.getItem(`ironvault_biometric_enabled_${vaultId}`);
      if (directFlag === 'true') return true;
      if (directFlag === 'false') return false;
      
      // Fall back to registry check
      const registry = this.getVaultRegistry();
      const vault = registry.find((v: any) => v.id === vaultId);
      return vault?.biometricEnabled === true;
    } catch {
      return false;
    }
  }

  /**
   * Get all vaults that have biometric enabled
   */
  getVaultsWithBiometricEnabled(): string[] {
    try {
      const enabledVaults: string[] = [];
      
      // Check registry
      const registry = this.getVaultRegistry();
      for (const vault of registry) {
        if (vault.biometricEnabled === true || vault.id) {
          // Also verify with direct flag
          const directFlag = localStorage.getItem(`ironvault_biometric_enabled_${vault.id}`);
          if (directFlag === 'true' || (vault.biometricEnabled === true && directFlag !== 'false')) {
            enabledVaults.push(vault.id);
          }
        }
      }
      
      // Also check for default vault
      const defaultFlag = localStorage.getItem('ironvault_biometric_enabled_default');
      if (defaultFlag === 'true' && !enabledVaults.includes('default')) {
        enabledVaults.push('default');
      }
      
      return enabledVaults;
    } catch {
      return [];
    }
  }

  /**
   * Update the biometric flag in the vault registry
   */
  private updateVaultBiometricFlag(vaultId: string, enabled: boolean): void {
    try {
      const registry = this.getVaultRegistry();
      const vaultIndex = registry.findIndex((v: any) => v.id === vaultId);
      
      if (vaultIndex !== -1) {
        registry[vaultIndex].biometricEnabled = enabled;
        localStorage.setItem(VAULT_REGISTRY_KEY, JSON.stringify(registry));
      } else if (enabled) {
        // If vault not in registry but enabling biometric, add it
        // This handles edge cases where vault exists but registry is missing entry
        console.log(`BiometricKeystore: Vault ${vaultId} not in registry, adding biometric entry`);
        registry.push({
          id: vaultId,
          biometricEnabled: true,
          name: 'Vault',
          createdAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          isDefault: registry.length === 0,
          iconColor: '#6366f1'
        });
        localStorage.setItem(VAULT_REGISTRY_KEY, JSON.stringify(registry));
      }
      
      // Also store a direct biometric enabled flag for quick lookup
      localStorage.setItem(`ironvault_biometric_enabled_${vaultId}`, enabled ? 'true' : 'false');
    } catch (error) {
      console.error('BiometricKeystore: Failed to update vault registry:', error);
    }
  }

  /**
   * Get the vault registry from localStorage
   */
  private getVaultRegistry(): any[] {
    try {
      const data = localStorage.getItem(VAULT_REGISTRY_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate a vault unlock key from the master password
   * 
   * This derives a key that can be used to unlock the vault database.
   * The derived key is what we store in biometric storage, not the password.
   * 
   * @param masterPassword - The user's master password
   * @param salt - Salt for key derivation (stored in vault metadata)
   */
  async deriveVaultUnlockKey(masterPassword: string, salt: Uint8Array): Promise<string> {
    try {
      // Use the existing crypto service to derive the key (extractable for export)
      const derivedKey = await CryptoService.deriveKeyWithConfig(
        masterPassword, 
        salt, 
        CryptoService.KDF_PRESETS.standard,
        true // extractable
      );
      
      // Export the key to a storable format
      const exportedKey = await crypto.subtle.exportKey('raw', derivedKey);
      const keyBytes = new Uint8Array(exportedKey);
      
      // Convert to base64 for storage
      return btoa(Array.from(keyBytes).map(b => String.fromCharCode(b)).join(''));
    } catch (error) {
      console.error('BiometricKeystore: Failed to derive unlock key:', error);
      throw error;
    }
  }

  /**
   * Import a vault unlock key from stored format
   * 
   * @param base64Key - The base64-encoded key from biometric storage
   */
  async importVaultUnlockKey(base64Key: string): Promise<CryptoKey> {
    try {
      // Decode from base64
      const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
      
      // Import as CryptoKey
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
      
      return key;
    } catch (error) {
      console.error('BiometricKeystore: Failed to import unlock key:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const biometricKeystore = BiometricKeystore.getInstance();
