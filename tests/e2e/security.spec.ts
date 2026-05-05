import { test, expect } from '@playwright/test';
import { unlockVault, spaNavigate, TEST_EMAIL } from './helpers';

test.describe('security — input fuzzing', () => {
  test('SQL-injection-shaped payload in email is sanitized at the form level', async ({ page }) => {
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"]').first();
    const pw = page.locator('input[type="password"]').first();
    await email.fill("admin'-- OR 1=1");
    await pw.fill('xxxxxxx');
    await page.getByRole('button', { name: /sign in|log in/i }).first().click();
    await page.waitForTimeout(2500);
    // Either the login screen still shows (rejected) OR a clear "invalid" toast.
    expect(page.url()).toMatch(/auth\/login/);
    // Page must not crash to a white screen.
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('XSS payload in note title is rendered as text, not executed', async ({ page }) => {
    test.setTimeout(120_000);
    await unlockVault(page);
    await spaNavigate(page, '/notes');
    let alertFired = false;
    page.on('dialog', async (d) => { alertFired = true; await d.dismiss().catch(() => {}); });
    const headerBtn = page.locator('[data-testid="button-new-note-header"]').first();
    if (await headerBtn.count() === 0) test.skip(true, 'header New Note button not present on this layout');
    await headerBtn.click();
    await page.locator('[data-testid="menu-item-blank-note"]').click();
    const titleInput = page.locator('input[aria-label="Note title"], input[placeholder*="Untitled" i]').first();
    await titleInput.fill('<img src=x onerror=alert(1)> e2e-xss');
    await page.waitForTimeout(1500);
    expect(alertFired).toBe(false);
  });
});

test.describe('security — auth-gating', () => {
  test('unauthenticated request to /api/vaults/cloud → 401', async ({ request }) => {
    const res = await request.get('https://www.ironvault.app/api/vaults/cloud');
    expect([401, 403]).toContain(res.status());
  });

  test('unauthenticated GET /api/auth/me → 401', async ({ request }) => {
    const res = await request.get('https://www.ironvault.app/api/auth/me');
    expect([401, 403]).toContain(res.status());
  });

  test('share endpoint requires auth', async ({ request }) => {
    const res = await request.post('https://www.ironvault.app/api/share/create', {
      data: { data: { v: 2, ct: 'x', iv: 'x' }, expiresIn: 24 },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([401, 403]).toContain(res.status());
  });
});

test.describe('security — direct-URL access without auth', () => {
  test('GET /passwords without auth lands on a public surface', async ({ page }) => {
    // Fresh context — no auth state.
    await page.goto('/passwords', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    // The SPA may either redirect to /auth/login OR render the public
    // landing page (its catch-all). Either way, the authenticated
    // password list must NOT be visible without auth.
    const pwList = page.locator('[data-testid^="password-row-"]');
    const count = await pwList.count();
    expect(count).toBe(0);
    // A login or landing element should be present.
    const loginEl = page.locator('input[type="email"], [data-testid="hero-get-started"]').first();
    await expect(loginEl).toBeVisible({ timeout: 10_000 });
    // sanity-check the imported test email constant is non-empty so this
    // file can't accidentally drift if `helpers.ts` empties it out.
    expect(TEST_EMAIL.length).toBeGreaterThan(0);
  });
});
