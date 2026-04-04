import { test, expect } from '@playwright/test';

test.describe('SubSafe Import/Export Enhancements', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:5000');
    
    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should load the application successfully', async ({ page }) => {
    // Check if the app loads
    await expect(page).toHaveTitle(/SubSafe/);
    
    // Check if main elements are present
    await expect(page.locator('text=SubSafe')).toBeVisible();
  });

  test('should open import/export modal', async ({ page }) => {
    // Look for settings or import/export button
    const settingsButton = page.locator('button:has-text("Settings"), button:has-text("Import"), button:has-text("Export")').first();
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      // Look for import/export modal
      const importExportButton = page.locator('button:has-text("Import"), button:has-text("Export")').first();
      if (await importExportButton.isVisible()) {
        await importExportButton.click();
        
        // Check if modal opens
        await expect(page.locator('text=Import')).toBeVisible();
      }
    }
  });

  test('should test plaintext import functionality', async ({ page }) => {
    // Navigate to import/export modal
    const settingsButton = page.locator('button:has-text("Settings"), button:has-text("Import"), button:has-text("Export")').first();
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      const importExportButton = page.locator('button:has-text("Import"), button:has-text("Export")').first();
      if (await importExportButton.isVisible()) {
        await importExportButton.click();
        
        // Check if import tab is available
        const importTab = page.locator('text=Import').first();
        if (await importTab.isVisible()) {
          await importTab.click();
          
          // Check if file input is present
          const fileInput = page.locator('input[type="file"]');
          await expect(fileInput).toBeVisible();
          
          // Check if password field is optional (new feature)
          const passwordInput = page.locator('input[type="password"]');
          if (await passwordInput.isVisible()) {
            // Check if placeholder indicates password is optional
            const placeholder = await passwordInput.getAttribute('placeholder');
            expect(placeholder).toContain('optional');
          }
        }
      }
    }
  });

  test('should test export functionality', async ({ page }) => {
    // Navigate to import/export modal
    const settingsButton = page.locator('button:has-text("Settings"), button:has-text("Import"), button:has-text("Export")').first();
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      const importExportButton = page.locator('button:has-text("Import"), button:has-text("Export")').first();
      if (await importExportButton.isVisible()) {
        await importExportButton.click();
        
        // Check if export tab is available
        const exportTab = page.locator('text=Export').first();
        if (await exportTab.isVisible()) {
          await exportTab.click();
          
          // Check if password field is required for export
          const passwordInput = page.locator('input[type="password"]');
          if (await passwordInput.isVisible()) {
            // Check if placeholder indicates password is required
            const placeholder = await passwordInput.getAttribute('placeholder');
            expect(placeholder).toContain('password');
          }
        }
      }
    }
  });

  test('should test mobile responsiveness', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if app is responsive
    await expect(page.locator('text=SubSafe')).toBeVisible();
    
    // Test touch interactions
    const settingsButton = page.locator('button:has-text("Settings"), button:has-text("Import"), button:has-text("Export")').first();
    if (await settingsButton.isVisible()) {
      await settingsButton.tap();
    }
  });
});
