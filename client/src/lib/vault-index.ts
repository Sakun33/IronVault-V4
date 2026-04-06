/**
 * Vault Index - Unencrypted registry for multi-vault support
 * 
 * This module manages a separate IndexedDB database that stores:
 * - Vault metadata (id, name, createdAt, isDefault, etc.)
 * - Password verification entries for each vault
 * - Global security state (lockout after failed attempts)
 * - App settings
 * 
 * This allows listing vaults and verifying passwords without opening each vault DB.
 */

import { CryptoService } from './crypto';

// Vault metadata stored in the index
export interface VaultIndexEntry {
  id: string;
  name: string;
  createdAt: Date;
  lastUnlockedAt: Date | null;
  isDefault: boolean;
  dbName: string;
  encryptionSalt: string;
  kdfConfig: {
    algorithm: 'PBKDF2';
    iterations: number;
    hash: 'SHA-256';
  };
  // Password verification data - encrypted string that decrypts to known value
  passwordVerification: {
    data: string;
    iv: string;
  };
}

// Global security state
export interface SecurityState {
  id: string; // Always 'global'
  failedAttempts: number;
  lockoutUntil: number | null; // Timestamp when lockout expires
  lastFailedAt: number | null;
}

// App settings
export interface AppSettings {
  id: string; // Always 'settings'
  defaultVaultId: string | null;
  lastActiveVaultId: string | null;
}

// Constants
const VAULT_INDEX_DB_NAME = 'IronVault-Index';
const VAULT_INDEX_VERSION = 1;
const LOCKOUT_DURATION_MS = 0; // Lockout disabled
const MAX_FAILED_ATTEMPTS = Infinity; // Lockout disabled
const PASSWORD_VERIFICATION_STRING = 'IRONVAULT_PASSWORD_VERIFICATION_V1';

export class VaultIndex {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the vault index database
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(VAULT_INDEX_DB_NAME, VAULT_INDEX_VERSION);

      request.onerror = () => {
        console.error('❌ Vault index initialization failed:', request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Vault index initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create vaults store
        if (!db.objectStoreNames.contains('vaults')) {
          db.createObjectStore('vaults', { keyPath: 'id' });
          console.log('📦 Created vaults store');
        }

        // Create security store
        if (!db.objectStoreNames.contains('security')) {
          db.createObjectStore('security', { keyPath: 'id' });
          console.log('📦 Created security store');
        }

        // Create settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
          console.log('📦 Created settings store');
        }
      };

      request.onblocked = () => {
        console.warn('⚠️ Vault index upgrade blocked');
        reject(new Error('Database upgrade blocked'));
      };
    });

    return this.initPromise;
  }

  /**
   * Check if vault index is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Get all vaults
   */
  async getAllVaults(): Promise<VaultIndexEntry[]> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readonly');
      const store = transaction.objectStore('vaults');
      const request = store.getAll();

      request.onsuccess = () => {
        const vaults = request.result.map((v: any) => ({
          ...v,
          createdAt: new Date(v.createdAt),
          lastUnlockedAt: v.lastUnlockedAt ? new Date(v.lastUnlockedAt) : null,
        }));
        resolve(vaults);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get vault by ID
   */
  async getVault(id: string): Promise<VaultIndexEntry | null> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readonly');
      const store = transaction.objectStore('vaults');
      const request = store.get(id);

      request.onsuccess = () => {
        if (!request.result) {
          resolve(null);
          return;
        }
        const vault = {
          ...request.result,
          createdAt: new Date(request.result.createdAt),
          lastUnlockedAt: request.result.lastUnlockedAt ? new Date(request.result.lastUnlockedAt) : null,
        };
        resolve(vault);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get the default vault
   */
  async getDefaultVault(): Promise<VaultIndexEntry | null> {
    const vaults = await this.getAllVaults();
    return vaults.find(v => v.isDefault) || vaults[0] || null;
  }

  /**
   * Add a new vault to the index
   */
  async addVault(vault: VaultIndexEntry): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    // If this is the first vault or marked as default, update other vaults
    if (vault.isDefault) {
      const vaults = await this.getAllVaults();
      for (const v of vaults) {
        if (v.isDefault && v.id !== vault.id) {
          await this.updateVault(v.id, { isDefault: false });
        }
      }
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readwrite');
      const store = transaction.objectStore('vaults');
      const request = store.put({
        ...vault,
        createdAt: vault.createdAt.toISOString(),
        lastUnlockedAt: vault.lastUnlockedAt?.toISOString() || null,
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update vault metadata
   */
  async updateVault(id: string, updates: Partial<Omit<VaultIndexEntry, 'id'>>): Promise<void> {
    const vault = await this.getVault(id);
    if (!vault) throw new Error(`Vault ${id} not found`);

    // If setting as default, unset other defaults
    if (updates.isDefault === true) {
      const vaults = await this.getAllVaults();
      for (const v of vaults) {
        if (v.isDefault && v.id !== id) {
          await this.updateVaultInternal(v.id, { isDefault: false });
        }
      }
    }

    await this.updateVaultInternal(id, updates);
  }

  private async updateVaultInternal(id: string, updates: Partial<Omit<VaultIndexEntry, 'id'>>): Promise<void> {
    const vault = await this.getVault(id);
    if (!vault) return;

    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    const updatedVault = {
      ...vault,
      ...updates,
      id,
      createdAt: (updates.createdAt || vault.createdAt).toISOString(),
      lastUnlockedAt: (updates.lastUnlockedAt || vault.lastUnlockedAt)?.toISOString() || null,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readwrite');
      const store = transaction.objectStore('vaults');
      const request = store.put(updatedVault);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a vault from the index
   */
  async deleteVault(id: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['vaults'], 'readwrite');
      const store = transaction.objectStore('vaults');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get vault count
   */
  async getVaultCount(): Promise<number> {
    const vaults = await this.getAllVaults();
    return vaults.length;
  }

  /**
   * Create password verification entry for a vault
   */
  async createPasswordVerification(masterPassword: string, salt: Uint8Array, kdfConfig: VaultIndexEntry['kdfConfig']): Promise<VaultIndexEntry['passwordVerification']> {
    const key = await CryptoService.deriveKey(masterPassword, salt, kdfConfig);
    const { encrypted, iv } = await CryptoService.encrypt(PASSWORD_VERIFICATION_STRING, key);
    
    return {
      data: CryptoService.arrayBufferToBase64(encrypted),
      iv: CryptoService.uint8ArrayToBase64(iv),
    };
  }

  /**
   * Verify password against a vault's verification entry
   * Returns true if password is correct
   */
  async verifyPassword(masterPassword: string, vault: VaultIndexEntry): Promise<boolean> {
    try {
      const salt = CryptoService.base64ToUint8Array(vault.encryptionSalt);
      const key = await CryptoService.deriveKey(masterPassword, salt, vault.kdfConfig);
      
      const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(vault.passwordVerification.data));
      const iv = CryptoService.base64ToUint8Array(vault.passwordVerification.iv);
      
      const decrypted = await CryptoService.decrypt(encrypted, key, iv);
      const decryptedText = new TextDecoder().decode(decrypted);
      
      return decryptedText === PASSWORD_VERIFICATION_STRING;
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Find vaults that match a given password
   * Returns array of vault IDs that match
   */
  async findMatchingVaults(masterPassword: string): Promise<VaultIndexEntry[]> {
    const vaults = await this.getAllVaults();
    const matchingVaults: VaultIndexEntry[] = [];

    for (const vault of vaults) {
      const matches = await this.verifyPassword(masterPassword, vault);
      if (matches) {
        matchingVaults.push(vault);
      }
    }

    return matchingVaults;
  }

  // ============================================
  // Security State Management
  // ============================================

  /**
   * Get security state
   */
  async getSecurityState(): Promise<SecurityState> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['security'], 'readonly');
      const store = transaction.objectStore('security');
      const request = store.get('global');

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          // Return default state
          resolve({
            id: 'global',
            failedAttempts: 0,
            lockoutUntil: null,
            lastFailedAt: null,
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save security state
   */
  private async saveSecurityState(state: SecurityState): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['security'], 'readwrite');
      const store = transaction.objectStore('security');
      const request = store.put(state);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Record a failed login attempt
   * Returns true if lockout was triggered
   */
  async recordFailedAttempt(): Promise<boolean> {
    // Lockout disabled - never trigger lockout
    return false;
  }

  /**
   * Reset failed attempts (called on successful login)
   */
  async resetFailedAttempts(): Promise<void> {
    const state = await this.getSecurityState();
    state.failedAttempts = 0;
    state.lockoutUntil = null;
    state.lastFailedAt = null;
    await this.saveSecurityState(state);
    console.log('✅ Failed attempts reset');
  }

  /**
   * Check if currently locked out
   */
  async isLockedOut(): Promise<boolean> {
    // Lockout disabled
    return false;
  }

  /**
   * Get remaining lockout time in milliseconds
   */
  async getLockoutTimeRemaining(): Promise<number> {
    // Lockout disabled
    return 0;
  }

  /**
   * Get current failed attempt count
   */
  async getFailedAttemptCount(): Promise<number> {
    const state = await this.getSecurityState();
    return state.failedAttempts;
  }

  // ============================================
  // App Settings Management
  // ============================================

  /**
   * Get app settings
   */
  async getSettings(): Promise<AppSettings> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get('settings');

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
        } else {
          resolve({
            id: 'settings',
            defaultVaultId: null,
            lastActiveVaultId: null,
          });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update app settings
   */
  async updateSettings(updates: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Vault index not initialized');

    const current = await this.getSettings();
    const updated = { ...current, ...updates, id: 'settings' };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put(updated);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set default vault
   */
  async setDefaultVault(vaultId: string): Promise<void> {
    const vault = await this.getVault(vaultId);
    if (!vault) throw new Error(`Vault ${vaultId} not found`);

    // Update vault index entry
    await this.updateVault(vaultId, { isDefault: true });
    
    // Update settings
    await this.updateSettings({ defaultVaultId: vaultId });
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Generate a unique vault ID
   */
  generateVaultId(): string {
    return crypto.randomUUID();
  }

  /**
   * Get database name for a vault
   */
  getVaultDbName(vaultId: string): string {
    return `IronVault-${vaultId}`;
  }

  /**
   * Check if legacy single-vault database exists
   */
  async legacyVaultExists(): Promise<boolean> {
    return new Promise((resolve) => {
      const request = indexedDB.open('IronVault', 1);
      
      request.onsuccess = () => {
        const db = request.result;
        const hasMetadata = db.objectStoreNames.contains('metadata');
        db.close();
        
        if (hasMetadata) {
          // Check if it has vault data
          const checkRequest = indexedDB.open('IronVault', 1);
          checkRequest.onsuccess = () => {
            const checkDb = checkRequest.result;
            try {
              const transaction = checkDb.transaction(['metadata'], 'readonly');
              const store = transaction.objectStore('metadata');
              const getRequest = store.get('vault');
              
              getRequest.onsuccess = () => {
                checkDb.close();
                resolve(!!getRequest.result);
              };
              getRequest.onerror = () => {
                checkDb.close();
                resolve(false);
              };
            } catch {
              checkDb.close();
              resolve(false);
            }
          };
          checkRequest.onerror = () => resolve(false);
        } else {
          resolve(false);
        }
      };
      
      request.onerror = () => resolve(false);
      request.onupgradeneeded = () => {
        // Database doesn't exist or is empty
        request.transaction?.abort();
        resolve(false);
      };
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Singleton instance
export const vaultIndex = new VaultIndex();

// Export constants
export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS };
