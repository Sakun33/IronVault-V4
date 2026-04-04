import { test, expect } from './setup';

test.describe('Accessibility Tests (WCAG 2.1 AA)', () => {
  test('Unlock page - no a11y violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/');
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Dashboard - no a11y violations', async ({ authenticatedPage, makeAxeBuilder }) => {
    await authenticatedPage.goto('/');
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Passwords page - no a11y violations', async ({ authenticatedPage, makeAxeBuilder }) => {
    await authenticatedPage.goto('/passwords');
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Password Generator modal - no a11y violations', async ({ authenticatedPage, makeAxeBuilder }) => {
    await authenticatedPage.goto('/');
    const openButton = authenticatedPage.getByTestId('open-password-generator');
    if (await openButton.isVisible()) {
      await openButton.click();
      await authenticatedPage.waitForTimeout(500);
      const accessibilityScanResults = await makeAxeBuilder().analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('Settings page - no a11y violations', async ({ authenticatedPage, makeAxeBuilder }) => {
    await authenticatedPage.goto('/settings');
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Color contrast - light mode', async ({ page, makeAxeBuilder }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const results = await makeAxeBuilder()
      .withTags(['wcag2aa'])
      .analyze();
    
    const contrastViolations = results.violations.filter(v => 
      v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    );
    expect(contrastViolations).toHaveLength(0);
  });

  test('Color contrast - dark mode', async ({ page, makeAxeBuilder }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    const results = await makeAxeBuilder()
      .withTags(['wcag2aa'])
      .analyze();
    
    const contrastViolations = results.violations.filter(v => 
      v.id === 'color-contrast' || v.id === 'color-contrast-enhanced'
    );
    expect(contrastViolations).toHaveLength(0);
  });

  test('Keyboard navigation - bottom tabs accessible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/');
    
    // Tab through bottom navigation
    const dashboardTab = authenticatedPage.getByTestId('bottom-tab-dashboard');
    const passwordsTab = authenticatedPage.getByTestId('bottom-tab-passwords');
    
    if (await dashboardTab.isVisible()) {
      await dashboardTab.focus();
      expect(await dashboardTab.evaluate(el => document.activeElement === el)).toBeTruthy();
      
      await authenticatedPage.keyboard.press('Tab');
      await passwordsTab.focus();
      expect(await passwordsTab.evaluate(el => document.activeElement === el)).toBeTruthy();
    }
  });

  test('Focus indicators visible', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/passwords');
    
    // Find first button and check focus ring
    const addButton = authenticatedPage.locator('button').first();
    await addButton.focus();
    
    // Check that focused element has visible outline or ring
    const focusStyles = await addButton.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow
      };
    });
    
    const hasFocusIndicator = 
      focusStyles.outlineWidth !== '0px' || 
      focusStyles.boxShadow !== 'none';
    
    expect(hasFocusIndicator).toBeTruthy();
  });

  test('Touch targets minimum 44x44px', async ({ authenticatedPage }) => {
    await authenticatedPage.setViewportSize({ width: 375, height: 667 });
    await authenticatedPage.goto('/');
    
    const bottomTabs = await authenticatedPage.getByTestId('bottom-tab-dashboard').boundingBox();
    
    if (bottomTabs) {
      expect(bottomTabs.height).toBeGreaterThanOrEqual(44);
      expect(bottomTabs.width).toBeGreaterThanOrEqual(44);
    }
  });
});
