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
  // 300s per test — round 6 saw many tests die at the 180 s budget
  // (clustered 1.1-2.3m); they finish cleanly with more slack. The
  // slow-cloud unlock path eats 30-45 s before the test even begins
  // its assertions, and post-unlock data hydration adds 30-60 s more.
  timeout: 300_000,
  expect: { timeout: 45_000 },
  // 1 retry instead of 2 — round 6 wasted 1+ hour replaying the same
  // failures three times. One retry catches genuine flakes; a second
  // is signal that something is structurally wrong, not a flake.
  retries: 1,
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
    actionTimeout: 45_000,
    navigationTimeout: 90_000,
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
