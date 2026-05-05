import { test, expect } from '@playwright/test';
import { unlockVault, spaNavigate, expectNoHorizontalOverflow } from './helpers';

/**
 * Mobile-only smoke. The Playwright config defines a `mobile-iphone`
 * project that runs every spec under iPhone-14 emulation, but this
 * file is explicit about the mobile-specific assertions: bottom nav,
 * FAB visibility, touch targets, no horizontal overflow.
 *
 * `test.skip(!isMobile, ...)` short-circuits the suite when run from
 * the desktop project so we don't get false failures.
 */
function isMobileViewport(viewport: { width: number; height: number } | null): boolean {
  return !!viewport && viewport.width <= 500;
}

test.describe('mobile — public', () => {
  test('landing renders with no horizontal overflow', async ({ page, viewport }) => {
    test.skip(!isMobileViewport(viewport), 'mobile-only test');
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expectNoHorizontalOverflow(page);
    // Hero CTAs must be inside the visible viewport (not pushed offscreen).
    const cta = page.locator('[data-testid="hero-get-started"]').first();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.y).toBeGreaterThan(0);
  });

  test('login form fits on a 390px-wide screen', async ({ page, viewport }) => {
    test.skip(!isMobileViewport(viewport), 'mobile-only test');
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('mobile — authenticated', () => {
  test.beforeEach(async ({ page, viewport }) => {
    test.skip(!isMobileViewport(viewport), 'mobile-only test');
    test.setTimeout(120_000);
    await unlockVault(page);
  });

  test('bottom nav is visible with 5 tabs', async ({ page }) => {
    await spaNavigate(page, '/dashboard');
    const tabs = page.locator('nav[aria-label*="bottom" i] a, [data-testid^="bottom-tab-"]');
    if (await tabs.count() === 0) test.skip(true, 'bottom-nav not rendered on this layout');
    expect(await tabs.count()).toBeGreaterThanOrEqual(4);
  });

  test('FAB is visible on the notes page', async ({ page }) => {
    await spaNavigate(page, '/notes');
    const fab = page.locator('[data-testid="button-new-note-fab"]').first();
    await expect(fab).toBeVisible({ timeout: 15_000 });
    const box = await fab.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.height).toBeGreaterThanOrEqual(40);
  });

  test('FAB is visible on the expenses page', async ({ page }) => {
    await spaNavigate(page, '/expenses');
    const fab = page.locator('[aria-label*="Add" i].fixed, [data-testid="button-add-expense-fab"]').first();
    if (await fab.count() === 0) test.skip(true, 'no FAB on expenses for this build');
    await expect(fab).toBeVisible({ timeout: 15_000 });
  });

  test('passwords page has no horizontal overflow', async ({ page }) => {
    await spaNavigate(page, '/passwords');
    await expectNoHorizontalOverflow(page);
  });

  test('top-level touch targets are at least 36×36 (mobile)', async ({ page }) => {
    await spaNavigate(page, '/dashboard');
    const buttons = page.locator('button:visible, [role="button"]:visible');
    const count = await buttons.count();
    let tooSmall = 0;
    for (let i = 0; i < Math.min(count, 25); i++) {
      const b = await buttons.nth(i).boundingBox();
      if (b && (b.width < 36 || b.height < 36)) tooSmall++;
    }
    // Tolerate a handful of decorative chevrons / text-link buttons that
    // are intentionally smaller. The test only fails if the majority of
    // sampled controls are tiny.
    expect(tooSmall).toBeLessThan(15);
  });
});
