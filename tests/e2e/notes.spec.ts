import { test, expect } from './fixtures';
import { unlockVault, spaNavigate, expectNoHorizontalOverflow } from './helpers';

test.describe('notes page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(300_000);
    await unlockVault(page);
    await spaNavigate(page, '/notes');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('header New Note button is visible without scrolling', async ({ page }) => {
    // App renders the same testid in both panes of the two-panel
    // notes layout — use .first() to pick the desktop header copy.
    const header = page.locator('[data-testid="button-new-note-header"]').first();
    await expect(header).toBeVisible({ timeout: 20_000 });
    const box = await header.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.y).toBeLessThan(150);
  });

  // The desktop 2-pane layout (notes.tsx:1212) renders a *plain* "New
  // Note" button whose onClick goes straight to openNewNote() — no
  // dropdown menu. Only the legacy single-pane layout (notes.tsx:932)
  // wrapped it in a DropdownMenu with Blank-Note + Templates items.
  // Tests 2-4 originally assumed the dropdown layout; updated below
  // to also accept "no dropdown, editor opens directly".
  test('new-note button surfaces editor or dropdown', async ({ page }) => {
    await page.locator('[data-testid="button-new-note-header"]').first().click();
    await page.waitForTimeout(800);
    // Either a dropdown appears with the blank/template items, OR the
    // editor opened directly. Pass on either.
    const dropdown = page.locator('[data-testid="menu-item-blank-note"]').first();
    const editorTitle = page.locator('input[aria-label="Note title"], input[placeholder*="Untitled" i]').first();
    const someAppeared = (await dropdown.count() > 0) || (await editorTitle.count() > 0);
    expect(someAppeared).toBe(true);
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('blank note opens the editor with title input + toolbar', async ({ page }) => {
    // The button is `disabled={upgradeBlocked}` (notes.tsx:1215), which is
    // briefly true during initial plan hydration. Without this wait the
    // first click can hit the still-disabled button and silently no-op,
    // leaving the editor closed and the test failing for missing title.
    const newBtn = page.locator('[data-testid="button-new-note-header"]').first();
    await expect(newBtn).toBeEnabled({ timeout: 15_000 });
    await newBtn.click();
    // If a dropdown showed, click "Blank Note"; otherwise the editor
    // is already opening from the direct-create button.
    const dropdownBlank = page.locator('[data-testid="menu-item-blank-note"]').first();
    if (await dropdownBlank.count() > 0) await dropdownBlank.click().catch(() => {});
    const title = page.locator('input[aria-label="Note title"], input[placeholder*="Untitled" i]').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
    const bold = page.locator('button[aria-label*="Bold" i]').first();
    await expect(bold).toBeVisible();
  });

  test('typing title persists when Done clicked', async ({ page }) => {
    const newBtn = page.locator('[data-testid="button-new-note-header"]').first();
    await expect(newBtn).toBeEnabled({ timeout: 15_000 });
    await newBtn.click();
    const dropdownBlank = page.locator('[data-testid="menu-item-blank-note"]').first();
    if (await dropdownBlank.count() > 0) await dropdownBlank.click().catch(() => {});
    const title = page.locator('input[aria-label="Note title"], input[placeholder*="Untitled" i]').first();
    await expect(title).toBeVisible({ timeout: 15_000 });
    const stamp = `e2e-${Date.now()}`;
    await title.fill(stamp);
    const done = page.locator('[data-testid="button-editor-done"], button:has-text("Done")').first();
    if (await done.count() > 0) {
      await done.click();
      await page.waitForTimeout(2000);
      await expect(page.getByText(stamp).first()).toBeVisible({ timeout: 15_000 });
    }
  });

  test('search filters the notes list', async ({ page }) => {
    const searchToggle = page.locator('main button[aria-label*="Search" i]').first();
    if (await searchToggle.count() > 0) await searchToggle.click().catch(() => {});
    // Scope to <main> to avoid the global header search.
    const search = page.locator('main input[placeholder*="Search" i]').first();
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
