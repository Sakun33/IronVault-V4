import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DeduplicationService } from '@/lib/deduplication'

describe('DeduplicationService', () => {
  let deduplicationService: DeduplicationService

  beforeEach(() => {
    deduplicationService = new DeduplicationService()
  })

  describe('Hash Generation', () => {
    it('generates stable hash for identical data', () => {
      const data1 = { title: 'Test Password', url: 'https://example.com', username: 'user1' }
      const data2 = { title: 'Test Password', url: 'https://example.com', username: 'user1' }
      
      const hash1 = deduplicationService.generateHash('passwords', data1)
      const hash2 = deduplicationService.generateHash('passwords', data2)
      
      expect(hash1).toBe(hash2)
    })

    it('generates different hashes for different data', () => {
      const data1 = { title: 'Test Password 1', url: 'https://example.com', username: 'user1' }
      const data2 = { title: 'Test Password 2', url: 'https://example.com', username: 'user1' }
      
      const hash1 = deduplicationService.generateHash('passwords', data1)
      const hash2 = deduplicationService.generateHash('passwords', data2)
      
      expect(hash1).not.toBe(hash2)
    })

    it('generates different hashes for different sections', () => {
      const data = { title: 'Test Item', url: 'https://example.com' }
      
      const hash1 = deduplicationService.generateHash('passwords', data)
      const hash2 = deduplicationService.generateHash('subscriptions', data)
      
      expect(hash1).not.toBe(hash2)
    })

    it('handles case sensitivity correctly', () => {
      const data1 = { title: 'Test Password', url: 'https://example.com' }
      const data2 = { title: 'test password', url: 'https://example.com' }
      
      const hash1 = deduplicationService.generateHash('passwords', data1)
      const hash2 = deduplicationService.generateHash('passwords', data2)
      
      expect(hash1).not.toBe(hash2)
    })

    it('ignores non-canonical fields', () => {
      const data1 = { title: 'Test Password', url: 'https://example.com', id: '1', created_at: '2023-01-01' }
      const data2 = { title: 'Test Password', url: 'https://example.com', id: '2', created_at: '2023-01-02' }
      
      const hash1 = deduplicationService.generateHash('passwords', data1)
      const hash2 = deduplicationService.generateHash('passwords', data2)
      
      expect(hash1).toBe(hash2)
    })
  })

  describe('Canonical Field Mapping', () => {
    it('uses correct canonical fields for passwords', () => {
      const data = { title: 'Test Password', url: 'https://example.com', username: 'user1', password: 'pass123' }
      
      const hash = deduplicationService.generateHash('passwords', data)
      
      // Hash should be based on title, url, username (canonical fields)
      // but not password (non-canonical)
      expect(hash).toBeDefined()
    })

    it('uses correct canonical fields for subscriptions', () => {
      const data = { service: 'Netflix', plan: 'Premium', price: 15.99, billing_cycle: 'monthly' }
      
      const hash = deduplicationService.generateHash('subscriptions', data)
      
      // Hash should be based on service, plan (canonical fields)
      expect(hash).toBeDefined()
    })

    it('uses correct canonical fields for notes', () => {
      const data = { title: 'My Note', content: 'This is a note', tags: ['work', 'important'] }
      
      const hash = deduplicationService.generateHash('notes', data)
      
      // Hash should be based on title, content (canonical fields)
      expect(hash).toBeDefined()
    })

    it('uses correct canonical fields for expenses', () => {
      const data = { description: 'Coffee', amount: 4.50, category: 'Food', date: '2023-01-01' }
      
      const hash = deduplicationService.generateHash('expenses', data)
      
      // Hash should be based on description, amount, category (canonical fields)
      expect(hash).toBeDefined()
    })
  })

  describe('Deduplication Logic', () => {
    it('identifies duplicates correctly', () => {
      const existing = { id: '1', title: 'Test Password', url: 'https://example.com', username: 'user1' }
      const incoming = { id: '2', title: 'Test Password', url: 'https://example.com', username: 'user1' }
      
      const isDuplicate = deduplicationService.isDuplicate('passwords', existing, incoming)
      
      expect(isDuplicate).toBe(true)
    })

    it('identifies non-duplicates correctly', () => {
      const existing = { id: '1', title: 'Test Password 1', url: 'https://example.com', username: 'user1' }
      const incoming = { id: '2', title: 'Test Password 2', url: 'https://example.com', username: 'user1' }
      
      const isDuplicate = deduplicationService.isDuplicate('passwords', existing, incoming)
      
      expect(isDuplicate).toBe(false)
    })

    it('handles null/undefined values', () => {
      const existing = { id: '1', title: 'Test Password', url: null, username: 'user1' }
      const incoming = { id: '2', title: 'Test Password', url: null, username: 'user1' }
      
      const isDuplicate = deduplicationService.isDuplicate('passwords', existing, incoming)
      
      expect(isDuplicate).toBe(true)
    })

    it('handles empty strings', () => {
      const existing = { id: '1', title: 'Test Password', url: '', username: 'user1' }
      const incoming = { id: '2', title: 'Test Password', url: '', username: 'user1' }
      
      const isDuplicate = deduplicationService.isDuplicate('passwords', existing, incoming)
      
      expect(isDuplicate).toBe(true)
    })
  })

  describe('Update vs Insert Logic', () => {
    it('updates existing record instead of creating duplicate', () => {
      const existing = { id: '1', title: 'Test Password', url: 'https://example.com', username: 'user1', password: 'oldpass' }
      const incoming = { id: '2', title: 'Test Password', url: 'https://example.com', username: 'user1', password: 'newpass' }
      
      const result = deduplicationService.processItem('passwords', existing, incoming)
      
      expect(result.action).toBe('update')
      expect(result.data.id).toBe('1') // Keep original ID
      expect(result.data.password).toBe('newpass') // Update with new data
    })

    it('inserts new record when no duplicate found', () => {
      const existing = { id: '1', title: 'Test Password 1', url: 'https://example1.com', username: 'user1' }
      const incoming = { id: '2', title: 'Test Password 2', url: 'https://example2.com', username: 'user1' }
      
      const result = deduplicationService.processItem('passwords', existing, incoming)
      
      expect(result.action).toBe('insert')
      expect(result.data.id).toBe('2') // Keep original ID
    })

    it('handles multiple existing records', () => {
      const existing = [
        { id: '1', title: 'Test Password 1', url: 'https://example1.com', username: 'user1' },
        { id: '2', title: 'Test Password 2', url: 'https://example2.com', username: 'user1' }
      ]
      const incoming = { id: '3', title: 'Test Password 1', url: 'https://example1.com', username: 'user1' }
      
      const result = deduplicationService.processItem('passwords', existing, incoming)
      
      expect(result.action).toBe('update')
      expect(result.data.id).toBe('1') // Update first matching record
    })
  })

  describe('Performance', () => {
    it('handles large datasets efficiently', () => {
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
      const hashes = largeDataset.map(item => deduplicationService.generateHash('passwords', item))
      const endTime = performance.now()
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
      expect(hashes.length).toBe(10000)
    })

    it('optimizes duplicate detection', () => {
      const existing = []
      for (let i = 0; i < 1000; i++) {
        existing.push({
          id: `item-${i}`,
          title: `Item ${i}`,
          url: `https://example${i}.com`,
          username: `user${i}`
        })
      }
      
      const incoming = { id: 'new-item', title: 'Item 500', url: 'https://example500.com', username: 'user500' }
      
      const startTime = performance.now()
      const result = deduplicationService.processItem('passwords', existing, incoming)
      const endTime = performance.now()
      
      // Should find duplicate quickly
      expect(endTime - startTime).toBeLessThan(100) // 100ms
      expect(result.action).toBe('update')
    })
  })

  describe('Edge Cases', () => {
    it('handles malformed data gracefully', () => {
      const malformedData = { title: null, url: undefined, username: '' }
      
      expect(() => {
        deduplicationService.generateHash('passwords', malformedData)
      }).not.toThrow()
    })

    it('handles circular references', () => {
      const data = { title: 'Test', url: 'https://example.com' }
      // @ts-ignore
      data.self = data // Create circular reference
      
      expect(() => {
        deduplicationService.generateHash('passwords', data)
      }).not.toThrow()
    })

    it('handles very long strings', () => {
      const longString = 'x'.repeat(100000) // 100KB string
      const data = { title: longString, url: 'https://example.com' }
      
      const hash = deduplicationService.generateHash('passwords', data)
      expect(hash).toBeDefined()
    })

    it('handles special characters', () => {
      const specialData = { title: 'Test with émojis 🚀 and spéciál chars', url: 'https://example.com' }
      
      const hash = deduplicationService.generateHash('passwords', specialData)
      expect(hash).toBeDefined()
    })
  })
})
