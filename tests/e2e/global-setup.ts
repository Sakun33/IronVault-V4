/**
 * Playwright global setup — logs the test user in ONCE and snapshots
 * everything a fresh context needs to skip the ~2.5-minute login+unlock
 * flow on every test:
 *
 *   - cookies + localStorage → tests/e2e/.auth/user.json (Playwright's
 *     storageState format, consumed via `use: { storageState }`)
 *   - sessionStorage          → tests/e2e/.auth/session.json (replayed
 *     by the fixture in fixtures.ts because Playwright's storageState
 *     does NOT cover sessionStorage)
 *
 * The auth-context reads `sessionStorage[iv_session]` on init and
 * auto-unlocks the vault if it matches the encrypted blob in
 * IndexedDB. The IndexedDB blob rehydrates from the cloud on first
 * boot (we have a valid cloud_token in localStorage), so the
 * unlocked-shell appears within seconds rather than minutes.
 *
 * Admin specs target a different identity (admin.ironvault.app with
 * admin / admin123) and explicitly opt out of this storageState via
 * `test.use({ storageState: { cookies: [], origins: [] } })`.
 */
import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.join(__dirname, '.auth');
const STORAGE_PATH = path.join(AUTH_DIR, 'user.json');
const SESSION_PATH = path.join(AUTH_DIR, 'session.json');

const TEST_EMAIL = 'saketsuman1312@gmail.com';
const TEST_PASSWORD = '12121212';
const TEST_MASTER_PASSWORD = '12121212';

async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: 'https://www.ironvault.app' });
  const page = await context.newPage();

  // Plant auto-lock-disabled flags FIRST. The AutoLockService reads
  // these on init; without them a saved session can self-evict on a
  // background-grace timer mid-test.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    try {
      localStorage.setItem('autolock_enabled', 'false');
      localStorage.setItem('autolock_idle_enabled', 'false');
    } catch { /* noop */ }
  });

  // Account login (Stage 1).
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
  await page.locator('input[type="password"]').first().fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).first().click();

  // Wait for either the master-password field (vault picker) OR the
  // authenticated shell. On Pro accounts the picker is the expected
  // landing state.
  const unlockField = page.locator('input[data-testid="input-unlock-password"], input[placeholder*="Master password" i]').first();
  await unlockField.waitFor({ state: 'visible', timeout: 90_000 });

  // Vault unlock (Stage 2).
  await unlockField.fill(TEST_MASTER_PASSWORD);
  // The Unlock button is the only primary-action button in the picker
  // — pick it by accessible name first, fall back to testid.
  const unlockBtn = page.getByRole('button', { name: /unlock/i }).first();
  await unlockBtn.click();

  // Wait for the authenticated shell. The dashboard greeting renders
  // as a <div>, not <h1>, so use markers that ONLY appear post-unlock
  // (same set helpers.ts uses for its detection). Bumped to 180 s to
  // cover slow cloud unlock + chunk warmup on a cold runner.
  const authedMarker = page.locator(
    '[data-testid="dashboard-loading"], [data-testid="dashboard-today"], [data-testid="dashboard-action-bar"], [data-testid="text-greeting"], nav a[href="/passwords"], nav a[href="/notes"]',
  ).first();
  await authedMarker.waitFor({ state: 'visible', timeout: 180_000 });

  // Settle through handleCloudUnlock's tail: the unlock fires a 1.8 s
  // success animation and a final setLocation('/') AFTER the marker
  // becomes visible. If we navigate / snapshot during that window, we
  // race the SPA router and Playwright reports ERR_ABORTED on the
  // outbound nav (or worse, the snapshot captures pre-animation state
  // and the auth-context's sessionStorage write hasn't flushed).
  await page.waitForTimeout(3000);

  // Persist Playwright's view of the world (cookies + localStorage,
  // per Playwright docs — sessionStorage is NOT included).
  await context.storageState({ path: STORAGE_PATH });

  // Snapshot sessionStorage so fixtures.ts can replay it on every
  // fresh context. The vault session lives here (auth-context.tsx:200
  // — `sessionStorage.getItem(SESSION_KEY)`).
  const sessionDump = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k !== null) out[k] = sessionStorage.getItem(k) ?? '';
    }
    return JSON.stringify(out);
  });
  fs.writeFileSync(SESSION_PATH, sessionDump);

  await browser.close();
  // eslint-disable-next-line no-console
  console.log(`[global-setup] storageState → ${STORAGE_PATH} | sessionStorage keys → ${Object.keys(JSON.parse(sessionDump)).length}`);
}

export default globalSetup;
