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
  // 120s per test — the slow-cloud unlock path (PBKDF2 600k iterations
  // + cloud blob fetch + IDB import) can chew through 30–45 s on a
  // headless runner, leaving only a thin margin for the rest of the
  // test under a 60 s budget.
  timeout: 120_000,
  expect: { timeout: 20_000 },
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
    // Mobile project uses iPhone 14 viewport / touch / userAgent BUT runs
    // against Chromium so the suite doesn't require a WebKit install on
    // every machine. WebKit-specific behaviour belongs in a separate
    // tagged project layered on top of this one.
    {
      name: 'mobile-iphone',
      use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium', browserName: 'chromium' },
    },
  ],
});
