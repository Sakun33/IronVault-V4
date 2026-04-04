/**
 * Vault Migration
 * 
 * This module handles migration from the legacy single-vault system
 * to the new multi-vault architecture. It's safe and idempotent.
 */

import { VaultMetadata } from '@shared/schema';
import { CryptoService } from './crypto';
import { vaultIndex, VaultIndexEntry } from './vault-index';
import { MultiVaultStorage } from './multi-vault-storage';

const LEGACY_DB_NAME = 'IronVault';
const MIGRATION_KEY = 'ironvault-migration-v1-complete';

export interface MigrationResult {
  success: boolean;
  migrated: boolean;
  vaultId?: string;
  error?: string;
}

/**
 * Check if migration has already been completed
 */
export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_KEY) === 'true';
}

/**
 * Mark migration as complete
 */
function markMigrationComplete(): void {
  localStorage.setItem(MIGRATION_KEY, 'true');
}

/**
 * Check if legacy vault exists and needs migration
 */
export async function needsMigration(): Promise<boolean> {
  // If already migrated, skip
  if (isMigrationComplete()) {
    return false;
  }

  // Check if there are any vaults in the new index
  await vaultIndex.init();
  const vaultCount = await vaultIndex.getVaultCount();
  if (vaultCount > 0) {
    // Already have vaults in new system, mark as migrated
    markMigrationComplete();
    return false;
  }

  // Check if legacy vault exists
  return vaultIndex.legacyVaultExists();
}

/**
 * Get legacy vault metadata without needing the password
 */
async function getLegacyMetadata(): Promise<VaultMetadata | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(LEGACY_DB_NAME, 3);
    
    request.onsuccess = () => {
      const db = request.result;
      
      try {
        const transaction = db.transaction(['metadata'], 'readonly');
        const store = transaction.objectStore('metadata');
        const getRequest = store.get('vault');
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result || null);
        };
        
        getRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
    
    request.onerror = () => resolve(null);
  });
}

/**
 * Get password verification entry from legacy vault
 */
async function getLegacyPasswordVerification(): Promise<{ data: string; iv: string } | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(LEGACY_DB_NAME, 3);
    
    request.onsuccess = () => {
      const db = request.result;
      
      try {
        const transaction = db.transaction(['encrypted_data'], 'readonly');
        const store = transaction.objectStore('encrypted_data');
        const getRequest = store.get('password_verification');
        
        getRequest.onsuccess = () => {
          db.close();
          const result = getRequest.result;
          if (result && result.data && result.iv) {
            resolve({ data: result.data, iv: result.iv });
          } else {
            resolve(null);
          }
        };
        
        getRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
    
    request.onerror = () => resolve(null);
  });
}

/**
 * Get all encrypted data from legacy vault
 */
async function getLegacyEncryptedData(): Promise<any[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open(LEGACY_DB_NAME, 3);
    
    request.onsuccess = () => {
      const db = request.result;
      
      try {
        const transaction = db.transaction(['encrypted_data'], 'readonly');
        const store = transaction.objectStore('encrypted_data');
        const getRequest = store.getAll();
        
        getRequest.onsuccess = () => {
          db.close();
          resolve(getRequest.result || []);
        };
        
        getRequest.onerror = () => {
          db.close();
          resolve([]);
        };
      } catch {
        db.close();
        resolve([]);
      }
    };
    
    request.onerror = () => resolve([]);
  });
}

/**
 * Copy encrypted data to new vault database
 */
async function copyEncryptedData(newDb: IDBDatabase, data: any[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = newDb.transaction(['encrypted_data'], 'readwrite');
    const store = transaction.objectStore('encrypted_data');
    
    let pending = data.length;
    if (pending === 0) {
      resolve();
      return;
    }
    
    for (const item of data) {
      const request = store.put(item);
      request.onsuccess = () => {
        pending--;
        if (pending === 0) resolve();
      };
      request.onerror = () => reject(request.error);
    }
  });
}

/**
 * Copy metadata to new vault database
 */
async function copyMetadata(newDb: IDBDatabase, metadata: VaultMetadata): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = newDb.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');
    const request = store.put(metadata);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete legacy database
 */
async function deleteLegacyDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    request.onsuccess = () => {
      console.log('✅ Legacy database deleted');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Migrate legacy vault to new multi-vault system
 * 
 * This creates a new vault entry in the index and copies all data
 * from the legacy database to a new per-vault database.
 */
export async function migrateLegacyVault(): Promise<MigrationResult> {
  console.log('🔄 Starting legacy vault migration...');
  
  try {
    // Initialize vault index
    await vaultIndex.init();
    
    // Check if migration needed
    if (isMigrationComplete()) {
      console.log('✅ Migration already complete');
      return { success: true, migrated: false };
    }
    
    const vaultCount = await vaultIndex.getVaultCount();
    if (vaultCount > 0) {
      console.log('✅ Vaults already exist in new system');
      markMigrationComplete();
      return { success: true, migrated: false };
    }
    
    // Get legacy vault metadata
    const legacyMetadata = await getLegacyMetadata();
    if (!legacyMetadata) {
      console.log('ℹ️ No legacy vault found to migrate');
      markMigrationComplete();
      return { success: true, migrated: false };
    }
    
    console.log('📦 Found legacy vault, migrating...');
    
    // Get password verification from legacy vault
    const legacyVerification = await getLegacyPasswordVerification();
    
    // Generate new vault ID
    const vaultId = vaultIndex.generateVaultId();
    const dbName = vaultIndex.getVaultDbName(vaultId);
    
    // Create vault index entry
    const vaultEntry: VaultIndexEntry = {
      id: vaultId,
      name: 'Default Vault',
      createdAt: legacyMetadata.createdAt ? new Date(legacyMetadata.createdAt) : new Date(),
      lastUnlockedAt: legacyMetadata.lastUnlocked ? new Date(legacyMetadata.lastUnlocked) : null,
      isDefault: true,
      dbName,
      encryptionSalt: legacyMetadata.encryptionSalt,
      kdfConfig: {
        algorithm: 'PBKDF2' as const,
        iterations: legacyMetadata.kdfConfig?.iterations || 100000,
        hash: 'SHA-256' as const,
      },
      passwordVerification: legacyVerification || {
        data: '',
        iv: '',
      },
    };
    
    // Create new vault database
    const newDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 3);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        const objectStores = [
          'passwords', 'subscriptions', 'notes', 'expenses', 'reminders',
          'metadata', 'encrypted_data', 'bankStatements', 'bankTransactions',
          'investments', 'investmentGoals', 'persistent_data'
        ];
        
        objectStores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };
    });
    
    // Copy all encrypted data
    const encryptedData = await getLegacyEncryptedData();
    await copyEncryptedData(newDb, encryptedData);
    console.log(`📋 Copied ${encryptedData.length} encrypted items`);
    
    // Copy metadata
    await copyMetadata(newDb, legacyMetadata);
    console.log('📋 Copied metadata');
    
    // Close new database
    newDb.close();
    
    // Add vault to index
    await vaultIndex.addVault(vaultEntry);
    console.log('📋 Added vault to index');
    
    // Delete legacy database
    await deleteLegacyDatabase();
    
    // Mark migration complete
    markMigrationComplete();
    
    console.log(`✅ Migration complete! Vault ID: ${vaultId}`);
    
    return {
      success: true,
      migrated: true,
      vaultId,
    };
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      migrated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Force re-migration (for testing/recovery)
 */
export async function forceMigration(): Promise<MigrationResult> {
  localStorage.removeItem(MIGRATION_KEY);
  return migrateLegacyVault();
}
