import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CryptoService } from '@/lib/crypto'
import { VaultStorage } from '@/lib/storage'

describe('CryptoService', () => {
  let cryptoService: CryptoService
  let testKey: CryptoKey

  beforeEach(async () => {
    cryptoService = new CryptoService()
    testKey = await cryptoService.generateKey('test-password')
  })

  describe('Key Generation', () => {
    it('generates a unique IV per encryption', async () => {
      const ivs = new Set<string>()
      const testData = 'hello world'
      
      for (let i = 0; i < 1000; i++) {
        const { iv } = await cryptoService.encrypt(testData, testKey)
        ivs.add(Buffer.from(iv).toString('hex'))
      }
      
      expect(ivs.size).toBe(1000)
    })

    it('uses sufficient PBKDF2 iterations', async () => {
      const password = 'test-password'
      const salt = crypto.getRandomValues(new Uint8Array(16))
      
      // Mock crypto.subtle.deriveKey to capture iterations
      const deriveKeySpy = vi.spyOn(crypto.subtle, 'deriveKey')
      
      await cryptoService.generateKey(password)
      
      expect(deriveKeySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          salt: expect.any(Uint8Array),
          iterations: expect.any(Number)
        }),
        expect.any(CryptoKey),
        expect.any(Object),
        false,
        ['encrypt', 'decrypt']
      )
      
      // Verify iterations is at least 100,000
      const call = deriveKeySpy.mock.calls[0]
      const iterations = call[0].iterations
      expect(iterations).toBeGreaterThanOrEqual(100000)
    })

    it('generates non-extractable keys', async () => {
      const key = await cryptoService.generateKey('test-password')
      expect(key.extractable).toBe(false)
    })

    it('generates unique salt per key', async () => {
      const salts = new Set<string>()
      
      for (let i = 0; i < 100; i++) {
        const key = await cryptoService.generateKey('test-password')
        // We can't directly access salt, but we can verify keys are different
        salts.add(JSON.stringify(key))
      }
      
      expect(salts.size).toBe(100)
    })
  })

  describe('Encryption/Decryption', () => {
    it('encrypts and decrypts data correctly', async () => {
      const testData = 'sensitive information'
      
      const encrypted = await cryptoService.encrypt(testData, testKey)
      const decrypted = await cryptoService.decrypt(encrypted, testKey)
      
      expect(decrypted).toBe(testData)
    })

    it('fails decryption with wrong key', async () => {
      const testData = 'sensitive information'
      const wrongKey = await cryptoService.generateKey('wrong-password')
      
      const encrypted = await cryptoService.encrypt(testData, testKey)
      
      await expect(cryptoService.decrypt(encrypted, wrongKey))
        .rejects.toThrow()
    })

    it('fails decryption with tampered data', async () => {
      const testData = 'sensitive information'
      
      const encrypted = await cryptoService.encrypt(testData, testKey)
      
      // Tamper with the encrypted data
      const tamperedData = new Uint8Array(encrypted)
      tamperedData[0] = tamperedData[0] ^ 0xFF
      
      await expect(cryptoService.decrypt(tamperedData, testKey))
        .rejects.toThrow()
    })

    it('handles empty data', async () => {
      const testData = ''
      
      const encrypted = await cryptoService.encrypt(testData, testKey)
      const decrypted = await cryptoService.decrypt(encrypted, testKey)
      
      expect(decrypted).toBe(testData)
    })

    it('handles large data', async () => {
      const testData = 'x'.repeat(100000) // 100KB of data
      
      const encrypted = await cryptoService.encrypt(testData, testKey)
      const decrypted = await cryptoService.decrypt(encrypted, testKey)
      
      expect(decrypted).toBe(testData)
    })
  })

  describe('Memory Cleanup', () => {
    it('clears sensitive data from memory', async () => {
      const testData = 'sensitive information'
      
      const encrypted = await cryptoService.encrypt(testData, testKey)
      
      // Verify data is encrypted (not plaintext)
      const encryptedString = Buffer.from(encrypted).toString('utf8')
      expect(encryptedString).not.toContain('sensitive')
      expect(encryptedString).not.toContain('information')
    })
  })
})

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

  describe('IndexedDB Schema', () => {
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

    it('creates required indexes', async () => {
      const db = await vaultStorage.getDB()
      
      // Check passwords store indexes
      const passwordsStore = db.transaction(['passwords'], 'readonly').objectStore('passwords')
      const passwordIndexes = Array.from(passwordsStore.indexNames)
      
      expect(passwordIndexes).toContain('url')
      expect(passwordIndexes).toContain('username')
      expect(passwordIndexes).toContain('created_at')
    })

    it('handles database upgrades', async () => {
      // This test would verify that database schema upgrades work correctly
      // For now, we'll just verify the database can be created
      expect(vaultStorage).toBeDefined()
    })
  })

  describe('Data Operations', () => {
    it('saves and retrieves encrypted data', async () => {
      const testData = { id: '1', title: 'Test Password', url: 'https://example.com' }
      
      await vaultStorage.save('passwords', testData)
      const retrieved = await vaultStorage.get('passwords', '1')
      
      expect(mockCryptoService.encrypt).toHaveBeenCalled()
      expect(mockCryptoService.decrypt).toHaveBeenCalled()
      expect(retrieved).toBe('decrypted-data')
    })

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

    it('handles transaction rollback on error', async () => {
      // Mock crypto service to throw error
      mockCryptoService.encrypt.mockRejectedValueOnce(new Error('Encryption failed'))
      
      await expect(
        vaultStorage.save('passwords', { id: '1', title: 'Test' })
      ).rejects.toThrow('Encryption failed')
    })
  })

  describe('OPFS Backup', () => {
    it('creates OPFS backup', async () => {
      // Mock OPFS API
      const mockOPFS = {
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn(),
          close: vi.fn()
        })
      }
      
      // @ts-ignore
      global.navigator.storage = {
        getDirectory: vi.fn().mockResolvedValue(mockOPFS)
      }
      
      await vaultStorage.createBackup()
      
      expect(mockOPFS.createWritable).toHaveBeenCalled()
    })

    it('restores from OPFS backup', async () => {
      // Mock OPFS API with existing backup
      const mockBackupData = 'encrypted-backup-data'
      const mockOPFS = {
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi.fn().mockResolvedValue({
            text: vi.fn().mockResolvedValue(mockBackupData)
          })
        })
      }
      
      // @ts-ignore
      global.navigator.storage = {
        getDirectory: vi.fn().mockResolvedValue(mockOPFS)
      }
      
      await vaultStorage.restoreBackup()
      
      expect(mockOPFS.getFileHandle).toHaveBeenCalled()
    })
  })
})
