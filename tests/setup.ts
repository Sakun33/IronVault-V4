import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { vi } from 'vitest'

// Mock crypto for tests
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    },
    subtle: {
      importKey: vi.fn(),
      exportKey: vi.fn(),
      generateKey: vi.fn(),
      deriveKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      digest: vi.fn()
    }
  }
})

// Mock IndexedDB for tests
global.indexedDB = require('fake-indexeddb')
global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange')

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock

// Mock fetch
global.fetch = vi.fn()

// Suppress console warnings in tests
const originalWarn = console.warn
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is no longer supported')
  ) {
    return
  }
  originalWarn.call(console, ...args)
}
