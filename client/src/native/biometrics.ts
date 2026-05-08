/**
 * Biometrics Module — Public Native API
 *
 * Thin facade over BiometricKeystore. Stores email + account password +
 * master password together so a single biometric gesture handles BOTH the
 * Stage-1 account login and the Stage-2 vault unlock.
 */

import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';
import { isNativeApp, isIOS } from './platform';
import { biometricAuthService, BiometricAuthResult } from '../lib/biometric-auth';
import { biometricKeystore } from '../lib/biometric-keystore';

export interface BiometricCapabilities {
  isAvailable: boolean;
  biometryType: 'touchId' | 'faceId' | 'fingerprint' | 'face' | 'iris' | 'none';
  biometricLabel: 'Face ID' | 'Touch ID' | 'Fingerprint' | 'Biometric';
  isEnrolled: boolean;
  strongBiometryIsAvailable: boolean;
}

export async function checkBiometricCapabilities(): Promise<BiometricCapabilities> {
  if (isNativeApp()) {
    try {
      const result = await BiometricAuth.checkBiometry();
      const available = result.isAvailable;

      let biometryType: BiometricCapabilities['biometryType'] = 'none';
      let label: BiometricCapabilities['biometricLabel'] = 'Biometric';
      if (result.biometryType === BiometryType.faceId) {
        biometryType = 'faceId'; label = 'Face ID';
      } else if (result.biometryType === BiometryType.touchId) {
        biometryType = 'touchId'; label = 'Touch ID';
      } else if (result.biometryType === BiometryType.fingerprintAuthentication) {
        biometryType = 'fingerprint'; label = 'Fingerprint';
      } else if (result.biometryType === BiometryType.faceAuthentication) {
        biometryType = 'face'; label = 'Face ID';
      } else if (result.biometryType === BiometryType.irisAuthentication) {
        biometryType = 'iris'; label = 'Biometric';
      }

      return {
        isAvailable: available,
        biometryType,
        biometricLabel: label,
        isEnrolled: available,
        strongBiometryIsAvailable: available,
      };
    } catch (error) {
      console.error('BiometricCheck: error checking capabilities:', error, isIOS() ? '(iOS)' : '');
      return {
        isAvailable: false,
        biometryType: 'none',
        biometricLabel: 'Biometric',
        isEnrolled: false,
        strongBiometryIsAvailable: false,
      };
    }
  }

  // Web — WebAuthn fallback (used by document protection, NOT vault unlock).
  const available = await biometricAuthService.isBiometricAvailable();
  const bioType = await biometricAuthService.getBiometricType();
  return {
    isAvailable: available,
    biometryType: bioType === 'fingerprint' ? 'fingerprint' : bioType === 'face' ? 'face' : 'none',
    biometricLabel: bioType === 'face' ? 'Face ID' : bioType === 'fingerprint' ? 'Fingerprint' : 'Biometric',
    isEnrolled: available,
    strongBiometryIsAvailable: available,
  };
}

/** Standalone biometric prompt (no credential retrieval). */
export async function authenticateWithBiometric(reason?: string): Promise<BiometricAuthResult> {
  try {
    const caps = await checkBiometricCapabilities();
    if (!caps.isAvailable || !caps.isEnrolled) {
      return { success: false, error: 'Biometric authentication not available or not enrolled' };
    }

    if (isNativeApp()) {
      const result = await biometricKeystore.promptOnly(reason || 'Verify your identity');
      if (result.ok) {
        return {
          success: true,
          method: caps.biometryType === 'fingerprint' || caps.biometryType === 'touchId' ? 'fingerprint' : 'face',
        };
      }
      return { success: false, error: result.error };
    }

    // Web WebAuthn fallback
    const result = await biometricAuthService.authenticateBiometric();
    if (result.success) {
      return {
        success: true,
        method: caps.biometryType === 'fingerprint' ? 'fingerprint' : 'face',
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

// ── Unified enrol / disable / status ────────────────────────────────────────

export interface BiometricEnrolParams {
  email: string;
  accountPassword: string;
  masterPassword: string;
  vaultId: string;
  vaultName: string;
}

/**
 * Enable biometric for a vault. Stores all three credentials together so
 * one biometric prompt handles login + vault unlock.
 */
export async function enrollBiometric(params: BiometricEnrolParams): Promise<boolean> {
  if (!isNativeApp()) return false;
  const result = await biometricKeystore.enroll(params);
  return result.success;
}

/** Disable biometric for a single vault. */
export async function disableBiometric(vaultId: string): Promise<void> {
  await biometricKeystore.disable(vaultId);
}

/** Disable biometric for ALL vaults — used on logout / account reset. */
export async function disableAllBiometric(): Promise<void> {
  await biometricKeystore.disableAll();
}

/** Sync hint — fast check from localStorage. */
export function isBiometricEnrolledForVault(vaultId: string): boolean {
  return biometricKeystore.isEnrolled(vaultId);
}

/** Async authoritative probe — checks Capacitor Preferences directly. */
export async function hasBiometricEntryForVault(vaultId: string): Promise<boolean> {
  return biometricKeystore.hasEntry(vaultId);
}

/** All vaults that currently have biometric enrolled. */
export async function getEnrolledBiometricVaults(): Promise<string[]> {
  return biometricKeystore.getEnrolledVaultIds();
}

/**
 * Account-level sign-in via biometric. Returns the email + plaintext account
 * password from any enrolled vault, suitable for auto-filling the login form.
 */
export async function signInWithBiometric(): Promise<{
  success: boolean;
  email?: string;
  password?: string;
  error?: string;
}> {
  if (!isNativeApp()) return { success: false, error: 'Biometric requires native app' };
  const result = await biometricKeystore.signInWithBiometric();
  return {
    success: result.success,
    email: result.email,
    password: result.accountPassword,
    error: result.error,
  };
}

/**
 * Vault-specific unlock. Prompts biometric, returns the master password.
 */
export async function unlockVaultWithBiometric(vaultId: string): Promise<{
  success: boolean;
  masterPassword?: string;
  error?: string;
}> {
  if (!isNativeApp()) return { success: false, error: 'Biometric requires native app' };
  return biometricKeystore.unlockVaultWithBiometric(vaultId);
}

/** Sync — is ANY vault biometric-enrolled? */
export function isAccountBiometricEnabled(): boolean {
  return !!biometricKeystore.getAccountEmail();
}

/** Async authoritative probe — does the account have any enrolment in storage? */
export async function hasAccountBiometricCredentials(): Promise<boolean> {
  if (!isNativeApp()) return false;
  const ids = await biometricKeystore.getEnrolledVaultIds();
  return ids.length > 0;
}

/** Last-enrolled email — for login UI hint. */
export function getAccountBiometricEmail(): string | null {
  return biometricKeystore.getAccountEmail();
}

// ── Compatibility aliases (deprecated) ──────────────────────────────────────
// These keep older call sites compiling while we migrate. They route to the
// new unified storage but cannot enrol the account password — full enrolment
// must go through enrollBiometric().

/** @deprecated — use enrollBiometric() with all three credentials. */
export async function enableBiometricUnlock(_masterPassword: string, _vaultId: string): Promise<boolean> {
  console.warn(
    'enableBiometricUnlock() is deprecated. Use enrollBiometric() to store account+vault credentials together.',
  );
  return false;
}

/** @deprecated — use disableBiometric(). */
export async function disableBiometricUnlock(vaultId: string): Promise<void> {
  await biometricKeystore.disable(vaultId);
}

/** @deprecated — use isBiometricEnrolledForVault(). */
export async function isBiometricUnlockEnabled(vaultId: string = 'default'): Promise<boolean> {
  // Async to match the old signature; the keystore lookup is sync.
  return biometricKeystore.isEnrolled(vaultId);
}

/** @deprecated — use unlockVaultWithBiometric(). */
export async function unlockWithBiometric(vaultId: string = 'default'): Promise<{
  success: boolean;
  vaultUnlockKey?: string;
  vaultId?: string;
  error?: string;
  deviceKey?: string;
}> {
  const result = await biometricKeystore.unlockVaultWithBiometric(vaultId);
  return {
    success: result.success,
    vaultUnlockKey: result.masterPassword,
    deviceKey: result.masterPassword,
    vaultId,
    error: result.error,
  };
}

/** @deprecated — use getEnrolledBiometricVaults(). */
export async function getVaultsWithBiometricEnabled(): Promise<string[]> {
  return biometricKeystore.getEnrolledVaultIds();
}

/** @deprecated — use enrollBiometric() with full creds. */
export async function enableAccountBiometric(_email: string, _accountPassword: string): Promise<boolean> {
  console.warn('enableAccountBiometric() is deprecated. Use enrollBiometric() with all three credentials.');
  return false;
}

/** @deprecated — use disableAllBiometric(). */
export async function disableAccountBiometric(): Promise<void> {
  await biometricKeystore.disableAll();
}

/** @deprecated — kept for compatibility. */
export function getBiometricKeystore() {
  return biometricKeystore;
}

/** Generate a 32-byte random device key (legacy helper, no longer used). */
export function generateDeviceKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/** @deprecated — never returned a usable value, kept as no-op. */
export async function getDeviceKey(_vaultId?: string): Promise<string | null> {
  return null;
}
