/**
 * Local Vault Store for Autofill Entries
 * 
 * IndexedDB wrapper for storing encrypted autofill entries.
 * All data is encrypted client-side before storage.
 */

import { VaultEntry } from './vault-autofill-crypto';

const DB_NAME = 'IronVaultAutofillVault';
const DB_VERSION = 1;
const STORE_NAME = 'autofillEntries';
const NEVER_DOMAINS_STORE = 'neverForDomains';

export interface VaultFilter {
  domain?: string;
  type?: VaultEntry['type'];
  tags?: string[];
  searchQuery?: string;
}

export class LocalVaultStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open autofill vault database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create autofill entries store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('domain', 'domain', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('lastUsed', 'lastUsed', { unique: false });
        }

        // Create never-for-domains store
        if (!db.objectStoreNames.contains(NEVER_DOMAINS_STORE)) {
          db.createObjectStore(NEVER_DOMAINS_STORE, { keyPath: 'domain' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * Save a vault entry
   * @param entry - The vault entry to save
   */
  async saveEntry(entry: VaultEntry): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save vault entry'));
    });
  }

  /**
   * Fetch vault entries based on filter
   * @param filter - Optional filter criteria
   * @returns Array of matching vault entries
   */
  async fetchEntries(filter?: VaultFilter): Promise<VaultEntry[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let entries = request.result as VaultEntry[];
        
        // Apply filters
        if (filter) {
          if (filter.domain) {
            entries = entries.filter(e => e.domain === filter.domain);
          }
          if (filter.type) {
            entries = entries.filter(e => e.type === filter.type);
          }
          if (filter.tags && filter.tags.length > 0) {
            entries = entries.filter(e => 
              e.tags?.some(tag => filter.tags!.includes(tag))
            );
          }
          if (filter.searchQuery) {
            const query = filter.searchQuery.toLowerCase();
            entries = entries.filter(e => 
              e.title.toLowerCase().includes(query) ||
              e.domain.toLowerCase().includes(query) ||
              e.username?.toLowerCase().includes(query)
            );
          }
        }
        
        // Sort by last used, then by creation date
        entries.sort((a, b) => {
          if (a.lastUsed && b.lastUsed) {
            return b.lastUsed.getTime() - a.lastUsed.getTime();
          }
          if (a.lastUsed) return -1;
          if (b.lastUsed) return 1;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        
        resolve(entries);
      };

      request.onerror = () => reject(new Error('Failed to fetch vault entries'));
    });
  }

  /**
   * Get a vault entry by ID
   * @param id - Entry ID
   * @returns Vault entry or null if not found
   */
  async getEntryById(id: string): Promise<VaultEntry | null> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get vault entry'));
    });
  }

  /**
   * Update last used timestamp for an entry
   * @param id - Entry ID
   */
  async updateLastUsed(id: string): Promise<void> {
    const entry = await this.getEntryById(id);
    if (!entry) return;
    
    entry.lastUsed = new Date();
    entry.updatedAt = new Date();
    
    await this.saveEntry(entry);
  }

  /**
   * Delete a vault entry
   * @param id - Entry ID
   */
  async deleteEntry(id: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete vault entry'));
    });
  }

  /**
   * Mark a domain to never show autofill prompts
   * @param domain - Domain to add to never list
   */
  async markNever(domain: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NEVER_DOMAINS_STORE], 'readwrite');
      const store = transaction.objectStore(NEVER_DOMAINS_STORE);
      const request = store.put({ domain, addedAt: new Date() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to mark domain'));
    });
  }

  /**
   * Check if a domain is in the never list
   * @param domain - Domain to check
   * @returns True if domain is in never list
   */
  async isNeverForDomain(domain: string): Promise<boolean> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NEVER_DOMAINS_STORE], 'readonly');
      const store = transaction.objectStore(NEVER_DOMAINS_STORE);
      const request = store.get(domain);

      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(new Error('Failed to check never domain'));
    });
  }

  /**
   * Remove a domain from the never list
   * @param domain - Domain to remove
   */
  async removeNever(domain: string): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NEVER_DOMAINS_STORE], 'readwrite');
      const store = transaction.objectStore(NEVER_DOMAINS_STORE);
      const request = store.delete(domain);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to remove never domain'));
    });
  }

  /**
   * Get all never domains
   * @returns Array of domains
   */
  async getNeverDomains(): Promise<string[]> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([NEVER_DOMAINS_STORE], 'readonly');
      const store = transaction.objectStore(NEVER_DOMAINS_STORE);
      const request = store.getAllKeys();

      request.onsuccess = () => resolve(request.result as string[]);
      request.onerror = () => reject(new Error('Failed to get never domains'));
    });
  }

  /**
   * Get count of vault entries
   * @returns Total number of entries
   */
  async getCount(): Promise<number> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count entries'));
    });
  }

  /**
   * Clear all vault entries (for testing or reset)
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME, NEVER_DOMAINS_STORE], 'readwrite');
      
      const entriesStore = transaction.objectStore(STORE_NAME);
      const neverStore = transaction.objectStore(NEVER_DOMAINS_STORE);
      
      entriesStore.clear();
      neverStore.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to clear vault'));
    });
  }
}

// Singleton instance
export const localVaultStore = new LocalVaultStore();

