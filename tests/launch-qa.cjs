/**
 * IronVault Play Store Launch QA — Playwright test runner
 * Runs against production: https://www.ironvault.app
 */

const { chromium } = require('../node_modules/playwright-core');

const PROD = 'https://www.ironvault.app';
const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const results = { pass: 0, fail: 0, issues: [] };

function pass(test) {
  results.pass++;
  console.log(`  ✅ ${test}`);
}
function fail(test, detail) {
  results.fail++;
  results.issues.push({ test, detail });
  console.log(`  ❌ ${test}: ${detail}`);
}
function info(msg) { console.log(`  ℹ  ${msg}`); }
function section(name) { console.log(`\n▶ ${name}`); }

async function main() {
  const launchOpts = {
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  let browser;
  try {
    browser = await chromium.launch(launchOpts);
  } catch (e) {
    console.error('Failed to launch browser:', e.message);
    process.exit(1);
  }

  // ── PHASE 1: Smoke Test ─────────────────────────────────────────────────────
  section('PHASE 1: Smoke Test — all 16 pages');
  const pages = [
    '/', '/passwords', '/subscriptions', '/notes', '/reminders', '/expenses',
    '/bank-statements', '/investments', '/goals', '/documents', '/api-keys',
    '/profile', '/settings', '/logging', '/upgrade', '/vaults',
  ];

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // First load the root to prime auth state
  try {
    const res = await page.goto(PROD, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (res.status() !== 200) {
      fail('/ loads', `HTTP ${res.status()}`);
    } else {
      // Wait for React to mount
      await page.waitForSelector('#root', { timeout: 15000 });
      const root = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length ?? 0);
      if (root < 100) {
        fail('/ React mounts', 'Root is empty — white screen');
      } else {
        pass('/ loads and React mounts');
      }
    }
  } catch (e) {
    fail('/ initial load', e.message);
  }

  // Test each route — for SPA, all return same HTML but we verify no crash
  for (const route of pages.slice(1)) {
    try {
      const res = await page.goto(`${PROD}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (res.status() !== 200) {
        fail(`${route} loads`, `HTTP ${res.status()}`);
      } else {
        // Check for white screen (root empty)
        const root = await page.evaluate(() => document.getElementById('root')?.innerHTML?.length ?? 0);
        if (root < 50) {
          fail(`${route} renders`, 'Root appears empty');
        } else {
          pass(`${route} loads (${res.status()})`);
        }
      }
    } catch (e) {
      fail(`${route}`, e.message);
    }
  }

  // Check console errors on last page
  const jsErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('ResizeObserver'));
  if (jsErrors.length > 0) {
    fail('No JS console errors', jsErrors.slice(0, 3).join('; '));
  } else {
    pass('No JS console errors');
  }

  console.log('\n  Phase 1 summary:', results.pass, 'pass,', results.fail, 'fail');

  // ── PHASE 5: Auth UI ────────────────────────────────────────────────────────
  section('PHASE 5: Auth — login page UI');
  try {
    await page.goto(`${PROD}/login`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check if login form or vault picker shows
    const loginForm = await page.$('input[type="email"], input[placeholder*="email" i], input[placeholder*="Email" i]');
    const vaultPicker = await page.$('[data-testid="vault-picker"], .vault-picker, h2');

    if (loginForm) {
      pass('Login form is visible with email input');

      // Test wrong password
      await loginForm.fill('wrong@test.com');
      const passInput = await page.$('input[type="password"]');
      if (passInput) {
        await passInput.fill('wrongpassword123');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForTimeout(3000);
          const errorText = await page.evaluate(() => {
            const alerts = document.querySelectorAll('[role="alert"], .error, [class*="error"], [class*="toast"]');
            return Array.from(alerts).map(a => a.textContent?.trim()).filter(Boolean).join(' | ');
          });
          if (errorText && !errorText.toLowerCase().includes('technical')) {
            pass('Wrong credentials shows friendly error: ' + errorText.slice(0, 50));
          } else if (errorText) {
            fail('Wrong credentials error message', 'Shows technical message: ' + errorText.slice(0, 80));
          } else {
            fail('Wrong credentials feedback', 'No error message shown');
          }
        }
      }
    } else if (vaultPicker) {
      pass('Vault picker loads (user already has session)');
      info('Skipping login form test — already authenticated');
    } else {
      fail('Auth page', 'No login form or vault picker found');
    }
  } catch (e) {
    fail('Auth page load', e.message);
  }

  // ── PHASE 9: Mobile Viewport ────────────────────────────────────────────────
  section('PHASE 9: Mobile responsiveness — 375px');
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PROD, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    if (hasHorizontalScroll) {
      fail('Mobile: no horizontal scroll', `scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)} > innerWidth=375`);
    } else {
      pass('Mobile 375px: no horizontal scroll');
    }

    // Check bottom nav is visible
    const bottomNav = await page.$('nav, [role="navigation"], [class*="bottom"], [class*="nav"]');
    if (bottomNav) {
      const visible = await bottomNav.isVisible();
      visible ? pass('Mobile: bottom navigation visible') : fail('Mobile: bottom nav', 'Not visible');
    } else {
      fail('Mobile: bottom navigation', 'Not found in DOM');
    }

    // Check upgrade page on mobile
    await page.goto(`${PROD}/upgrade`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);
    const upgradeHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    upgradeHScroll ? fail('Upgrade page mobile', 'Horizontal scroll present') : pass('Upgrade page: no horizontal scroll at 375px');

  } catch (e) {
    fail('Mobile viewport test', e.message);
  }

  // ── PHASE 10: Security ──────────────────────────────────────────────────────
  section('PHASE 10: Security checks');
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(PROD, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Check CORS header on API
    const corsResp = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/health');
        return { ok: r.ok, status: r.status };
      } catch (e) {
        return { err: e.message };
      }
    });
    corsResp.ok ? pass('API /health reachable from browser') : fail('API health', JSON.stringify(corsResp));

    // Check unauthenticated cloud vault returns 401 not 500
    const authResp = await page.evaluate(async () => {
      try {
        const r = await fetch('/api/vaults/cloud');
        return { status: r.status };
      } catch (e) {
        return { err: e.message };
      }
    });
    if (authResp.status === 401) {
      pass('Unauthenticated API call returns 401');
    } else {
      fail('Unauthenticated /api/vaults/cloud', `Expected 401, got ${JSON.stringify(authResp)}`);
    }

    // Check HTTPS redirect (no HTTP)
    const httpResp = await page.evaluate(async () => window.location.protocol);
    httpResp === 'https:' ? pass('App served over HTTPS') : fail('HTTPS', `Protocol: ${httpResp}`);

  } catch (e) {
    fail('Security checks', e.message);
  }

  // ── PHASE 4: Dashboard UI (structure check without auth) ────────────────────
  section('PHASE 4: Dashboard structure');
  try {
    await page.goto(PROD, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check vault picker or dashboard shows
    const pageContent = await page.evaluate(() => document.body.innerText.slice(0, 500));
    info('Page content preview: ' + pageContent.replace(/\n/g, ' ').slice(0, 150));

    // Check for vault picker (expected when not logged in or locked)
    const hasVaultPicker = pageContent.includes('vault') || pageContent.includes('Vault') || pageContent.includes('IronVault');
    hasVaultPicker ? pass('App renders (vault picker / dashboard content)') : fail('App render', 'No expected content found');

    // Check for upgrade / pricing page structure
    await page.goto(`${PROD}/upgrade`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    const pricingContent = await page.evaluate(() => document.body.innerText.slice(0, 800));
    if (pricingContent.includes('Pro') || pricingContent.includes('Lifetime') || pricingContent.includes('plan')) {
      pass('Upgrade/pricing page renders plan options');
    } else {
      fail('Upgrade page content', 'No plan options found: ' + pricingContent.slice(0, 100));
    }

    // Check Free plan description (should say mobile only)
    if (pricingContent.includes('mobile') || pricingContent.includes('Mobile')) {
      pass('Free plan shows mobile-only description');
    } else {
      info('Note: Free plan "mobile only" text not found in pricing preview');
    }

  } catch (e) {
    fail('Dashboard/pricing structure', e.message);
  }

  // ── Final report ────────────────────────────────────────────────────────────
  await browser.close();

  console.log('\n══════════════════════════════════════════');
  console.log(`RESULTS: ${results.pass} passed, ${results.fail} failed`);
  if (results.issues.length > 0) {
    console.log('\nISSUES:');
    results.issues.forEach((i, n) => console.log(`  ${n+1}. [${i.test}] ${i.detail}`));
  }
  console.log('══════════════════════════════════════════');

  // Write JSON results for dashboard update
  const fs = require('fs');
  fs.writeFileSync('/tmp/launch-qa-results.json', JSON.stringify({ ...results, timestamp: new Date().toISOString() }, null, 2));

  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
