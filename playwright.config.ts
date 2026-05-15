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
  // Skip the fixture/setup helper files when discovering tests.
  testMatch: /.*\.spec\.ts/,
  // Sign in + unlock once and persist the storageState/sessionStorage so
  // every test starts inside the authenticated shell instead of paying
  // a ~2.5-minute login+unlock toll before its assertions begin.
  globalSetup: './tests/e2e/global-setup.ts',
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
  // CLI override via --workers takes precedence; default to 3 so the
  // full ~417-test sweep finishes in ~30-40 minutes instead of 3+ hours.
  workers: 3,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright', open: 'never' }],
    ['json', { outputFile: 'reports/playwright/results.json' }],
  ],
  use: {
    baseURL: 'https://www.ironvault.app',
    // Auth state captured by globalSetup. Specs that need a clean
    // identity (admin) opt out per-file with:
    //   test.use({ storageState: { cookies: [], origins: [] } })
    storageState: './tests/e2e/.auth/user.json',
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
