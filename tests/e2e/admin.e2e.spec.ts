import { test, expect } from '@playwright/test'

test.describe('Admin Console E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/admin-console-simple.html')
  })

  test.describe('Authentication', () => {
    test('logs in with correct credentials', async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')

      await expect(page.locator('[data-testid="dashboard"]')).toBeVisible()
      await expect(page.locator('[data-testid="welcome-message"]')).toContainText('Welcome, admin')
    })

    test('rejects incorrect credentials', async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'wrong-password')
      await page.click('[data-testid="login-button"]')

      await expect(page.locator('[data-testid="login-error"]')).toBeVisible()
      await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid credentials')
    })

    test('redirects to login when not authenticated', async ({ page }) => {
      await page.goto('http://localhost:3000/admin-console-simple.html#/dashboard')
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
    })
  })

  test.describe('Dashboard KPIs', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('displays all KPIs correctly', async ({ page }) => {
      await expect(page.locator('[data-testid="total-customers"]')).toBeVisible()
      await expect(page.locator('[data-testid="dau"]')).toBeVisible()
      await expect(page.locator('[data-testid="wau"]')).toBeVisible()
      await expect(page.locator('[data-testid="mau"]')).toBeVisible()
      await expect(page.locator('[data-testid="mrr"]')).toBeVisible()
      await expect(page.locator('[data-testid="arr"]')).toBeVisible()
      await expect(page.locator('[data-testid="churn-rate"]')).toBeVisible()
      await expect(page.locator('[data-testid="plan-mix"]')).toBeVisible()
    })

    test('shows correct customer count', async ({ page }) => {
      const customerCount = await page.locator('[data-testid="total-customers"]').textContent()
      expect(customerCount).toMatch(/\d+/)
      expect(parseInt(customerCount!)).toBeGreaterThan(100000)
    })

    test('displays revenue metrics', async ({ page }) => {
      const mrr = await page.locator('[data-testid="mrr"]').textContent()
      const arr = await page.locator('[data-testid="arr"]').textContent()
      
      expect(mrr).toMatch(/\$[\d,]+/)
      expect(arr).toMatch(/\$[\d,]+/)
    })

    test('shows plan distribution', async ({ page }) => {
      await expect(page.locator('[data-testid="plan-mix-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="free-plan-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="pro-plan-count"]')).toBeVisible()
      await expect(page.locator('[data-testid="enterprise-plan-count"]')).toBeVisible()
    })
  })

  test.describe('Customer Management', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('displays customer list', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      await expect(page.locator('[data-testid="customer-table"]')).toBeVisible()
      await expect(page.locator('[data-testid="customer-row"]')).toHaveCount(10) // Default page size
    })

    test('searches customers efficiently', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      const startTime = Date.now()
      await page.fill('[data-testid="customer-search"]', 'john')
      await page.waitForSelector('[data-testid="search-results"]')
      const searchTime = Date.now() - startTime

      expect(searchTime).toBeLessThan(200) // Sub-200ms search
      await expect(page.locator('[data-testid="customer-row"]')).toHaveCount.greaterThan(0)
    })

    test('filters customers by plan', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      await page.selectOption('[data-testid="plan-filter"]', 'pro')
      await page.waitForSelector('[data-testid="filtered-results"]')
      
      const customerRows = page.locator('[data-testid="customer-row"]')
      const count = await customerRows.count()
      
      for (let i = 0; i < count; i++) {
        const plan = await customerRows.nth(i).locator('[data-testid="customer-plan"]').textContent()
        expect(plan).toBe('Pro')
      }
    })

    test('filters customers by date range', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      await page.fill('[data-testid="date-from"]', '2023-01-01')
      await page.fill('[data-testid="date-to"]', '2023-12-31')
      await page.click('[data-testid="apply-date-filter"]')
      
      await expect(page.locator('[data-testid="filtered-results"]')).toBeVisible()
    })

    test('filters customers by region', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      await page.selectOption('[data-testid="region-filter"]', 'North America')
      await page.waitForSelector('[data-testid="filtered-results"]')
      
      const customerRows = page.locator('[data-testid="customer-row"]')
      const count = await customerRows.count()
      
      for (let i = 0; i < count; i++) {
        const region = await customerRows.nth(i).locator('[data-testid="customer-region"]').textContent()
        expect(region).toBe('North America')
      }
    })

    test('filters customers by platform', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      await page.selectOption('[data-testid="platform-filter"]', 'iOS')
      await page.waitForSelector('[data-testid="filtered-results"]')
      
      const customerRows = page.locator('[data-testid="customer-row"]')
      const count = await customerRows.count()
      
      for (let i = 0; i < count; i++) {
        const platform = await customerRows.nth(i).locator('[data-testid="customer-platform"]').textContent()
        expect(platform).toBe('iOS')
      }
    })

    test('applies multiple filters simultaneously', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      await page.selectOption('[data-testid="plan-filter"]', 'pro')
      await page.selectOption('[data-testid="region-filter"]', 'Europe')
      await page.selectOption('[data-testid="platform-filter"]', 'Android')
      
      await page.waitForSelector('[data-testid="filtered-results"]')
      
      const customerRows = page.locator('[data-testid="customer-row"]')
      const count = await customerRows.count()
      
      for (let i = 0; i < count; i++) {
        const plan = await customerRows.nth(i).locator('[data-testid="customer-plan"]').textContent()
        const region = await customerRows.nth(i).locator('[data-testid="customer-region"]').textContent()
        const platform = await customerRows.nth(i).locator('[data-testid="customer-platform"]').textContent()
        
        expect(plan).toBe('Pro')
        expect(region).toBe('Europe')
        expect(platform).toBe('Android')
      }
    })
  })

  test.describe('Analytics Sync', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('triggers manual sync', async ({ page }) => {
      await page.click('[data-testid="sync-tab"]')
      
      const initialCount = await page.locator('[data-testid="total-customers"]').textContent()
      
      await page.click('[data-testid="sync-now-button"]')
      await expect(page.locator('[data-testid="sync-progress"]')).toBeVisible()
      
      await page.waitForSelector('[data-testid="sync-success"]')
      await expect(page.locator('[data-testid="sync-success"]')).toContainText('Sync completed')
    })

    test('handles sync idempotently', async ({ page }) => {
      await page.click('[data-testid="sync-tab"]')
      
      // First sync
      await page.click('[data-testid="sync-now-button"]')
      await page.waitForSelector('[data-testid="sync-success"]')
      
      // Second sync (should not create duplicates)
      await page.click('[data-testid="sync-now-button"]')
      await page.waitForSelector('[data-testid="sync-success"]')
      
      // Verify no duplicates
      await page.click('[data-testid="customers-tab"]')
      const customerCount = await page.locator('[data-testid="total-customers"]').textContent()
      expect(parseInt(customerCount!)).toBeLessThanOrEqual(100001) // Original + 1 test customer
    })

    test('shows sync history', async ({ page }) => {
      await page.click('[data-testid="sync-tab"]')
      
      await expect(page.locator('[data-testid="sync-history"]')).toBeVisible()
      await expect(page.locator('[data-testid="sync-history-item"]')).toHaveCount.greaterThan(0)
    })
  })

  test.describe('Subscriptions & Pricing', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('updates subscription pricing', async ({ page }) => {
      await page.click('[data-testid="subscriptions-tab"]')
      
      await page.click('[data-testid="edit-pro-plan-button"]')
      await page.fill('[data-testid="pro-monthly-price"]', '19.99')
      await page.fill('[data-testid="pro-annual-price"]', '199.99')
      await page.click('[data-testid="save-pricing-button"]')
      
      await expect(page.locator('[data-testid="pricing-success"]')).toBeVisible()
    })

    test('applies discount codes', async ({ page }) => {
      await page.click('[data-testid="subscriptions-tab"]')
      
      await page.click('[data-testid="add-discount-button"]')
      await page.fill('[data-testid="discount-code"]', 'SAVE20')
      await page.fill('[data-testid="discount-percentage"]', '20')
      await page.fill('[data-testid="discount-expiry"]', '2024-12-31')
      await page.click('[data-testid="save-discount-button"]')
      
      await expect(page.locator('[data-testid="discount-success"]')).toBeVisible()
    })

    test('tracks plan adoption metrics', async ({ page }) => {
      await page.click('[data-testid="subscriptions-tab"]')
      
      await expect(page.locator('[data-testid="plan-adoption-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="free-to-pro-conversion"]')).toBeVisible()
      await expect(page.locator('[data-testid="pro-to-enterprise-conversion"]')).toBeVisible()
    })
  })

  test.describe('Promotions & Notifications', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('creates promotional campaign', async ({ page }) => {
      await page.click('[data-testid="promotions-tab"]')
      
      await page.click('[data-testid="create-promo-button"]')
      await page.fill('[data-testid="promo-title"]', 'Summer Sale')
      await page.fill('[data-testid="promo-description"]', 'Get 50% off Pro plans')
      await page.fill('[data-testid="promo-discount"]', '50')
      await page.fill('[data-testid="promo-start-date"]', '2024-06-01')
      await page.fill('[data-testid="promo-end-date"]', '2024-08-31')
      await page.click('[data-testid="save-promo-button"]')
      
      await expect(page.locator('[data-testid="promo-success"]')).toBeVisible()
    })

    test('schedules notification', async ({ page }) => {
      await page.click('[data-testid="notifications-tab"]')
      
      await page.click('[data-testid="schedule-notification-button"]')
      await page.fill('[data-testid="notification-title"]', 'New Feature Available')
      await page.fill('[data-testid="notification-message"]', 'Check out our new investment tracking feature')
      await page.selectOption('[data-testid="notification-audience"]', 'pro-users')
      await page.fill('[data-testid="notification-schedule"]', '2024-01-15T10:00:00')
      await page.click('[data-testid="schedule-button"]')
      
      await expect(page.locator('[data-testid="notification-scheduled"]')).toBeVisible()
    })

    test('views notification history', async ({ page }) => {
      await page.click('[data-testid="notifications-tab"]')
      
      await expect(page.locator('[data-testid="notification-history"]')).toBeVisible()
      await expect(page.locator('[data-testid="notification-item"]')).toHaveCount.greaterThan(0)
    })
  })

  test.describe('Support Tickets', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('receives encrypted support ticket', async ({ page }) => {
      await page.click('[data-testid="tickets-tab"]')
      
      await expect(page.locator('[data-testid="ticket-list"]')).toBeVisible()
      await expect(page.locator('[data-testid="ticket-item"]')).toHaveCount.greaterThan(0)
    })

    test('decrypts and views ticket details', async ({ page }) => {
      await page.click('[data-testid="tickets-tab"]')
      
      await page.click('[data-testid="ticket-item"]')
      await expect(page.locator('[data-testid="ticket-details"]')).toBeVisible()
      await expect(page.locator('[data-testid="ticket-content"]')).toBeVisible()
    })

    test('resolves support ticket', async ({ page }) => {
      await page.click('[data-testid="tickets-tab"]')
      
      await page.click('[data-testid="ticket-item"]')
      await page.fill('[data-testid="resolution-notes"]', 'Issue resolved by updating user settings')
      await page.selectOption('[data-testid="resolution-status"]', 'resolved')
      await page.click('[data-testid="resolve-ticket-button"]')
      
      await expect(page.locator('[data-testid="ticket-resolved"]')).toBeVisible()
    })

    test('generates support metrics report', async ({ page }) => {
      await page.click('[data-testid="tickets-tab"]')
      
      await page.click('[data-testid="generate-report-button"]')
      await expect(page.locator('[data-testid="report-generated"]')).toBeVisible()
      
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="download-report-button"]')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('support-report')
    })
  })

  test.describe('Export & Reporting', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('exports dashboard as PDF', async ({ page }) => {
      await page.click('[data-testid="export-tab"]')
      
      await page.click('[data-testid="export-dashboard-pdf-button"]')
      await expect(page.locator('[data-testid="export-progress"]')).toBeVisible()
      
      const downloadPromise = page.waitForEvent('download')
      await page.waitForSelector('[data-testid="export-success"]')
      await page.click('[data-testid="download-pdf-button"]')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('dashboard-report.pdf')
    })

    test('exports customer data as CSV', async ({ page }) => {
      await page.click('[data-testid="export-tab"]')
      
      await page.selectOption('[data-testid="export-format"]', 'csv')
      await page.selectOption('[data-testid="export-data-type"]', 'customers')
      await page.click('[data-testid="export-data-button"]')
      
      const downloadPromise = page.waitForEvent('download')
      await page.waitForSelector('[data-testid="export-success"]')
      await page.click('[data-testid="download-csv-button"]')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('customers.csv')
    })

    test('exports analytics data as XLSX', async ({ page }) => {
      await page.click('[data-testid="export-tab"]')
      
      await page.selectOption('[data-testid="export-format"]', 'xlsx')
      await page.selectOption('[data-testid="export-data-type"]', 'analytics')
      await page.click('[data-testid="export-data-button"]')
      
      const downloadPromise = page.waitForEvent('download')
      await page.waitForSelector('[data-testid="export-success"]')
      await page.click('[data-testid="download-xlsx-button"]')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('analytics.xlsx')
    })

    test('schedules automated reports', async ({ page }) => {
      await page.click('[data-testid="export-tab"]')
      
      await page.click('[data-testid="schedule-report-button"]')
      await page.fill('[data-testid="report-name"]', 'Weekly Analytics Report')
      await page.selectOption('[data-testid="report-frequency"]', 'weekly')
      await page.fill('[data-testid="report-email"]', 'admin@company.com')
      await page.click('[data-testid="save-schedule-button"]')
      
      await expect(page.locator('[data-testid="schedule-success"]')).toBeVisible()
    })
  })

  test.describe('Performance', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('loads dashboard quickly', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('http://localhost:3000/admin-console-simple.html')
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
      await page.waitForSelector('[data-testid="dashboard"]')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(2000) // 2 seconds
    })

    test('handles large customer datasets efficiently', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      const startTime = Date.now()
      await page.waitForSelector('[data-testid="customer-table"]')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(500) // 500ms
    })

    test('searches customers in sub-200ms', async ({ page }) => {
      await page.click('[data-testid="customers-tab"]')
      
      const startTime = Date.now()
      await page.fill('[data-testid="customer-search"]', 'test')
      await page.waitForSelector('[data-testid="search-results"]')
      const searchTime = Date.now() - startTime

      expect(searchTime).toBeLessThan(200) // Sub-200ms
    })
  })

  test.describe('Accessibility', () => {
    test.beforeEach(async ({ page }) => {
      await page.fill('[data-testid="username-input"]', 'admin')
      await page.fill('[data-testid="password-input"]', 'password')
      await page.click('[data-testid="login-button"]')
    })

    test('has no critical accessibility violations', async ({ page }) => {
      await injectAxe(page)
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true }
      })
    })

    test('supports keyboard navigation', async ({ page }) => {
      // Tab through main navigation
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Verify focus is on expected element
      const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
      expect(focusedElement).toBe('customers-tab')
    })

    test('has proper ARIA labels', async ({ page }) => {
      await expect(page.locator('[aria-label="Customer search"]')).toBeVisible()
      await expect(page.locator('[aria-label="Sync now"]')).toBeVisible()
      await expect(page.locator('[aria-label="Export data"]')).toBeVisible()
    })
  })
})
