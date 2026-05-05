import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the live-prod E2E suite. All specs in
 * `tests/e2e/*.spec.ts` run against https://www.ironvault.app (and a
 * couple against https://admin.ironvault.app), so there's no
 * webServer block and no reuseExistingServer dance.
 *
 * Two projects cover desktop + mobile so every flow is exercised on
 * both layouts. Heavier per-engine coverage (WebKit, real iPhone
 * emulation) belongs in a separate suite — this one optimises for
 * "smoke green on every push" rather than exhaustive matrix testing.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 2,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright', open: 'never' }],
    ['json', { outputFile: 'reports/playwright/results.json' }],
  ],
  use: {
    baseURL: 'https://www.ironvault.app',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-iphone',  use: { ...devices['iPhone 14'] } },
  ],
});
