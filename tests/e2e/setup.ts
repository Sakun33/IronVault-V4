import { test as base, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Extend basic test with custom fixtures
export const test = base.extend({
  // Auto-login for authenticated tests
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/');
    
    // Check if we need to create vault first
    const createVaultButton = page.getByTestId('button-create-vault');
    if (await createVaultButton.isVisible()) {
      await page.getByTestId('input-master-password').fill('TestPassword123!');
      await page.getByTestId('input-confirm-password').fill('TestPassword123!');
      await createVaultButton.click();
      await expect(page.getByTestId('button-unlock-vault')).toBeVisible({ timeout: 5000 });
    }
    
    // Unlock vault
    const unlockButton = page.getByTestId('button-unlock-vault');
    if (await unlockButton.isVisible()) {
      await page.getByTestId('input-unlock-password').fill('TestPassword123!');
      await unlockButton.click();
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
    }
    
    await use(page);
  },

  // Helper for accessibility testing
  makeAxeBuilder: async ({ page }, use) => {
    const makeAxeBuilder = () =>
      new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('#webpack-dev-server-client-overlay');
    await use(makeAxeBuilder);
  },
});

export { expect };

// Helper to seed demo data for tests
export async function seedDemoData(page) {
  await page.goto('/qa');
  await page.getByTestId('qa-seed-data-button').click();
  await expect(page.locator('text=Demo Data Seeded')).toBeVisible({ timeout: 10000 });
}

// Helper to clear all data
export async function clearAllData(page) {
  await page.goto('/qa');
  
  // Handle confirm dialog
  page.on('dialog', dialog => dialog.accept());
  
  await page.getByTestId('qa-clear-data-button').click();
  await expect(page.locator('text=All Data Cleared')).toBeVisible({ timeout: 5000 });
}

// Wait for animations to complete
export async function waitForAnimations(page) {
  await page.waitForTimeout(500);
}

// Take a full page screenshot with consistent naming
export async function takeFullPageScreenshot(page, name: string) {
  await waitForAnimations(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
}
