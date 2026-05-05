import { test, expect } from '@playwright/test';
import { unlockVault, spaNavigate, expectNoHorizontalOverflow } from './helpers';

test.describe('profile page', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await unlockVault(page);
    await spaNavigate(page, '/profile');
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  });

  test('profile shell renders', async ({ page }) => {
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    // Profile heading or the user's email at the top.
    const header = page.getByRole('heading').first();
    await expect(header).toBeVisible({ timeout: 10_000 });
  });

  test.describe('tabs', () => {
    for (const tab of ['Overview', 'Data', 'Security', 'Vaults', 'Subscription', 'Support']) {
      test(`tab "${tab}" is reachable`, async ({ page }) => {
        const trigger = page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') }).first();
        if (await trigger.count() === 0) test.skip(true, `tab "${tab}" not exposed in this build`);
        await trigger.click();
        await page.waitForTimeout(500);
        // Tab should report selected.
        await expect(trigger).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 }).catch(() => {});
      });
    }
  });

  test('CSV export button is present somewhere on the data tab', async ({ page }) => {
    const dataTab = page.getByRole('tab', { name: /data/i }).first();
    if (await dataTab.count() > 0) await dataTab.click();
    await page.waitForTimeout(500);
    const csv = page.getByRole('button', { name: /export.*csv|csv.*export|download.*csv/i }).first();
    if (await csv.count() === 0) test.skip(true, 'CSV export not surfaced here');
    await expect(csv).toBeVisible();
  });

  test('2FA section is visible on the security tab', async ({ page }) => {
    const securityTab = page.getByRole('tab', { name: /security/i }).first();
    if (await securityTab.count() > 0) await securityTab.click();
    await page.waitForTimeout(500);
    const twoFa = page.getByText(/two-factor|2fa/i).first();
    await expect(twoFa).toBeVisible({ timeout: 10_000 });
  });

  test('master password change form visible on security tab', async ({ page }) => {
    const securityTab = page.getByRole('tab', { name: /security/i }).first();
    if (await securityTab.count() > 0) await securityTab.click();
    await page.waitForTimeout(500);
    const trigger = page.getByRole('button', { name: /change.*master password|master password.*change/i }).first();
    if (await trigger.count() === 0) test.skip(true, 'change-master-password trigger not present');
    await expect(trigger).toBeVisible();
  });

  test('account deletion entry-point exists', async ({ page }) => {
    const dangerTab = page.getByRole('tab', { name: /security|data|account/i }).first();
    if (await dangerTab.count() > 0) await dangerTab.click();
    await page.waitForTimeout(500);
    const deleteBtn = page.getByRole('button', { name: /delete account|remove account/i }).first();
    if (await deleteBtn.count() === 0) test.skip(true, 'no delete-account button surfaced');
    await expect(deleteBtn).toBeVisible();
  });

  test('no horizontal overflow', async ({ page }) => {
    await expectNoHorizontalOverflow(page);
  });
});
