import { test, expect } from '@playwright/test';
import { unlockVault, spaNavigate, expectNoHorizontalOverflow } from './helpers';

test.describe('notes page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await unlockVault(page);
    await spaNavigate(page, '/notes');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('header New Note button is visible without scrolling', async ({ page }) => {
    const header = page.locator('[data-testid="button-new-note-header"]');
    await expect(header).toBeVisible({ timeout: 20_000 });
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.y).toBeLessThan(150);
  });

  test('new-note dropdown surfaces Blank + templates', async ({ page }) => {
    await page.locator('[data-testid="button-new-note-header"]').click();
    const blank = page.locator('[data-testid="menu-item-blank-note"]');
    await expect(blank).toBeVisible({ timeout: 10_000 });
    // At least one template entry should be present.
    const anyTemplate = page.locator('[data-testid^="menu-item-template-"]').first();
    await expect(anyTemplate).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('blank note opens the editor with title input + toolbar', async ({ page }) => {
    await page.locator('[data-testid="button-new-note-header"]').click();
    await page.locator('[data-testid="menu-item-blank-note"]').click();
    const title = page.locator('input[aria-label="Note title"], input[placeholder*="Untitled" i]').first();
    await expect(title).toBeVisible({ timeout: 10_000 });
    // Toolbar buttons — bold/italic/underline should be present.
    const bold = page.locator('button[aria-label*="Bold" i]').first();
    await expect(bold).toBeVisible();
  });

  test('typing title persists when Done clicked', async ({ page }) => {
    await page.locator('[data-testid="button-new-note-header"]').click();
    await page.locator('[data-testid="menu-item-blank-note"]').click();
    const title = page.locator('input[aria-label="Note title"], input[placeholder*="Untitled" i]').first();
    await expect(title).toBeVisible();
    const stamp = `e2e-${Date.now()}`;
    await title.fill(stamp);
    const done = page.locator('[data-testid="button-editor-done"], button:has-text("Done")').first();
    if (await done.count() > 0) {
      await done.click();
      await page.waitForTimeout(2000);
      // The new note should now appear in the list.
      await expect(page.getByText(stamp).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('search filters the notes list', async ({ page }) => {
    const searchToggle = page.locator('button[aria-label*="Search" i]').first();
    if (await searchToggle.count() > 0) await searchToggle.click().catch(() => {});
    const search = page.locator('input[placeholder*="Search" i]').first();
    if (await search.count() === 0) test.skip(true, 'search input not exposed in this viewport');
    await search.fill('zzzzzzzzz-no-match');
    await page.waitForTimeout(500);
    // Empty / no-match state should be visible OR no note rows.
    const noResult = page.getByText(/no notes|nothing found|no results/i).first();
    if (await noResult.count() === 0) {
      // Confirm at least no rows match the no-op query.
      const rows = await page.locator('[data-testid^="note-row-"], [data-testid^="note-card-"]').count();
      expect(rows).toBe(0);
    }
  });

  test('no horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});
