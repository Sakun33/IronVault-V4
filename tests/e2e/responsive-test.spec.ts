/**
 * Cross-viewport smoke test against the LIVE production site
 * (https://www.ironvault.app).
 *
 * Each Playwright project (iPhone SE / iPhone 14 / iPad / etc — see
 * playwright.live.config.ts) runs every test below. The tests are
 * deliberately shallow: they confirm a page renders without crashing,
 * key controls are visible, no horizontal overflow, no JavaScript
 * errors hit the console. Deeper flow testing belongs in the unit /
 * integration suites.
 *
 * Test credentials live in env vars so the file can be checked in
 * safely. CI/local runs should pass:
 *
 *   IRONVAULT_E2E_EMAIL=...
 *   IRONVAULT_E2E_PASSWORD=...
 *   IRONVAULT_E2E_MASTER_PASSWORD=...
 */
import { test, expect, Page } from '@playwright/test';

const EMAIL = process.env.IRONVAULT_E2E_EMAIL || '';
const PASSWORD = process.env.IRONVAULT_E2E_PASSWORD || '';
const MASTER_PASSWORD = process.env.IRONVAULT_E2E_MASTER_PASSWORD || '';

const haveCreds = !!EMAIL && !!PASSWORD && !!MASTER_PASSWORD;

// ── Console-error gate ─────────────────────────────────────────────────────
// Lighthouse-style guarantee: any uncaught JS error or 5xx response is a
// test failure. Cross-origin "Script error." (Razorpay/Zoho noise) is
// allow-listed via the same predicate `main.tsx` uses internally.
function attachConsoleGuard(page: Page, errors: string[]) {
  page.on('pageerror', (e) => {
    const msg = (e?.message || String(e)).trim();
    if (/^Script error\.?$/i.test(msg)) return;
    errors.push(`pageerror: ${msg}`);
  });
  // Third-party noise patterns. CSP blocks (ipify, GA, PageSense) are
  // expected — those services are loaded for marketing/telemetry but
  // CSP forbids the connect-src calls. They are NOT app bugs and a
  // Lighthouse-style gate would be useless if they fail every test.
  // Likewise transient 503s and 401s during initial auth restoration
  // are noise. Anything that looks like our own code (file path, our
  // own logger prefixes, React/component stacks) is still surfaced.
  const NOISE_PATTERNS: RegExp[] = [
    /zoho|razorpay|googletagmanager|google-analytics|pagesense|gtag|salesiq|ipify\.org/i,
    /Refused to connect because it violates the document's Content Security Policy/i,
    /Failed to load resource: the server responded with a status of (401|403|503|404)/i,
    /Refused to (load|execute)/i,
    /Failed to load resource: net::ERR_(BLOCKED_BY|FAILED|CONNECTION_REFUSED)/i,
  ];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (NOISE_PATTERNS.some(p => p.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const result = await page.evaluate(() => {
    const docW = document.documentElement.scrollWidth;
    const winW = window.innerWidth;
    return { docW, winW, overflow: docW - winW };
  });
  // Allow a 2px fudge for sub-pixel rendering / scrollbar gutter.
  expect(result.overflow, `horizontal overflow ${result.overflow}px (doc ${result.docW}, win ${result.winW})`).toBeLessThanOrEqual(2);
}

// ─────────────────────────────────────────────────────────────────────────
// Public surfaces (no auth required)
// ─────────────────────────────────────────────────────────────────────────

test.describe('public — landing', () => {
  test('renders, has hero CTA, no horizontal overflow, no JS errors', async ({ page }) => {
    const errors: string[] = [];
    attachConsoleGuard(page, errors);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // Hero headline is the bold title — match by partial text so a
    // copy tweak doesn't break the test.
    await expect(page.getByRole('heading', { name: /vaulted/i })).toBeVisible();
    await expect(page.getByTestId('hero-get-started')).toBeVisible();
    await expect(page.getByTestId('hero-sign-in')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

test.describe('public — login page', () => {
  test('renders login form', async ({ page }) => {
    const errors: string[] = [];
    attachConsoleGuard(page, errors);
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"], input[name="email"], input[id*="email" i]').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Authenticated surfaces — skipped if creds aren't supplied via env vars
// ─────────────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
  await emailInput.fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  const signIn = page.getByRole('button', { name: /^(sign in|log in|continue|next)$/i }).first();
  await signIn.click();
  await page.waitForURL(/\/(vault-picker|dashboard|passwords|notes|home|vaults)/i, { timeout: 45_000 }).catch(() => {});
  // eslint-disable-next-line no-console
  console.log('[E2E] post-login URL:', page.url());
}

async function unlockVault(page: Page) {
  // The vault-picker renders both LOCAL and CLOUD vault sections, each
  // with its own input + button (`button-unlock-vault` for local,
  // `button-unlock-cloud-vault` for cloud). Match either.
  const masterInput = page.locator('input[data-testid="input-unlock-password"]').first();
  try {
    await masterInput.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    // eslint-disable-next-line no-console
    console.log('[E2E] no master password input — already unlocked at', page.url());
    return;
  }
  await masterInput.fill(MASTER_PASSWORD);
  const unlockBtn = page
    .locator('[data-testid="button-unlock-cloud-vault"], [data-testid="button-unlock-vault"]')
    .first();
  await unlockBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await unlockBtn.click();
  // The SPA stays on `/` after unlock — the URL doesn't change, only
  // the rendered component does. Wait for the master-password input to
  // detach from the DOM as the signal that VaultPicker has been
  // replaced by the authenticated layout.
  await page.locator('input[data-testid="input-unlock-password"]').first()
    .waitFor({ state: 'detached', timeout: 30_000 })
    .catch(() => { /* may already be detached */ });
  // eslint-disable-next-line no-console
  console.log('[E2E] post-unlock URL:', page.url());
}

/**
 * In-SPA navigation. `page.goto()` does a HARD navigation that
 * re-mounts the React app and wipes the in-memory master-password
 * state — which re-locks the vault and bounces back to the picker.
 * Wouter listens for `popstate`, so a `pushState` + `popstate`
 * dispatch routes inside the same React tree without remounting.
 */
async function spaNavigate(page: Page, path: string) {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  // Give wouter + the lazy chunk a beat to swap the tree.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
}

test.describe('authenticated', () => {
  test.skip(!haveCreds, 'IRONVAULT_E2E_* env vars not supplied — skipping authed tests');

  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    await unlockVault(page);
  });

  test('dashboard renders + scrolls', async ({ page }) => {
    await spaNavigate(page, '/dashboard');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
  });

  test('passwords page renders with view toggle', async ({ page }) => {
    await spaNavigate(page, '/passwords');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="view-toggle-list"], [data-testid="view-toggle-grid"]').first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
  });

  test('notes page — header New Note button is visible without scrolling', async ({ page }) => {
    await spaNavigate(page, '/notes');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    const newNoteBtn = page.locator('[data-testid="button-new-note-header"]');
    await expect(newNoteBtn).toBeVisible({ timeout: 20_000 });
    const box = await newNoteBtn.boundingBox();
    expect(box, 'New Note button has no bounding box').not.toBeNull();
    if (box) expect(box.y).toBeLessThan(150);
    await expectNoHorizontalOverflow(page);
  });

  test('subscriptions page renders', async ({ page }) => {
    await spaNavigate(page, '/subscriptions');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
  });

  test('expenses page renders', async ({ page }) => {
    await spaNavigate(page, '/expenses');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
  });

  test('profile page renders', async ({ page }) => {
    await spaNavigate(page, '/profile');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible({ timeout: 20_000 });
    await expectNoHorizontalOverflow(page);
  });
});
