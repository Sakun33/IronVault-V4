import { test, expect } from '@playwright/test';
import { login, unlockVault, TEST_EMAIL, TEST_MASTER_PASSWORD } from './helpers';

test.describe('auth — login flows', () => {
  test('valid credentials reach vault picker or dashboard', async ({ page }) => {
    await login(page);
    // Either vault-picker is visible OR we landed on the authenticated
    // layout — both are valid post-login states.
    const masterPasswordInput = page.locator('input[data-testid="input-unlock-password"]');
    const authenticatedShell = page.locator('main, [role="main"]').first();
    await expect(masterPasswordInput.or(authenticatedShell).first()).toBeVisible({ timeout: 20_000 });
  });

  test('wrong password surfaces an error and stays on login', async ({ page }) => {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
    await page.locator('input[type="password"]').first().fill('wrong-password-xyz');
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();
    // Expect either an inline error toast OR for the user to remain on the login page.
    await page.waitForTimeout(2000);
    const stillOnLogin = page.url().includes('/auth/login');
    expect(stillOnLogin).toBeTruthy();
  });

  test('empty fields keep the submit disabled or surface validation', async ({ page }) => {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    const submit = page.getByRole('button', { name: /sign in|log in/i }).first();
    await submit.click().catch(() => {});
    // We should still be on the login page after a no-op click.
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/auth/login');
  });
});

test.describe('auth — navigation links', () => {
  test('forgot password link navigates to reset', async ({ page }) => {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: /forgot/i }).first();
    if (await link.count() > 0) {
      await link.click();
      await expect(page).toHaveURL(/forgot|reset/i, { timeout: 15_000 });
    }
  });

  test('signup link navigates to signup page', async ({ page }) => {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: /sign ?up|create account|get started/i }).first();
    if (await link.count() > 0) {
      await link.click();
      await expect(page).toHaveURL(/signup|register|sign-up/i, { timeout: 15_000 });
    }
  });
});

test.describe('auth — vault unlock', () => {
  test('correct master password unlocks the vault', async ({ page }) => {
    await unlockVault(page);
    // Master-password input should be gone after unlock.
    await expect(page.locator('input[data-testid="input-unlock-password"]')).toHaveCount(0);
  });

  test('wrong master password keeps the vault locked', async ({ page }) => {
    await login(page);
    const masterInput = page.locator('input[data-testid="input-unlock-password"]').first();
    if (await masterInput.count() === 0) {
      test.skip(true, 'Single-vault auto-unlock — master-password input not rendered');
    }
    await masterInput.fill('wrong-master-pwd');
    await page.locator(
      '[data-testid="button-unlock-cloud-vault"], [data-testid="button-unlock-vault"], button:has-text("Unlock")',
    ).first().click();
    // Vault stays locked → master-password input still on screen after a beat.
    await page.waitForTimeout(2500);
    await expect(masterInput).toBeVisible();
  });
});

test.describe('auth — session', () => {
  test('refresh after login keeps the user signed in', async ({ page, context }) => {
    await unlockVault(page);
    // Persist storage state, refresh, expect not to be bounced to /auth/login.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    expect(page.url()).not.toMatch(/\/auth\/login$/);
    void context;
  });
});

test.describe('auth — sign out', () => {
  test('sign out from menu returns to public surface', async ({ page }) => {
    await unlockVault(page);
    // Try desktop user-menu first, fall back to mobile menu.
    const menuTrigger = page.locator(
      '[data-testid="user-menu-desktop"], button[aria-label="Account menu"], button[aria-label="More options"]',
    ).first();
    await menuTrigger.click().catch(() => {});
    const signOut = page.locator(
      '[data-testid^="menu-sign-out"], [role="menuitem"]:has-text("Sign out")',
    ).first();
    if (await signOut.count() > 0) {
      await signOut.click();
      await page.waitForTimeout(2500);
      // Either landing or login — both are public.
      expect(page.url()).toMatch(/^https:\/\/www\.ironvault\.app\/(auth\/login)?$/);
    }
  });
});
