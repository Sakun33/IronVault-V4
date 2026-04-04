import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/admin-console-comprehensive.spec.ts', '**/comprehensive-test.spec.ts', '**/debug-seeding.spec.ts', '**/encrypted-analytics.spec.ts', '**/import-export.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './reports/coverage',
      include: ['client/src/**/*', 'server/**/*', 'shared/**/*'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**']
    },
    globals: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src'),
      '@shared': resolve(__dirname, './shared')
    }
  }
})
