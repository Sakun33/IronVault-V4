import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { unlockVault } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Seed test data through the in-app `__importTestData` hook (see
 * client/src/lib/storage.ts). The hook is two-step opt-in:
 *
 *   window.__ironvaultSeedReady = true;
 *   await window.__importTestData(jsonString);
 *
 * That route goes through the real `vaultStorage.save*` methods, so
 * data is encrypted-at-rest with the unlocked vault's key — readable
 * by the app on the next page load (unlike the previous direct-IDB
 * inject path which bypassed encryption and produced corrupt rows).
 *
 * Skips when SEED is unset so the regular suite doesn't re-run it.
 */
const SEED = process.env.SEED === '1';

test.describe('seed test data (via __importTestData hook)', () => {
  test.skip(!SEED, 'set SEED=1 to enable');

  test('seed test data via app import hook', async ({ page }) => {
    // 5 min — importing ~1400 items through the encrypt+IDB-write path
    // takes time. The 180s default budget isn't enough.
    test.setTimeout(300_000);

    const testDataPath = path.join(__dirname, '../../test-data-import.json');
    const testData = readFileSync(testDataPath, 'utf-8');

    await unlockVault(page);

    // Give the vault a moment to fully hydrate before we start writing —
    // unlockVault returns when the master input detaches, but the cloud
    // pull + IDB rehydrate can still be in flight for a few seconds.
    await page.waitForTimeout(3_000);

    const result = await page.evaluate(async ({ jsonStr, masterPw }) => {
      (window as any).__ironvaultSeedReady = true;
      const fn = (window as any).__importTestData;
      if (typeof fn !== 'function') {
        return { error: '__importTestData not found on window' };
      }
      // Pass master password so the hook can re-unlock — singleton's
      // encryptionKey may have been cleared by a background sync.
      return await fn(jsonStr, masterPw);
    }, { jsonStr: testData, masterPw: '12121212' });

    // eslint-disable-next-line no-console
    console.log('Seed result:', JSON.stringify(result));

    expect((result as any).success).toBe(true);
    const counts = (result as any).results || {};
    expect(counts.passwords ?? 0).toBeGreaterThan(0);

    // Wait so the cloud sync queue has time to push the seeded data.
    await page.waitForTimeout(10_000);

    // eslint-disable-next-line no-console
    console.log('Data seeded successfully:', counts);
  });
});
