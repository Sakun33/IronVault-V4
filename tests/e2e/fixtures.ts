/**
 * Replaces `import { test, expect } from '@playwright/test'` so every
 * fresh browser context replays the sessionStorage snapshot captured
 * by global-setup.ts. Without this, the `iv_session` master-password
 * cache (auth-context.tsx:200) is missing from each new context and
 * tests land on the vault picker instead of the authenticated shell.
 *
 * Specs that want to opt out of the user identity (e.g. admin specs
 * that authenticate as a different role) can override per-spec with
 * `test.use({ storageState: { cookies: [], origins: [] } })`, which
 * starts with a fully clean context.
 */
import { test as base, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_PATH = path.join(__dirname, '.auth', 'session.json');

let sessionCache: Record<string, string> | null = null;
function loadSession(): Record<string, string> {
  if (sessionCache !== null) return sessionCache;
  try {
    const raw = fs.readFileSync(SESSION_PATH, 'utf8');
    sessionCache = JSON.parse(raw) as Record<string, string>;
  } catch {
    sessionCache = {};
  }
  return sessionCache;
}

export const test = base.extend({
  context: async ({ context }, use) => {
    const data = loadSession();
    if (Object.keys(data).length > 0) {
      await context.addInitScript((sd: Record<string, string>) => {
        try {
          for (const [k, v] of Object.entries(sd)) sessionStorage.setItem(k, v);
        } catch { /* noop — private browsing / quota */ }
      }, data);
    }
    await use(context);
  },
});

export { expect };
