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

// Selectors that ONLY render on the authenticated surface — never on
// the vault picker, login page, or signup. Picker has a `<main>` and
// `<h1>` too, so those generic markers can't be used here.
const AUTHED_MARKER_SELECTOR =
  '[data-testid="dashboard-loading"], [data-testid="dashboard-today"], [data-testid="dashboard-action-bar"], [data-testid="text-greeting"], nav a[href="/passwords"], nav a[href="/notes"]';

/**
 * Probes the post-storageState landing page and reports which entry
 * point we're on. Saves significant per-test setup time by skipping
 * stages that storageState already covered:
 *
 *   - 'authed'      → already unlocked (sessionStorage replay worked
 *                     OR a single-vault auto-unlock fired). No work.
 *   - 'picker'      → account-logged-in but vault locked (cookies +
 *                     localStorage restored, but IndexedDB is empty
 *                     in a fresh Playwright context so the
 *                     auth-context's auto-unlock saw no vault blob
 *                     and skipped the sessionStorage path).
 *   - 'signed-out'  → clean context (auth/security/admin specs that
 *                     opted out of storageState).
 */
async function detectEntry(page: Page): Promise<'authed' | 'picker' | 'signed-out'> {
  await disableAutoLockOnPage(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  // Race the three signals — first one to surface wins.
  const authedPromise = page.locator(AUTHED_MARKER_SELECTOR).first()
    .waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'authed' as const).catch(() => null);
  const pickerPromise = page.locator('input[data-testid="input-unlock-password"], input[placeholder*="Master password" i]').first()
    .waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'picker' as const).catch(() => null);
  const loginPromise = page.locator('input[type="email"]').first()
    .waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'signed-out' as const).catch(() => null);
  const winner = await Promise.race([authedPromise, pickerPromise, loginPromise]);
  if (winner) return winner;
  // None showed up — settle for whatever is there. Default to signed-out.
  const stillAuthed = await page.locator(AUTHED_MARKER_SELECTOR).first().isVisible().catch(() => false);
  if (stillAuthed) return 'authed';
  const stillPicker = await page.locator('input[data-testid="input-unlock-password"]').first().isVisible().catch(() => false);
  if (stillPicker) return 'picker';
  return 'signed-out';
}

/**
 * Enter the master password on a visible vault picker and wait for the
 * authenticated shell. Shared between the medium-path (storageState
 * landed us on the picker) and the slow path (full login → picker →
 * unlock). Lifted out of unlockVault so both paths share the same
 * detach + animation-tail handling.
 */
async function fillMasterPasswordAndUnlock(page: Page): Promise<void> {
  const masterInput = page.locator(
    'input[data-testid="input-unlock-password"], input[data-testid="input-master-password"], input[type="password"]'
  ).first();
  await masterInput.waitFor({ state: 'visible', timeout: 30_000 });
  await masterInput.fill(TEST_MASTER_PASSWORD);
  let typed = await masterInput.inputValue().catch(() => '');
  if (typed !== TEST_MASTER_PASSWORD) {
    await masterInput.click({ force: true }).catch(() => {});
    await masterInput.fill(TEST_MASTER_PASSWORD);
  }
  const unlockBtn = page.locator(
    '[data-testid="button-unlock-cloud-vault"], [data-testid="button-unlock-vault"], button:has-text("Unlock"), button[type="submit"]'
  ).first();
  await unlockBtn.click();
  const detached = await masterInput.waitFor({ state: 'detached', timeout: 120_000 })
    .then(() => true).catch(() => false);
  if (!detached) {
    await masterInput.fill(TEST_MASTER_PASSWORD).catch(() => {});
    await unlockBtn.click().catch(() => {});
    await masterInput.waitFor({ state: 'detached', timeout: 120_000 }).catch(() => {});
  }
  await page.locator(AUTHED_MARKER_SELECTOR).first()
    .waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});
  // Sit out the unlock animation tail + the final setLocation('/') —
  // see helpers.ts:120 history comment.
  await page.waitForTimeout(2500);
}

export async function unlockVault(page: Page): Promise<void> {
  const entry = await detectEntry(page);
  if (entry === 'authed') return;
  if (entry === 'picker') {
    // Account login was preserved by storageState — just unlock.
    await fillMasterPasswordAndUnlock(page);
    return;
  }
  // 'signed-out' — full flow.
  await login(page);
  // login() lands on either vault picker or straight on the dashboard.
  // If we're at the picker, finish the unlock; if we're already in the
  // authed shell, fillMasterPasswordAndUnlock's first waitFor will time
  // out and we just confirm the marker.
  const stillNeedsUnlock = await page.locator(
    'input[data-testid="input-unlock-password"], input[data-testid="input-master-password"]',
  ).first().isVisible().catch(() => false);
  if (stillNeedsUnlock) {
    await fillMasterPasswordAndUnlock(page);
  } else {
    await page.locator(AUTHED_MARKER_SELECTOR).first()
      .waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }
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
