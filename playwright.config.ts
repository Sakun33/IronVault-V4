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
  // 180s per test — the slow-cloud unlock path (PBKDF2 600k iterations
  // + cloud blob fetch + IDB import) can chew through 30–45 s on a
  // headless runner, and post-unlock data hydration (cloud sync, IDB
  // rehydrate) needs 60 s+ on top. 120 s left zero margin and produced
  // 1.5 m flaky timeouts in round 3.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  // actionTimeout 30s — clicks/fills against a freshly-rehydrated page
  // can take 15-25s when React is still hydrating. 15s default is too
  // tight for the post-unlock window.
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
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
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
