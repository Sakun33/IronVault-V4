# Latest status
**Updated:** 2026-04-09 ~21:40 UTC

## PRODUCTION DEPLOY — ironvault-main-eocha1y92 ✅
- Deployment: `ironvault-main-eocha1y92-saket-sumans-projects-1f5ede07.vercel.app`
- Aliases: www.ironvault.app ✅, ironvault.app ✅
- Bundle: `index-6cb02aac.js`
- main branch: `b173d5c` (BUG-037 full fix — push on unlock)
- Timestamp: 2026-04-09 ~21:40 UTC

## Bugs in this deploy

| Bug | Title | Status |
|-----|-------|--------|
| BUG-033 | Server-backed cross-device login | LIVE ✅ |
| BUG-034 | Admin console SPA rewrite 404 | LIVE ✅ |
| BUG-035 | Entitlement URL encode (%40) | LIVE ✅ |
| BUG-036 | Per-vault Cloud Sync toggle | LIVE ✅ |
| BUG-037 | Cross-browser cloud vault contents empty | LIVE ✅ |

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

## DB state
- `vault_1775754523250_1q6o3zl` (Cl1): 917-byte empty blob (pre-fix; will be updated when browser A next unlocks)

## Account state
- saketsuman1312@gmail.com: plan=lifetime ✅
- www.ironvault.app, ironvault.app → ironvault-main project ✅
