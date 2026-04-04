import { describe, it, expect, beforeEach, vi } from 'vitest'
import { VaultStorage } from '@/lib/storage'

describe('IndexedDB Indexes', () => {
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

  describe('Passwords Store Indexes', () => {
    it('creates url index for passwords', async () => {
      const db = await vaultStorage.getDB()
      const passwordsStore = db.transaction(['passwords'], 'readonly').objectStore('passwords')
      const indexes = Array.from(passwordsStore.indexNames)
      
      expect(indexes).toContain('url')
    })

    it('creates username index for passwords', async () => {
      const db = await vaultStorage.getDB()
      const passwordsStore = db.transaction(['passwords'], 'readonly').objectStore('passwords')
      const indexes = Array.from(passwordsStore.indexNames)
      
      expect(indexes).toContain('username')
    })

    it('creates created_at index for passwords', async () => {
      const db = await vaultStorage.getDB()
      const passwordsStore = db.transaction(['passwords'], 'readonly').objectStore('passwords')
      const indexes = Array.from(passwordsStore.indexNames)
      
      expect(indexes).toContain('created_at')
    })

    it('supports efficient URL queries', async () => {
      // Add test data
      const testPasswords = [
        { id: '1', title: 'Google', url: 'https://google.com', username: 'user1' },
        { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user2' },
        { id: '3', title: 'Google Drive', url: 'https://drive.google.com', username: 'user3' }
      ]

      for (const password of testPasswords) {
        await vaultStorage.save('passwords', password)
      }

      // Query by URL using index
      const results = await vaultStorage.query('passwords', 'url', 'https://google.com')
      
      expect(results).toBeDefined()
      expect(mockCryptoService.decrypt).toHaveBeenCalled()
    })

    it('supports efficient username queries', async () => {
      // Add test data
      const testPasswords = [
        { id: '1', title: 'Google', url: 'https://google.com', username: 'user1' },
        { id: '2', title: 'GitHub', url: 'https://github.com', username: 'user1' },
        { id: '3', title: 'Drive', url: 'https://drive.google.com', username: 'user2' }
      ]

      for (const password of testPasswords) {
        await vaultStorage.save('passwords', password)
      }

      // Query by username using index
      const results = await vaultStorage.query('passwords', 'username', 'user1')
      
      expect(results).toBeDefined()
    })
  })

  describe('Subscriptions Store Indexes', () => {
    it('creates service index for subscriptions', async () => {
      const db = await vaultStorage.getDB()
      const subscriptionsStore = db.transaction(['subscriptions'], 'readonly').objectStore('subscriptions')
      const indexes = Array.from(subscriptionsStore.indexNames)
      
      expect(indexes).toContain('service')
    })

    it('creates plan index for subscriptions', async () => {
      const db = await vaultStorage.getDB()
      const subscriptionsStore = db.transaction(['subscriptions'], 'readonly').objectStore('subscriptions')
      const indexes = Array.from(subscriptionsStore.indexNames)
      
      expect(indexes).toContain('plan')
    })

    it('creates billing_cycle index for subscriptions', async () => {
      const db = await vaultStorage.getDB()
      const subscriptionsStore = db.transaction(['subscriptions'], 'readonly').objectStore('subscriptions')
      const indexes = Array.from(subscriptionsStore.indexNames)
      
      expect(indexes).toContain('billing_cycle')
    })

    it('supports efficient service queries', async () => {
      const testSubscriptions = [
        { id: '1', service: 'Netflix', plan: 'Premium', billing_cycle: 'monthly' },
        { id: '2', service: 'Spotify', plan: 'Premium', billing_cycle: 'monthly' },
        { id: '3', service: 'Netflix', plan: 'Basic', billing_cycle: 'monthly' }
      ]

      for (const subscription of testSubscriptions) {
        await vaultStorage.save('subscriptions', subscription)
      }

      const results = await vaultStorage.query('subscriptions', 'service', 'Netflix')
      
      expect(results).toBeDefined()
    })
  })

  describe('Notes Store Indexes', () => {
    it('creates title index for notes', async () => {
      const db = await vaultStorage.getDB()
      const notesStore = db.transaction(['notes'], 'readonly').objectStore('notes')
      const indexes = Array.from(notesStore.indexNames)
      
      expect(indexes).toContain('title')
    })

    it('creates tags index for notes', async () => {
      const db = await vaultStorage.getDB()
      const notesStore = db.transaction(['notes'], 'readonly').objectStore('notes')
      const indexes = Array.from(notesStore.indexNames)
      
      expect(indexes).toContain('tags')
    })

    it('creates created_at index for notes', async () => {
      const db = await vaultStorage.getDB()
      const notesStore = db.transaction(['notes'], 'readonly').objectStore('notes')
      const indexes = Array.from(notesStore.indexNames)
      
      expect(indexes).toContain('created_at')
    })

    it('supports efficient tag queries', async () => {
      const testNotes = [
        { id: '1', title: 'Work Note', content: 'Important work info', tags: ['work', 'important'] },
        { id: '2', title: 'Personal Note', content: 'Personal info', tags: ['personal'] },
        { id: '3', title: 'Work Task', content: 'Task info', tags: ['work', 'task'] }
      ]

      for (const note of testNotes) {
        await vaultStorage.save('notes', note)
      }

      const results = await vaultStorage.query('notes', 'tags', 'work')
      
      expect(results).toBeDefined()
    })
  })

  describe('Expenses Store Indexes', () => {
    it('creates category index for expenses', async () => {
      const db = await vaultStorage.getDB()
      const expensesStore = db.transaction(['expenses'], 'readonly').objectStore('expenses')
      const indexes = Array.from(expensesStore.indexNames)
      
      expect(indexes).toContain('category')
    })

    it('creates date index for expenses', async () => {
      const db = await vaultStorage.getDB()
      const expensesStore = db.transaction(['expenses'], 'readonly').objectStore('expenses')
      const indexes = Array.from(expensesStore.indexNames)
      
      expect(indexes).toContain('date')
    })

    it('creates amount index for expenses', async () => {
      const db = await vaultStorage.getDB()
      const expensesStore = db.transaction(['expenses'], 'readonly').objectStore('expenses')
      const indexes = Array.from(expensesStore.indexNames)
      
      expect(indexes).toContain('amount')
    })

    it('supports efficient category queries', async () => {
      const testExpenses = [
        { id: '1', description: 'Coffee', amount: 4.50, category: 'Food', date: '2023-01-01' },
        { id: '2', description: 'Gas', amount: 50.00, category: 'Transportation', date: '2023-01-01' },
        { id: '3', description: 'Lunch', amount: 12.00, category: 'Food', date: '2023-01-02' }
      ]

      for (const expense of testExpenses) {
        await vaultStorage.save('expenses', expense)
      }

      const results = await vaultStorage.query('expenses', 'category', 'Food')
      
      expect(results).toBeDefined()
    })
  })

  describe('Bank Statements Store Indexes', () => {
    it('creates account_name index for bank statements', async () => {
      const db = await vaultStorage.getDB()
      const bankStatementsStore = db.transaction(['bank_statements'], 'readonly').objectStore('bank_statements')
      const indexes = Array.from(bankStatementsStore.indexNames)
      
      expect(indexes).toContain('account_name')
    })

    it('creates transaction_date index for bank statements', async () => {
      const db = await vaultStorage.getDB()
      const bankStatementsStore = db.transaction(['bank_statements'], 'readonly').objectStore('bank_statements')
      const indexes = Array.from(bankStatementsStore.indexNames)
      
      expect(indexes).toContain('transaction_date')
    })

    it('creates amount index for bank statements', async () => {
      const db = await vaultStorage.getDB()
      const bankStatementsStore = db.transaction(['bank_statements'], 'readonly').objectStore('bank_statements')
      const indexes = Array.from(bankStatementsStore.indexNames)
      
      expect(indexes).toContain('amount')
    })

    it('supports efficient account queries', async () => {
      const testStatements = [
        { id: '1', account_name: 'Checking', transaction_date: '2023-01-01', amount: 100.00 },
        { id: '2', account_name: 'Savings', transaction_date: '2023-01-01', amount: 500.00 },
        { id: '3', account_name: 'Checking', transaction_date: '2023-01-02', amount: -50.00 }
      ]

      for (const statement of testStatements) {
        await vaultStorage.save('bank_statements', statement)
      }

      const results = await vaultStorage.query('bank_statements', 'account_name', 'Checking')
      
      expect(results).toBeDefined()
    })
  })

  describe('Investments Store Indexes', () => {
    it('creates symbol index for investments', async () => {
      const db = await vaultStorage.getDB()
      const investmentsStore = db.transaction(['investments'], 'readonly').objectStore('investments')
      const indexes = Array.from(investmentsStore.indexNames)
      
      expect(indexes).toContain('symbol')
    })

    it('creates type index for investments', async () => {
      const db = await vaultStorage.getDB()
      const investmentsStore = db.transaction(['investments'], 'readonly').objectStore('investments')
      const indexes = Array.from(investmentsStore.indexNames)
      
      expect(indexes).toContain('type')
    })

    it('creates purchase_date index for investments', async () => {
      const db = await vaultStorage.getDB()
      const investmentsStore = db.transaction(['investments'], 'readonly').objectStore('investments')
      const indexes = Array.from(investmentsStore.indexNames)
      
      expect(indexes).toContain('purchase_date')
    })

    it('supports efficient symbol queries', async () => {
      const testInvestments = [
        { id: '1', symbol: 'AAPL', type: 'stock', purchase_date: '2023-01-01', shares: 10 },
        { id: '2', symbol: 'GOOGL', type: 'stock', purchase_date: '2023-01-01', shares: 5 },
        { id: '3', symbol: 'AAPL', type: 'stock', purchase_date: '2023-01-02', shares: 5 }
      ]

      for (const investment of testInvestments) {
        await vaultStorage.save('investments', investment)
      }

      const results = await vaultStorage.query('investments', 'symbol', 'AAPL')
      
      expect(results).toBeDefined()
    })
  })

  describe('Index Performance', () => {
    it('handles large datasets efficiently', async () => {
      const largeDataset = []
      for (let i = 0; i < 10000; i++) {
        largeDataset.push({
          id: `item-${i}`,
          title: `Item ${i}`,
          url: `https://example${i}.com`,
          username: `user${i % 100}` // Reuse usernames
        })
      }

      // Add all items
      for (const item of largeDataset) {
        await vaultStorage.save('passwords', item)
      }

      // Query by username (should be fast due to index)
      const startTime = performance.now()
      const results = await vaultStorage.query('passwords', 'username', 'user50')
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // 100ms
      expect(results).toBeDefined()
    })

    it('supports range queries efficiently', async () => {
      const testData = []
      for (let i = 0; i < 1000; i++) {
        testData.push({
          id: `expense-${i}`,
          description: `Expense ${i}`,
          amount: i * 10, // 0, 10, 20, 30, ...
          category: 'Test',
          date: `2023-01-${String(i % 28 + 1).padStart(2, '0')}`
        })
      }

      for (const item of testData) {
        await vaultStorage.save('expenses', item)
      }

      // Query by amount range (should be fast due to index)
      const startTime = performance.now()
      const results = await vaultStorage.queryRange('expenses', 'amount', 100, 200)
      const endTime = performance.now()

      expect(endTime - startTime).toBeLessThan(100) // 100ms
      expect(results).toBeDefined()
    })
  })

  describe('Index Maintenance', () => {
    it('maintains index consistency on updates', async () => {
      const testData = { id: '1', title: 'Test Password', url: 'https://example.com', username: 'user1' }
      
      await vaultStorage.save('passwords', testData)
      
      // Update the data
      const updatedData = { ...testData, username: 'user2' }
      await vaultStorage.save('passwords', updatedData)
      
      // Query by old username should return empty
      const oldResults = await vaultStorage.query('passwords', 'username', 'user1')
      expect(oldResults).toHaveLength(0)
      
      // Query by new username should return the record
      const newResults = await vaultStorage.query('passwords', 'username', 'user2')
      expect(newResults).toHaveLength(1)
    })

    it('maintains index consistency on deletes', async () => {
      const testData = { id: '1', title: 'Test Password', url: 'https://example.com', username: 'user1' }
      
      await vaultStorage.save('passwords', testData)
      await vaultStorage.delete('passwords', '1')
      
      // Query should return empty
      const results = await vaultStorage.query('passwords', 'username', 'user1')
      expect(results).toHaveLength(0)
    })
  })
})
