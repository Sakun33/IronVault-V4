# Latest status
**Updated:** 2026-04-09 ~15:50 UTC

## PRODUCTION DEPLOY — ironvault-main-ayy8ieeaf ✅
- Deployment: `ironvault-main-ayy8ieeaf-saket-sumans-projects-1f5ede07.vercel.app`
- Aliases: www.ironvault.app ✅, ironvault.app ✅
- Bundle: `index-29b227e6.js`
- main branch: `b0536b3` (merged claude/fervent-mclaren)
- Timestamp: 2026-04-09 ~15:50 UTC

## Bugs promoted in this deploy

| Bug | Title | Status |
|-----|-------|--------|
| BUG-033 | Server-backed cross-device login | LIVE ✅ |
| BUG-034 | Admin console SPA rewrite 404 | LIVE ✅ |
| BUG-035 | Entitlement URL encode (%40) — plan always returned free | LIVE ✅ |
| BUG-036 | Per-vault Cloud Sync toggle on Vaults settings page | LIVE ✅ |

## Verification
- `GET /api/health` → `{"status":"ok","db":true}` ✅
- `GET /api/crm/entitlement/saketsuman1312%40gmail.com` → `plan: "lifetime"` ✅ (BUG-035 confirmed)
- Bundle `index-29b227e6.js` includes cloud sync toggle code ✅

## How to use Cloud Sync (BUG-036)
1. Log in → unlock vault → sidebar → **Vaults**
2. Vault card shows **Cloud Sync** toggle (bottom row, below Biometric)
3. Toggle ON → enter master password → **Enable Cloud Sync** → blue Cloud badge appears
4. Other browsers: log in → vault picker shows vault in Cloud Vaults section
5. Toggle OFF → confirm → cloud copy removed → other devices stop seeing it

## Account state
- saketsuman1312@gmail.com: plan=lifetime, login works ✅
- All NULL password hashes backfilled with SHA-256("12121212") ✅
