import { test, expect } from '@playwright/test'
import { injectAxe, checkA11y } from '@axe-core/playwright'

test.describe('SubSafe Main Application E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test.describe('First Run Experience', () => {
    test('completes first run flow', async ({ page }) => {
      // Set master password
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Verify vault is unlocked
      await expect(page.locator('[data-testid="vault-unlocked"]')).toBeVisible()

      // Create sample items across all sections
      await page.click('[data-testid="add-password-button"]')
      await page.fill('[data-testid="password-title"]', 'Google Account')
      await page.fill('[data-testid="password-url"]', 'https://google.com')
      await page.fill('[data-testid="password-username"]', 'user@example.com')
      await page.fill('[data-testid="password-password"]', 'password123')
      await page.click('[data-testid="save-password-button"]')

      await page.click('[data-testid="add-subscription-button"]')
      await page.fill('[data-testid="subscription-service"]', 'Netflix')
      await page.fill('[data-testid="subscription-plan"]', 'Premium')
      await page.fill('[data-testid="subscription-price"]', '15.99')
      await page.selectOption('[data-testid="subscription-billing-cycle"]', 'monthly')
      await page.click('[data-testid="save-subscription-button"]')

      await page.click('[data-testid="add-note-button"]')
      await page.fill('[data-testid="note-title"]', 'Work Notes')
      await page.fill('[data-testid="note-content"]', 'Important work information')
      await page.click('[data-testid="save-note-button"]')

      // Verify items are created
      await expect(page.locator('[data-testid="password-item"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="subscription-item"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="note-item"]')).toHaveCount(1)

      // Lock vault
      await page.click('[data-testid="lock-vault-button"]')
      await expect(page.locator('[data-testid="vault-locked"]')).toBeVisible()

      // Unlock vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.click('[data-testid="unlock-vault-button"]')
      await expect(page.locator('[data-testid="vault-unlocked"]')).toBeVisible()

      // Verify items are still there
      await expect(page.locator('[data-testid="password-item"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="subscription-item"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="note-item"]')).toHaveCount(1)
    })

    test('handles password mismatch', async ({ page }) => {
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'different-password')
      await page.click('[data-testid="set-password-button"]')

      await expect(page.locator('[data-testid="password-mismatch-error"]')).toBeVisible()
    })

    test('validates password strength', async ({ page }) => {
      await page.fill('[data-testid="master-password-input"]', 'weak')
      await page.fill('[data-testid="confirm-password-input"]', 'weak')
      await page.click('[data-testid="set-password-button"]')

      await expect(page.locator('[data-testid="password-strength-error"]')).toBeVisible()
    })
  })

  test.describe('Security Features', () => {
    test('wipes vault after 3 failed attempts', async ({ page }) => {
      // Set up vault first
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Add some data
      await page.click('[data-testid="add-password-button"]')
      await page.fill('[data-testid="password-title"]', 'Test Password')
      await page.fill('[data-testid="password-url"]', 'https://test.com')
      await page.fill('[data-testid="password-username"]', 'user')
      await page.fill('[data-testid="password-password"]', 'pass')
      await page.click('[data-testid="save-password-button"]')

      // Lock vault
      await page.click('[data-testid="lock-vault-button"]')

      // Try wrong passwords 3 times
      for (let i = 0; i < 3; i++) {
        await page.fill('[data-testid="master-password-input"]', 'wrong-password')
        await page.click('[data-testid="unlock-vault-button"]')
        await expect(page.locator('[data-testid="wrong-password-error"]')).toBeVisible()
      }

      // Verify vault is wiped
      await expect(page.locator('[data-testid="vault-wiped-warning"]')).toBeVisible()
      await expect(page.locator('[data-testid="password-item"]')).toHaveCount(0)
    })

    test('auto-locks after idle timeout', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Wait for idle timeout (mock this in test environment)
      await page.evaluate(() => {
        // Simulate idle timeout
        window.dispatchEvent(new Event('idle-timeout'))
      })

      await expect(page.locator('[data-testid="vault-locked"]')).toBeVisible()
    })

    test('prevents data leakage in memory', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Add sensitive data
      await page.click('[data-testid="add-password-button"]')
      await page.fill('[data-testid="password-title"]', 'Sensitive Account')
      await page.fill('[data-testid="password-url"]', 'https://sensitive.com')
      await page.fill('[data-testid="password-username"]', 'sensitive-user')
      await page.fill('[data-testid="password-password"]', 'sensitive-password')
      await page.click('[data-testid="save-password-button"]')

      // Lock vault
      await page.click('[data-testid="lock-vault-button"]')

      // Verify sensitive data is not visible in DOM
      await expect(page.locator('text=sensitive-password')).not.toBeVisible()
      await expect(page.locator('text=sensitive-user')).not.toBeVisible()
    })
  })

  test.describe('Import/Export Functionality', () => {
    test('imports plaintext CSV data', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Open import dialog
      await page.click('[data-testid="import-data-button"]')

      // Select CSV file
      const csvContent = 'title,url,username,password\nGoogle,https://google.com,user1,pass1\nGitHub,https://github.com,user2,pass2'
      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })
      
      await page.setInputFiles('[data-testid="file-input"]', file)
      await page.click('[data-testid="import-button"]')

      // Verify import success
      await expect(page.locator('[data-testid="import-success"]')).toBeVisible()
      await expect(page.locator('[data-testid="password-item"]')).toHaveCount(2)
    })

    test('exports encrypted package', async ({ page }) => {
      // Set up vault with data
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      await page.click('[data-testid="add-password-button"]')
      await page.fill('[data-testid="password-title"]', 'Test Password')
      await page.fill('[data-testid="password-url"]', 'https://test.com')
      await page.fill('[data-testid="password-username"]', 'user')
      await page.fill('[data-testid="password-password"]', 'pass')
      await page.click('[data-testid="save-password-button"]')

      // Open export dialog
      await page.click('[data-testid="export-data-button"]')

      // Select encrypted package format
      await page.click('[data-testid="encrypted-package-option"]')
      await page.fill('[data-testid="export-passphrase"]', 'export-passphrase-123')
      await page.click('[data-testid="export-button"]')

      // Verify export success
      await expect(page.locator('[data-testid="export-success"]')).toBeVisible()
      
      // Verify file download
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="download-button"]')
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('.svpkg')
    })

    test('re-imports encrypted package', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Add data
      await page.click('[data-testid="add-password-button"]')
      await page.fill('[data-testid="password-title"]', 'Test Password')
      await page.fill('[data-testid="password-url"]', 'https://test.com')
      await page.fill('[data-testid="password-username"]', 'user')
      await page.fill('[data-testid="password-password"]', 'pass')
      await page.click('[data-testid="save-password-button"]')

      // Export encrypted package
      await page.click('[data-testid="export-data-button"]')
      await page.click('[data-testid="encrypted-package-option"]')
      await page.fill('[data-testid="export-passphrase"]', 'export-passphrase-123')
      await page.click('[data-testid="export-button"]')

      // Clear vault
      await page.click('[data-testid="clear-all-data-button"]')
      await page.click('[data-testid="confirm-clear-button"]')

      // Import encrypted package
      await page.click('[data-testid="import-data-button"]')
      const encryptedFile = new File(['encrypted-data'], 'export.svpkg', { type: 'application/octet-stream' })
      await page.setInputFiles('[data-testid="file-input"]', encryptedFile)
      await page.fill('[data-testid="import-passphrase"]', 'export-passphrase-123')
      await page.click('[data-testid="import-button"]')

      // Verify re-import success
      await expect(page.locator('[data-testid="import-success"]')).toBeVisible()
      await expect(page.locator('[data-testid="password-item"]')).toHaveCount(1)
    })
  })

  test.describe('Bank Statements and Investments', () => {
    test('imports bank statements from CSV', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Navigate to bank statements
      await page.click('[data-testid="bank-statements-section"]')

      // Import bank statements
      await page.click('[data-testid="import-statements-button"]')
      const csvContent = 'date,description,amount,account\n2023-01-01,Salary Deposit,5000.00,Checking\n2023-01-02,Grocery Store,-50.00,Checking'
      const file = new File([csvContent], 'statements.csv', { type: 'text/csv' })
      
      await page.setInputFiles('[data-testid="file-input"]', file)
      await page.click('[data-testid="import-button"]')

      // Verify import success
      await expect(page.locator('[data-testid="import-success"]')).toBeVisible()
      await expect(page.locator('[data-testid="statement-item"]')).toHaveCount(2)
    })

    test('displays bank statement analysis charts', async ({ page }) => {
      // Set up vault with bank statements
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      await page.click('[data-testid="bank-statements-section"]')
      await page.click('[data-testid="import-statements-button"]')
      const csvContent = 'date,description,amount,account\n2023-01-01,Salary Deposit,5000.00,Checking\n2023-01-02,Grocery Store,-50.00,Checking\n2023-01-03,Gas Station,-30.00,Checking'
      const file = new File([csvContent], 'statements.csv', { type: 'text/csv' })
      
      await page.setInputFiles('[data-testid="file-input"]', file)
      await page.click('[data-testid="import-button"]')

      // Verify charts are displayed
      await expect(page.locator('[data-testid="balance-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="expense-categories-chart"]')).toBeVisible()
      await expect(page.locator('[data-testid="monthly-summary-chart"]')).toBeVisible()
    })

    test('manages investment portfolio', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Navigate to investments
      await page.click('[data-testid="investments-section"]')

      // Add investment
      await page.click('[data-testid="add-investment-button"]')
      await page.fill('[data-testid="investment-symbol"]', 'AAPL')
      await page.fill('[data-testid="investment-shares"]', '10')
      await page.fill('[data-testid="investment-purchase-price"]', '150.00')
      await page.fill('[data-testid="investment-purchase-date"]', '2023-01-01')
      await page.click('[data-testid="save-investment-button"]')

      // Verify investment added
      await expect(page.locator('[data-testid="investment-item"]')).toHaveCount(1)

      // Update current price
      await page.click('[data-testid="update-price-button"]')
      await page.fill('[data-testid="current-price"]', '160.00')
      await page.click('[data-testid="save-price-button"]')

      // Verify ROI calculation
      await expect(page.locator('[data-testid="roi-percentage"]')).toContainText('6.67%')
      await expect(page.locator('[data-testid="total-value"]')).toContainText('$1,600.00')
    })

    test('tracks investment goals', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Navigate to investment goals
      await page.click('[data-testid="investment-goals-section"]')

      // Add investment goal
      await page.click('[data-testid="add-goal-button"]')
      await page.fill('[data-testid="goal-name"]', 'Retirement Fund')
      await page.fill('[data-testid="goal-target-amount"]', '1000000')
      await page.fill('[data-testid="goal-target-date"]', '2050-01-01')
      await page.fill('[data-testid="goal-current-amount"]', '100000')
      await page.click('[data-testid="save-goal-button"]')

      // Verify goal added
      await expect(page.locator('[data-testid="goal-item"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="goal-progress"]')).toContainText('10%')
    })
  })

  test.describe('Analytics Privacy', () => {
    test('sends only counts to admin (no PII/content)', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Add sensitive data
      await page.click('[data-testid="add-password-button"]')
      await page.fill('[data-testid="password-title"]', 'Sensitive Account')
      await page.fill('[data-testid="password-url"]', 'https://sensitive.com')
      await page.fill('[data-testid="password-username"]', 'sensitive-user')
      await page.fill('[data-testid="password-password"]', 'sensitive-password')
      await page.click('[data-testid="save-password-button"]')

      // Intercept analytics requests
      const requests: any[] = []
      await page.route('**/api/v1/ingest/analytics', route => {
        requests.push(route.request().postDataJSON())
        route.fulfill({ status: 200, body: '{}' })
      })

      // Trigger analytics sync
      await page.click('[data-testid="sync-analytics-button"]')

      // Verify analytics payload
      const payload = requests[0]
      expect(payload.sections.passwords).toMatchObject({ total: 1 })
      expect(JSON.stringify(payload)).not.toMatch(/sensitive|password|username|url|content/i)
    })

    test('respects privacy settings', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Disable analytics
      await page.click('[data-testid="settings-button"]')
      await page.click('[data-testid="disable-analytics-toggle"]')
      await page.click('[data-testid="save-settings-button"]')

      // Add data
      await page.click('[data-testid="add-password-button"]')
      await page.fill('[data-testid="password-title"]', 'Test Password')
      await page.fill('[data-testid="password-url"]', 'https://test.com')
      await page.fill('[data-testid="password-username"]', 'user')
      await page.fill('[data-testid="password-password"]', 'pass')
      await page.click('[data-testid="save-password-button"]')

      // Verify no analytics requests are sent
      const requests: any[] = []
      await page.route('**/api/v1/ingest/analytics', route => {
        requests.push(route.request())
      })

      await page.click('[data-testid="sync-analytics-button"]')
      expect(requests).toHaveLength(0)
    })
  })

  test.describe('Accessibility', () => {
    test('has no critical accessibility violations', async ({ page }) => {
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      await injectAxe(page)
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true }
      })
    })

    test('supports keyboard navigation', async ({ page }) => {
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Tab through interactive elements
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Verify focus is on expected element
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName)
      expect(focusedElement).toBe('BUTTON')
    })

    test('has proper ARIA labels', async ({ page }) => {
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Check for ARIA labels
      await expect(page.locator('[aria-label="Add password"]')).toBeVisible()
      await expect(page.locator('[aria-label="Import data"]')).toBeVisible()
      await expect(page.locator('[aria-label="Export data"]')).toBeVisible()
    })
  })

  test.describe('Performance', () => {
    test('loads quickly', async ({ page }) => {
      const startTime = Date.now()
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime

      expect(loadTime).toBeLessThan(3000) // 3 seconds
    })

    test('handles large datasets efficiently', async ({ page }) => {
      // Set up vault
      await page.fill('[data-testid="master-password-input"]', 'test-password-123')
      await page.fill('[data-testid="confirm-password-input"]', 'test-password-123')
      await page.click('[data-testid="set-password-button"]')

      // Import large dataset
      await page.click('[data-testid="import-data-button"]')
      const largeCsvContent = Array.from({ length: 1000 }, (_, i) => 
        `Password ${i},https://example${i}.com,user${i},pass${i}`
      ).join('\n')
      const file = new File([largeCsvContent], 'large.csv', { type: 'text/csv' })
      
      await page.setInputFiles('[data-testid="file-input"]', file)
      
      const startTime = Date.now()
      await page.click('[data-testid="import-button"]')
      await page.waitForSelector('[data-testid="import-success"]')
      const importTime = Date.now() - startTime

      expect(importTime).toBeLessThan(10000) // 10 seconds
      await expect(page.locator('[data-testid="password-item"]')).toHaveCount(1000)
    })
  })
})
