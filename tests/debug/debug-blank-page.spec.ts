import { test, expect } from '@playwright/test';

test.describe('SubSafe Frontend Debug', () => {
  test('should load the app without blank page', async ({ page }) => {
    // Navigate to the frontend
    await page.goto('http://localhost:5173');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-blank-page.png' });
    
    // Check if the root element exists
    const rootElement = await page.locator('#root');
    await expect(rootElement).toBeVisible();
    
    // Check if there's any content in the root
    const rootContent = await rootElement.textContent();
    console.log('Root content:', rootContent);
    
    // Check for any JavaScript errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit more for any async operations
    await page.waitForTimeout(2000);
    
    // Check if we can see the title
    const title = await page.title();
    console.log('Page title:', title);
    
    // Check if there's any visible content
    const bodyText = await page.locator('body').textContent();
    console.log('Body text:', bodyText);
    
    // Check for React root
    const reactRoot = await page.locator('#root').innerHTML();
    console.log('React root HTML:', reactRoot);
    
    // Log any errors
    if (errors.length > 0) {
      console.log('JavaScript errors:', errors);
    }
    
    // The test should pass if we can see the root element
    expect(rootElement).toBeVisible();
  });
  
  test('should show login screen', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Look for login-related elements
    const loginElements = await page.locator('input[type="password"], button:has-text("Create"), button:has-text("Unlock")').count();
    console.log('Login elements found:', loginElements);
    
    // Take screenshot
    await page.screenshot({ path: 'debug-login-screen.png' });
    
    // Check if we can see password input or create vault button
    const hasPasswordInput = await page.locator('input[type="password"]').count() > 0;
    const hasCreateButton = await page.locator('button:has-text("Create")').count() > 0;
    const hasUnlockButton = await page.locator('button:has-text("Unlock")').count() > 0;
    
    console.log('Has password input:', hasPasswordInput);
    console.log('Has create button:', hasCreateButton);
    console.log('Has unlock button:', hasUnlockButton);
    
    // At least one of these should be present
    expect(hasPasswordInput || hasCreateButton || hasUnlockButton).toBeTruthy();
  });
});
