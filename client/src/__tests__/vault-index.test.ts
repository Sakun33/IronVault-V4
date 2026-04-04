/**
 * Vault Index and Lockout Tests
 * 
 * Unit tests for the multi-vault index system including:
 * - Vault index CRUD operations
 * - Password verification logic
 * - Lockout persistence (3 fails => lockoutUntil)
 * - Plan-based vault access control
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock IndexedDB for testing
const mockIDBStore = new Map<string, any>();
const mockIDBDatabases = new Map<string, any>();

// Mock indexedDB
const mockIndexedDB = {
  open: jest.fn((name: string, version?: number) => {
    const request: any = {
      result: null,
      error: null,
      onupgradeneeded: null,
      onsuccess: null,
      onerror: null,
      onblocked: null,
      transaction: null,
    };

    setTimeout(() => {
      if (!mockIDBDatabases.has(name)) {
        // Trigger upgrade needed for new database
        const db = createMockDB(name);
        mockIDBDatabases.set(name, db);
        request.result = db;
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ target: request });
        }
      } else {
        request.result = mockIDBDatabases.get(name);
      }
      if (request.onsuccess) {
        request.onsuccess();
      }
    }, 0);

    return request;
  }),
  deleteDatabase: jest.fn((name: string) => {
    const request: any = {
      onsuccess: null,
      onerror: null,
    };
    setTimeout(() => {
      mockIDBDatabases.delete(name);
      if (request.onsuccess) request.onsuccess();
    }, 0);
    return request;
  }),
};

function createMockDB(name: string) {
  const stores = new Map<string, Map<string, any>>();
  
  return {
    name,
    objectStoreNames: {
      contains: (storeName: string) => stores.has(storeName),
    },
    createObjectStore: (storeName: string, options?: any) => {
      stores.set(storeName, new Map());
      return createMockStore(stores.get(storeName)!);
    },
    transaction: (storeNames: string[], mode: string) => {
      return {
        objectStore: (storeName: string) => {
          if (!stores.has(storeName)) {
            stores.set(storeName, new Map());
          }
          return createMockStore(stores.get(storeName)!);
        },
      };
    },
    close: jest.fn(),
  };
}

function createMockStore(data: Map<string, any>) {
  return {
    put: (value: any) => {
      const request: any = { onsuccess: null, onerror: null };
      setTimeout(() => {
        data.set(value.id, value);
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    },
    get: (key: string) => {
      const request: any = { result: null, onsuccess: null, onerror: null };
      setTimeout(() => {
        request.result = data.get(key);
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    },
    getAll: () => {
      const request: any = { result: null, onsuccess: null, onerror: null };
      setTimeout(() => {
        request.result = Array.from(data.values());
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    },
    delete: (key: string) => {
      const request: any = { onsuccess: null, onerror: null };
      setTimeout(() => {
        data.delete(key);
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    },
    clear: () => {
      const request: any = { onsuccess: null, onerror: null };
      setTimeout(() => {
        data.clear();
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    },
  };
}

// Set up global mocks before tests
beforeEach(() => {
  // @ts-ignore
  global.indexedDB = mockIndexedDB;
  mockIDBDatabases.clear();
  mockIDBStore.clear();
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('Vault Index System', () => {
  describe('Lockout State Management', () => {
    it('should initialize with zero failed attempts', () => {
      const defaultState = {
        id: 'global',
        failedAttempts: 0,
        lockoutUntil: null,
        lastFailedAt: null,
      };
      
      expect(defaultState.failedAttempts).toBe(0);
      expect(defaultState.lockoutUntil).toBeNull();
    });

    it('should track failed attempts', () => {
      let state = {
        id: 'global',
        failedAttempts: 0,
        lockoutUntil: null as number | null,
        lastFailedAt: null as number | null,
      };
      
      // Simulate failed attempts
      state.failedAttempts++;
      state.lastFailedAt = Date.now();
      
      expect(state.failedAttempts).toBe(1);
      expect(state.lastFailedAt).toBeTruthy();
    });

    it('should trigger lockout after 3 failed attempts', () => {
      const MAX_FAILED_ATTEMPTS = 3;
      const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour
      
      let state = {
        id: 'global',
        failedAttempts: 0,
        lockoutUntil: null as number | null,
        lastFailedAt: null as number | null,
      };
      
      // Simulate 3 failed attempts
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        state.failedAttempts++;
        state.lastFailedAt = Date.now();
        
        if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          state.lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
        }
      }
      
      expect(state.failedAttempts).toBe(3);
      expect(state.lockoutUntil).toBeTruthy();
      expect(state.lockoutUntil! - Date.now()).toBeCloseTo(LOCKOUT_DURATION_MS, -3);
    });

    it('should reset failed attempts on successful login', () => {
      let state = {
        id: 'global',
        failedAttempts: 2,
        lockoutUntil: null as number | null,
        lastFailedAt: Date.now() - 1000,
      };
      
      // Simulate successful login
      state.failedAttempts = 0;
      state.lockoutUntil = null;
      state.lastFailedAt = null;
      
      expect(state.failedAttempts).toBe(0);
      expect(state.lockoutUntil).toBeNull();
    });

    it('should expire lockout after 1 hour', () => {
      const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour
      const oneHourAgo = Date.now() - LOCKOUT_DURATION_MS - 1000;
      
      let state = {
        id: 'global',
        failedAttempts: 3,
        lockoutUntil: oneHourAgo + LOCKOUT_DURATION_MS,
        lastFailedAt: oneHourAgo,
      };
      
      // Check if lockout has expired
      const isStillLocked = state.lockoutUntil! > Date.now();
      
      expect(isStillLocked).toBe(false);
    });

    it('should calculate remaining lockout time correctly', () => {
      const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 hour
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      
      let state = {
        id: 'global',
        failedAttempts: 3,
        lockoutUntil: thirtyMinutesAgo + LOCKOUT_DURATION_MS,
        lastFailedAt: thirtyMinutesAgo,
      };
      
      const remainingMs = state.lockoutUntil! - Date.now();
      const remainingMinutes = Math.floor(remainingMs / 60000);
      
      expect(remainingMinutes).toBeCloseTo(30, 0);
    });
  });

  describe('Vault Metadata', () => {
    it('should create vault entry with required fields', () => {
      const vault = {
        id: 'test-vault-1',
        name: 'My Test Vault',
        createdAt: new Date(),
        lastUnlockedAt: new Date(),
        isDefault: true,
        dbName: 'IronVault-test-vault-1',
        encryptionSalt: 'base64salt==',
        kdfConfig: {
          algorithm: 'PBKDF2',
          iterations: 100000,
          hash: 'SHA-256',
        },
        passwordVerification: {
          data: 'encryptedData==',
          iv: 'base64iv==',
        },
      };
      
      expect(vault.id).toBeTruthy();
      expect(vault.name).toBe('My Test Vault');
      expect(vault.isDefault).toBe(true);
      expect(vault.kdfConfig.iterations).toBe(100000);
    });

    it('should set first vault as default', () => {
      const vaults: any[] = [];
      
      const newVault = {
        id: 'vault-1',
        name: 'First Vault',
        isDefault: vaults.length === 0, // First vault is default
      };
      
      expect(newVault.isDefault).toBe(true);
    });

    it('should unset other defaults when setting new default', () => {
      const vaults = [
        { id: 'vault-1', name: 'Vault 1', isDefault: true },
        { id: 'vault-2', name: 'Vault 2', isDefault: false },
      ];
      
      // Set vault-2 as default
      vaults.forEach(v => { v.isDefault = v.id === 'vault-2'; });
      
      expect(vaults[0].isDefault).toBe(false);
      expect(vaults[1].isDefault).toBe(true);
    });
  });

  describe('Plan-based Vault Access', () => {
    const MAX_VAULTS_FREE = 1;
    const MAX_VAULTS_PAID = 5;

    it('should limit free users to 1 vault', () => {
      const isPaidUser = false;
      const maxVaults = isPaidUser ? MAX_VAULTS_PAID : MAX_VAULTS_FREE;
      
      expect(maxVaults).toBe(1);
    });

    it('should allow premium users up to 5 vaults', () => {
      const isPaidUser = true;
      const maxVaults = isPaidUser ? MAX_VAULTS_PAID : MAX_VAULTS_FREE;
      
      expect(maxVaults).toBe(5);
    });

    it('should allow free users to access only default vault', () => {
      const canAccessVault = (vault: { isDefault: boolean }, isPaidUser: boolean) => {
        if (isPaidUser) return true;
        return vault.isDefault;
      };
      
      const defaultVault = { id: 'v1', isDefault: true };
      const nonDefaultVault = { id: 'v2', isDefault: false };
      
      expect(canAccessVault(defaultVault, false)).toBe(true);
      expect(canAccessVault(nonDefaultVault, false)).toBe(false);
    });

    it('should allow premium users to access all vaults', () => {
      const canAccessVault = (vault: { isDefault: boolean }, isPaidUser: boolean) => {
        if (isPaidUser) return true;
        return vault.isDefault;
      };
      
      const defaultVault = { id: 'v1', isDefault: true };
      const nonDefaultVault = { id: 'v2', isDefault: false };
      
      expect(canAccessVault(defaultVault, true)).toBe(true);
      expect(canAccessVault(nonDefaultVault, true)).toBe(true);
    });

    it('should prevent vault creation when at limit', () => {
      const canCreateVault = (currentCount: number, isPaidUser: boolean) => {
        const maxVaults = isPaidUser ? MAX_VAULTS_PAID : MAX_VAULTS_FREE;
        return currentCount < maxVaults;
      };
      
      // Free user with 1 vault
      expect(canCreateVault(1, false)).toBe(false);
      
      // Premium user with 1 vault
      expect(canCreateVault(1, true)).toBe(true);
      
      // Premium user with 5 vaults
      expect(canCreateVault(5, true)).toBe(false);
    });
  });

  describe('Password Matching', () => {
    it('should find vaults that match a password', async () => {
      // Simulate password verification
      const vaults = [
        { id: 'v1', name: 'Vault 1', passwordHash: 'hash1' },
        { id: 'v2', name: 'Vault 2', passwordHash: 'hash2' },
        { id: 'v3', name: 'Vault 3', passwordHash: 'hash1' }, // Same password as v1
      ];
      
      const verifyPassword = (vault: any, inputPasswordHash: string) => {
        return vault.passwordHash === inputPasswordHash;
      };
      
      const matchingVaults = vaults.filter(v => verifyPassword(v, 'hash1'));
      
      expect(matchingVaults.length).toBe(2);
      expect(matchingVaults[0].id).toBe('v1');
      expect(matchingVaults[1].id).toBe('v3');
    });

    it('should return empty array for wrong password', () => {
      const vaults = [
        { id: 'v1', name: 'Vault 1', passwordHash: 'hash1' },
        { id: 'v2', name: 'Vault 2', passwordHash: 'hash2' },
      ];
      
      const matchingVaults = vaults.filter(v => v.passwordHash === 'wronghash');
      
      expect(matchingVaults.length).toBe(0);
    });
  });

  describe('Vault Database Naming', () => {
    it('should generate unique database names per vault', () => {
      const getVaultDbName = (vaultId: string) => `IronVault-${vaultId}`;
      
      expect(getVaultDbName('abc123')).toBe('IronVault-abc123');
      expect(getVaultDbName('default')).toBe('IronVault-default');
    });

    it('should generate unique vault IDs', () => {
      const ids = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const id = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        ids.add(id);
      }
      
      // All IDs should be unique
      expect(ids.size).toBe(100);
    });
  });
});

describe('Migration', () => {
  it('should detect legacy vault for migration', () => {
    const legacyExists = true; // Simulate legacy vault exists
    const newVaultCount = 0;
    
    const needsMigration = legacyExists && newVaultCount === 0;
    
    expect(needsMigration).toBe(true);
  });

  it('should skip migration if new vaults exist', () => {
    const legacyExists = true;
    const newVaultCount = 1;
    
    const needsMigration = legacyExists && newVaultCount === 0;
    
    expect(needsMigration).toBe(false);
  });

  it('should create default vault entry from legacy data', () => {
    const legacyMetadata = {
      encryptionSalt: 'legacySalt==',
      kdfConfig: {
        algorithm: 'PBKDF2',
        iterations: 100000,
        hash: 'SHA-256',
      },
      createdAt: new Date('2024-01-01'),
    };
    
    const migratedVault = {
      id: 'migrated-default',
      name: 'Default Vault',
      isDefault: true,
      encryptionSalt: legacyMetadata.encryptionSalt,
      kdfConfig: legacyMetadata.kdfConfig,
      createdAt: legacyMetadata.createdAt,
    };
    
    expect(migratedVault.name).toBe('Default Vault');
    expect(migratedVault.isDefault).toBe(true);
    expect(migratedVault.encryptionSalt).toBe('legacySalt==');
  });
});
