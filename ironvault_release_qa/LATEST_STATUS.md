# Latest status
**Updated:** 2026-04-09 ~20:40 UTC

## PRODUCTION DEPLOY — ironvault-main-fgc6dm5i8 ✅
- Deployment: `ironvault-main-fgc6dm5i8-saket-sumans-projects-1f5ede07.vercel.app`
- Aliases: www.ironvault.app ✅, ironvault.app ✅
- Bundle: `index-ab452011.js`
- main branch: `bcca560` (merged BUG-037 fix)
- Timestamp: 2026-04-09 ~20:40 UTC
- Domains moved from `ironvault` project to `ironvault-main` project (permanent)

## Bugs promoted in this deploy

| Bug | Title | Status |
|-----|-------|--------|
| BUG-033 | Server-backed cross-device login | LIVE ✅ |
| BUG-034 | Admin console SPA rewrite 404 | LIVE ✅ |
| BUG-035 | Entitlement URL encode (%40) — plan always returned free | LIVE ✅ |
| BUG-036 | Per-vault Cloud Sync toggle on Vaults settings page | LIVE ✅ |
| BUG-037 | Cross-browser cloud vault contents empty | LIVE ✅ |

## Verification
- `GET /api/health` → `{"status":"ok","db":true}` ✅
- Bundle `index-ab452011.js` live on www.ironvault.app ✅
- `vault:item:saved` event auto-sync wired ✅

## BUG-037 Fix Summary
**Root cause:** Cloud vault uploaded empty blob at creation time; no re-sync when items added.

**Fix components:**
1. `storage.ts`: `encryptAndStore` + all delete methods dispatch `vault:item:saved` CustomEvent
2. `cloud-vault-sync.ts`: `markVaultAsCloudSynced` / `markVaultAsNotCloudSynced` / `isVaultCloudSynced` helpers
3. `hooks/use-cloud-auto-sync.ts`: Debounced (3s) event listener — re-exports and pushes vault to cloud
4. `App.tsx`: `useCloudAutoSync(activeVault?.id, masterPassword)` wired into MainLayout
5. `vault-manager-ui.tsx` + `create-vault.tsx`: Mark vault as cloud-synced on enable
6. `vault-picker.tsx`: Same-device login now re-imports from cloud (clear + reimport)

## How to test cross-browser sync (BUG-037)
1. Browser A: log in, unlock vault, Vaults page → enable Cloud Sync → enter master password
2. Browser A: add a password entry (auto-sync fires after 3s debounce)
3. Browser B: log in same account → vault appears in Cloud Vaults section → enter master password
4. Browser B: should see the password entry from step 2 ✅

## Account state
- saketsuman1312@gmail.com: plan=lifetime, login works ✅
- www.ironvault.app → ironvault-main project (domains moved)
