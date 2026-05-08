/**
 * Biometric Keystore — Unified Credential Storage
 *
 * One entry per vault. Each entry stores the email, account password, and
 * master password together so a single biometric prompt unlocks BOTH the
 * Stage-1 account login and the Stage-2 vault unlock.
 *
 * SECURITY:
 * - Entries are AES-256-GCM encrypted with a per-install device key held in
 *   Capacitor Preferences. A biometric prompt gates every read.
 * - localStorage flags are advisory hints for sync UI checks; the encrypted
 *   blob in Preferences is the source of truth.
 *
 * STORAGE KEYS:
 * - Capacitor Preferences:
 *   - `iv_dk` — device key (raw 32-byte AES key, base64)
 *   - `iv_bio_v3_{vaultId}` — encrypted blob {iv, ct} of BiometricEntry JSON
 * - localStorage:
 *   - `iv_bio_enrolled_{vaultId}` = '1'  (sync hint)
 *   - `iv_bio_account_email`     = lastEnrolledEmail (for login UI)
 */

import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { Preferences } from '@capacitor/preferences';
import { isNativeApp } from '@/native/platform';
import { CryptoService } from './crypto';

const DEVICE_KEY_PREF = 'iv_dk';
const ENTRY_PREFIX = 'iv_bio_v3_';
const ACCOUNT_EMAIL_FLAG = 'iv_bio_account_email';
const ENROLLED_FLAG_PREFIX = 'iv_bio_enrolled_';

// Legacy keys we purge on first run of the v3 keystore.
const LEGACY_KEYS_TO_PURGE = [
  'iv_bkey_',
  'iv_account_bio',
  'iv_account_bio_enabled',
  'iv_account_bio_email',
  'ironvault_biometric_enabled_',
  'ironvault_biometric_salt_',
];
const LEGACY_PURGE_FLAG = 'iv_bio_v3_migrated';

export interface BiometricEntry {
  email: string;
  accountPassword: string;
  masterPassword: string;
  vaultName: string;
  enrolledAt: string;
}

export interface StoreResult {
  success: boolean;
  error?: string;
}

class BiometricKeystore {
  private static instance: BiometricKeystore;
  private deviceKey: CryptoKey | null = null;
  private migrated = false;

  private constructor() {}

  static getInstance(): BiometricKeystore {
    if (!BiometricKeystore.instance) {
      BiometricKeystore.instance = new BiometricKeystore();
    }
    return BiometricKeystore.instance;
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async getDeviceKey(): Promise<CryptoKey> {
    if (this.deviceKey) return this.deviceKey;

    const { value } = await Preferences.get({ key: DEVICE_KEY_PREF });
    if (value) {
      const rawBytes = CryptoService.base64ToUint8Array(value);
      this.deviceKey = await crypto.subtle.importKey(
        'raw', rawBytes.buffer as ArrayBuffer,
        { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'],
      );
    } else {
      this.deviceKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
      );
      const rawBytes = await crypto.subtle.exportKey('raw', this.deviceKey);
      await Preferences.set({
        key: DEVICE_KEY_PREF,
        value: CryptoService.arrayBufferToBase64(rawBytes),
      });
    }
    return this.deviceKey;
  }

  /** Purge legacy biometric data from previous schema versions. Runs once. */
  private async migrateOnce(): Promise<void> {
    if (this.migrated) return;
    this.migrated = true;

    if (localStorage.getItem(LEGACY_PURGE_FLAG) === '1') return;

    try {
      // Wipe localStorage flags from previous schemas.
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        for (const prefix of LEGACY_KEYS_TO_PURGE) {
          if (key === prefix || key.startsWith(prefix)) {
            toRemove.push(key);
            break;
          }
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      // Wipe legacy Capacitor Preferences entries.
      if (isNativeApp()) {
        try {
          const { keys } = await Preferences.keys();
          for (const k of keys) {
            if (k.startsWith('iv_bkey_') || k === 'iv_account_bio') {
              await Preferences.remove({ key: k });
            }
          }
        } catch { /* noop */ }
      }

      localStorage.setItem(LEGACY_PURGE_FLAG, '1');
    } catch {
      // best-effort migration
    }
  }

  private async authenticate(reason: string): Promise<{ ok: boolean; error?: string }> {
    try {
      await BiometricAuth.authenticate({
        reason,
        cancelTitle: 'Cancel',
        allowDeviceCredential: false,
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Biometric authentication cancelled',
      };
    }
  }

  private async writeEntry(vaultId: string, entry: BiometricEntry): Promise<void> {
    const dk = await this.getDeviceKey();
    const { encrypted, iv } = await CryptoService.encrypt(JSON.stringify(entry), dk);
    const blob = JSON.stringify({
      iv: CryptoService.uint8ArrayToBase64(iv),
      ct: CryptoService.uint8ArrayToBase64(encrypted),
    });
    await Preferences.set({ key: ENTRY_PREFIX + vaultId, value: blob });
    localStorage.setItem(ENROLLED_FLAG_PREFIX + vaultId, '1');
    localStorage.setItem(ACCOUNT_EMAIL_FLAG, entry.email.toLowerCase().trim());
  }

  private async readEntry(vaultId: string): Promise<BiometricEntry | null> {
    const { value } = await Preferences.get({ key: ENTRY_PREFIX + vaultId });
    if (!value) return null;

    const { iv: ivB64, ct: ctB64 } = JSON.parse(value);
    const iv = CryptoService.base64ToUint8Array(ivB64);
    const ct = CryptoService.base64ToUint8Array(ctB64);
    const dk = await this.getDeviceKey();
    const decrypted = await CryptoService.decrypt(ct, dk, iv);
    return JSON.parse(new TextDecoder().decode(decrypted)) as BiometricEntry;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Enroll biometric for a vault. Stores email + accountPassword + masterPassword
   * together so one biometric prompt unlocks both Stage-1 and Stage-2.
   */
  async enroll(params: {
    email: string;
    accountPassword: string;
    masterPassword: string;
    vaultId: string;
    vaultName: string;
  }): Promise<StoreResult> {
    if (!isNativeApp()) {
      return { success: false, error: 'Biometric storage requires native app' };
    }
    await this.migrateOnce();

    try {
      const entry: BiometricEntry = {
        email: params.email.toLowerCase().trim(),
        accountPassword: params.accountPassword,
        masterPassword: params.masterPassword,
        vaultName: params.vaultName,
        enrolledAt: new Date().toISOString(),
      };
      await this.writeEntry(params.vaultId, entry);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enrol biometric',
      };
    }
  }

  /**
   * Disable biometric for a vault. Cleans up the encrypted entry and flags.
   * If no enrolments remain, also clears the cached account email.
   */
  async disable(vaultId: string): Promise<void> {
    try {
      await Preferences.remove({ key: ENTRY_PREFIX + vaultId });
    } catch { /* noop */ }
    localStorage.removeItem(ENROLLED_FLAG_PREFIX + vaultId);

    // If nothing left enrolled, drop the account email hint.
    const remaining = await this.getEnrolledVaultIds();
    if (remaining.length === 0) {
      localStorage.removeItem(ACCOUNT_EMAIL_FLAG);
    }
  }

  /** Disable biometric for ALL vaults — used on account logout. */
  async disableAll(): Promise<void> {
    const ids = await this.getEnrolledVaultIds();
    await Promise.all(ids.map(id => this.disable(id)));
    localStorage.removeItem(ACCOUNT_EMAIL_FLAG);
  }

  /** Sync hint — does this vault have biometric enrolled? */
  isEnrolled(vaultId: string): boolean {
    return localStorage.getItem(ENROLLED_FLAG_PREFIX + vaultId) === '1';
  }

  /**
   * Authoritative async probe of Capacitor Preferences. Self-heals the
   * localStorage flag if it was lost (webview cache wipe).
   */
  async hasEntry(vaultId: string): Promise<boolean> {
    if (!isNativeApp()) return false;
    try {
      const { value } = await Preferences.get({ key: ENTRY_PREFIX + vaultId });
      const exists = !!value;
      const flag = this.isEnrolled(vaultId);
      if (exists && !flag) {
        localStorage.setItem(ENROLLED_FLAG_PREFIX + vaultId, '1');
      } else if (!exists && flag) {
        localStorage.removeItem(ENROLLED_FLAG_PREFIX + vaultId);
      }
      return exists;
    } catch {
      return false;
    }
  }

  /** Vaults that currently have biometric enrolled. */
  async getEnrolledVaultIds(): Promise<string[]> {
    if (!isNativeApp()) return [];
    await this.migrateOnce();
    try {
      const { keys } = await Preferences.keys();
      const enrolled: string[] = [];
      for (const k of keys) {
        if (k.startsWith(ENTRY_PREFIX)) {
          const vaultId = k.slice(ENTRY_PREFIX.length);
          enrolled.push(vaultId);
          // Heal the localStorage flag while we're here.
          if (!this.isEnrolled(vaultId)) {
            localStorage.setItem(ENROLLED_FLAG_PREFIX + vaultId, '1');
          }
        }
      }
      return enrolled;
    } catch {
      return [];
    }
  }

  /** Account email of the most recently enrolled vault — for login UI hint. */
  getAccountEmail(): string | null {
    return localStorage.getItem(ACCOUNT_EMAIL_FLAG);
  }

  /**
   * Account-level sign in. Prompts biometric, returns email + accountPassword
   * from the first enrolled vault entry. Both passwords decrypt with the same
   * gesture, so this implicitly authorises the vault unlock that follows.
   */
  async signInWithBiometric(): Promise<{
    success: boolean;
    email?: string;
    accountPassword?: string;
    masterPassword?: string;
    vaultId?: string;
    error?: string;
  }> {
    if (!isNativeApp()) {
      return { success: false, error: 'Biometric requires native app' };
    }
    await this.migrateOnce();

    const enrolled = await this.getEnrolledVaultIds();
    if (enrolled.length === 0) {
      return { success: false, error: 'No biometric credentials enrolled' };
    }

    const auth = await this.authenticate('Sign in to IronVault');
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    try {
      // Use the first enrolled vault for the account creds. Multiple vaults
      // share the same email/accountPassword, so any will do.
      const entry = await this.readEntry(enrolled[0]);
      if (!entry) return { success: false, error: 'Stored credentials missing' };
      return {
        success: true,
        email: entry.email,
        accountPassword: entry.accountPassword,
        masterPassword: entry.masterPassword,
        vaultId: enrolled[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read credentials',
      };
    }
  }

  /**
   * Vault-specific unlock. Prompts biometric and returns the master password
   * for that vault.
   */
  async unlockVaultWithBiometric(vaultId: string): Promise<{
    success: boolean;
    masterPassword?: string;
    email?: string;
    accountPassword?: string;
    error?: string;
  }> {
    if (!isNativeApp()) {
      return { success: false, error: 'Biometric requires native app' };
    }
    await this.migrateOnce();

    if (!(await this.hasEntry(vaultId))) {
      return { success: false, error: 'Biometric not enabled for this vault' };
    }

    const auth = await this.authenticate('Unlock your vault');
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }

    try {
      const entry = await this.readEntry(vaultId);
      if (!entry) return { success: false, error: 'Stored credentials missing' };
      return {
        success: true,
        masterPassword: entry.masterPassword,
        email: entry.email,
        accountPassword: entry.accountPassword,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read credentials',
      };
    }
  }

  /**
   * Standalone biometric prompt with no credential retrieval. Used for
   * confirming device identity before a sensitive action (e.g. enabling
   * biometric for the first time, before we have anything to store).
   */
  async promptOnly(reason: string): Promise<{ ok: boolean; error?: string }> {
    return this.authenticate(reason);
  }
}

export const biometricKeystore = BiometricKeystore.getInstance();
export { BiometricKeystore };
