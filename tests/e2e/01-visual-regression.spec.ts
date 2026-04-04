import { test, expect, takeFullPageScreenshot, seedDemoData } from './setup';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ authenticatedPage }) => {
    // Seed demo data for consistent screenshots
    await seedDemoData(authenticatedPage);
  });

  test('Unlock screen - light and dark', async ({ page }) => {
    await page.goto('/');
    await takeFullPageScreenshot(page, 'unlock-screen');
  });

  test('Dashboard - overview with data', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await takeFullPageScreenshot(authenticatedPage, 'dashboard');
  });

  test('Passwords list - with entries', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/passwords');
    await expect(authenticatedPage.locator('text=Password Vault')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'passwords-list');
  });

  test('Password Generator modal - open state', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.getByTestId('open-password-generator').click();
    await expect(authenticatedPage.locator('text=Password Generator')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'password-generator-modal');
  });

  test('Add Password modal - form visible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/passwords');
    await authenticatedPage.locator('button', { hasText: 'Add' }).first().click();
    await expect(authenticatedPage.locator('text=Add New Password')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'add-password-modal');
  });

  test('Subscriptions page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/subscriptions');
    await expect(authenticatedPage.locator('text=Subscriptions')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'subscriptions');
  });

  test('Notes page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/notes');
    await expect(authenticatedPage.locator('text=Notes')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'notes');
  });

  test('Expenses page', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/expenses');
    await expect(authenticatedPage.locator('text=Expenses')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'expenses');
  });

  test('Settings page - theme toggle visible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    await expect(authenticatedPage.locator('text=Settings')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'settings');
  });

  test('More menu drawer - open state', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    // Open more menu if on mobile
    const moreButton = authenticatedPage.getByTestId('bottom-tab-more');
    if (await moreButton.isVisible()) {
      await moreButton.click();
      await authenticatedPage.waitForTimeout(500); // Animation
      await takeFullPageScreenshot(authenticatedPage, 'more-menu-drawer');
    }
  });

  test('Bottom navigation - visible and not overlapping', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    await authenticatedPage.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    // Check bottom tabs are visible
    await expect(authenticatedPage.getByTestId('bottom-tab-dashboard')).toBeVisible();
    await expect(authenticatedPage.getByTestId('bottom-tab-passwords')).toBeVisible();
    
    // Take screenshot showing tabs
    await takeFullPageScreenshot(authenticatedPage, 'bottom-tabs');
  });

  test('Search modal - open and functional', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Click search button in header
    const searchButton = authenticatedPage.locator('button', { has: authenticatedPage.locator('svg').first() }).first();
    await searchButton.click();
    
    await authenticatedPage.waitForTimeout(300);
    await takeFullPageScreenshot(authenticatedPage, 'search-modal');
  });
});
