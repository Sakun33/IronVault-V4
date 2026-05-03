/**
 * Multi-Vault Storage
 * 
 * This module extends the original VaultStorage to support multiple vaults,
 * each with their own IndexedDB database. It works with the VaultIndex
 * to manage vault metadata and password verification.
 */

import { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry, VaultMetadata, BankStatement, BankTransaction, Investment, InvestmentGoal } from '@shared/schema';
import { CryptoService, KDFConfig as CryptoKDFConfig } from './crypto';
import { vaultIndex, VaultIndexEntry } from './vault-index';

// Re-export VaultIndexEntry for convenience
export type { VaultIndexEntry };

export class MultiVaultStorage {
  private dbName: string;
  private vaultId: string;
  private version = 3;
  private db: IDBDatabase | null = null;
  private encryptionKey: CryptoKey | null = null;

  constructor(vaultId: string) {
    this.vaultId = vaultId;
    this.dbName = vaultIndex.getVaultDbName(vaultId);
  }

  /**
   * Get the vault ID
   */
  getVaultId(): string {
    return this.vaultId;
  }

  /**
   * Get the database name
   */
  getDbName(): string {
    return this.dbName;
  }

  /**
   * Get the database instance
   */
  getDatabase(): IDBDatabase | null {
    return this.db;
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.db !== null;
  }

  /**
   * Check if vault is unlocked (has encryption key)
   */
  isUnlocked(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Initialize the vault database
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        console.error(`❌ Vault ${this.vaultId} initialization failed:`, request.error);
        reject(request.error);
      };

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

      request.onblocked = () => {
        reject(new Error('Database upgrade blocked'));
      };
    });
  }

  /**
   * Set the encryption key (called after successful password verification)
   */
  setEncryptionKey(key: CryptoKey): void {
    this.encryptionKey = key;
  }

  /**
   * Clear the encryption key (called on logout)
   */
  clearEncryptionKey(): void {
    this.encryptionKey = null;
  }

  /**
   * Derive encryption key from password using vault's KDF config
   */
  async deriveKey(masterPassword: string, vault: VaultIndexEntry): Promise<CryptoKey> {
    const salt = CryptoService.base64ToUint8Array(vault.encryptionSalt);
    return CryptoService.deriveKey(masterPassword, salt, vault.kdfConfig);
  }

  /**
   * Update last unlocked time in vault index
   */
  async updateLastUnlocked(): Promise<void> {
    await vaultIndex.updateVault(this.vaultId, {
      lastUnlockedAt: new Date(),
    });
  }

  /**
   * Check if vault has any data
   */
  async vaultExists(): Promise<boolean> {
    if (!this.db) return false;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get('vault');

      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save metadata
   */
  async saveMetadata(metadata: VaultMetadata): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get metadata
   */
  async getMetadata(): Promise<VaultMetadata | undefined> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get('vault');

      request.onsuccess = () => resolve(request.result || undefined);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Encrypted Data Operations
  // ============================================

  private async encryptAndStore(storeName: string, data: any): Promise<void> {
    if (!this.db || !this.encryptionKey) throw new Error('Database or encryption key not available');

    const jsonData = JSON.stringify(data);
    const { encrypted, iv } = await CryptoService.encrypt(jsonData, this.encryptionKey);

    const encryptedEntry = {
      id: data.id,
      data: CryptoService.arrayBufferToBase64(encrypted),
      iv: CryptoService.uint8ArrayToBase64(iv),
      store: storeName,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.put(encryptedEntry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async decryptAndRetrieve(storeName: string, id: string): Promise<any | undefined> {
    if (!this.db || !this.encryptionKey) throw new Error('Database or encryption key not available');

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readonly');
      const store = transaction.objectStore('encrypted_data');
      const request = store.get(id);

      request.onsuccess = async () => {
        const result = request.result;
        if (!result || result.store !== storeName) {
          resolve(undefined);
          return;
        }

        try {
          const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(result.data));
          const iv = CryptoService.base64ToUint8Array(result.iv);
          const decrypted = await CryptoService.decrypt(encrypted, this.encryptionKey!, iv);
          resolve(JSON.parse(new TextDecoder().decode(decrypted)));
        } catch (error) {
          reject(error);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async getAllEncrypted(storeName: string): Promise<any[]> {
    if (!this.db || !this.encryptionKey) throw new Error('Database or encryption key not available');

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readonly');
      const store = transaction.objectStore('encrypted_data');
      const request = store.getAll();

      request.onsuccess = async () => {
        const results = request.result.filter((item: any) => item.store === storeName);
        const decryptedItems = [];

        for (const result of results) {
          try {
            const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(result.data));
            const iv = CryptoService.base64ToUint8Array(result.iv);
            const decrypted = await CryptoService.decrypt(encrypted, this.encryptionKey!, iv);
            decryptedItems.push(JSON.parse(new TextDecoder().decode(decrypted)));
          } catch (error) {
            console.error('Failed to decrypt item:', error);
          }
        }

        resolve(decryptedItems);
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async deleteEncrypted(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Password Operations
  // ============================================

  async savePassword(password: PasswordEntry): Promise<void> {
    await this.encryptAndStore('passwords', password);
    await this.updateCount('passwords');
  }

  async getPassword(id: string): Promise<PasswordEntry | undefined> {
    return this.decryptAndRetrieve('passwords', id);
  }

  async getAllPasswords(): Promise<PasswordEntry[]> {
    return this.getAllEncrypted('passwords');
  }

  async deletePassword(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('passwords');
  }

  // ============================================
  // Subscription Operations
  // ============================================

  async saveSubscription(subscription: SubscriptionEntry): Promise<void> {
    await this.encryptAndStore('subscriptions', subscription);
    await this.updateCount('subscriptions');
  }

  async getSubscription(id: string): Promise<SubscriptionEntry | undefined> {
    return this.decryptAndRetrieve('subscriptions', id);
  }

  async getAllSubscriptions(): Promise<SubscriptionEntry[]> {
    return this.getAllEncrypted('subscriptions');
  }

  async deleteSubscription(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('subscriptions');
  }

  // ============================================
  // Note Operations
  // ============================================

  async saveNote(note: NoteEntry): Promise<void> {
    await this.encryptAndStore('notes', note);
    await this.updateCount('notes');
  }

  async getNote(id: string): Promise<NoteEntry | undefined> {
    return this.decryptAndRetrieve('notes', id);
  }

  async getAllNotes(): Promise<NoteEntry[]> {
    return this.getAllEncrypted('notes');
  }

  async deleteNote(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('notes');
  }

  // ============================================
  // Expense Operations
  // ============================================

  async saveExpense(expense: ExpenseEntry): Promise<void> {
    await this.encryptAndStore('expenses', expense);
    await this.updateCount('expenses');
  }

  async getExpense(id: string): Promise<ExpenseEntry | undefined> {
    return this.decryptAndRetrieve('expenses', id);
  }

  async getAllExpenses(): Promise<ExpenseEntry[]> {
    return this.getAllEncrypted('expenses');
  }

  async deleteExpense(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('expenses');
  }

  // ============================================
  // Reminder Operations
  // ============================================

  async saveReminder(reminder: ReminderEntry): Promise<void> {
    await this.encryptAndStore('reminders', reminder);
    await this.updateCount('reminders');
  }

  async getReminder(id: string): Promise<ReminderEntry | undefined> {
    return this.decryptAndRetrieve('reminders', id);
  }

  async getAllReminders(): Promise<ReminderEntry[]> {
    return this.getAllEncrypted('reminders');
  }

  async deleteReminder(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('reminders');
  }

  // ============================================
  // Bank Statement Operations
  // ============================================

  async saveBankStatement(statement: BankStatement): Promise<void> {
    await this.encryptAndStore('bankStatements', statement);
    await this.updateCount('bankStatements');
  }

  async getBankStatement(id: string): Promise<BankStatement | undefined> {
    return this.decryptAndRetrieve('bankStatements', id);
  }

  async getAllBankStatements(): Promise<BankStatement[]> {
    return this.getAllEncrypted('bankStatements');
  }

  async deleteBankStatement(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('bankStatements');
  }

  // ============================================
  // Bank Transaction Operations
  // ============================================

  async saveBankTransaction(transaction: BankTransaction): Promise<void> {
    await this.encryptAndStore('bankTransactions', transaction);
    await this.updateCount('bankTransactions');
  }

  async getBankTransaction(id: string): Promise<BankTransaction | undefined> {
    return this.decryptAndRetrieve('bankTransactions', id);
  }

  async getAllBankTransactions(): Promise<BankTransaction[]> {
    return this.getAllEncrypted('bankTransactions');
  }

  async deleteBankTransaction(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('bankTransactions');
  }

  // ============================================
  // Investment Operations
  // ============================================

  async saveInvestment(investment: Investment): Promise<void> {
    await this.encryptAndStore('investments', investment);
    await this.updateCount('investments');
  }

  async getInvestment(id: string): Promise<Investment | undefined> {
    return this.decryptAndRetrieve('investments', id);
  }

  async getAllInvestments(): Promise<Investment[]> {
    return this.getAllEncrypted('investments');
  }

  async deleteInvestment(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('investments');
  }

  // ============================================
  // Investment Goal Operations
  // ============================================

  async saveInvestmentGoal(goal: InvestmentGoal): Promise<void> {
    await this.encryptAndStore('investmentGoals', goal);
    await this.updateCount('investmentGoals');
  }

  async getInvestmentGoal(id: string): Promise<InvestmentGoal | undefined> {
    return this.decryptAndRetrieve('investmentGoals', id);
  }

  async getAllInvestmentGoals(): Promise<InvestmentGoal[]> {
    return this.getAllEncrypted('investmentGoals');
  }

  async deleteInvestmentGoal(id: string): Promise<void> {
    await this.deleteEncrypted(id);
    await this.updateCount('investmentGoals');
  }

  // ============================================
  // Count Updates
  // ============================================

  private async updateCount(type: string): Promise<void> {
    const metadata = await this.getMetadata();
    if (!metadata) return;

    switch (type) {
      case 'passwords':
        metadata.passwordCount = (await this.getAllPasswords()).length;
        break;
      case 'subscriptions':
        metadata.subscriptionCount = (await this.getAllSubscriptions()).length;
        break;
      case 'notes':
        metadata.noteCount = (await this.getAllNotes()).length;
        break;
      case 'expenses':
        metadata.expenseCount = (await this.getAllExpenses()).length;
        break;
      case 'reminders':
        metadata.reminderCount = (await this.getAllReminders()).length;
        break;
      case 'bankStatements':
        metadata.bankStatementCount = (await this.getAllBankStatements()).length;
        break;
      case 'bankTransactions':
        metadata.bankTransactionCount = (await this.getAllBankTransactions()).length;
        break;
      case 'investments':
        metadata.investmentCount = (await this.getAllInvestments()).length;
        break;
      case 'investmentGoals':
        metadata.investmentGoalCount = (await this.getAllInvestmentGoals()).length;
        break;
    }

    await this.saveMetadata(metadata);
  }

  // ============================================
  // Export/Import
  // ============================================

  async exportVault(exportPassword: string): Promise<string> {
    const passwords = await this.getAllPasswords();
    const subscriptions = await this.getAllSubscriptions();
    const notes = await this.getAllNotes();
    const expenses = await this.getAllExpenses();
    const reminders = await this.getAllReminders();
    const bankStatements = await this.getAllBankStatements();
    const bankTransactions = await this.getAllBankTransactions();
    const investments = await this.getAllInvestments();
    const investmentGoals = await this.getAllInvestmentGoals();
    const metadata = await this.getMetadata();

    const exportData = {
      vaultId: this.vaultId,
      passwords,
      subscriptions,
      notes,
      expenses,
      reminders,
      bankStatements,
      bankTransactions,
      investments,
      investmentGoals,
      metadata,
      exportedAt: new Date().toISOString(),
      version: 3,
    };

    const salt = CryptoService.generateSalt();
    const key = await CryptoService.deriveKey(exportPassword, salt);
    const { encrypted, iv } = await CryptoService.encrypt(JSON.stringify(exportData), key);

    return JSON.stringify({
      version: 3,
      salt: CryptoService.uint8ArrayToBase64(salt),
      iv: CryptoService.uint8ArrayToBase64(iv),
      data: CryptoService.arrayBufferToBase64(encrypted),
    });
  }

  // ============================================
  // Database Management
  // ============================================

  /**
   * Delete the vault database
   */
  async deleteDatabase(): Promise<void> {
    // Close connection first
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.dbName);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.encryptionKey = null;
  }
}

// ============================================
// Vault Manager - High-level API
// ============================================

export class VaultManager {
  private activeStorage: MultiVaultStorage | null = null;

  /**
   * Get the active vault storage
   */
  getActiveStorage(): MultiVaultStorage | null {
    return this.activeStorage;
  }

  /**
   * Initialize vault manager
   */
  async init(): Promise<void> {
    await vaultIndex.init();
  }

  /**
   * Get all vaults
   */
  async getAllVaults(): Promise<VaultIndexEntry[]> {
    return vaultIndex.getAllVaults();
  }

  /**
   * Get vault count
   */
  async getVaultCount(): Promise<number> {
    return vaultIndex.getVaultCount();
  }

  /**
   * Get max vaults for a plan tier
   */
  getMaxVaultsForPlan(tier: 'free' | 'pro' | 'lifetime' | 'trial'): number {
    switch (tier) {
      case 'free':
        return 1;
      case 'pro':
      case 'trial':
      case 'lifetime':
        return 5;
      default:
        return 1;
    }
  }

  /**
   * Check if user can create more vaults
   */
  async canCreateVault(tier: 'free' | 'pro' | 'lifetime' | 'trial'): Promise<boolean> {
    const count = await this.getVaultCount();
    const max = this.getMaxVaultsForPlan(tier);
    return count < max;
  }

  /**
   * Check if a vault is accessible based on plan
   */
  canAccessVault(vault: VaultIndexEntry, tier: 'free' | 'pro' | 'lifetime' | 'trial'): boolean {
    if (tier === 'free') {
      // Free users can only access the default vault
      return vault.isDefault;
    }
    // Premium users can access all vaults
    return true;
  }

  /**
   * Create a new vault
   */
  async createVault(
    name: string,
    masterPassword: string,
    isDefault: boolean = false,
    kdfConfig?: CryptoKDFConfig
  ): Promise<{ vaultId: string; storage: MultiVaultStorage }> {
    // Generate vault ID and salt
    const vaultId = vaultIndex.generateVaultId();
    const salt = CryptoService.generateSalt();
    const config = kdfConfig || CryptoService.KDF_PRESETS.standard;

    // Create password verification
    const passwordVerification = await vaultIndex.createPasswordVerification(
      masterPassword,
      salt,
      {
        algorithm: config.algorithm as 'PBKDF2',
        iterations: config.iterations,
        hash: config.hash as 'SHA-256',
      }
    );

    // If this is the first vault, make it default
    const vaultCount = await this.getVaultCount();
    const shouldBeDefault = isDefault || vaultCount === 0;

    // Create vault index entry
    const vaultEntry: VaultIndexEntry = {
      id: vaultId,
      name,
      createdAt: new Date(),
      lastUnlockedAt: new Date(),
      isDefault: shouldBeDefault,
      dbName: vaultIndex.getVaultDbName(vaultId),
      encryptionSalt: CryptoService.uint8ArrayToBase64(salt),
      kdfConfig: {
        algorithm: config.algorithm as 'PBKDF2',
        iterations: config.iterations,
        hash: config.hash as 'SHA-256',
      },
      passwordVerification,
    };

    await vaultIndex.addVault(vaultEntry);

    // Create storage instance
    const storage = new MultiVaultStorage(vaultId);
    await storage.init();

    // Derive key and set it
    const key = await CryptoService.deriveKey(masterPassword, salt, config);
    storage.setEncryptionKey(key);

    // Create metadata in vault DB
    const metadata: VaultMetadata = {
      id: 'vault',
      encryptionSalt: vaultEntry.encryptionSalt,
      kdfConfig: vaultEntry.kdfConfig,
      createdAt: new Date(),
      lastUnlocked: new Date(),
      passwordCount: 0,
      subscriptionCount: 0,
      noteCount: 0,
      expenseCount: 0,
      reminderCount: 0,
      bankStatementCount: 0,
      bankTransactionCount: 0,
      investmentCount: 0,
      investmentGoalCount: 0,
    };
    await storage.saveMetadata(metadata);

    // Set as active
    this.activeStorage = storage;

    return { vaultId, storage };
  }

  /**
   * Unlock a vault with password
   */
  async unlockVault(vaultId: string, masterPassword: string): Promise<MultiVaultStorage> {
    const vault = await vaultIndex.getVault(vaultId);
    if (!vault) throw new Error(`Vault ${vaultId} not found`);

    // Verify password
    const isValid = await vaultIndex.verifyPassword(masterPassword, vault);
    if (!isValid) {
      throw new Error('Invalid password');
    }

    // Create storage and derive key
    const storage = new MultiVaultStorage(vaultId);
    await storage.init();
    
    const key = await storage.deriveKey(masterPassword, vault);
    storage.setEncryptionKey(key);

    // Update last unlocked
    await storage.updateLastUnlocked();

    // Set as active
    this.activeStorage = storage;

    // Reset failed attempts on success
    await vaultIndex.resetFailedAttempts();

    return storage;
  }

  /**
   * Unlock a vault with a pre-derived key (for biometric unlock)
   * Bypasses KDF derivation — the key was derived during biometric setup
   */
  async unlockVaultWithKey(vaultId: string, base64Key: string): Promise<MultiVaultStorage> {
    const vault = await vaultIndex.getVault(vaultId);
    if (!vault) throw new Error(`Vault ${vaultId} not found`);

    // Import the base64 key as a CryptoKey
    const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );

    // Verify the key against the vault's password verification entry
    if (vault.passwordVerification) {
      try {
        const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(vault.passwordVerification.data));
        const iv = CryptoService.base64ToUint8Array(vault.passwordVerification.iv);
        const decrypted = await CryptoService.decrypt(encrypted, key, iv);
        const text = new TextDecoder().decode(decrypted);
        if (text !== 'VAULT_VERIFICATION_TOKEN') {
          throw new Error('Invalid biometric key');
        }
      } catch {
        throw new Error('Invalid biometric key');
      }
    }

    // Create storage and set the key directly
    const storage = new MultiVaultStorage(vaultId);
    await storage.init();
    storage.setEncryptionKey(key);

    // Update last unlocked
    await storage.updateLastUnlocked();

    // Set as active
    this.activeStorage = storage;

    // Reset failed attempts on success
    await vaultIndex.resetFailedAttempts();

    return storage;
  }

  /**
   * Try to unlock with password against all vaults
   * Returns matching vaults
   */
  async tryUnlockWithPassword(masterPassword: string): Promise<VaultIndexEntry[]> {
    return vaultIndex.findMatchingVaults(masterPassword);
  }

  /**
   * Lock the active vault
   */
  lockVault(): void {
    if (this.activeStorage) {
      this.activeStorage.close();
      this.activeStorage = null;
    }
  }

  /**
   * Delete a vault
   */
  async deleteVault(vaultId: string): Promise<void> {
    const vault = await vaultIndex.getVault(vaultId);
    if (!vault) throw new Error(`Vault ${vaultId} not found`);

    // Close if active
    if (this.activeStorage?.getVaultId() === vaultId) {
      this.activeStorage.close();
      this.activeStorage = null;
    }

    // Delete vault database
    const storage = new MultiVaultStorage(vaultId);
    await storage.deleteDatabase();

    // Remove from index
    await vaultIndex.deleteVault(vaultId);

  }

  /**
   * Rename a vault
   */
  async renameVault(vaultId: string, newName: string): Promise<void> {
    await vaultIndex.updateVault(vaultId, { name: newName });
  }

  /**
   * Set default vault
   */
  async setDefaultVault(vaultId: string): Promise<void> {
    await vaultIndex.setDefaultVault(vaultId);
  }

  /**
   * Get default vault
   */
  async getDefaultVault(): Promise<VaultIndexEntry | null> {
    return vaultIndex.getDefaultVault();
  }

  /**
   * Check lockout status
   */
  async isLockedOut(): Promise<boolean> {
    return vaultIndex.isLockedOut();
  }

  /**
   * Get lockout time remaining
   */
  async getLockoutTimeRemaining(): Promise<number> {
    return vaultIndex.getLockoutTimeRemaining();
  }

  /**
   * Record failed attempt
   */
  async recordFailedAttempt(): Promise<boolean> {
    return vaultIndex.recordFailedAttempt();
  }

  /**
   * Get failed attempt count
   */
  async getFailedAttemptCount(): Promise<number> {
    return vaultIndex.getFailedAttemptCount();
  }
}

// Singleton instance
export const vaultManager = new VaultManager();
