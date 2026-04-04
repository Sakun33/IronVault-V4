/**
 * Vault Backup Service
 * Handles export and import of vault data for persistence across app reinstalls
 * Uses AES-256 encryption with password protection
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { CryptoService } from './crypto';

// Backup file format version
const BACKUP_VERSION = 1;
const BACKUP_MAGIC = 'IRONVAULT_BACKUP';

interface VaultBackupData {
  magic: string;
  version: number;
  createdAt: string;
  vaults: VaultExportData[];
}

interface VaultExportData {
  id: string;
  name: string;
  createdAt: string;
  lastAccessedAt: string;
  isDefault: boolean;
  biometricEnabled: boolean;
  iconColor: string;
  passwordHash: string; // Encrypted password verification data
  data: string; // Encrypted vault data (all stores)
}

interface EncryptedBackup {
  magic: string;
  version: number;
  encrypted: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded IV
  salt: string; // Base64 encoded salt for key derivation
}

export class VaultBackupService {
  private static instance: VaultBackupService;

  private constructor() {}

  static getInstance(): VaultBackupService {
    if (!VaultBackupService.instance) {
      VaultBackupService.instance = new VaultBackupService();
    }
    return VaultBackupService.instance;
  }

  /**
   * Export all vaults to an encrypted backup file
   */
  async exportBackup(backupPassword: string): Promise<{ success: boolean; error?: string; filePath?: string }> {
    try {
      // Collect all vault data
      const vaultRegistry = this.getVaultRegistry();
      const vaultPasswords = this.getVaultPasswords();
      
      if (vaultRegistry.length === 0) {
        return { success: false, error: 'No vaults to export' };
      }

      const vaultsData: VaultExportData[] = [];

      for (const vault of vaultRegistry) {
        // Get all data from IndexedDB for this vault
        const vaultData = await this.exportVaultData(vault.id);
        const passwordData = vaultPasswords.find(p => p.vaultId === vault.id);

        vaultsData.push({
          id: vault.id,
          name: vault.name,
          createdAt: vault.createdAt,
          lastAccessedAt: vault.lastAccessedAt,
          isDefault: vault.isDefault,
          biometricEnabled: vault.biometricEnabled,
          iconColor: vault.iconColor,
          passwordHash: passwordData ? JSON.stringify(passwordData) : '',
          data: JSON.stringify(vaultData),
        });
      }

      const backupData: VaultBackupData = {
        magic: BACKUP_MAGIC,
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        vaults: vaultsData,
      };

      // Encrypt the backup with the password
      const encryptedBackup = await this.encryptBackup(JSON.stringify(backupData), backupPassword);
      const backupJson = JSON.stringify(encryptedBackup);

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `IronVault_Backup_${timestamp}.ivbackup`;

      if (Capacitor.isNativePlatform()) {
        // Save to filesystem and share
        await Filesystem.writeFile({
          path: fileName,
          data: backupJson,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const fileInfo = await Filesystem.getUri({
          path: fileName,
          directory: Directory.Cache,
        });

        // Share the file so user can save it
        await Share.share({
          title: 'IronVault Backup',
          text: 'Your encrypted vault backup',
          url: fileInfo.uri,
          dialogTitle: 'Save your vault backup',
        });

        return { success: true, filePath: fileInfo.uri };
      } else {
        // Web: Download as file
        const blob = new Blob([backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return { success: true };
      }
    } catch (error) {
      console.error('Backup export failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
    }
  }

  /**
   * Import vaults from a backup file
   */
  async importBackup(fileContent: string, backupPassword: string): Promise<{ success: boolean; error?: string; vaultCount?: number }> {
    try {
      // Parse the encrypted backup
      const encryptedBackup: EncryptedBackup = JSON.parse(fileContent);

      if (encryptedBackup.magic !== BACKUP_MAGIC) {
        return { success: false, error: 'Invalid backup file format' };
      }

      // Decrypt the backup
      const decryptedJson = await this.decryptBackup(encryptedBackup, backupPassword);
      if (!decryptedJson) {
        return { success: false, error: 'Incorrect backup password' };
      }

      const backupData: VaultBackupData = JSON.parse(decryptedJson);

      if (backupData.magic !== BACKUP_MAGIC) {
        return { success: false, error: 'Invalid backup data' };
      }

      // Import each vault
      let importedCount = 0;
      for (const vaultExport of backupData.vaults) {
        const success = await this.importVault(vaultExport);
        if (success) importedCount++;
      }

      return { success: true, vaultCount: importedCount };
    } catch (error) {
      console.error('Backup import failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Import failed' };
    }
  }

  /**
   * Read backup file from user selection
   */
  async readBackupFile(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.ivbackup,.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = () => {
          resolve(null);
        };
        reader.readAsText(file);
      };

      input.click();
    });
  }

  // Private helper methods

  private getVaultRegistry(): any[] {
    try {
      const data = localStorage.getItem('ironvault_registry');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private getVaultPasswords(): any[] {
    try {
      const data = localStorage.getItem('ironvault_passwords');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Export vault data for a specific vault (public for selective exports)
   */
  async exportVaultData(vaultId?: string): Promise<Record<string, any[]>> {
    // If no vaultId provided, get active vault
    if (!vaultId) {
      const activeVaultId = localStorage.getItem('ironvault_active_vault');
      if (!activeVaultId) {
        return {};
      }
      vaultId = activeVaultId;
    }
    const dbName = `IronVault_${vaultId}`;
    const stores = [
      'passwords', 'subscriptions', 'notes', 'expenses', 'reminders',
      'metadata', 'encrypted_data', 'bankStatements', 'bankTransactions',
      'investments', 'investmentGoals', 'persistent_data'
    ];

    const data: Record<string, any[]> = {};

    return new Promise((resolve) => {
      const request = indexedDB.open(dbName);
      
      request.onsuccess = async () => {
        const db = request.result;
        
        for (const storeName of stores) {
          if (db.objectStoreNames.contains(storeName)) {
            try {
              const tx = db.transaction(storeName, 'readonly');
              const store = tx.objectStore(storeName);
              const getAllRequest = store.getAll();
              
              await new Promise<void>((res) => {
                getAllRequest.onsuccess = () => {
                  data[storeName] = getAllRequest.result || [];
                  res();
                };
                getAllRequest.onerror = () => {
                  data[storeName] = [];
                  res();
                };
              });
            } catch {
              data[storeName] = [];
            }
          }
        }
        
        db.close();
        resolve(data);
      };

      request.onerror = () => {
        resolve(data);
      };
    });
  }

  private async importVault(vaultExport: VaultExportData): Promise<boolean> {
    try {
      // Add to registry
      const registry = this.getVaultRegistry();
      
      // Check if vault already exists (by ID)
      const existingIndex = registry.findIndex(v => v.id === vaultExport.id);
      
      const vaultEntry = {
        id: vaultExport.id,
        name: vaultExport.name,
        createdAt: vaultExport.createdAt,
        lastAccessedAt: new Date().toISOString(),
        isDefault: existingIndex === -1 && registry.length === 0, // Only default if first vault
        biometricEnabled: false, // Reset biometric on import
        iconColor: vaultExport.iconColor,
      };

      if (existingIndex >= 0) {
        registry[existingIndex] = vaultEntry;
      } else {
        registry.push(vaultEntry);
      }
      
      localStorage.setItem('ironvault_registry', JSON.stringify(registry));

      // Restore password hash
      if (vaultExport.passwordHash) {
        const passwords = this.getVaultPasswords();
        const passwordData = JSON.parse(vaultExport.passwordHash);
        const existingPwIndex = passwords.findIndex(p => p.vaultId === vaultExport.id);
        
        if (existingPwIndex >= 0) {
          passwords[existingPwIndex] = passwordData;
        } else {
          passwords.push(passwordData);
        }
        
        localStorage.setItem('ironvault_passwords', JSON.stringify(passwords));
      }

      // Restore IndexedDB data
      const vaultData = JSON.parse(vaultExport.data);
      await this.importVaultData(vaultExport.id, vaultData);

      return true;
    } catch (error) {
      console.error('Failed to import vault:', error);
      return false;
    }
  }

  private async importVaultData(vaultId: string, data: Record<string, any[]>): Promise<void> {
    const dbName = `IronVault_${vaultId}`;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 3);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        const stores = [
          'passwords', 'subscriptions', 'notes', 'expenses', 'reminders',
          'metadata', 'encrypted_data', 'bankStatements', 'bankTransactions',
          'investments', 'investmentGoals', 'persistent_data'
        ];

        stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });
      };

      request.onsuccess = async () => {
        const db = request.result;
        
        for (const [storeName, items] of Object.entries(data)) {
          if (db.objectStoreNames.contains(storeName) && items.length > 0) {
            try {
              const tx = db.transaction(storeName, 'readwrite');
              const store = tx.objectStore(storeName);
              
              // Clear existing data
              store.clear();
              
              // Add imported items
              for (const item of items) {
                store.put(item);
              }
              
              await new Promise<void>((res) => {
                tx.oncomplete = () => res();
                tx.onerror = () => res();
              });
            } catch (err) {
              console.error(`Failed to import store ${storeName}:`, err);
            }
          }
        }
        
        db.close();
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private async encryptBackup(data: string, password: string): Promise<EncryptedBackup> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    return {
      magic: BACKUP_MAGIC,
      version: BACKUP_VERSION,
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv.buffer),
      salt: this.arrayBufferToBase64(salt.buffer),
    };
  }

  private async decryptBackup(backup: EncryptedBackup, password: string): Promise<string | null> {
    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      const salt = this.base64ToArrayBuffer(backup.salt);
      const iv = this.base64ToArrayBuffer(backup.iv);
      const encrypted = this.base64ToArrayBuffer(backup.encrypted);
      
      // Derive key from password
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new Uint8Array(salt),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv) },
        key,
        encrypted
      );
      
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const vaultBackupService = VaultBackupService.getInstance();
