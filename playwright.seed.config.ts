/**
 * Playwright config for running the seed script against production.
 * Identical to playwright.prod.config.ts except testMatch targets seed-pro-data.spec.ts
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/seed-pro-data.spec.ts',

  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 120000,  // 2-min per test — each test seeds many items

  reporter: [
    ['list'],
  ],

  use: {
    baseURL: 'https://www.ironvault.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 30000,
    permissions: ['clipboard-read', 'clipboard-write'],
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
        launchOptions: {
          args: ['--disable-web-security', '--allow-running-insecure-content'],
        },
      },
    },
  ],
});
