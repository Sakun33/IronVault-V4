import { defineConfig } from '@playwright/test';

/**
 * Playwright config for hitting the LIVE production site at
 * https://www.ironvault.app. No dev server, no localhost — used by
 * `tests/e2e/responsive-test.spec.ts` for cross-viewport smoke
 * testing of the deployed app.
 *
 * Run with: `npx playwright test --config=playwright.live.config.ts`
 */
const VIEWPORTS = [
  { name: 'iphone-se',          width: 320,  height: 568,  isMobile: true,  hasTouch: true  },
  { name: 'iphone-14',          width: 390,  height: 844,  isMobile: true,  hasTouch: true  },
  { name: 'iphone-14-pro-max',  width: 430,  height: 932,  isMobile: true,  hasTouch: true  },
  { name: 'ipad',               width: 768,  height: 1024, isMobile: true,  hasTouch: true  },
  { name: 'laptop',             width: 1024, height: 768,  isMobile: false, hasTouch: false },
  { name: 'desktop',            width: 1440, height: 900,  isMobile: false, hasTouch: false },
];

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /responsive-test\.spec\.ts/,
  // Live-site testing is read-mostly; allow parallel runs across viewports
  // but keep tests within a single project sequential for storage-state.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: 90_000,
  reporter: [
    ['list'],
    ['json', { outputFile: 'reports/responsive/results.json' }],
    ['html', { outputFolder: 'reports/responsive', open: 'never' }],
  ],
  use: {
    baseURL: 'https://www.ironvault.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    ignoreHTTPSErrors: false,
  },
  projects: VIEWPORTS.map(v => ({
    name: v.name,
    use: {
      viewport: { width: v.width, height: v.height },
      isMobile: v.isMobile,
      hasTouch: v.hasTouch,
      deviceScaleFactor: v.isMobile ? 2 : 1,
      // Force Chromium across the board so we're testing one engine; the
      // user's request was viewport coverage, not engine coverage. We
      // can add WebKit later if the iPhone-Safari-specific behaviour
      // (visualViewport, etc.) needs verifying.
      browserName: 'chromium',
    },
  })),
});
