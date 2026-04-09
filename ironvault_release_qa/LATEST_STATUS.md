# Latest status
**Updated:** 2026-04-09 ~22:30 UTC

## PRODUCTION DEPLOY — ironvault-main-m7g5ea3wu ✅
- Deployment: `ironvault-main-m7g5ea3wu-saket-sumans-projects-1f5ede07.vercel.app`
- Aliases: www.ironvault.app ✅, ironvault.app ✅
- Bundle: `index-61c221d2.js`
- main branch: `b173d5c` (BUG-037 full fix — push on unlock)
- Timestamp: 2026-04-09 ~22:30 UTC

## Bugs in this deploy

| Bug | Title | Status |
|-----|-------|--------|
| BUG-033 | Server-backed cross-device login | LIVE ✅ |
| BUG-034 | Admin console SPA rewrite 404 | LIVE ✅ |
| BUG-035 | Entitlement URL encode (%40) | LIVE ✅ |
| BUG-036 | Per-vault Cloud Sync toggle | LIVE ✅ |
| BUG-037 | Cross-browser cloud vault contents empty | LIVE ✅ |
| BUG-038 | Cache requires clearing to see new deploys | LIVE ✅ |
| BUG-039 | Clearing cache deletes vault data | LIVE ✅ |

## BUG-038 Fix Summary

**Root cause:** SW served stale JS assets (cache-first strategy) and HTTP headers had no immutable/no-store directives. After a new deploy, the browser was getting a fresh HTML shell pointing to new hashed JS filenames — but the SW had old assets cached.

**Fix:**
1. `vercel.json` — added headers: `/assets/*` → `public, max-age=31536000, immutable`; `/` and `/*.html` → `no-store`; `/sw.js` → `no-store`
2. `client/public/sw.js` — bumped cache names to `securevault-v2.0.0`; added network-only for `request.destination === 'document' || request.mode === 'navigate'` so new deploys are always visible without cache clearing

**Verified:** `www.ironvault.app/assets/index-61c221d2.js` → `cache-control: public, max-age=31536000, immutable` ✅; `www.ironvault.app/` → `cache-control: no-store` ✅

## BUG-039 Fix Summary

**Root cause:** Vault data (IndexedDB) wiped by "clear all site data"; vault registry (localStorage) wiped by "clear cookies and site data". `navigator.storage.persist()` was never called, so browser treated storage as best-effort evictable.

**Fix:**
1. `client/src/lib/storage.ts` — call `navigator.storage?.persist?.()` in both `createVault()` and `unlockVault()` (on success). This marks IronVault's origin as persistent; browser won't evict IndexedDB on low storage.
2. `client/src/components/vault-manager-ui.tsx` — VaultCard now shows amber "Local only" badge (with tooltip) when `!isCloudSynced`, so users know their vault is device-local and at risk if they wipe browser data.

**Note:** `navigator.storage.persist()` protects against browser-initiated eviction but NOT explicit "clear all site data" in DevTools (that's a user-intentional wipe). The local-only warning + cloud sync is the full protection story.

## BUG-037 Root Cause (full analysis)

**Root cause 1 (primary):** Cloud vault blob was uploaded EMPTY at creation time (`create-vault.tsx` exported 917-byte empty vault before any items were added). Items added after creation were never synced because:
- The auto-sync hook guards on `isVaultCloudSynced(vaultId)` (localStorage flag)  
- That flag was only set by `markVaultAsCloudSynced()` calls added in the fix
- Vaults created BEFORE the fix deployment never had the flag set → auto-sync silently skipped them

**Root cause 2 (secondary):** Browser B downloaded the empty 917-byte blob and imported nothing, resulting in an empty vault regardless of what was on browser A.

## BUG-037 Fix Summary (all layers)

1. **`storage.ts`** — `vault:item:saved` event on every item save/delete
2. **`use-cloud-auto-sync.ts`** — Debounced 3s push on each event (guards on `isVaultCloudSynced`)
3. **`cloud-vault-sync.ts`** — `markVaultAsCloudSynced/Not/isVaultCloudSynced` localStorage registry
4. **`App.tsx` (this fix)** — On every vault unlock: `listCloudVaults()` → if vault is in cloud → `markVaultAsCloudSynced()` + push current items (if blob > 1000 bytes). Heals all pre-fix vaults.
5. **`vault-picker.tsx`** — Same-device login: `clearEncryptedItems()` + `importVault(cloud_blob)` to pick up remote changes
6. **`vault-manager-ui.tsx`** + **`create-vault.tsx`** — `markVaultAsCloudSynced` on enable

## Cross-browser sync test path

1. **Browser A**: Log in → unlock vault → wait ~3s (on-unlock effect pushes items to cloud)
2. **Browser B**: Log in same account → vault appears in Cloud Vaults section → enter master password → items from browser A should be visible ✅

*Note: if browser B did a first login before browser A pushed, log out of browser B and log back in — the same-device path will re-import the updated cloud blob.*

## Cache refresh test path (BUG-038)

After a new deploy:
1. Open `www.ironvault.app` in browser (no cache clear needed)
2. Page loads fresh HTML → references new hashed JS bundle → browser downloads it
3. No stale SW cache intervention — navigation requests are network-only ✅

## Persistent storage test path (BUG-039)

1. Create vault → unlock it → `navigator.storage.persist()` is called
2. DevTools → Application → Storage: Persisted should show ✅
3. If vault has no cloud sync: amber "Local only" badge is shown in vault manager
4. Cloud sync enabled: blue "Cloud" badge shown; data recoverable even if local data is wiped

## DB state
- `vault_1775754523250_1q6o3zl` (Cl1): 917-byte empty blob (pre-fix; will be updated when browser A next unlocks)

## Account state
- saketsuman1312@gmail.com: plan=lifetime ✅
- www.ironvault.app, ironvault.app → ironvault-main project ✅
