import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImportExportService } from '@/lib/import-export'
import { VaultStorage } from '@/lib/storage'
import { CryptoService } from '@/lib/crypto'

describe('Import/Export Round-trip Tests', () => {
  let importExportService: ImportExportService
  let vaultStorage: VaultStorage
  let cryptoService: CryptoService
  let mockCryptoService: any

  beforeEach(async () => {
    // Mock crypto service
    mockCryptoService = {
      encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
      decrypt: vi.fn().mockResolvedValue('decrypted-data'),
      generateKey: vi.fn().mockResolvedValue({})
    }

    cryptoService = new CryptoService()
    vaultStorage = new VaultStorage(mockCryptoService)
    importExportService = new ImportExportService(vaultStorage, mockCryptoService)
    
    await vaultStorage.init()
  })

  describe('CSV Import/Export Round-trip', () => {
    it('exports encrypted .svpkg and re-imports exactly', async () => {
      // Create test data
      const testData = {
        passwords: [
          { id: '1', title: 'Google', url: 'https://google.com', username: 'user1', password: 'pass1' },
          { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user2', password: 'pass2' }
        ],
        subscriptions: [
          { id: '1', service: 'Netflix', plan: 'Premium', price: 15.99, billing_cycle: 'monthly' },
          { id: '2', service: 'Spotify', plan: 'Premium', price: 9.99, billing_cycle: 'monthly' }
        ]
      }

      // Add test data to vault
      for (const [section, items] of Object.entries(testData)) {
        for (const item of items) {
          await vaultStorage.save(section, item)
        }
      }

      // Export data
      const exportResult = await importExportService.exportData('encrypted', 'test-passphrase')
      expect(exportResult.success).toBe(true)

      // Clear vault
      await vaultStorage.clearAllData()

      // Import data
      const importResult = await importExportService.importData(exportResult.data, 'test-passphrase')
      expect(importResult.success).toBe(true)

      // Verify data integrity
      const importedPasswords = await vaultStorage.getItems('passwords')
      const importedSubscriptions = await vaultStorage.getItems('subscriptions')

      expect(importedPasswords).toHaveLength(2)
      expect(importedSubscriptions).toHaveLength(2)
      expect(importedPasswords[0].title).toBe('Google')
      expect(importedSubscriptions[0].service).toBe('Netflix')
    })

    it('handles CSV with missing headers gracefully', async () => {
      const csvData = 'Test Password,https://test.com,user1\nAnother Password,https://another.com,user2'
      
      const result = await importExportService.importCSV(csvData, 'passwords')
      
      expect(result.success).toBe(true)
      expect(result.imported).toBe(2)
    })

    it('handles CSV with extra columns', async () => {
      const csvData = 'title,url,username,password,extra_column\nTest,https://test.com,user1,pass1,extra'
      
      const result = await importExportService.importCSV(csvData, 'passwords')
      
      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
    })

    it('handles CSV with different encodings', async () => {
      const csvData = 'title,url,username\nTëst,https://tëst.com,üsër1'
      
      const result = await importExportService.importCSV(csvData, 'passwords')
      
      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
    })
  })

  describe('XLSX Import/Export Round-trip', () => {
    it('exports and imports XLSX data correctly', async () => {
      const testData = {
        passwords: [
          { id: '1', title: 'Google', url: 'https://google.com', username: 'user1' },
          { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user2' }
        ]
      }

      // Add test data
      for (const item of testData.passwords) {
        await vaultStorage.save('passwords', item)
      }

      // Export to XLSX
      const exportResult = await importExportService.exportData('xlsx')
      expect(exportResult.success).toBe(true)

      // Clear vault
      await vaultStorage.clearAllData()

      // Import from XLSX
      const importResult = await importExportService.importXLSX(exportResult.data, 'passwords')
      expect(importResult.success).toBe(true)

      // Verify data
      const importedPasswords = await vaultStorage.getItems('passwords')
      expect(importedPasswords).toHaveLength(2)
      expect(importedPasswords[0].title).toBe('Google')
    })

    it('handles XLSX with multiple sheets', async () => {
      const xlsxData = {
        passwords: [
          { title: 'Google', url: 'https://google.com', username: 'user1' }
        ],
        subscriptions: [
          { service: 'Netflix', plan: 'Premium', price: 15.99 }
        ]
      }

      const result = await importExportService.importXLSX(xlsxData, 'all')
      
      expect(result.success).toBe(true)
      expect(result.imported).toBe(2)
    })

    it('handles XLSX with empty cells', async () => {
      const xlsxData = {
        passwords: [
          { title: 'Google', url: 'https://google.com', username: '', password: 'pass1' }
        ]
      }

      const result = await importExportService.importXLSX(xlsxData, 'passwords')
      
      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
    })
  })

  describe('JSON Import/Export Round-trip', () => {
    it('exports and imports JSON data correctly', async () => {
      const testData = {
        passwords: [
          { id: '1', title: 'Google', url: 'https://google.com', username: 'user1' },
          { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user2' }
        ]
      }

      // Add test data
      for (const item of testData.passwords) {
        await vaultStorage.save('passwords', item)
      }

      // Export to JSON
      const exportResult = await importExportService.exportData('json')
      expect(exportResult.success).toBe(true)

      // Clear vault
      await vaultStorage.clearAllData()

      // Import from JSON
      const importResult = await importExportService.importJSON(exportResult.data, 'passwords')
      expect(importResult.success).toBe(true)

      // Verify data
      const importedPasswords = await vaultStorage.getItems('passwords')
      expect(importedPasswords).toHaveLength(2)
      expect(importedPasswords[0].title).toBe('Google')
    })

    it('handles JSON with nested objects', async () => {
      const jsonData = {
        passwords: [
          {
            title: 'Google',
            url: 'https://google.com',
            username: 'user1',
            metadata: {
              created: '2023-01-01',
              tags: ['work', 'important']
            }
          }
        ]
      }

      const result = await importExportService.importJSON(jsonData, 'passwords')
      
      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
    })

    it('handles JSON with arrays', async () => {
      const jsonData = {
        notes: [
          {
            title: 'Work Note',
            content: 'Important work info',
            tags: ['work', 'important', 'urgent']
          }
        ]
      }

      const result = await importExportService.importJSON(jsonData, 'notes')
      
      expect(result.success).toBe(true)
      expect(result.imported).toBe(1)
    })
  })

  describe('Deduplication During Import', () => {
    it('updates existing records instead of creating duplicates', async () => {
      // Add initial data
      const initialData = { id: '1', title: 'Google', url: 'https://google.com', username: 'user1' }
      await vaultStorage.save('passwords', initialData)

      // Import data with same canonical fields but different non-canonical fields
      const importData = { id: '2', title: 'Google', url: 'https://google.com', username: 'user1', password: 'newpass' }
      const result = await importExportService.importJSON({ passwords: [importData] }, 'passwords')

      expect(result.success).toBe(true)
      expect(result.updated).toBe(1)
      expect(result.imported).toBe(0)

      // Verify only one record exists
      const passwords = await vaultStorage.getItems('passwords')
      expect(passwords).toHaveLength(1)
      expect(passwords[0].id).toBe('1') // Original ID preserved
      expect(passwords[0].password).toBe('newpass') // Updated with new data
    })

    it('handles multiple duplicates correctly', async () => {
      // Add initial data
      const initialData = [
        { id: '1', title: 'Google', url: 'https://google.com', username: 'user1' },
        { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user2' }
      ]
      for (const item of initialData) {
        await vaultStorage.save('passwords', item)
      }

      // Import data with duplicates
      const importData = [
        { id: '3', title: 'Google', url: 'https://google.com', username: 'user1', password: 'newpass' },
        { id: '4', title: 'GitHub', url: 'https://github.com', username: 'user2', password: 'newpass' },
        { id: '5', title: 'New Service', url: 'https://new.com', username: 'user3' }
      ]

      const result = await importExportService.importJSON({ passwords: importData }, 'passwords')

      expect(result.success).toBe(true)
      expect(result.updated).toBe(2)
      expect(result.imported).toBe(1)

      // Verify final state
      const passwords = await vaultStorage.getItems('passwords')
      expect(passwords).toHaveLength(3)
    })
  })

  describe('Error Handling', () => {
    it('handles corrupted encrypted data', async () => {
      const corruptedData = 'corrupted-encrypted-data'
      
      const result = await importExportService.importData(corruptedData, 'test-passphrase')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('decryption failed')
    })

    it('handles wrong passphrase', async () => {
      // Export with one passphrase
      const exportResult = await importExportService.exportData('encrypted', 'correct-passphrase')
      
      // Import with wrong passphrase
      const result = await importExportService.importData(exportResult.data, 'wrong-passphrase')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('decryption failed')
    })

    it('handles malformed CSV data', async () => {
      const malformedCSV = 'title,url,username\n"Unclosed quote,https://test.com,user1'
      
      const result = await importExportService.importCSV(malformedCSV, 'passwords')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('malformed CSV')
    })

    it('handles malformed JSON data', async () => {
      const malformedJSON = '{ "passwords": [ { "title": "Test", "url": "https://test.com" }'
      
      const result = await importExportService.importJSON(malformedJSON, 'passwords')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('malformed JSON')
    })

    it('handles unsupported file format', async () => {
      const unsupportedData = 'unsupported file format'
      
      const result = await importExportService.importData(unsupportedData, 'test-passphrase')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('unsupported format')
    })
  })

  describe('Performance', () => {
    it('handles large datasets efficiently', async () => {
      const largeDataset = []
      for (let i = 0; i < 10000; i++) {
        largeDataset.push({
          id: `item-${i}`,
          title: `Item ${i}`,
          url: `https://example${i}.com`,
          username: `user${i}`
        })
      }

      const startTime = performance.now()
      const result = await importExportService.importJSON({ passwords: largeDataset }, 'passwords')
      const endTime = performance.now()

      expect(result.success).toBe(true)
      expect(result.imported).toBe(10000)
      expect(endTime - startTime).toBeLessThan(5000) // 5 seconds
    })

    it('handles concurrent imports', async () => {
      const dataset1 = Array.from({ length: 1000 }, (_, i) => ({
        id: `item1-${i}`,
        title: `Item 1-${i}`,
        url: `https://example1-${i}.com`,
        username: `user1-${i}`
      }))

      const dataset2 = Array.from({ length: 1000 }, (_, i) => ({
        id: `item2-${i}`,
        title: `Item 2-${i}`,
        url: `https://example2-${i}.com`,
        username: `user2-${i}`
      }))

      const startTime = performance.now()
      const [result1, result2] = await Promise.all([
        importExportService.importJSON({ passwords: dataset1 }, 'passwords'),
        importExportService.importJSON({ passwords: dataset2 }, 'passwords')
      ])
      const endTime = performance.now()

      expect(result1.success).toBe(true)
      expect(result2.success).toBe(true)
      expect(result1.imported + result2.imported).toBe(2000)
      expect(endTime - startTime).toBeLessThan(3000) // 3 seconds
    })
  })

  describe('Data Integrity', () => {
    it('maintains data integrity during round-trip', async () => {
      const originalData = {
        passwords: [
          { id: '1', title: 'Google', url: 'https://google.com', username: 'user1', password: 'pass1' },
          { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user2', password: 'pass2' }
        ],
        subscriptions: [
          { id: '1', service: 'Netflix', plan: 'Premium', price: 15.99, billing_cycle: 'monthly' },
          { id: '2', service: 'Spotify', plan: 'Premium', price: 9.99, billing_cycle: 'monthly' }
        ]
      }

      // Add original data
      for (const [section, items] of Object.entries(originalData)) {
        for (const item of items) {
          await vaultStorage.save(section, item)
        }
      }

      // Export and import
      const exportResult = await importExportService.exportData('json')
      await vaultStorage.clearAllData()
      const importResult = await importExportService.importJSON(exportResult.data, 'all')

      expect(importResult.success).toBe(true)

      // Verify data integrity
      const importedPasswords = await vaultStorage.getItems('passwords')
      const importedSubscriptions = await vaultStorage.getItems('subscriptions')

      expect(importedPasswords).toHaveLength(2)
      expect(importedSubscriptions).toHaveLength(2)

      // Verify specific data
      expect(importedPasswords[0].title).toBe('Google')
      expect(importedPasswords[0].url).toBe('https://google.com')
      expect(importedPasswords[0].username).toBe('user1')
      expect(importedPasswords[0].password).toBe('pass1')

      expect(importedSubscriptions[0].service).toBe('Netflix')
      expect(importedSubscriptions[0].plan).toBe('Premium')
      expect(importedSubscriptions[0].price).toBe(15.99)
      expect(importedSubscriptions[0].billing_cycle).toBe('monthly')
    })

    it('preserves special characters', async () => {
      const specialData = {
        passwords: [
          { id: '1', title: 'Tëst Pässwörd', url: 'https://tëst.com', username: 'üsër1', password: 'päss1' },
          { id: '2', title: '测试密码', url: 'https://测试.com', username: '用户1', password: '密码1' }
        ]
      }

      // Add special data
      for (const item of specialData.passwords) {
        await vaultStorage.save('passwords', item)
      }

      // Export and import
      const exportResult = await importExportService.exportData('json')
      await vaultStorage.clearAllData()
      const importResult = await importExportService.importJSON(exportResult.data, 'passwords')

      expect(importResult.success).toBe(true)

      // Verify special characters preserved
      const importedPasswords = await vaultStorage.getItems('passwords')
      expect(importedPasswords[0].title).toBe('Tëst Pässwörd')
      expect(importedPasswords[0].username).toBe('üsër1')
      expect(importedPasswords[1].title).toBe('测试密码')
      expect(importedPasswords[1].username).toBe('用户1')
    })
  })
})
