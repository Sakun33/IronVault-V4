import { test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { unlockVault } from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Bypass-the-UI bulk seeder. Logs in + unlocks via the proven
 * helpers, then opens the vault's IndexedDB directly and `put`s
 * each item from `test-data-import.json` into the matching
 * object store. Skips when SEED is unset so the regular suite
 * doesn't re-run it.
 *
 * NB: this writes PLAIN items into the IDB stores. If the app
 * stores items encrypted-at-rest, the data will fail to decrypt
 * on read. Run once, then verify in the app — adjust if needed.
 */
const SEED = process.env.SEED === '1';

test.describe('seed test data (direct IDB inject)', () => {
  test.skip(!SEED, 'set SEED=1 to enable');

  test('inject test-data-import.json into vault IDB stores', async ({ page }) => {
    test.setTimeout(180_000);

    const testData = readFileSync(
      path.join(__dirname, '../../test-data-import.json'),
      'utf-8',
    );

    // Use proven login + unlock helpers — handles the two-stage auth
    // (Supabase login → vault picker master password) and disables
    // auto-lock so the IDB stays accessible during the inject.
    await unlockVault(page);

    // Wait for vault hydration to finish so the IDB is fully populated.
    await page.waitForTimeout(8000);

    const result = await page.evaluate(async (jsonStr) => {
      const data = JSON.parse(jsonStr);
      const dbs = await indexedDB.databases();
      // Vault DBs are named `IronVault_<vaultId>` (or similar) — accept any
      // IronVault-prefixed DB.
      const vaultDb = dbs.find(
        (d) => d.name && /ironvault/i.test(d.name),
      );
      if (!vaultDb || !vaultDb.name) {
        return { error: 'No vault database found', dbs: dbs.map((d) => d.name) };
      }

      return await new Promise<unknown>((resolve) => {
        const req = indexedDB.open(vaultDb.name as string, vaultDb.version);
        req.onsuccess = () => {
          const db = req.result;
          const stores = Array.from(db.objectStoreNames);

          const importStore = (
            storeName: string,
            items: Array<Record<string, unknown>> | undefined,
          ): Promise<{ store: string; written: number; skipped: boolean }> => {
            if (!stores.includes(storeName)) {
              return Promise.resolve({ store: storeName, written: 0, skipped: true });
            }
            if (!items || items.length === 0) {
              return Promise.resolve({ store: storeName, written: 0, skipped: false });
            }
            return new Promise((res) => {
              const tx = db.transaction(storeName, 'readwrite');
              const store = tx.objectStore(storeName);
              let count = 0;
              items.forEach((item) => {
                try {
                  store.put(item);
                  count++;
                } catch {
                  /* swallow per-item write failures */
                }
              });
              tx.oncomplete = () => res({ store: storeName, written: count, skipped: false });
              tx.onerror = () => res({ store: storeName, written: count, skipped: false });
              tx.onabort = () => res({ store: storeName, written: count, skipped: false });
            });
          };

          Promise.all([
            importStore('passwords', data.passwords),
            importStore('subscriptions', data.subscriptions),
            importStore('notes', data.notes),
            importStore('expenses', data.expenses),
            importStore('reminders', data.reminders),
            importStore('bankStatements', data.bankStatements),
            importStore('bankTransactions', data.bankTransactions),
            importStore('investments', data.investments),
            importStore('investmentGoals', data.investmentGoals),
            importStore('apiKeys', data.apiKeys),
          ]).then((rows) => {
            db.close();
            resolve({
              success: true,
              dbName: vaultDb.name,
              dbVersion: vaultDb.version,
              stores,
              imports: rows,
            });
          });
        };
        req.onerror = () =>
          resolve({ error: 'Failed to open DB', name: vaultDb.name });
      });
    }, testData);

    // eslint-disable-next-line no-console
    console.log('SEED RESULT:', JSON.stringify(result, null, 2));
  });
});
