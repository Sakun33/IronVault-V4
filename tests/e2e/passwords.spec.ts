import { test, expect } from '@playwright/test';
import { unlockVault, spaNavigate, expectNoHorizontalOverflow } from './helpers';

test.describe('passwords page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await unlockVault(page);
    await spaNavigate(page, '/passwords');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('list area renders + view toggle visible', async ({ page }) => {
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    const toggle = page.locator('[data-testid="view-toggle-list"], [data-testid="view-toggle-grid"]').first();
    await expect(toggle).toBeVisible({ timeout: 15_000 });
  });

  test('search input filters the visible list', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search" i], input[type="search"]').first();
    await expect(search).toBeVisible();
    await search.fill('zzzzzzzzzz-no-match-zzzzzzz');
    await page.waitForTimeout(500);
    // No password row should be visible for a deliberately-no-match query.
    const rowCount = await page.locator('[data-testid^="password-row-"], [data-testid^="password-card-"]').count();
    expect(rowCount).toBe(0);
    await search.fill('');
  });

  test('category dropdown is interactive', async ({ page }) => {
    const trigger = page.locator(
      'button:has-text("All Categories"), [role="combobox"]:has-text("Categor")',
    ).first();
    if (await trigger.count() === 0) test.skip(true, 'category select not rendered on this viewport');
    await trigger.click();
    // Some option list should be visible after clicking.
    await page.waitForTimeout(500);
    const list = page.locator('[role="listbox"], [role="menu"]').first();
    await expect(list).toBeVisible({ timeout: 5_000 });
    await page.keyboard.press('Escape');
  });

  test('strength filter dropdown is interactive', async ({ page }) => {
    const trigger = page.locator(
      'button:has-text("All Strength"), button:has-text("Strength"), [role="combobox"]:has-text("Strength")',
    ).first();
    if (await trigger.count() === 0) test.skip(true, 'strength select not rendered on this viewport');
    await trigger.click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
  });

  test('add button opens the create-password dialog', async ({ page }) => {
    const addBtn = page.locator(
      '[data-testid="button-add-password"], button[aria-label*="Add Password" i], button[title*="Add Password" i]',
    ).first();
    await addBtn.scrollIntoViewIfNeeded().catch(() => {});
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]:has-text("Add"), [data-testid="add-password-modal"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // Close the dialog cleanly.
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('grid / list toggle round-trips', async ({ page }) => {
    const grid = page.locator('[data-testid="view-toggle-grid"]').first();
    const list = page.locator('[data-testid="view-toggle-list"]').first();
    if (await grid.count() === 0 || await list.count() === 0) {
      test.skip(true, 'view toggle not rendered on this viewport');
    }
    await grid.click();
    await page.waitForTimeout(300);
    await list.click();
    await page.waitForTimeout(300);
    await expect(list).toHaveAttribute('aria-selected', 'true');
  });

  test('favicons render for known services', async ({ page }) => {
    // The Favicon component routes through /api/favicon — at least one
    // password row should have a favicon image OR a fallback initial.
    const favicons = page.locator('img[src*="/api/favicon"]');
    const initials = page.locator('div[class*="bg-"]:has(.select-none)');
    const total = (await favicons.count()) + (await initials.count());
    expect(total).toBeGreaterThan(0);
  });

  test('password generator opens from the toolbox', async ({ page }) => {
    const generatorBtn = page.locator(
      '[data-testid="generate-password-button"], button:has-text("Generate"), button[aria-label*="Generator" i]',
    ).first();
    if (await generatorBtn.count() === 0) test.skip(true, 'generator button not surfaced here');
    await generatorBtn.click();
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('no horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});
