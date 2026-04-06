/**
 * Playwright config for running the full-sweep E2E suite against production:
 *   https://www.ironvault.app
 *
 * Usage:
 *   npx playwright test tests/e2e/full-sweep.spec.ts --config playwright.prod.config.ts
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/full-sweep.spec.ts',

  fullyParallel: false,   // serial – vault state is shared across tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90000,         // long timeout for production network latency

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright-prod', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-prod/results.json' }],
  ],

  use: {
    baseURL: 'https://www.ironvault.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 30000,
    // Grant clipboard-read/write so copy tests work
    permissions: ['clipboard-read', 'clipboard-write'],
    // Persist browser storage between tests in the same worker
    storageState: undefined,
  },

  expect: {
    timeout: 15000,
  },

  projects: [
    {
      name: 'prod-desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Use a real persistent context so IndexedDB vault persists between tests
        launchOptions: {
          args: ['--disable-web-security', '--allow-running-insecure-content'],
        },
      },
    },
  ],

  // No webServer block – tests run against live production
});
