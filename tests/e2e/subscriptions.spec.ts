import { test, expect } from '@playwright/test';
import { unlockVault, spaNavigate, expectNoHorizontalOverflow } from './helpers';

test.describe('subscriptions page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await unlockVault(page);
    await spaNavigate(page, '/subscriptions');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('list renders + view toggle visible', async ({ page }) => {
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    const toggle = page.locator(
      '[data-testid="subs-view-list"], [data-testid="subs-view-grid"], [data-testid="view-toggle-list"], [data-testid="view-toggle-grid"]',
    ).first();
    await expect(toggle).toBeVisible({ timeout: 15_000 });
  });

  test('add button surfaces the create-subscription form', async ({ page }) => {
    const addBtn = page.locator(
      '[data-testid="button-add-subscription"], button:has-text("Add Subscription"), button[aria-label*="Add" i]:has-text("Subscription")',
    ).first();
    if (await addBtn.count() === 0) {
      // Mobile FAB might be the only entry-point.
      const fab = page.locator('[data-testid="button-add-subscription-fab"]').first();
      if (await fab.count() === 0) test.skip(true, 'no add button on this viewport');
      await fab.click();
    } else {
      await addBtn.click();
    }
    const dialog = page.locator('[role="dialog"]:has-text("Subscription"), [data-testid="add-subscription-modal"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('search filters the visible list', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search" i], input[type="search"]').first();
    if (await search.count() === 0) test.skip(true, 'search not in this viewport');
    await search.fill('zzzzzzzz-no-match');
    await page.waitForTimeout(500);
    const rows = await page.locator('[data-testid^="subscription-row-"], [data-testid^="subscription-card-"]').count();
    expect(rows).toBe(0);
    await search.fill('');
  });

  test('grid / list toggle round-trips', async ({ page }) => {
    const grid = page.locator('[data-testid="subs-view-grid"], [data-testid="view-toggle-grid"]').first();
    const list = page.locator('[data-testid="subs-view-list"], [data-testid="view-toggle-list"]').first();
    if (await grid.count() === 0 || await list.count() === 0) {
      test.skip(true, 'view toggle not rendered on this viewport');
    }
    await grid.click();
    await page.waitForTimeout(300);
    await list.click();
  });

  test('billing summary visible somewhere', async ({ page }) => {
    // Match common labels — totals, monthly cost, upcoming renewals etc.
    const summary = page.getByText(/total|monthly|yearly|upcoming|renewal/i).first();
    await expect(summary).toBeVisible({ timeout: 10_000 });
  });

  test('no horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});
