/**
 * Biometrics Module - Secure Per-Vault Biometric Authentication
 * 
 * SECURITY ARCHITECTURE:
 * - Uses native Keychain (iOS) / Keystore (Android) for credential storage
 * - Stores derived vault unlock keys, NEVER the master password
 * - Per-vault biometric credentials with proper isolation
 * - Biometric authentication required to retrieve stored keys
 * 
 * IMPORTANT: This module delegates secure storage to BiometricKeystore
 * which uses NativeBiometric.setCredentials/getCredentials for 
 * hardware-backed secure storage.
 */

import { isNativeApp, isIOS, isAndroid } from './platform';
import { biometricAuthService, BiometricAuthResult } from '../lib/biometric-auth';
import { biometricKeystore } from '../lib/biometric-keystore';
import { NativeBiometric, BiometryType } from 'capacitor-native-biometric';

const DEFAULT_VAULT_ID = 'default';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometryType: 'touchId' | 'faceId' | 'fingerprint' | 'face' | 'iris' | 'none';
  isEnrolled: boolean;
  strongBiometryIsAvailable: boolean;
}

export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  // For native iOS/Android apps, use the native biometric plugin
  if (isNativeApp()) {
    try {
      console.log('BiometricCheck: Checking native biometric availability...');
      const result = await NativeBiometric.isAvailable();
      console.log('BiometricCheck: NativeBiometric.isAvailable() result:', JSON.stringify(result));
      
      let biometryType: BiometricCapabilities['biometryType'] = 'none';
      if (result.biometryType === BiometryType.FACE_ID) {
        biometryType = 'faceId';
      } else if (result.biometryType === BiometryType.TOUCH_ID) {
        biometryType = 'touchId';
      } else if (result.biometryType === BiometryType.FINGERPRINT) {
        biometryType = 'fingerprint';
      } else if (result.biometryType === BiometryType.FACE_AUTHENTICATION) {
        biometryType = 'face';
      } else if (result.biometryType === BiometryType.IRIS_AUTHENTICATION) {
        biometryType = 'iris';
      }
      
      console.log('BiometricCheck: Biometry type:', biometryType, 'Available:', result.isAvailable);
      
      return {
        isAvailable: result.isAvailable,
        biometryType,
        isEnrolled: result.isAvailable,
        strongBiometryIsAvailable: result.isAvailable,
      };
    } catch (error) {
      console.error('BiometricCheck: Error checking native biometric capabilities:', error);
      // Even if isAvailable fails, try to return a sensible default for iOS
      if (isIOS()) {
        console.log('BiometricCheck: iOS detected, assuming Face ID available');
        return {
          isAvailable: true,
          biometryType: 'faceId',
          isEnrolled: true,
          strongBiometryIsAvailable: true,
        };
      }
      return {
        isAvailable: false,
        biometryType: 'none',
        isEnrolled: false,
        strongBiometryIsAvailable: false,
      };
    }
  } else {
    console.log('BiometricCheck: Not a native app, using WebAuthn');
  }

  // For web, use WebAuthn
  const available = await biometricAuthService.isBiometricAvailable();
  const biometricType = await biometricAuthService.getBiometricType();
  
  return {
    isAvailable: available,
    biometryType: biometricType === 'fingerprint' ? 'fingerprint' : biometricType === 'face' ? 'face' : 'none',
    isEnrolled: available,
    strongBiometryIsAvailable: available,
  };
}

export async function authenticateWithBiometric(reason?: string): Promise<BiometricAuthResult> {
  try {
    const capabilities = await checkBiometricCapabilities();
    
    if (!capabilities.isAvailable || !capabilities.isEnrolled) {
      return {
        success: false,
        error: 'Biometric authentication not available or not enrolled',
      };
    }

    // For native apps, use the native biometric plugin
    if (isNativeApp()) {
      try {
        await NativeBiometric.verifyIdentity({
          reason: reason || 'Unlock your vault',
          title: 'IronVault Authentication',
          subtitle: 'Verify your identity',
          description: 'Use biometrics to unlock your vault',
        });
        
        // If verifyIdentity doesn't throw, authentication was successful
        return {
          success: true,
          method: capabilities.biometryType === 'fingerprint' || capabilities.biometryType === 'touchId' ? 'fingerprint' : 'face',
        };
      } catch (error) {
        console.error('Native biometric verification failed:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Biometric verification cancelled or failed',
        };
      }
    }

    // For web, use WebAuthn
    const result = await biometricAuthService.authenticateBiometric();
    
    if (result.success) {
      return {
        success: true,
        method: capabilities.biometryType === 'fingerprint' ? 'fingerprint' : 'face',
      };
    }
    
    return result;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Biometric authentication failed',
    };
  }
}

/**
 * Check if biometric unlock is enabled for a specific vault
 * Uses the vault registry flag (set when credentials are stored in Keychain/Keystore)
 */
export async function isBiometricUnlockEnabled(vaultId: string = DEFAULT_VAULT_ID): Promise<boolean> {
  try {
    return biometricKeystore.isBiometricEnabledForVault(vaultId);
  } catch {
    return false;
  }
}

/**
 * Enable biometric unlock for a vault
 * 
 * SECURITY: The vaultUnlockKey should be a derived encryption key,
 * NOT the raw master password. The key is stored in native Keychain/Keystore
 * which provides hardware-backed security and requires biometric auth to access.
 * 
 * @param vaultUnlockKey - Base64-encoded derived vault unlock key
 * @param vaultId - The vault to enable biometrics for
 */
export async function enableBiometricUnlock(vaultUnlockKey: string, vaultId: string = DEFAULT_VAULT_ID): Promise<boolean> {
  try {
    const result = await biometricKeystore.storeVaultKey(vaultId, vaultUnlockKey);
    return result.success;
  } catch (error) {
    console.error('Failed to enable biometric unlock:', error);
    return false;
  }
}

/**
 * Disable biometric unlock for a vault
 * Removes credentials from native Keychain/Keystore
 */
export async function disableBiometricUnlock(vaultId: string = DEFAULT_VAULT_ID): Promise<void> {
  try {
    await biometricKeystore.deleteVaultKey(vaultId);
  } catch (error) {
    console.error('Failed to disable biometric unlock:', error);
    throw error;
  }
}

/**
 * Get the vault unlock key (requires biometric authentication)
 * 
 * NOTE: This function is now internal - use unlockWithBiometric() instead
 * which handles the full biometric flow.
 * 
 * @deprecated Use unlockWithBiometric() for the full secure flow
 */
export async function getDeviceKey(vaultId: string = DEFAULT_VAULT_ID): Promise<string | null> {
  console.warn('getDeviceKey is deprecated - use unlockWithBiometric() instead');
  try {
    const result = await biometricKeystore.retrieveVaultKey(vaultId);
    return result.success ? result.vaultUnlockKey || null : null;
  } catch {
    return null;
  }
}

export function generateDeviceKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Unlock a vault using biometric authentication
 * 
 * This is the main entry point for biometric vault unlock. It:
 * 1. Verifies biometric is enabled for the vault
 * 2. Triggers biometric authentication via native Keychain/Keystore
 * 3. Returns the vault unlock key if authentication succeeds
 * 
 * The returned vaultUnlockKey is a derived encryption key that can be
 * used to decrypt the vault database - NOT the master password.
 * 
 * @param vaultId - The vault to unlock
 * @returns Object with success status and vault unlock key if successful
 */
export async function unlockWithBiometric(vaultId: string = DEFAULT_VAULT_ID): Promise<{ 
  success: boolean; 
  vaultUnlockKey?: string; 
  vaultId?: string; 
  error?: string;
  // Legacy alias for compatibility
  deviceKey?: string;
}> {
  try {
    const isEnabled = await isBiometricUnlockEnabled(vaultId);
    
    if (!isEnabled) {
      return { success: false, error: 'Biometric unlock is not enabled for this vault' };
    }

    // Use BiometricKeystore which handles biometric auth + credential retrieval
    // in a single secure operation using native Keychain/Keystore
    const result = await biometricKeystore.retrieveVaultKey(vaultId);
    
    if (!result.success || !result.vaultUnlockKey) {
      return { success: false, error: result.error || 'Failed to retrieve vault key' };
    }

    return { 
      success: true, 
      vaultUnlockKey: result.vaultUnlockKey,
      deviceKey: result.vaultUnlockKey, // Legacy alias
      vaultId 
    };
  } catch (error) {
    console.error('Biometric unlock failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unlock failed',
    };
  }
}

/**
 * Get all vault IDs that have biometric unlock enabled
 */
export async function getVaultsWithBiometricEnabled(): Promise<string[]> {
  try {
    return biometricKeystore.getVaultsWithBiometricEnabled();
  } catch (error) {
    console.error('Error getting vaults with biometric:', error);
    return [];
  }
}

/**
 * Get the BiometricKeystore instance for advanced operations
 * (e.g., deriving vault unlock keys)
 */
export function getBiometricKeystore() {
  return biometricKeystore;
}
