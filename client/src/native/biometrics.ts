/**
 * Biometrics Module - Secure Per-Vault Biometric Authentication
 *
 * Uses @aparajita/capacitor-biometric-auth (Capacitor 7 compatible) for
 * availability checks and auth prompts.  Credential storage is handled by
 * BiometricKeystore via @capacitor/preferences + AES-GCM.
 */

import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { isNativeApp, isIOS } from './platform';
import { biometricAuthService, BiometricAuthResult } from '../lib/biometric-auth';
import { biometricKeystore } from '../lib/biometric-keystore';

const DEFAULT_VAULT_ID = 'default';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometryType: 'touchId' | 'faceId' | 'fingerprint' | 'face' | 'iris' | 'none';
  isEnrolled: boolean;
  strongBiometryIsAvailable: boolean;
}

export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  if (isNativeApp()) {
    try {
      const result = await BiometricAuth.checkBiometry();
      const available = result.isAvailable;

      let biometryType: BiometricCapabilities['biometryType'] = 'none';
      if (result.biometryType === BiometryType.faceId) {
        biometryType = 'faceId';
      } else if (result.biometryType === BiometryType.touchId) {
        biometryType = 'touchId';
      } else if (result.biometryType === BiometryType.fingerprintAuthentication) {
        biometryType = 'fingerprint';
      } else if (result.biometryType === BiometryType.faceAuthentication) {
        biometryType = 'face';
      } else if (result.biometryType === BiometryType.irisAuthentication) {
        biometryType = 'iris';
      }

      return {
        isAvailable: available,
        biometryType,
        isEnrolled: available,
        strongBiometryIsAvailable: available,
      };
    } catch (error) {
      // Previously this returned a synthetic { isAvailable: true, biometryType: 'faceId' }
      // on iOS to mask plugin init quirks. That hid real failures (no enrolment,
      // hardware locked, missing usage description) and made the unlock UI claim
      // Face ID was ready when the prompt would error. Always report unavailable
      // on error and surface the underlying message so the caller can show a
      // useful message instead of a silent failure.
      console.error('BiometricCheck: error checking capabilities:', error, isIOS() ? '(iOS)' : '');
      return { isAvailable: false, biometryType: 'none', isEnrolled: false, strongBiometryIsAvailable: false };
    }
  }

  // Web — use WebAuthn fallback
  const available = await biometricAuthService.isBiometricAvailable();
  const bioType = await biometricAuthService.getBiometricType();
  return {
    isAvailable: available,
    biometryType: bioType === 'fingerprint' ? 'fingerprint' : bioType === 'face' ? 'face' : 'none',
    isEnrolled: available,
    strongBiometryIsAvailable: available,
  };
}

export async function authenticateWithBiometric(reason?: string): Promise<BiometricAuthResult> {
  try {
    const capabilities = await checkBiometricCapabilities();
    if (!capabilities.isAvailable || !capabilities.isEnrolled) {
      return { success: false, error: 'Biometric authentication not available or not enrolled' };
    }

    if (isNativeApp()) {
      try {
        await BiometricAuth.authenticate({
          reason: reason || 'Unlock your vault',
          cancelTitle: 'Cancel',
          allowDeviceCredential: false,
        });
        return {
          success: true,
          method: capabilities.biometryType === 'fingerprint' || capabilities.biometryType === 'touchId'
            ? 'fingerprint' : 'face',
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Biometric verification cancelled or failed',
        };
      }
    }

    // Web WebAuthn fallback
    const result = await biometricAuthService.authenticateBiometric();
    if (result.success) {
      return {
        success: true,
        method: capabilities.biometryType === 'fingerprint' ? 'fingerprint' : 'face',
      };
    }
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Biometric authentication failed',
    };
  }
}

export async function isBiometricUnlockEnabled(vaultId: string = DEFAULT_VAULT_ID): Promise<boolean> {
  try {
    return biometricKeystore.isBiometricEnabledForVault(vaultId);
  } catch {
    return false;
  }
}

export async function enableBiometricUnlock(vaultUnlockKey: string, vaultId: string = DEFAULT_VAULT_ID): Promise<boolean> {
  try {
    const result = await biometricKeystore.storeVaultKey(vaultId, vaultUnlockKey);
    return result.success;
  } catch {
    return false;
  }
}

export async function disableBiometricUnlock(vaultId: string = DEFAULT_VAULT_ID): Promise<void> {
  await biometricKeystore.deleteVaultKey(vaultId);
}

/** @deprecated Use unlockWithBiometric() */
export async function getDeviceKey(vaultId: string = DEFAULT_VAULT_ID): Promise<string | null> {
  const result = await biometricKeystore.retrieveVaultKey(vaultId);
  return result.success ? result.vaultUnlockKey || null : null;
}

export function generateDeviceKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

export async function unlockWithBiometric(vaultId: string = DEFAULT_VAULT_ID): Promise<{
  success: boolean;
  vaultUnlockKey?: string;
  vaultId?: string;
  error?: string;
  deviceKey?: string; // legacy alias
}> {
  try {
    const isEnabled = await isBiometricUnlockEnabled(vaultId);
    if (!isEnabled) {
      return { success: false, error: 'Biometric unlock is not enabled for this vault' };
    }

    const result = await biometricKeystore.retrieveVaultKey(vaultId);
    if (!result.success || !result.vaultUnlockKey) {
      return { success: false, error: result.error || 'Failed to retrieve vault key' };
    }

    return {
      success: true,
      vaultUnlockKey: result.vaultUnlockKey,
      deviceKey: result.vaultUnlockKey,
      vaultId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unlock failed',
    };
  }
}

export async function getVaultsWithBiometricEnabled(): Promise<string[]> {
  try {
    return biometricKeystore.getVaultsWithBiometricEnabled();
  } catch {
    return [];
  }
}

export function getBiometricKeystore() {
  return biometricKeystore;
}
