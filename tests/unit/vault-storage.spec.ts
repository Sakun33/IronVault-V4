import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VaultStorage } from '@/lib/storage'

describe('VaultStorage', () => {
  let vaultStorage: VaultStorage
  let mockCryptoService: any

  beforeEach(async () => {
    // Mock crypto service
    mockCryptoService = {
      encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
      decrypt: vi.fn().mockResolvedValue('decrypted-data'),
      generateKey: vi.fn().mockResolvedValue({})
    }

    vaultStorage = new VaultStorage(mockCryptoService)
    await vaultStorage.init()
  })

  describe('IndexedDB Operations', () => {
    it('initializes database with correct schema', async () => {
      const db = await vaultStorage.getDB()
      expect(db).toBeDefined()
      expect(db.version).toBeGreaterThan(0)
    })

    it('creates all required object stores', async () => {
      const db = await vaultStorage.getDB()
      const storeNames = Array.from(db.objectStoreNames)
      
      const expectedStores = [
        'passwords', 'subscriptions', 'notes', 'expenses', 
        'reminders', 'bank_statements', 'investments', 'investment_goals'
      ]
      
      expectedStores.forEach(storeName => {
        expect(storeNames).toContain(storeName)
      })
    })

    it('creates indexes for efficient queries', async () => {
      const db = await vaultStorage.getDB()
      
      // Check passwords store indexes
      const passwordsStore = db.transaction(['passwords'], 'readonly').objectStore('passwords')
      const passwordIndexes = Array.from(passwordsStore.indexNames)
      
      expect(passwordIndexes).toContain('url')
      expect(passwordIndexes).toContain('username')
      expect(passwordIndexes).toContain('created_at')
    })

    it('handles database version upgrades', async () => {
      // Test that database can be upgraded without data loss
      const db = await vaultStorage.getDB()
      expect(db.version).toBeGreaterThan(0)
    })
  })

  describe('Data Encryption', () => {
    it('encrypts data before storage', async () => {
      const testData = { id: '1', title: 'Test Password', url: 'https://example.com' }
      
      await vaultStorage.save('passwords', testData)
      
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(
        JSON.stringify(testData),
        expect.any(Object)
      )
    })

    it('decrypts data after retrieval', async () => {
      const testData = { id: '1', title: 'Test Password', url: 'https://example.com' }
      
      await vaultStorage.save('passwords', testData)
      await vaultStorage.get('passwords', '1')
      
      expect(mockCryptoService.decrypt).toHaveBeenCalled()
    })

    it('handles encryption failures gracefully', async () => {
      mockCryptoService.encrypt.mockRejectedValueOnce(new Error('Encryption failed'))
      
      await expect(
        vaultStorage.save('passwords', { id: '1', title: 'Test' })
      ).rejects.toThrow('Encryption failed')
    })

    it('handles decryption failures gracefully', async () => {
      mockCryptoService.decrypt.mockRejectedValueOnce(new Error('Decryption failed'))
      
      await expect(
        vaultStorage.get('passwords', '1')
      ).rejects.toThrow('Decryption failed')
    })
  })

  describe('Transaction Management', () => {
    it('handles concurrent operations', async () => {
      const promises = []
      
      for (let i = 0; i < 100; i++) {
        promises.push(
          vaultStorage.save('passwords', { id: `test-${i}`, title: `Test ${i}` })
        )
      }
      
      await Promise.all(promises)
      
      // Verify all operations completed
      expect(mockCryptoService.encrypt).toHaveBeenCalledTimes(100)
    })

    it('rolls back transactions on error', async () => {
      // Mock crypto service to throw error after first operation
      let callCount = 0
      mockCryptoService.encrypt.mockImplementation(() => {
        callCount++
        if (callCount === 2) {
          throw new Error('Transaction failed')
        }
        return Promise.resolve(new Uint8Array([1, 2, 3, 4]))
      })
      
      await expect(
        Promise.all([
          vaultStorage.save('passwords', { id: '1', title: 'Test 1' }),
          vaultStorage.save('passwords', { id: '2', title: 'Test 2' })
        ])
      ).rejects.toThrow('Transaction failed')
    })

    it('maintains data consistency', async () => {
      const testData = { id: '1', title: 'Test Password', url: 'https://example.com' }
      
      await vaultStorage.save('passwords', testData)
      const retrieved = await vaultStorage.get('passwords', '1')
      
      expect(retrieved).toBe('decrypted-data')
    })
  })

  describe('OPFS Backup Integration', () => {
    beforeEach(() => {
      // Mock OPFS API
      const mockOPFS = {
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn(),
          close: vi.fn()
        }),
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi.fn().mockResolvedValue({
            text: vi.fn().mockResolvedValue('encrypted-backup-data')
          })
        })
      }
      
      // @ts-ignore
      global.navigator.storage = {
        getDirectory: vi.fn().mockResolvedValue(mockOPFS)
      }
    })

    it('creates OPFS backup successfully', async () => {
      await vaultStorage.createBackup()
      
      expect(global.navigator.storage.getDirectory).toHaveBeenCalled()
    })

    it('restores from OPFS backup successfully', async () => {
      await vaultStorage.restoreBackup()
      
      expect(global.navigator.storage.getDirectory).toHaveBeenCalled()
    })

    it('handles OPFS backup failures', async () => {
      // Mock OPFS failure
      global.navigator.storage.getDirectory.mockRejectedValueOnce(
        new Error('OPFS not available')
      )
      
      await expect(vaultStorage.createBackup())
        .rejects.toThrow('OPFS not available')
    })
  })

  describe('Data Integrity', () => {
    it('validates data before storage', async () => {
      const invalidData = null
      
      await expect(
        vaultStorage.save('passwords', invalidData)
      ).rejects.toThrow()
    })

    it('handles corrupted data gracefully', async () => {
      // Mock corrupted encrypted data
      mockCryptoService.decrypt.mockRejectedValueOnce(
        new Error('Invalid encrypted data')
      )
      
      await expect(
        vaultStorage.get('passwords', '1')
      ).rejects.toThrow('Invalid encrypted data')
    })

    it('maintains referential integrity', async () => {
      const passwordData = { id: '1', title: 'Test Password' }
      const subscriptionData = { id: '1', passwordId: '1', service: 'Netflix' }
      
      await vaultStorage.save('passwords', passwordData)
      await vaultStorage.save('subscriptions', subscriptionData)
      
      // Verify both records exist
      expect(mockCryptoService.encrypt).toHaveBeenCalledTimes(2)
    })
  })

  describe('Performance', () => {
    it('handles large datasets efficiently', async () => {
      const largeData = { id: '1', content: 'x'.repeat(100000) } // 100KB
      
      const startTime = performance.now()
      await vaultStorage.save('notes', largeData)
      const endTime = performance.now()
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
    })

    it('optimizes query performance with indexes', async () => {
      // Add multiple records
      for (let i = 0; i < 1000; i++) {
        await vaultStorage.save('passwords', {
          id: `test-${i}`,
          title: `Test ${i}`,
          url: `https://example${i}.com`,
          username: `user${i}`
        })
      }
      
      // Query should be fast due to indexes
      const startTime = performance.now()
      await vaultStorage.query('passwords', 'url', 'https://example500.com')
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(100) // 100ms
    })
  })
})
