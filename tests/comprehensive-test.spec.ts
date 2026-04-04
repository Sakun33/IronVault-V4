import { test, expect } from '@playwright/test';

test.describe('SubSafe Offline - Comprehensive Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5000');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
    
    // Check if we're on login page
    const isLoginPage = await page.locator('input[type="password"]').isVisible();
    if (isLoginPage) {
      // Login with test password
      await page.fill('input[type="password"]', '11223344');
      await page.click('button[type="submit"]');
      await page.waitForLoadState('networkidle');
    }
  });

  test('Dashboard loads correctly and shows stats', async ({ page }) => {
    // Check if dashboard is visible
    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    
    // Check for stats cards
    await expect(page.locator('text=Total Passwords')).toBeVisible();
    await expect(page.locator('text=Active Subscriptions')).toBeVisible();
    await expect(page.locator('text=Monthly Spend')).toBeVisible();
    
    // Check for action buttons
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible();
    await expect(page.locator('button:has-text("Import / Export")')).toBeVisible();
  });

  test('Password Management - Add, Edit, Delete', async ({ page }) => {
    // Navigate to passwords section
    await page.click('a[href="/passwords"]');
    await page.waitForLoadState('networkidle');
    
    // Check if passwords page loads
    await expect(page.locator('h1:has-text("Passwords")')).toBeVisible();
    
    // Test Add Password
    await page.click('button:has-text("Add Password")');
    await expect(page.locator('text=Add New Password')).toBeVisible();
    
    // Fill password form
    await page.fill('input[name="name"]', 'Test Password');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass123');
    await page.fill('input[name="url"]', 'https://test.com');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if password was added
    await expect(page.locator('text=Test Password')).toBeVisible();
    
    // Test Edit Password
    const editButton = page.locator('button[aria-label="Edit"]').first();
    await editButton.click();
    
    // Check if edit modal opens
    await expect(page.locator('text=Edit Password')).toBeVisible();
    
    // Update password name
    await page.fill('input[name="name"]', 'Updated Test Password');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if password was updated
    await expect(page.locator('text=Updated Test Password')).toBeVisible();
    
    // Test Delete Password
    const deleteButton = page.locator('button[aria-label="Delete"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    await page.waitForLoadState('networkidle');
    
    // Check if password was deleted
    await expect(page.locator('text=Updated Test Password')).not.toBeVisible();
  });

  test('Subscription Management - Add, Edit, Delete', async ({ page }) => {
    // Navigate to subscriptions section
    await page.click('a[href="/subscriptions"]');
    await page.waitForLoadState('networkidle');
    
    // Check if subscriptions page loads
    await expect(page.locator('h1:has-text("Subscriptions")')).toBeVisible();
    
    // Test Add Subscription
    await page.click('button:has-text("Add Subscription")');
    await expect(page.locator('text=Add New Subscription')).toBeVisible();
    
    // Fill subscription form
    await page.fill('input[name="name"]', 'Test Subscription');
    await page.fill('input[name="cost"]', '9.99');
    await page.selectOption('select[name="billingCycle"]', 'monthly');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if subscription was added
    await expect(page.locator('text=Test Subscription')).toBeVisible();
    
    // Test Edit Subscription
    const editButton = page.locator('button[aria-label="Edit"]').first();
    await editButton.click();
    
    // Check if edit modal opens
    await expect(page.locator('text=Edit Subscription')).toBeVisible();
    
    // Update subscription name
    await page.fill('input[name="name"]', 'Updated Test Subscription');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if subscription was updated
    await expect(page.locator('text=Updated Test Subscription')).toBeVisible();
    
    // Test Delete Subscription
    const deleteButton = page.locator('button[aria-label="Delete"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    await page.waitForLoadState('networkidle');
    
    // Check if subscription was deleted
    await expect(page.locator('text=Updated Test Subscription')).not.toBeVisible();
  });

  test('Notes Management - Add, Edit, Delete', async ({ page }) => {
    // Navigate to notes section
    await page.click('a[href="/notes"]');
    await page.waitForLoadState('networkidle');
    
    // Check if notes page loads
    await expect(page.locator('h1:has-text("Notes")')).toBeVisible();
    
    // Test Add Note
    await page.click('button:has-text("Add Note")');
    await expect(page.locator('text=Add New Note')).toBeVisible();
    
    // Fill note form
    await page.fill('input[name="title"]', 'Test Note');
    await page.fill('textarea[name="content"]', 'This is a test note content');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if note was added
    await expect(page.locator('text=Test Note')).toBeVisible();
    
    // Test Edit Note
    const editButton = page.locator('button[aria-label="Edit"]').first();
    await editButton.click();
    
    // Check if edit modal opens
    await expect(page.locator('text=Edit Note')).toBeVisible();
    
    // Update note title
    await page.fill('input[name="title"]', 'Updated Test Note');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if note was updated
    await expect(page.locator('text=Updated Test Note')).toBeVisible();
    
    // Test Delete Note
    const deleteButton = page.locator('button[aria-label="Delete"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    await page.waitForLoadState('networkidle');
    
    // Check if note was deleted
    await expect(page.locator('text=Updated Test Note')).not.toBeVisible();
  });

  test('Expenses Management - Add, Edit, Delete', async ({ page }) => {
    // Navigate to expenses section
    await page.click('a[href="/expenses"]');
    await page.waitForLoadState('networkidle');
    
    // Check if expenses page loads
    await expect(page.locator('h1:has-text("Expenses")')).toBeVisible();
    
    // Test Add Expense
    await page.click('button:has-text("Add Expense")');
    await expect(page.locator('text=Add New Expense')).toBeVisible();
    
    // Fill expense form
    await page.fill('input[name="description"]', 'Test Expense');
    await page.fill('input[name="amount"]', '25.50');
    await page.selectOption('select[name="category"]', 'Food');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if expense was added
    await expect(page.locator('text=Test Expense')).toBeVisible();
    
    // Test Edit Expense
    const editButton = page.locator('button[aria-label="Edit"]').first();
    await editButton.click();
    
    // Check if edit modal opens
    await expect(page.locator('text=Edit Expense')).toBeVisible();
    
    // Update expense description
    await page.fill('input[name="description"]', 'Updated Test Expense');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if expense was updated
    await expect(page.locator('text=Updated Test Expense')).toBeVisible();
    
    // Test Delete Expense
    const deleteButton = page.locator('button[aria-label="Delete"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    await page.waitForLoadState('networkidle');
    
    // Check if expense was deleted
    await expect(page.locator('text=Updated Test Expense')).not.toBeVisible();
  });

  test('Reminders Management - Add, Edit, Delete', async ({ page }) => {
    // Navigate to reminders section
    await page.click('a[href="/reminders"]');
    await page.waitForLoadState('networkidle');
    
    // Check if reminders page loads
    await expect(page.locator('h1:has-text("Reminders")')).toBeVisible();
    
    // Test Add Reminder
    await page.click('button:has-text("Add Reminder")');
    await expect(page.locator('text=Add New Reminder')).toBeVisible();
    
    // Fill reminder form
    await page.fill('input[name="title"]', 'Test Reminder');
    await page.fill('textarea[name="description"]', 'This is a test reminder');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if reminder was added
    await expect(page.locator('text=Test Reminder')).toBeVisible();
    
    // Test Edit Reminder
    const editButton = page.locator('button[aria-label="Edit"]').first();
    await editButton.click();
    
    // Check if edit modal opens
    await expect(page.locator('text=Edit Reminder')).toBeVisible();
    
    // Update reminder title
    await page.fill('input[name="title"]', 'Updated Test Reminder');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if reminder was updated
    await expect(page.locator('text=Updated Test Reminder')).toBeVisible();
    
    // Test Delete Reminder
    const deleteButton = page.locator('button[aria-label="Delete"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    await page.waitForLoadState('networkidle');
    
    // Check if reminder was deleted
    await expect(page.locator('text=Updated Test Reminder')).not.toBeVisible();
  });

  test('Bank Statements - Add, Edit, Delete', async ({ page }) => {
    // Navigate to bank statements section
    await page.click('a[href="/bank-statements"]');
    await page.waitForLoadState('networkidle');
    
    // Check if bank statements page loads
    await expect(page.locator('h1:has-text("Bank Statements")')).toBeVisible();
    
    // Test Add Bank Statement
    await page.click('button:has-text("Add Statement")');
    await expect(page.locator('text=Add New Bank Statement')).toBeVisible();
    
    // Fill bank statement form
    await page.fill('input[name="bankName"]', 'Test Bank');
    await page.fill('input[name="accountNumber"]', '1234567890');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if bank statement was added
    await expect(page.locator('text=Test Bank')).toBeVisible();
    
    // Test Edit Bank Statement
    const editButton = page.locator('button[aria-label="Edit"]').first();
    await editButton.click();
    
    // Check if edit modal opens
    await expect(page.locator('text=Edit Bank Statement')).toBeVisible();
    
    // Update bank name
    await page.fill('input[name="bankName"]', 'Updated Test Bank');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if bank statement was updated
    await expect(page.locator('text=Updated Test Bank')).toBeVisible();
    
    // Test Delete Bank Statement
    const deleteButton = page.locator('button[aria-label="Delete"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    await page.waitForLoadState('networkidle');
    
    // Check if bank statement was deleted
    await expect(page.locator('text=Updated Test Bank')).not.toBeVisible();
  });

  test('Investments - Add, Edit, Delete', async ({ page }) => {
    // Navigate to investments section
    await page.click('a[href="/investments"]');
    await page.waitForLoadState('networkidle');
    
    // Check if investments page loads
    await expect(page.locator('h1:has-text("Investments")')).toBeVisible();
    
    // Test Add Investment
    await page.click('button:has-text("Add Investment")');
    await expect(page.locator('text=Add New Investment')).toBeVisible();
    
    // Fill investment form
    await page.fill('input[name="name"]', 'Test Investment');
    await page.selectOption('select[name="type"]', 'stocks');
    await page.fill('input[name="purchasePrice"]', '100.00');
    await page.fill('input[name="quantity"]', '10');
    
    // Submit form
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if investment was added
    await expect(page.locator('text=Test Investment')).toBeVisible();
    
    // Test Edit Investment
    const editButton = page.locator('button[aria-label="Edit"]').first();
    await editButton.click();
    
    // Check if edit modal opens
    await expect(page.locator('text=Edit Investment')).toBeVisible();
    
    // Update investment name
    await page.fill('input[name="name"]', 'Updated Test Investment');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    // Check if investment was updated
    await expect(page.locator('text=Updated Test Investment')).toBeVisible();
    
    // Test Delete Investment
    const deleteButton = page.locator('button[aria-label="Delete"]').first();
    await deleteButton.click();
    
    // Confirm deletion
    await page.click('button:has-text("Delete")');
    await page.waitForLoadState('networkidle');
    
    // Check if investment was deleted
    await expect(page.locator('text=Updated Test Investment')).not.toBeVisible();
  });

  test('Import/Export functionality', async ({ page }) => {
    // Test Import/Export modal
    await page.click('button:has-text("Import / Export")');
    await expect(page.locator('text=Import & Export')).toBeVisible();
    
    // Test Export functionality
    await page.click('button:has-text("Export")');
    await expect(page.locator('text=Export Vault')).toBeVisible();
    
    // Close modal
    await page.click('button:has-text("Cancel")');
  });

  test('Search functionality', async ({ page }) => {
    // Test search in passwords
    await page.click('a[href="/passwords"]');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test');
    await page.waitForTimeout(500); // Wait for search to process
    
    // Test search in subscriptions
    await page.click('a[href="/subscriptions"]');
    await page.waitForLoadState('networkidle');
    
    const subscriptionSearch = page.locator('input[placeholder*="Search"]');
    await subscriptionSearch.fill('test');
    await page.waitForTimeout(500);
  });

  test('Navigation between sections', async ({ page }) => {
    const sections = [
      { href: '/passwords', title: 'Passwords' },
      { href: '/subscriptions', title: 'Subscriptions' },
      { href: '/notes', title: 'Notes' },
      { href: '/expenses', title: 'Expenses' },
      { href: '/reminders', title: 'Reminders' },
      { href: '/bank-statements', title: 'Bank Statements' },
      { href: '/investments', title: 'Investments' },
      { href: '/dashboard', title: 'Dashboard' }
    ];

    for (const section of sections) {
      await page.click(`a[href="${section.href}"]`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator(`h1:has-text("${section.title}")`)).toBeVisible();
    }
  });

  test('Mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if mobile navigation is visible
    await expect(page.locator('button[aria-label="Menu"]')).toBeVisible();
    
    // Test mobile menu
    await page.click('button[aria-label="Menu"]');
    await expect(page.locator('text=Passwords')).toBeVisible();
    
    // Close mobile menu
    await page.click('button[aria-label="Close"]');
  });

  test('Performance - Page load times', async ({ page }) => {
    const sections = [
      '/passwords',
      '/subscriptions', 
      '/notes',
      '/expenses',
      '/reminders',
      '/bank-statements',
      '/investments'
    ];

    for (const section of sections) {
      const startTime = Date.now();
      await page.goto(`http://localhost:5000${section}`);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      console.log(`${section} loaded in ${loadTime}ms`);
      
      // Page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    }
  });

  test('UI Overflow and Layout Issues', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 375, height: 667 }, // iPhone 8
      { width: 414, height: 896 }, // iPhone 11 Pro Max
      { width: 768, height: 1024 }, // iPad
      { width: 1024, height: 768 }, // Desktop
      { width: 1920, height: 1080 } // Large Desktop
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Test each section for overflow
      const sections = ['/passwords', '/subscriptions', '/notes', '/expenses'];
      
      for (const section of sections) {
        await page.goto(`http://localhost:5000${section}`);
        await page.waitForLoadState('networkidle');
        
        // Check for horizontal scroll
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        
        expect(hasHorizontalScroll).toBe(false);
        
        // Check for elements extending beyond viewport
        const overflowingElements = await page.evaluate(() => {
          const elements = document.querySelectorAll('*');
          const viewportWidth = window.innerWidth;
          const overflowing = [];
          
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > viewportWidth) {
              overflowing.push(el.tagName + (el.className ? '.' + el.className : ''));
            }
          });
          
          return overflowing;
        });
        
        if (overflowingElements.length > 0) {
          console.log(`Overflowing elements in ${section} at ${viewport.width}x${viewport.height}:`, overflowingElements);
        }
      }
    }
  });
});

