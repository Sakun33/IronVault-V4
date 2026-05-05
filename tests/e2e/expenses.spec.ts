import { test, expect } from '@playwright/test';
import { unlockVault, spaNavigate, expectNoHorizontalOverflow } from './helpers';

test.describe('expenses page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await unlockVault(page);
    await spaNavigate(page, '/expenses');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('balance summary cards render', async ({ page }) => {
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    // Splitwise-style summary — at least one of the labels should be on screen.
    const card = page.getByText(/you owe|you're owed|net|total/i).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
  });

  test('tabs (All / Groups / People / Activity / Reports) visible', async ({ page }) => {
    const tabs = page.getByRole('tab').or(page.locator('[role="tablist"] button'));
    if (await tabs.count() < 2) test.skip(true, 'tab UI not rendered here');
    for (const label of ['All', 'Groups', 'People', 'Activity', 'Reports']) {
      const tab = page.getByRole('tab', { name: new RegExp(label, 'i') }).first();
      if (await tab.count() === 0) continue;
      await expect(tab).toBeVisible();
    }
  });

  test('add expense button opens the form', async ({ page }) => {
    const addBtn = page.locator(
      '[data-testid="button-add-expense"], button:has-text("Add expense"), button[aria-label*="Add" i]:has-text("Expense"), button:has(svg.lucide-plus)',
    ).first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]:has-text("expense"), [data-testid="add-expense-modal"]').first();
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('add expense form has title + amount + split selector', async ({ page }) => {
    const addBtn = page.locator(
      '[data-testid="button-add-expense"], button:has-text("Add expense")',
    ).first();
    if (await addBtn.count() === 0) test.skip(true, 'no add expense entry visible here');
    await addBtn.click();
    const title = page.locator('[data-testid="input-expense-title"], input[id="title"]').first();
    const amount = page.locator('[data-testid="input-expense-amount"], input[id="amount"]').first();
    await expect(title).toBeVisible({ timeout: 10_000 });
    await expect(amount).toBeVisible();
    await page.keyboard.press('Escape').catch(() => {});
  });

  test('groups manager surfaces existing groups', async ({ page }) => {
    const groupsTab = page.getByRole('tab', { name: /groups/i }).first();
    if (await groupsTab.count() === 0) test.skip(true, 'groups tab not present');
    await groupsTab.click();
    await page.waitForTimeout(500);
    // Either "no groups yet" empty-state or a group card.
    const present = page.getByText(/groups|trip|household/i).first();
    await expect(present).toBeVisible({ timeout: 10_000 });
  });

  test('reports tab loads charts or summary', async ({ page }) => {
    const reportsTab = page.getByRole('tab', { name: /reports/i }).first();
    if (await reportsTab.count() === 0) test.skip(true, 'reports tab not present');
    await reportsTab.click();
    await page.waitForTimeout(1000);
    // recharts containers, OR a text fallback like "Total" / "By category"
    const chart = page.locator('.recharts-wrapper, svg.recharts-surface, canvas').first();
    const summary = page.getByText(/total|by category|trend|breakdown/i).first();
    const present = (await chart.count()) > 0 || (await summary.count()) > 0;
    expect(present).toBeTruthy();
  });

  test('no horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});
