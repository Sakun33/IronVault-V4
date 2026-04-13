import { PasswordEntry, SubscriptionEntry, NoteEntry, ExpenseEntry, ReminderEntry, VaultMetadata, KDFConfig, BankStatement, BankTransaction, Investment, InvestmentGoal } from '@shared/schema';
import { CryptoService, KDFConfig as CryptoKDFConfig } from './crypto';
import { PASSWORD_MANAGER_PARSERS, type ParserConfig } from './csv-parsers';

export class VaultStorage {
  private dbName = 'IronVault';
  private version = 3; // Incremented for new security features
  private db: IDBDatabase | undefined = undefined;
  private encryptionKey: CryptoKey | undefined = undefined;
  private failedAttempts: number = 0;
  private maxFailedAttempts: number = 3;
  private lastFailedAttempt: number = 0;
  private lockoutDuration: number = 5 * 60 * 1000; // 5 minutes

  // Public method to get database
  getDatabase(): IDBDatabase | undefined {
    return this.db;
  }

  // Public method to check if database is initialized
  isInitialized(): boolean {
    return this.db !== undefined;
  }

  // Initialize IndexedDB with proper migration handling
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ Database initialized successfully with version:', this.version);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ Database initialization failed:', request.error);
        reject(request.error);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;
        
        console.log(`🔄 Database upgrade from version ${oldVersion} to ${this.version}`);

        // Create all object stores
        const objectStores = [
          'passwords', 'subscriptions', 'notes', 'expenses', 'reminders',
          'metadata', 'encrypted_data', 'bankStatements', 'bankTransactions',
          'investments', 'investmentGoals', 'persistent_data'
        ];

        objectStores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            console.log(`📦 Creating object store: ${storeName}`);
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        });

        console.log('✅ Database schema updated successfully');
      };

      request.onblocked = () => {
        console.warn('⚠️ Database upgrade blocked. Please close other tabs and refresh.');
        reject(new Error('Database upgrade blocked. Please close other tabs and refresh.'));
      };
    });
  }

  // Check if database schema is correct
  async checkSchema(): Promise<boolean> {
    if (!this.db) return false;
    
    const requiredStores = [
      'passwords', 'subscriptions', 'notes', 'expenses', 'reminders',
      'metadata', 'encrypted_data', 'bankStatements', 'bankTransactions',
      'investments', 'investmentGoals', 'persistent_data'
    ];
    
    const existingStores = Array.from(this.db.objectStoreNames);
    const missingStores = requiredStores.filter(store => !existingStores.includes(store));
    
    if (missingStores.length > 0) {
      console.warn('⚠️ Missing object stores:', missingStores);
      return false;
    }
    
    console.log('✅ Database schema is correct');
    return true;
  }

  // Force database recreation
  async recreateDatabase(): Promise<void> {
    console.log('🔄 Forcing database recreation...');
    
    // Close current connection
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    
    // Delete and recreate
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      
      deleteRequest.onsuccess = () => {
        console.log('✅ Database deleted, recreating...');
        this.init().then(resolve).catch(reject);
      };
      
      deleteRequest.onerror = () => {
        console.error('❌ Failed to delete database');
        reject(new Error('Failed to delete database'));
      };
    });
  }

  // Reset all internal state for full vault reset
  resetState(): void {
    console.log('🔄 Resetting vaultStorage state...');
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    this.encryptionKey = undefined;
    this.failedAttempts = 0;
    this.lastFailedAttempt = 0;
    console.log('✅ vaultStorage state reset');
  }

  // Switch to a different vault database
  async switchToVault(vaultId: string): Promise<void> {
    console.log(`🔄 Switching to vault: ${vaultId}`);
    
    // Close existing connection
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
    
    // Clear encryption key from previous vault
    this.encryptionKey = undefined;
    
    // Set new database name
    this.dbName = vaultId === 'default' ? 'IronVault' : `IronVault_${vaultId}`;
    
    // Initialize the new database
    await this.init();
    console.log(`✅ Switched to vault database: ${this.dbName}`);
  }

  // Get current database name
  getDatabaseName(): string {
    return this.dbName;
  }

  // Anti-brute-force security methods
  // NOTE: Lockout state is now managed by vault-index for persistence across reloads
  // These methods are kept for backward compatibility but delegate to vault-index
  async recordFailedAttempt(): Promise<void> {
    this.failedAttempts++;
    this.lastFailedAttempt = Date.now();
    
    console.warn(`⚠️ Failed attempt ${this.failedAttempts}/${this.maxFailedAttempts}`);
    
    // NO LONGER WIPES - just locks out for 1 hour after 3 attempts
    if (this.failedAttempts >= this.maxFailedAttempts) {
      console.error('🔒 Maximum failed attempts reached. Account locked for 1 hour.');
      // Lockout state is persisted in vault-index
    }
  }

  async resetFailedAttempts(): Promise<void> {
    this.failedAttempts = 0;
    this.lastFailedAttempt = 0;
    console.log('✅ Failed attempts reset');
  }

  isLockedOut(): boolean {
    // Lockout disabled
    return false;
  }

  getLockoutTimeRemaining(): number {
    if (!this.isLockedOut()) return 0;
    const timeSinceLastAttempt = Date.now() - this.lastFailedAttempt;
    const oneHour = 60 * 60 * 1000;
    return Math.max(0, oneHour - timeSinceLastAttempt);
  }

  // DEPRECATED: Security wipe removed - use lockout instead
  // Keeping this method stub for backward compatibility
  async securityWipe(): Promise<void> {
    console.warn('⚠️ Security wipe is deprecated. Using lockout instead.');
    // No longer wipes data - just resets state
    this.failedAttempts = 0;
    this.lastFailedAttempt = 0;
    this.encryptionKey = undefined;
  }

  async clearCachedExports(): Promise<void> {
    try {
      // Clear any cached backup files
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          if (cacheName.includes('securevault-backup')) {
            await caches.delete(cacheName);
          }
        }
      }
      
      // Clear localStorage backup references
      localStorage.removeItem('securevault-last-backup');
      localStorage.removeItem('securevault-backup-hash');
      
      console.log('✅ Cached exports cleared');
    } catch (error) {
      console.error('❌ Failed to clear cached exports:', error);
    }
  }

  // Enhanced persistent storage methods
  async savePersistentData(key: string, data: any): Promise<void> {
    if (!this.encryptionKey) throw new Error('Encryption key not set');
    
    try {
      const jsonData = JSON.stringify(data);
      const { encrypted, iv } = await CryptoService.encrypt(jsonData, this.encryptionKey);
      
      // Store in IndexedDB (survives cache clear)
      await this.encryptAndStore('persistent_data', { 
        id: key, 
        data: encrypted, 
        iv: iv,
        timestamp: Date.now()
      });
      
      console.log(`✅ Persistent data saved: ${key}`);
    } catch (error) {
      console.error(`❌ Failed to save persistent data ${key}:`, error);
      throw error;
    }
  }

  async getPersistentData(key: string): Promise<any> {
    if (!this.encryptionKey) throw new Error('Encryption key not set');
    
    try {
      const result = await this.decryptAndRetrieve('persistent_data', key);
      if (!result) return null;
      
      const decrypted = await CryptoService.decrypt(result.data, this.encryptionKey, result.iv);
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (error) {
      console.error(`❌ Failed to get persistent data ${key}:`, error);
      return null;
    }
  }

  // Set encryption key with security validation
  setEncryptionKey(key: CryptoKey): void {
    this.encryptionKey = key;
    console.log('✅ Encryption key set');
  }

  // Check if vault exists
  async vaultExists(): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const metadata = await this.getMetadata();
    return metadata !== undefined;
  }

  // Create new vault with optional KDF configuration
  async createVault(masterPassword: string, kdfConfig?: CryptoKDFConfig): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Use provided KDF config or fall back to default
    const config = kdfConfig || CryptoService.KDF_PRESETS.standard;
    
    const salt = CryptoService.generateSalt();
    const key = await CryptoService.deriveKey(masterPassword, salt, config);
    this.encryptionKey = key;

    const metadata: VaultMetadata = {
      id: 'vault',
      encryptionSalt: CryptoService.uint8ArrayToBase64(salt),
      kdfConfig: {
        algorithm: config.algorithm as "PBKDF2",
        iterations: config.iterations,
        hash: config.hash as "SHA-256",
      },
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

    await this.saveMetadata(metadata);
    
    // Create password verification entry for future authentication
    await this.createPasswordVerificationEntry(key);
  }

  // Unlock vault with master password
  async unlockVault(masterPassword: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const metadata = await this.getMetadata();
      if (!metadata) return false;

      const salt = CryptoService.base64ToUint8Array(metadata.encryptionSalt);
      
      // Use stored KDF configuration or fall back to legacy default (100k iterations)
      const kdfConfig = metadata.kdfConfig ? {
        algorithm: metadata.kdfConfig.algorithm,
        iterations: metadata.kdfConfig.iterations,
        hash: metadata.kdfConfig.hash,
      } : {
        algorithm: 'PBKDF2' as const,
        iterations: 100000, // Original default before KDF upgrade
        hash: 'SHA-256' as const
      };
      
      const key = await CryptoService.deriveKey(masterPassword, salt, kdfConfig);
      
      // Test the key by trying to decrypt existing data or verification entry
      const testEntry = await this.getPasswordVerificationEntry();
      
      if (testEntry) {
        // Try to decrypt existing verification entry
        try {
          const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(testEntry.data));
          const iv = CryptoService.base64ToUint8Array(testEntry.iv);
          const decrypted = await CryptoService.decrypt(encrypted, key, iv);
          
          // Check if decrypted data matches expected test string
          const decryptedText = new TextDecoder().decode(decrypted);
          if (decryptedText !== 'VAULT_PASSWORD_VERIFICATION') {
            await this.recordFailedAttempt();
            return false; // Wrong password - decryption succeeded but content is wrong
          }
        } catch (error) {
          console.error('Password verification failed:', error);
          await this.recordFailedAttempt();
          return false; // Wrong password - decryption failed
        }
      } else {
        // No verification entry exists - this is a legacy vault
        // Try to decrypt existing encrypted entries to validate the password
        const canDecryptData = await this.hasDecryptableEntryWithKey(key);
        
        if (!canDecryptData) {
          // Can't validate password - either wrong password or empty vault
          // For security, we require explicit vault creation, not automatic unlock
          return false;
        }
        
        // Password is valid - create verification entry for future use
        await this.createPasswordVerificationEntry(key);
      }

      this.encryptionKey = key;
      
      // Reset failed attempts on successful unlock
      await this.resetFailedAttempts();

      // Update last unlocked time
      metadata.lastUnlocked = new Date();
      await this.saveMetadata(metadata);

      return true;
    } catch (error) {
      console.error('Failed to unlock vault:', error);
      return false;
    }
  }

  // Unlock vault with a pre-derived key (for biometric unlock)
  // The key was derived during biometric setup and stored in Keychain/Keystore
  async unlockVaultWithKey(base64Key: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Import the base64 key as a CryptoKey
      const keyBytes = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
      const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      // Verify the key against the password verification entry
      const testEntry = await this.getPasswordVerificationEntry();
      if (testEntry) {
        try {
          const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(testEntry.data));
          const iv = CryptoService.base64ToUint8Array(testEntry.iv);
          const decrypted = await CryptoService.decrypt(encrypted, key, iv);
          const decryptedText = new TextDecoder().decode(decrypted);
          if (decryptedText !== 'VAULT_PASSWORD_VERIFICATION') {
            return false;
          }
        } catch (error) {
          console.error('Biometric key verification failed:', error);
          return false;
        }
      } else {
        // No verification entry — try decrypting existing data
        const canDecrypt = await this.hasDecryptableEntryWithKey(key);
        if (!canDecrypt) return false;
      }

      this.encryptionKey = key;

      // Update last unlocked time
      const metadata = await this.getMetadata();
      if (metadata) {
        metadata.lastUnlocked = new Date();
        await this.saveMetadata(metadata);
      }

      return true;
    } catch (error) {
      console.error('Failed to unlock vault with biometric key:', error);
      return false;
    }
  }

  // Clear all encrypted items (used before re-importing from cloud)
  async clearEncryptedItems(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Replace vault contents from an encrypted cloud blob (clear then re-import)
  async replaceVaultFromBlob(encryptedBlob: string, masterPassword: string): Promise<void> {
    await this.clearEncryptedItems();
    await this.importVault(encryptedBlob, masterPassword);
  }

  // Save metadata
  private async saveMetadata(metadata: VaultMetadata): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get metadata
  private async getMetadata(): Promise<VaultMetadata | undefined> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get('vault');

      request.onsuccess = () => resolve(request.result || undefined);
      request.onerror = () => reject(request.error);
    });
  }

  // Encrypt and store data
  private async encryptAndStore(storeName: string, data: any): Promise<void> {
    if (!this.db || !this.encryptionKey) throw new Error('Database or encryption key not available');

    const jsonData = JSON.stringify(data);
    const { encrypted, iv } = await CryptoService.encrypt(jsonData, this.encryptionKey);

    const encryptedEntry = {
      id: data.id,
      data: CryptoService.arrayBufferToBase64(encrypted),
      iv: CryptoService.uint8ArrayToBase64(iv),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.put({ ...encryptedEntry, store: storeName });

      request.onsuccess = () => {
        window.dispatchEvent(new CustomEvent('vault:item:saved'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Decrypt and retrieve data
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

  // Get all encrypted entries for a store
  private async getAllEncrypted(storeName: string): Promise<any[]> {
    if (!this.db || !this.encryptionKey) throw new Error('Database or encryption key not available');

    return new Promise(async (resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readonly');
      const store = transaction.objectStore('encrypted_data');
      const request = store.getAll();

      request.onsuccess = async () => {
        const results = request.result.filter(item => item.store === storeName);
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

  // Password operations
  async savePassword(password: PasswordEntry): Promise<void> {
    await this.encryptAndStore('passwords', password);
    await this.updatePasswordCount();
  }

  async getPassword(id: string): Promise<PasswordEntry | undefined> {
    return this.decryptAndRetrieve('passwords', id);
  }

  async getAllPasswords(): Promise<PasswordEntry[]> {
    return this.getAllEncrypted('passwords');
  }

  async deletePassword(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.delete(id);

      request.onsuccess = async () => {
        await this.updatePasswordCount();
        window.dispatchEvent(new CustomEvent('vault:item:saved'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Subscription operations
  async saveSubscription(subscription: SubscriptionEntry): Promise<void> {
    await this.encryptAndStore('subscriptions', subscription);
    await this.updateSubscriptionCount();
  }

  async getSubscription(id: string): Promise<SubscriptionEntry | undefined> {
    return this.decryptAndRetrieve('subscriptions', id);
  }

  async getAllSubscriptions(): Promise<SubscriptionEntry[]> {
    return this.getAllEncrypted('subscriptions');
  }

  async deleteSubscription(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.delete(id);

      request.onsuccess = async () => {
        await this.updateSubscriptionCount();
        window.dispatchEvent(new CustomEvent('vault:item:saved'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Notes methods
  async saveNote(note: NoteEntry): Promise<void> {
    await this.encryptAndStore('notes', note);
    await this.updateNoteCount();
  }

  async getNote(id: string): Promise<NoteEntry | undefined> {
    return this.decryptAndRetrieve('notes', id);
  }

  async getAllNotes(): Promise<NoteEntry[]> {
    return this.getAllEncrypted('notes');
  }

  async deleteNote(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.delete(id);

      request.onsuccess = async () => {
        await this.updateNoteCount();
        window.dispatchEvent(new CustomEvent('vault:item:saved'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Expense methods
  async saveExpense(expense: ExpenseEntry): Promise<void> {
    await this.encryptAndStore('expenses', expense);
    await this.updateExpenseCount();
  }

  async getExpense(id: string): Promise<ExpenseEntry | undefined> {
    return this.decryptAndRetrieve('expenses', id);
  }

  async getAllExpenses(): Promise<ExpenseEntry[]> {
    return this.getAllEncrypted('expenses');
  }

  async deleteExpense(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.delete(id);

      request.onsuccess = async () => {
        await this.updateExpenseCount();
        window.dispatchEvent(new CustomEvent('vault:item:saved'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Reminder methods
  async saveReminder(reminder: ReminderEntry): Promise<void> {
    await this.encryptAndStore('reminders', reminder);
    await this.updateReminderCount();
  }

  async getReminder(id: string): Promise<ReminderEntry | undefined> {
    return this.decryptAndRetrieve('reminders', id);
  }

  async getAllReminders(): Promise<ReminderEntry[]> {
    return this.getAllEncrypted('reminders');
  }

  async deleteReminder(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.delete(id);

      request.onsuccess = async () => {
        await this.updateReminderCount();
        window.dispatchEvent(new CustomEvent('vault:item:saved'));
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Update counts in metadata
  private async updatePasswordCount(): Promise<void> {
    const passwords = await this.getAllPasswords();
    const metadata = await this.getMetadata();
    if (metadata) {
      metadata.passwordCount = passwords.length;
      await this.saveMetadata(metadata);
    }
  }

  private async updateSubscriptionCount(): Promise<void> {
    const subscriptions = await this.getAllSubscriptions();
    const metadata = await this.getMetadata();
    if (metadata) {
      metadata.subscriptionCount = subscriptions.length;
      await this.saveMetadata(metadata);
    }
  }

  private async updateNoteCount(): Promise<void> {
    const notes = await this.getAllNotes();
    const metadata = await this.getMetadata();
    if (metadata) {
      metadata.noteCount = notes.length;
      await this.saveMetadata(metadata);
    }
  }

  private async updateExpenseCount(): Promise<void> {
    const expenses = await this.getAllExpenses();
    const metadata = await this.getMetadata();
    if (metadata) {
      metadata.expenseCount = expenses.length;
      await this.saveMetadata(metadata);
    }
  }

  private async updateReminderCount(): Promise<void> {
    const reminders = await this.getAllReminders();
    const metadata = await this.getMetadata();
    if (metadata) {
      metadata.reminderCount = reminders.length;
      await this.saveMetadata(metadata);
    }
  }

  // Export vault data
  async exportVault(exportPassword: string): Promise<string> {
    console.log('📦 Starting vault export...');
    
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
      exportedAt: new Date(),
      version: 2, // Updated version for new data types
    };

    const salt = CryptoService.generateSalt();
    const key = await CryptoService.deriveKey(exportPassword, salt);
    const { encrypted, iv } = await CryptoService.encrypt(JSON.stringify(exportData), key);

    const encryptedExport = {
      version: 2,
      salt: CryptoService.uint8ArrayToBase64(salt),
      iv: CryptoService.uint8ArrayToBase64(iv),
      data: CryptoService.arrayBufferToBase64(encrypted),
    };

    const exportString = JSON.stringify(encryptedExport);
    
    // Save backup metadata for automatic replacement
    await this.saveBackupMetadata(exportString, exportPassword);
    
    console.log('✅ Vault export completed');
    return exportString;
  }

  async saveBackupMetadata(exportData: string, password: string): Promise<void> {
    try {
      const hash = await CryptoService.hash(exportData);
      const metadata = {
        timestamp: Date.now(),
        hash: hash,
        size: exportData.length,
        passwordHash: await CryptoService.hash(password), // Store password hash for verification
      };
      
      await this.savePersistentData('backup-metadata', metadata);
      localStorage.setItem('securevault-last-backup', Date.now().toString());
      localStorage.setItem('securevault-backup-hash', hash);
      
      console.log('✅ Backup metadata saved');
    } catch (error) {
      console.error('❌ Failed to save backup metadata:', error);
    }
  }

  async getBackupMetadata(): Promise<any> {
    return await this.getPersistentData('backup-metadata');
  }

  async hasRecentBackup(): Promise<boolean> {
    const metadata = await this.getBackupMetadata();
    if (!metadata) return false;
    
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    return metadata.timestamp > oneWeekAgo;
  }

  // Import vault data (supports both encrypted and plaintext formats)
  async importVault(data: string, password?: string): Promise<void> {
    try {
      // First, try to parse as JSON to determine if it's encrypted or plaintext
      let importData: any;
      
      try {
        // Clean the data first - remove BOM and extra whitespace
        let cleanData = data.trim();
        
        // Remove BOM (Byte Order Mark) if present
        if (cleanData.charCodeAt(0) === 0xFEFF) {
          cleanData = cleanData.slice(1);
        }
        
        // Remove any leading/trailing whitespace again
        cleanData = cleanData.trim();
        
        // Try to find the first valid JSON character
        let jsonStart = 0;
        for (let i = 0; i < cleanData.length; i++) {
          const char = cleanData[i];
          if (char === '{' || char === '[') {
            jsonStart = i;
            break;
          }
        }
        
        // Extract only the JSON part
        const jsonData = cleanData.substring(jsonStart);
        
        console.log('🔍 Cleaned data preview:', jsonData.substring(0, 100));
        
        const parsedData = JSON.parse(jsonData);
        
        // Check if this is an encrypted IronVault export (has version, salt, iv, data fields)
        if (parsedData.version && parsedData.salt && parsedData.iv && parsedData.data) {
          // This is an encrypted vault export
          if (!password) {
            throw new Error('This is an encrypted vault file. Please provide the password to decrypt it.');
          }
          
          const salt = CryptoService.base64ToUint8Array(parsedData.salt);
          const iv = CryptoService.base64ToUint8Array(parsedData.iv);
          const encryptedData = new Uint8Array(CryptoService.base64ToArrayBuffer(parsedData.data));

          const key = await CryptoService.deriveKey(password, salt);
          const decrypted = await CryptoService.decrypt(encryptedData, key, iv);
          importData = JSON.parse(new TextDecoder().decode(decrypted));
        } else {
          // This is plaintext JSON data
          importData = parsedData;
        }
      } catch (parseError) {
        // If JSON parsing fails, check if it's a CSV file
        if (this.isCSVFormat(data)) {
          // This is a CSV file, use CSV import functionality
          await this.importFromCSV(data);
          return;
        }
        
        // Provide more specific error information
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        console.error('JSON parsing failed:', parseError);
        console.error('Data preview (first 200 chars):', data.substring(0, 200));
        console.error('Data preview (last 200 chars):', data.substring(Math.max(0, data.length - 200)));
        
        // Check for common issues
        let diagnosticMessage = '';
        if (data.trim().length === 0) {
          diagnosticMessage = 'The file appears to be empty.';
        } else if (data.includes('<?xml')) {
          diagnosticMessage = 'The file appears to be XML format, not JSON.';
        } else if (data.includes('<html') || data.includes('<!DOCTYPE')) {
          diagnosticMessage = 'The file appears to be HTML format, not JSON.';
        } else if (data.includes('[') && data.includes(']') && !data.includes('{')) {
          diagnosticMessage = 'The file appears to be a JSON array, but IronVault expects a JSON object.';
        } else if (data.length < 10) {
          diagnosticMessage = 'The file is too short to be a valid JSON export.';
        } else {
          diagnosticMessage = 'The file format is not recognized. Please ensure it\'s a valid IronVault JSON export.';
        }
        
        throw new Error(`Import Failed: ${diagnosticMessage} JSON parsing error: ${errorMessage}. Please check the file format and try again.`);
      }

      // Import passwords
      if (importData.passwords) {
        for (const password of importData.passwords) {
          await this.savePassword(password);
        }
      }

      // Import subscriptions
      if (importData.subscriptions) {
        for (const subscription of importData.subscriptions) {
          await this.saveSubscription(subscription);
        }
      }

      // Import notes
      if (importData.notes) {
        for (const note of importData.notes) {
          await this.saveNote(note);
        }
      }

      // Import expenses
      if (importData.expenses) {
        for (const expense of importData.expenses) {
          await this.saveExpense(expense);
        }
      }

      // Import reminders
      if (importData.reminders) {
        for (const reminder of importData.reminders) {
          await this.saveReminder(reminder);
        }
      }

      // Import investments
      if (importData.investments) {
        for (const investment of importData.investments) {
          await this.saveInvestment(investment);
        }
      }

      // Import investment goals
      if (importData.investmentGoals) {
        for (const goal of importData.investmentGoals) {
          await this.saveInvestmentGoal(goal);
        }
      }

      // Import bank statements
      if (importData.bankStatements) {
        for (const statement of importData.bankStatements) {
          await this.saveBankStatement(statement);
        }
      }

      // Import bank transactions
      if (importData.bankTransactions) {
        for (const transaction of importData.bankTransactions) {
          await this.saveBankTransaction(transaction);
        }
      }

    } catch (error) {
      if (error instanceof Error && error.message.includes('password')) {
        throw error; // Re-throw password-related errors as-is
      }
      throw new Error(`Failed to import vault data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to detect if data is CSV format
  private isCSVFormat(data: string): boolean {
    const lines = data.trim().split('\n');
    if (lines.length < 2) return false;
    
    // Check if first line contains commas (typical CSV header)
    const firstLine = lines[0];
    return firstLine.includes(',') && !firstLine.includes('{') && !firstLine.includes('[');
  }

  // Import data from CSV format
  private async importFromCSV(csvContent: string): Promise<void> {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Determine the type of CSV based on headers (check most specific first)
    if (this.isPasswordCSV(headers)) {
      await this.importPasswordsFromGenericCSV(csvContent);
    } else if (this.isSubscriptionCSV(headers)) {
      await this.importSubscriptionsFromCSV(csvContent);
    } else if (this.isReminderCSV(headers)) {
      await this.importRemindersFromCSV(csvContent);
    } else if (this.isNoteCSV(headers)) {
      await this.importNotesFromCSV(csvContent);
    } else if (this.isExpenseCSV(headers)) {
      await this.importExpensesFromCSV(csvContent);
    } else {
      throw new Error('Unrecognized CSV format. Please ensure the CSV has the correct headers.');
    }
  }

  // Helper methods to identify CSV types
  private isPasswordCSV(headers: string[]): boolean {
    // Check for unique password identifiers
    return headers.includes('password') || (headers.includes('username') && headers.includes('url'));
  }

  private isSubscriptionCSV(headers: string[]): boolean {
    // Check for unique subscription identifiers
    return headers.includes('billingCycle') || (headers.includes('plan') && headers.includes('cost'));
  }

  private isExpenseCSV(headers: string[]): boolean {
    // Check for unique expense identifiers
    return headers.includes('amount') || (headers.includes('description') && headers.includes('currency'));
  }

  private isNoteCSV(headers: string[]): boolean {
    // Check for unique note identifiers
    return headers.includes('content') || (headers.includes('title') && headers.includes('isPinned'));
  }

  private isReminderCSV(headers: string[]): boolean {
    // Check for unique reminder identifiers
    return headers.includes('dueDate') || (headers.includes('priority') && headers.includes('isRecurring'));
  }

  // Import passwords from generic CSV
  private async importPasswordsFromGenericCSV(csvContent: string): Promise<void> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      // Create password entry
      const password: PasswordEntry = {
        id: `imported_${Date.now()}_${i}`,
        name: row.name || row.title || 'Imported Password',
        username: row.username || row.email || '',
        password: row.password || '',
        url: row.url || row.website || '',
        category: row.category || 'Imported',
        notes: row.notes || row.description || '',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsed: undefined,
      };

      try {
        await this.savePassword(password);
        imported++;
      } catch (error) {
        skipped++;
      }
    }

    if (imported === 0) {
      throw new Error('No valid passwords could be imported from the CSV file');
    }
  }

  // Import subscriptions from CSV
  private async importSubscriptionsFromCSV(csvContent: string): Promise<void> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      const subscription: SubscriptionEntry = {
        id: `imported_${Date.now()}_${i}`,
        name: row.name || 'Imported Subscription',
        plan: row.plan || 'Basic',
        cost: parseFloat(row.cost || '0'),
        currency: row.currency || 'USD',
        billingCycle: row.billingCycle || 'monthly',
        nextBillingDate: row.nextBillingDate ? new Date(row.nextBillingDate + 'T00:00:00.000Z') : new Date(),
        reminderDays: parseInt(row.reminderDays || '7'),
        category: row.category || 'Other',
        notes: row.notes || '',
        isActive: row.isActive === 'true' || row.isActive === true,
        subscriptionType: row.subscriptionType || 'other',
        autoRenew: row.autoRenew === 'true' || row.autoRenew === true,
        credentials: {
          username: row.username || '',
          email: row.email || '',
          accountId: row.accountId || ''
        },
        platformLink: row.platformLink || '',
        expiryDate: row.expiryDate ? new Date(row.expiryDate + 'T00:00:00.000Z') : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await this.saveSubscription(subscription);
        imported++;
      } catch (error) {
        skipped++;
      }
    }

    if (imported === 0) {
      throw new Error('No valid subscriptions could be imported from the CSV file');
    }
  }

  // Import expenses from CSV
  private async importExpensesFromCSV(csvContent: string): Promise<void> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      const expense: ExpenseEntry = {
        id: `imported_${Date.now()}_${i}`,
        title: row.description || row.title || 'Imported Expense',
        amount: parseFloat(row.amount || '0'),
        currency: row.currency || 'USD',
        category: row.category || 'Other',
        date: row.date ? new Date(row.date) : new Date(),
        notes: row.notes || '',
        isRecurring: false,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await this.saveExpense(expense);
        imported++;
      } catch (error) {
        skipped++;
      }
    }

    if (imported === 0) {
      throw new Error('No valid expenses could be imported from the CSV file');
    }
  }

  // Import notes from CSV
  private async importNotesFromCSV(csvContent: string): Promise<void> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      const note: NoteEntry = {
        id: `imported_${Date.now()}_${i}`,
        title: row.title || 'Imported Note',
        content: row.content || '',
        notebook: row.category || 'Default',
        tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
        isPinned: row.isPinned === 'true' || row.isPinned === true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await this.saveNote(note);
        imported++;
      } catch (error) {
        skipped++;
      }
    }

    if (imported === 0) {
      throw new Error('No valid notes could be imported from the CSV file');
    }
  }

  // Import reminders from CSV
  private async importRemindersFromCSV(csvContent: string): Promise<void> {
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      const reminder: ReminderEntry = {
        id: `imported_${Date.now()}_${i}`,
        title: row.title || 'Imported Reminder',
        description: row.description || '',
        dueDate: row.dueDate ? new Date(row.dueDate) : new Date(),
        priority: (row.priority || 'medium') as 'low' | 'medium' | 'high' | 'urgent',
        isCompleted: row.isCompleted === 'true' || row.isCompleted === true,
        category: row.category || 'Personal',
        tags: [],
        isRecurring: false,
        color: '#6366f1',
        notificationEnabled: true,
        alarmEnabled: false,
        alertMinutesBefore: 15,
        preAlertEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      try {
        await this.saveReminder(reminder);
        imported++;
      } catch (error) {
        skipped++;
      }
    }

    if (imported === 0) {
      throw new Error('No valid reminders could be imported from the CSV file');
    }
  }

  // Helper method to parse CSV line (handles quoted values)
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  // Import passwords from CSV
  async importPasswordsFromCSV(csvContent: string, parserId: string): Promise<{ imported: number; skipped: number }> {
    const parser = PASSWORD_MANAGER_PARSERS.find(p => p.id === parserId);
    if (!parser) {
      throw new Error('Unknown password manager format');
    }

    let passwords: PasswordEntry[];
    try {
      passwords = parser.parser(csvContent);
    } catch (error) {
      throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (passwords.length === 0) {
      throw new Error('No valid passwords found in CSV file');
    }

    // Fetch existing passwords once for efficient duplicate checking
    const existingPasswords = await this.getAllPasswords();
    const existingKeys = new Set(
      existingPasswords.map(p => `${p.name.toLowerCase()}::${p.username.toLowerCase()}`)
    );

    let imported = 0;
    let skipped = 0;
    const importedKeys = new Set<string>();

    for (const password of passwords) {
      try {
        // Create duplicate check key
        const duplicateKey = `${password.name.toLowerCase()}::${password.username.toLowerCase()}`;
        
        // Check against existing passwords and already imported passwords
        if (existingKeys.has(duplicateKey) || importedKeys.has(duplicateKey)) {
          skipped++;
          continue;
        }

        await this.savePassword(password);
        importedKeys.add(duplicateKey);
        imported++;
      } catch (error) {
        console.warn('Failed to import password:', password.name, error);
        skipped++;
      }
    }

    return { imported, skipped };
  }

  // Get available CSV parsers
  getAvailableCSVParsers(): ParserConfig[] {
    return PASSWORD_MANAGER_PARSERS;
  }

  // Password verification methods for authentication
  private async getPasswordVerificationEntry(): Promise<{ data: string; iv: string } | undefined> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readonly');
      const store = transaction.objectStore('encrypted_data');
      const request = store.get('password_verification');

      request.onsuccess = () => {
        const result = request.result;
        if (result && result.store === 'verification') {
          resolve({ data: result.data, iv: result.iv });
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async createPasswordVerificationEntry(key: CryptoKey): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const testString = 'VAULT_PASSWORD_VERIFICATION';
    const { encrypted, iv } = await CryptoService.encrypt(testString, key);

    const verificationEntry = {
      id: 'password_verification',
      store: 'verification',
      data: CryptoService.arrayBufferToBase64(encrypted),
      iv: CryptoService.uint8ArrayToBase64(iv),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readwrite');
      const store = transaction.objectStore('encrypted_data');
      const request = store.put(verificationEntry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async hasDecryptableEntryWithKey(key: CryptoKey): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['encrypted_data'], 'readonly');
      const store = transaction.objectStore('encrypted_data');
      const request = store.getAll();

      request.onsuccess = async () => {
        const results = request.result;
        
        // Find the first entry that belongs to passwords or subscriptions
        for (const result of results) {
          if (result.store === 'passwords' || result.store === 'subscriptions') {
            try {
              const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(result.data));
              const iv = CryptoService.base64ToUint8Array(result.iv);
              
              // Try to decrypt - if successful, key is valid
              await CryptoService.decrypt(encrypted, key, iv);
              resolve(true);
              return;
            } catch (error) {
              // Decryption failed - continue to next entry
              continue;
            }
          }
        }
        
        // No decryptable entries found
        resolve(false);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Get current KDF configuration from vault metadata
  async getKDFConfig(): Promise<CryptoKDFConfig | undefined> {
    const metadata = await this.getMetadata();
    if (!metadata?.kdfConfig) return undefined;
    
    return {
      algorithm: metadata.kdfConfig.algorithm,
      iterations: metadata.kdfConfig.iterations,
      hash: metadata.kdfConfig.hash,
    } as CryptoKDFConfig;
  }

  // Re-encrypt vault with new KDF configuration
  async reencryptVault(masterPassword: string, newKdfConfig: CryptoKDFConfig, onProgress?: (progress: number) => void): Promise<void> {
    if (!this.db || !this.encryptionKey) {
      throw new Error('Vault must be unlocked to re-encrypt');
    }

    onProgress?.(10);

    // Get current metadata and verify password
    const metadata = await this.getMetadata();
    if (!metadata) throw new Error('Vault metadata not found');

    onProgress?.(20);

    // Decrypt all existing data with current key
    const [passwords, subscriptions] = await Promise.all([
      this.getAllPasswords(),
      this.getAllSubscriptions(),
    ]);

    onProgress?.(40);

    // Generate new salt and derive new key with new KDF config
    const newSalt = CryptoService.generateSalt();
    const { key: newKey, timeMs } = await CryptoService.deriveKeyWithProgress(
      masterPassword, 
      newSalt, 
      newKdfConfig,
      (kdfProgress) => onProgress?.(40 + (kdfProgress * 0.3))
    );

    onProgress?.(70);

    // Set new encryption key for re-encrypting data
    const oldKey = this.encryptionKey;
    this.encryptionKey = newKey;

    // Re-encrypt all data with new key BEFORE updating metadata
    onProgress?.(75);

    try {
      // Re-encrypt all passwords and subscriptions with new key
      let itemsProcessed = 0;
      const totalItems = passwords.length + subscriptions.length;
      
      for (const password of passwords) {
        await this.savePassword(password);
        itemsProcessed++;
        onProgress?.(75 + (itemsProcessed / totalItems) * 20);
      }
      
      for (const subscription of subscriptions) {
        await this.saveSubscription(subscription);
        itemsProcessed++;
        onProgress?.(75 + (itemsProcessed / totalItems) * 20);
      }

      onProgress?.(95);

      // Create new password verification entry with new key
      await this.createPasswordVerificationEntry(newKey);

      // ONLY NOW update metadata atomically - this is the commit point
      const newMetadata: VaultMetadata = {
        ...metadata,
        encryptionSalt: CryptoService.uint8ArrayToBase64(newSalt),
        kdfConfig: {
          algorithm: newKdfConfig.algorithm as "PBKDF2",
          iterations: newKdfConfig.iterations,
          hash: newKdfConfig.hash as "SHA-256",
        },
        lastUnlocked: new Date(),
      };
      
      await this.saveMetadata(newMetadata);

      onProgress?.(100);
    } catch (error) {
      // Restore old key on any failure
      this.encryptionKey = oldKey;
      throw new Error(`Re-encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Bank Statements CRUD Operations
  async saveBankStatement(statement: BankStatement): Promise<void> {
    await this.encryptAndStore('bankStatements', statement);
  }

  async getBankStatement(id: string): Promise<BankStatement | null> {
    return this.decryptAndRetrieve('bankStatements', id);
  }

  async getAllBankStatements(): Promise<BankStatement[]> {
    return this.getAllEncrypted('bankStatements');
  }

  async deleteBankStatement(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['bankStatements'], 'readwrite');
    const store = transaction.objectStore('bankStatements');
    await store.delete(id);
  }

  // Bank Transactions CRUD Operations
  async saveBankTransaction(transaction: BankTransaction): Promise<void> {
    await this.encryptAndStore('bankTransactions', transaction);
  }

  async getBankTransaction(id: string): Promise<BankTransaction | null> {
    return this.decryptAndRetrieve('bankTransactions', id);
  }

  async getAllBankTransactions(): Promise<BankTransaction[]> {
    return this.getAllEncrypted('bankTransactions');
  }

  async deleteBankTransaction(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['bankTransactions'], 'readwrite');
    const store = transaction.objectStore('bankTransactions');
    await store.delete(id);
  }

  // Investments CRUD Operations
  async saveInvestment(investment: Investment): Promise<void> {
    await this.encryptAndStore('investments', investment);
  }

  async getInvestment(id: string): Promise<Investment | null> {
    return this.decryptAndRetrieve('investments', id);
  }

  async getAllInvestments(): Promise<Investment[]> {
    return this.getAllEncrypted('investments');
  }

  async deleteInvestment(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['investments'], 'readwrite');
    const store = transaction.objectStore('investments');
    await store.delete(id);
  }

  // Investment Goals CRUD Operations
  async saveInvestmentGoal(goal: InvestmentGoal): Promise<void> {
    await this.encryptAndStore('investmentGoals', goal);
  }

  async getInvestmentGoal(id: string): Promise<InvestmentGoal | null> {
    return this.decryptAndRetrieve('investmentGoals', id);
  }

  async getAllInvestmentGoals(): Promise<InvestmentGoal[]> {
    return this.getAllEncrypted('investmentGoals');
  }

  async deleteInvestmentGoal(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction(['investmentGoals'], 'readwrite');
    const store = transaction.objectStore('investmentGoals');
    await store.delete(id);
  }

  // Bank Statement CSV Import - Auto-detects multiple formats
  async importBankStatementsFromCSV(csvContent: string): Promise<{ statements: number; transactions: number }> {
    try {
      console.log('Storage: Starting CSV import with auto-detection...');
      
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row');
      }

      // Parse headers - handle quoted CSV values
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      console.log('Storage: CSV headers found:', headers);
      
      // Auto-detect column mappings for various bank formats
      const columnMappings = {
        date: headers.findIndex(h => /^(date|transaction.?date|posting.?date|value.?date|txn.?date)$/i.test(h)),
        description: headers.findIndex(h => /^(description|narration|particulars|details|memo|transaction.?description|remarks)$/i.test(h)),
        amount: headers.findIndex(h => /^(amount|transaction.?amount|txn.?amount|value)$/i.test(h)),
        debit: headers.findIndex(h => /^(debit|withdrawal|dr|debit.?amount|withdrawals)$/i.test(h)),
        credit: headers.findIndex(h => /^(credit|deposit|cr|credit.?amount|deposits)$/i.test(h)),
        balance: headers.findIndex(h => /^(balance|running.?balance|closing.?balance|available.?balance)$/i.test(h)),
        category: headers.findIndex(h => /^(category|type|transaction.?type)$/i.test(h)),
        reference: headers.findIndex(h => /^(reference|ref|cheque.?no|check.?no|transaction.?id|txn.?id)$/i.test(h)),
      };

      console.log('Storage: Auto-detected column mappings:', columnMappings);

      // Validate required columns
      if (columnMappings.date === -1) {
        throw new Error('Could not find date column. Please ensure your CSV has a Date column.');
      }
      if (columnMappings.description === -1) {
        throw new Error('Could not find description column. Please ensure your CSV has a Description/Narration column.');
      }
      if (columnMappings.amount === -1 && columnMappings.debit === -1 && columnMappings.credit === -1) {
        throw new Error('Could not find amount column. Please ensure your CSV has Amount, Debit, or Credit columns.');
      }

      const transactions: BankTransaction[] = [];
      const statementGroups: { [key: string]: BankTransaction[] } = {};

      // Auto-categorize based on description
      const autoCategory = (desc: string): { category: string; merchant: string } => {
        const descLower = desc.toLowerCase();
        
        // Income patterns
        if (/salary|payroll|wage|income|deposit|credit/i.test(descLower)) {
          return { category: 'Income', merchant: desc.split(' ')[0] };
        }
        // Food & Dining
        if (/restaurant|food|cafe|coffee|starbucks|mcdonald|pizza|uber.?eats|zomato|swiggy/i.test(descLower)) {
          return { category: 'Food & Dining', merchant: desc.split(' ')[0] };
        }
        // Shopping
        if (/amazon|flipkart|walmart|target|shopping|store|mart/i.test(descLower)) {
          return { category: 'Shopping', merchant: desc.split(' ')[0] };
        }
        // Transportation
        if (/uber|lyft|ola|fuel|gas|petrol|metro|taxi|transport/i.test(descLower)) {
          return { category: 'Transportation', merchant: desc.split(' ')[0] };
        }
        // Bills & Utilities
        if (/electric|water|gas|internet|phone|mobile|utility|bill|rent/i.test(descLower)) {
          return { category: 'Bills & Utilities', merchant: desc.split(' ')[0] };
        }
        // Entertainment
        if (/netflix|spotify|amazon.?prime|disney|hbo|movie|theatre|gaming/i.test(descLower)) {
          return { category: 'Entertainment', merchant: desc.split(' ')[0] };
        }
        // Healthcare
        if (/hospital|medical|pharmacy|doctor|health|medicine/i.test(descLower)) {
          return { category: 'Healthcare', merchant: desc.split(' ')[0] };
        }
        // Travel
        if (/airline|flight|hotel|booking|travel|airbnb/i.test(descLower)) {
          return { category: 'Travel', merchant: desc.split(' ')[0] };
        }
        // ATM/Cash
        if (/atm|cash|withdraw/i.test(descLower)) {
          return { category: 'Cash & ATM', merchant: 'ATM' };
        }
        // Transfer
        if (/transfer|upi|neft|imps|rtgs/i.test(descLower)) {
          return { category: 'Transfer', merchant: desc.split(' ')[0] };
        }
        
        return { category: 'Other', merchant: desc.split(' ')[0] || 'Unknown' };
      };

      // Parse transactions
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length < 2) continue;

        try {
          // Parse date
          const dateStr = values[columnMappings.date] || '';
          let parsedDate = new Date(dateStr);
          // Try different date formats
          if (isNaN(parsedDate.getTime())) {
            // Try DD/MM/YYYY or DD-MM-YYYY
            const parts = dateStr.split(/[\/\-]/);
            if (parts.length === 3) {
              parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
          }
          if (isNaN(parsedDate.getTime())) {
            console.warn(`Skipping line ${i + 1}: Invalid date "${dateStr}"`);
            continue;
          }

          // Parse amount - handle debit/credit columns or single amount column
          let amount = 0;
          let transactionType: 'debit' | 'credit' = 'debit';
          
          if (columnMappings.debit !== -1 && columnMappings.credit !== -1) {
            const debitVal = parseFloat((values[columnMappings.debit] || '0').replace(/[^0-9.\-]/g, '')) || 0;
            const creditVal = parseFloat((values[columnMappings.credit] || '0').replace(/[^0-9.\-]/g, '')) || 0;
            if (creditVal > 0) {
              amount = creditVal;
              transactionType = 'credit';
            } else {
              amount = -Math.abs(debitVal);
              transactionType = 'debit';
            }
          } else if (columnMappings.amount !== -1) {
            amount = parseFloat((values[columnMappings.amount] || '0').replace(/[^0-9.\-]/g, '')) || 0;
            transactionType = amount >= 0 ? 'credit' : 'debit';
          }

          const description = values[columnMappings.description] || 'Unknown Transaction';
          const { category, merchant } = autoCategory(description);
          const balance = columnMappings.balance !== -1 
            ? parseFloat((values[columnMappings.balance] || '0').replace(/[^0-9.\-]/g, '')) || 0 
            : 0;

          const transaction: BankTransaction = {
            id: crypto.randomUUID(),
            statementId: `stmt-${Math.floor(i / 100) + 1}`,
            date: parsedDate,
            description: description,
            amount: amount,
            currency: 'USD',
            category: values[columnMappings.category] || category,
            subcategory: '',
            merchant: merchant,
            account: 'Imported Account',
            transactionType: transactionType,
            balance: balance,
            isRecurring: false,
            tags: [category.toLowerCase().replace(/\s+/g, '_')],
            createdAt: new Date(),
            updatedAt: new Date()
          };

          transactions.push(transaction);

          if (!statementGroups[transaction.statementId]) {
            statementGroups[transaction.statementId] = [];
          }
          statementGroups[transaction.statementId].push(transaction);
        } catch (error) {
          console.warn(`Skipping line ${i + 1}: ${error instanceof Error ? error.message : 'Invalid data'}`);
          continue;
        }
      }

      // Create bank statements from transaction groups
      const statements: BankStatement[] = [];
      Object.entries(statementGroups).forEach(([statementId, txns]) => {
        const sortedTxns = txns.sort((a, b) => a.date.getTime() - b.date.getTime());
        const startDate = sortedTxns[0].date;
        const endDate = sortedTxns[sortedTxns.length - 1].date;
        const openingBalance = (sortedTxns[0]?.balance || 0) - (sortedTxns[0]?.amount || 0);
        const closingBalance = sortedTxns[sortedTxns.length - 1]?.balance || 0;

        const statement: BankStatement = {
          id: statementId,
          bankName: 'Imported Bank',
          accountName: 'Imported Account',
          accountNumber: `****${statementId.split('-')[1]}`,
          statementPeriod: {
            startDate: startDate,
            endDate: endDate
          },
          currency: 'USD',
          openingBalance: openingBalance,
          closingBalance: closingBalance,
          totalCredits: sortedTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
          totalDebits: Math.abs(sortedTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
          transactionCount: sortedTxns.length,
          fileName: `imported-${statementId}.csv`,
          fileType: 'csv',
          importDate: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        statements.push(statement);
      });

      // Save all data
      console.log('Storage: Saving data to database...');
      console.log('Storage: Statements to save:', statements.length);
      console.log('Storage: Transactions to save:', transactions.length);
      
      for (const statement of statements) {
        await this.saveBankStatement(statement);
      }

      for (const transaction of transactions) {
        await this.saveBankTransaction(transaction);
      }

      console.log('Storage: Data saved successfully');
      return {
        statements: statements.length,
        transactions: transactions.length
      };
    } catch (error) {
      console.error('Storage: Import failed:', error);
      // Return empty result instead of throwing
      return { statements: 0, transactions: 0 };
    }
  }
}

export const vaultStorage = new VaultStorage();
