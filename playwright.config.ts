import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential for screenshot consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for consistent screenshots
  timeout: 60000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/playwright', open: 'never' }],
    ['json', { outputFile: 'reports/playwright/results.json' }]
  ],
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'retain-on-failure',
    screenshot: 'on', // Always capture screenshots for visual regression
    video: 'retain-on-failure',
    actionTimeout: 15000,
  },
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100, // Allow minor rendering differences
      animations: 'disabled',
    }
  },
  projects: [
    // Desktop baseline
    {
      name: 'desktop-chromium-light',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
        viewport: { width: 1280, height: 720 }
      }
    },
    {
      name: 'desktop-chromium-dark',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        viewport: { width: 1280, height: 720 }
      }
    },
    // iPhone SE (smallest mobile target)
    {
      name: 'iphone-se-light',
      use: { 
        ...devices['iPhone SE'],
        colorScheme: 'light'
      }
    },
    {
      name: 'iphone-se-dark',
      use: { 
        ...devices['iPhone SE'],
        colorScheme: 'dark'
      }
    },
    // iPhone 15 Pro (modern mobile target)
    {
      name: 'iphone-15-pro-light',
      use: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        colorScheme: 'light'
      }
    },
    {
      name: 'iphone-15-pro-dark',
      use: {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        colorScheme: 'dark'
      }
    }
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5000',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'cd admin-console/backend && npm exec tsx server-optimized.ts',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI
    }
  ]
})
