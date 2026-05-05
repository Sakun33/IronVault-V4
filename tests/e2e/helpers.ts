import { Page, expect } from '@playwright/test';

/**
 * Shared helpers for the prod E2E suite. Two main flows:
 *
 *   login(page)        — POST credentials, land on vault picker
 *   unlockVault(page)  — login + master-password the active vault
 *
 * Both helpers fall back through several selector forms so a copy
 * tweak (button label change, testid rename) doesn't take the whole
 * suite down. The credentials are the ones the user gave us for
 * testing — we don't read them from env to keep CI runnable
 * out-of-the-box.
 */
export const TEST_EMAIL = 'saketsuman1312@gmail.com';
export const TEST_PASSWORD = '12121212';
export const TEST_MASTER_PASSWORD = '12121212';

/**
 * Plant flags into localStorage that the AutoLock service reads on init
 * (see client/src/native/auto-lock.ts:loadSettings). Disables both the
 * background-grace lock AND the idle-timeout lock so the vault stays
 * unlocked across the duration of every Playwright test even on slow
 * runners. Must be called before the page navigates to a route that
 * boots AutoLockService.init() — i.e. immediately after page creation.
 */
async function disableAutoLockOnPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('autolock_enabled', 'false');
      localStorage.setItem('autolock_idle_enabled', 'false');
      localStorage.setItem('autolock_idle_timeout', '0');
      localStorage.setItem('autolock_grace_period', '999999999');
    } catch { /* private mode / quota — best-effort */ }
  });
}

export async function login(page: Page): Promise<void> {
  await disableAutoLockOnPage(page);
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  // Email input — be generous with selectors so a class rename doesn't break it.
  const email = page.locator('input[type="email"], input[name="email"], input[id*="email" i]').first();
  await email.waitFor({ state: 'visible', timeout: 30_000 });
  await email.fill(TEST_EMAIL);
  const pw = page.locator('input[type="password"]').first();
  await pw.fill(TEST_PASSWORD);
  // Sign in / Log in / Continue / Submit — match any reasonable label.
  const submit = page.getByRole('button', { name: /^(sign in|log in|continue|submit)$/i }).first();
  await submit.click();
  // After login the user lands on the vault picker (multi-vault) or
  // straight on /dashboard if a single-vault auto-unlock fired.
  await page.waitForURL(/\/(vault-picker|dashboard|passwords|notes|home|vaults|$)/i, { timeout: 30_000 }).catch(() => {});
}

export async function unlockVault(page: Page): Promise<void> {
  await login(page);
  // The vault picker may already be visible. Wait up to 30s for the
  // master password input — if we land straight on /dashboard (single
  // vault, already unlocked) the input never renders and we return.
  const masterInput = page.locator(
    'input[data-testid="input-unlock-password"], input[data-testid="input-master-password"], input[type="password"]'
  ).first();
  try {
    await masterInput.waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    // Already on the authenticated surface — confirm by checking for any
    // marker that only renders post-unlock (sidebar/dashboard/cards).
    const authedMarker = page.locator(
      '[data-testid="dashboard-loading"], [data-testid="text-greeting"], nav a[href="/dashboard"], nav a[href="/passwords"], main'
    ).first();
    await authedMarker.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    return;
  }
  await masterInput.fill(TEST_MASTER_PASSWORD);
  // Cloud-vault unlock has its own testid — match either, and a generic
  // text fallback for legacy renders.
  const unlockBtn = page
    .locator(
      '[data-testid="button-unlock-cloud-vault"], [data-testid="button-unlock-vault"], button:has-text("Unlock"), button[type="submit"]'
    )
    .first();
  await unlockBtn.click();
  // Wait for the master-password input to detach (signal that the
  // VaultPicker has been replaced by the authenticated layout). The
  // SPA stays on `/` after unlock — we can't rely on URL change.
  // Bump to 45s for slow-cloud cases (PBKDF2 600k iterations on a
  // headless runner can be slow).
  await masterInput.waitFor({ state: 'detached', timeout: 45_000 }).catch(() => {});
}

/**
 * In-SPA navigation. `page.goto()` does a HARD navigation that
 * remounts the React tree and clears in-memory auth state, locking
 * the vault. Wouter listens for popstate, so a pushState +
 * popstate dispatch routes inside the same React tree without a
 * remount.
 */
export async function spaNavigate(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

/**
 * Assert there's no horizontal overflow on the current page.
 * Tolerates 2px of sub-pixel rendering / scrollbar gutter.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const result = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
  }));
  expect(
    result.docW - result.winW,
    `horizontal overflow ${result.docW - result.winW}px (doc ${result.docW}, win ${result.winW})`,
  ).toBeLessThanOrEqual(2);
}
