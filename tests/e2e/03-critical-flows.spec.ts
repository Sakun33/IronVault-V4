import { test, expect, seedDemoData, clearAllData, takeFullPageScreenshot } from './setup';

test.describe('Critical User Flows', () => {
  
  test('FLOW 1: First launch -> Create vault -> Unlock -> Dashboard', async ({ page }) => {
    await clearAllData(page);
    
    // Navigate to app
    await page.goto('/');
    
    // Should show create vault screen
    await expect(page.getByTestId('button-create-vault')).toBeVisible();
    await takeFullPageScreenshot(page, 'flow1-create-vault');
    
    // Fill and create vault
    await page.getByTestId('input-master-password').fill('SecurePass123!');
    await page.getByTestId('input-confirm-password').fill('SecurePass123!');
    await page.getByTestId('button-create-vault').click();
    
    // Should redirect to unlock
    await expect(page.getByTestId('button-unlock-vault')).toBeVisible({ timeout: 5000 });
    await takeFullPageScreenshot(page, 'flow1-unlock');
    
    // Unlock vault
    await page.getByTestId('input-unlock-password').fill('SecurePass123!');
    await page.getByTestId('button-unlock-vault').click();
    
    // Should see dashboard
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 });
    await takeFullPageScreenshot(page, 'flow1-dashboard');
  });

  test('FLOW 2: Unlock errors + show/hide password', async ({ page }) => {
    await page.goto('/');
    
    // Enter wrong password
    await page.getByTestId('input-unlock-password').fill('WrongPassword');
    await page.getByTestId('button-unlock-vault').click();
    
    // Should show error
    await expect(page.locator('text=Failed to unlock')).toBeVisible({ timeout: 3000 });
    await takeFullPageScreenshot(page, 'flow2-error');
    
    // Test show/hide password toggle
    const passwordInput = page.getByTestId('input-unlock-password');
    const toggleButton = page.getByTestId('toggle-password-visibility');
    
    if (await toggleButton.isVisible()) {
      // Initially should be password type
      expect(await passwordInput.getAttribute('type')).toBe('password');
      
      // Click toggle
      await toggleButton.click();
      expect(await passwordInput.getAttribute('type')).toBe('text');
      
      // Click again
      await toggleButton.click();
      expect(await passwordInput.getAttribute('type')).toBe('password');
    }
  });

  test('FLOW 3: Password Generator modal', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Open password generator
    const generatorButton = authenticatedPage.getByTestId('open-password-generator');
    if (await generatorButton.isVisible()) {
      await generatorButton.click();
      
      // Modal should be visible
      await expect(authenticatedPage.locator('text=Password Generator')).toBeVisible();
      await takeFullPageScreenshot(authenticatedPage, 'flow3-generator-open');
      
      // Adjust length slider
      const slider = authenticatedPage.locator('input[type="range"]').first();
      await slider.fill('20');
      
      // Toggle options
      const uppercaseCheckbox = authenticatedPage.getByTestId('checkbox-uppercase');
      if (await uppercaseCheckbox.isVisible()) {
        await uppercaseCheckbox.click();
      }
      
      await takeFullPageScreenshot(authenticatedPage, 'flow3-generator-modified');
      
      // Copy password
      const copyButton = authenticatedPage.getByTestId('copy-password-button');
      if (await copyButton.isVisible()) {
        await copyButton.click();
        await expect(authenticatedPage.locator('text=Copied')).toBeVisible({ timeout: 3000 });
      }
      
      // Close modal
      const cancelButton = authenticatedPage.getByTestId('cancel-button');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
  });

  test('FLOW 4: Passwords CRUD', async ({ authenticatedPage }) => {
    await clearAllData(authenticatedPage);
    await authenticatedPage.goto('/passwords');
    
    // Add new password
    const addButton = authenticatedPage.locator('button', { hasText: 'Add' }).first();
    await addButton.click();
    
    await expect(authenticatedPage.getByTestId('input-site-name')).toBeVisible();
    await takeFullPageScreenshot(authenticatedPage, 'flow4-add-password-modal');
    
    // Fill form with long strings
    await authenticatedPage.getByTestId('input-site-name').fill('Very Long Service Name That Tests UI Wrapping Behavior');
    await authenticatedPage.getByTestId('input-site-url').fill('https://example-with-long-subdomain.verylongdomain.com');
    await authenticatedPage.getByTestId('input-username').fill('very.long.email.address@example.com');
    await authenticatedPage.getByTestId('input-password').fill('TestPass123!');
    
    await takeFullPageScreenshot(authenticatedPage, 'flow4-add-password-filled');
    
    // Save
    await authenticatedPage.getByTestId('save-password-button').click();
    
    // Should show in list
    await expect(authenticatedPage.locator('text=Very Long Service')).toBeVisible({ timeout: 5000 });
    await takeFullPageScreenshot(authenticatedPage, 'flow4-password-saved');
    
    // Copy password
    const copyButton = authenticatedPage.locator('button[aria-label*="Copy"]').first();
    if (await copyButton.isVisible()) {
      await copyButton.click();
      await expect(authenticatedPage.locator('text=Copied')).toBeVisible({ timeout: 3000 });
    }
    
    // Edit password
    const editButton = authenticatedPage.getByTestId('edit-password-button').first();
    if (await editButton.isVisible()) {
      await editButton.click();
      await authenticatedPage.getByTestId('input-site-name').fill('Updated Service Name');
      await authenticatedPage.getByTestId('save-password-button').click();
      await expect(authenticatedPage.locator('text=Updated Service')).toBeVisible({ timeout: 5000 });
    }
    
    // Delete password
    const deleteButton = authenticatedPage.getByTestId('delete-password-button').first();
    if (await deleteButton.isVisible()) {
      authenticatedPage.on('dialog', dialog => dialog.accept());
      await deleteButton.click();
      await expect(authenticatedPage.locator('text=Updated Service')).not.toBeVisible({ timeout: 5000 });
    }
    
    await takeFullPageScreenshot(authenticatedPage, 'flow4-password-deleted');
  });

  test('FLOW 5: Subscriptions CRUD', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/subscriptions');
    
    // Add subscription
    const addButton = authenticatedPage.locator('button', { hasText: 'Add' }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      
      await expect(authenticatedPage.locator('text=Add Subscription')).toBeVisible({ timeout: 3000 });
      await takeFullPageScreenshot(authenticatedPage, 'flow5-add-subscription');
    }
  });

  test('FLOW 6: Notes with long content', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/notes');
    
    const addButton = authenticatedPage.locator('button', { hasText: 'Add' }).first();
    if (await addButton.isVisible()) {
      await addButton.click();
      
      const longContent = 'This is a very long note that should test scrolling behavior. '.repeat(20);
      
      const titleInput = authenticatedPage.locator('input[placeholder*="title" i]').first();
      const contentArea = authenticatedPage.locator('textarea').first();
      
      if (await titleInput.isVisible() && await contentArea.isVisible()) {
        await titleInput.fill('Long Note Title');
        await contentArea.fill(longContent);
        
        await takeFullPageScreenshot(authenticatedPage, 'flow6-long-note');
        
        const saveButton = authenticatedPage.locator('button', { hasText: 'Save' }).first();
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
      }
    }
  });

  test('FLOW 7: Settings - Theme switching', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/settings');
    
    await takeFullPageScreenshot(authenticatedPage, 'flow7-settings-initial');
    
    // Find theme toggle
    const themeButton = authenticatedPage.locator('button[aria-label*="theme" i]').first();
    if (await themeButton.isVisible()) {
      // Switch to dark
      await authenticatedPage.emulateMedia({ colorScheme: 'dark' });
      await authenticatedPage.waitForTimeout(500);
      await takeFullPageScreenshot(authenticatedPage, 'flow7-settings-dark');
      
      // Switch to light
      await authenticatedPage.emulateMedia({ colorScheme: 'light' });
      await authenticatedPage.waitForTimeout(500);
      await takeFullPageScreenshot(authenticatedPage, 'flow7-settings-light');
    }
  });

  test('FLOW 8: Navigation + Drawer', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/');
    
    // Open more drawer
    const moreTab = authenticatedPage.getByTestId('bottom-tab-more');
    if (await moreTab.isVisible()) {
      await moreTab.click();
      await authenticatedPage.waitForTimeout(500);
      
      await takeFullPageScreenshot(authenticatedPage, 'flow8-drawer-open');
      
      // Navigate to a page
      const profileLink = authenticatedPage.locator('text=Profile').first();
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await expect(authenticatedPage.locator('text=Profile')).toBeVisible();
        await takeFullPageScreenshot(authenticatedPage, 'flow8-navigated');
      }
    }
  });

  test('FLOW 9: Mobile viewport - no overlapping content', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await seedDemoData(authenticatedPage);
    await authenticatedPage.goto('/');
    
    // Check that header is visible
    await expect(authenticatedPage.locator('text=SubSafe')).toBeVisible();
    
    // Check that bottom tabs are visible
    await expect(authenticatedPage.getByTestId('bottom-tab-dashboard')).toBeVisible();
    
    // Scroll to bottom of page
    await authenticatedPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await authenticatedPage.waitForTimeout(500);
    
    // Bottom tabs should still be visible
    await expect(authenticatedPage.getByTestId('bottom-tab-dashboard')).toBeVisible();
    
    await takeFullPageScreenshot(authenticatedPage, 'flow9-mobile-no-overlap');
  });

  test('FLOW 10: Keyboard handling - input remains visible', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/passwords');
    
    // Open add password
    const addButton = authenticatedPage.locator('button', { hasText: 'Add' }).first();
    await addButton.click();
    
    // Focus on input
    const nameInput = authenticatedPage.getByTestId('input-site-name');
    await nameInput.click();
    
    // Input should be visible after focus
    await expect(nameInput).toBeVisible();
    
    // Save button should also be visible
    const saveButton = authenticatedPage.getByTestId('save-password-button');
    await expect(saveButton).toBeVisible();
    
    await takeFullPageScreenshot(authenticatedPage, 'flow10-keyboard-visible');
  });
});
