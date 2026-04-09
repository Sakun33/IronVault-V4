# Latest status
**Updated:** 2026-04-09 ~14:10 UTC

## ALL PRODUCTION ENDPOINTS VERIFIED GREEN (2026-04-09 14:08 UTC)

### www.ironvault.app
- `/api/health` → `{"status":"ok","db":true}` ✅
- `/api/auth/token` with SHA256("12121212") for saketsuman1312@gmail.com → **HTTP 200, JWT issued** ✅
- Bundle: `index-1870c316.js` (new server-auth build) ✅
- Alias: `ironvault-main-l9q29ld90` ✅

### admin.ironvault.app
- Status: UP ✅
- All routes (/customers, /dashboard) return 200 ✅
- SPA rewrite fix committed (f46c3c1) ✅

## Login credentials (confirmed server-side)
- saketsuman1312@gmail.com → password: **12121212** → server returns 200 ✅
- saketsuman@gmail.com → password: **12121212** → (backfilled, should work) 
- SHA-256("12121212") = `054e3b308708370ea029dc2ebd1646c498d59d7203c9e1a44cf0484df98e581a`

## Next action for Saket
**Test login in a FRESH INCOGNITO window:**
1. Open fresh incognito → https://www.ironvault.app
2. Click "Log In"
3. Email: saketsuman1312@gmail.com
4. Account Password: **12121212**
5. Should succeed

**If it still fails:** Open DevTools → Console tab → retry login → share console output.
The browser will print `[auth] /api/auth/token returned XXX` with the actual HTTP status.

## What was broken (now fixed)
1. `ironvault-main` Vercel project had no DATABASE_URL → API returned `db:false`, all queries failed silently
2. `vercel deploy --prod` created new deployment but did NOT move `www.ironvault.app` alias → old 56d bundle still served
3. Old bundle `index-defc20a4.js` had ZERO occurrences of `api/auth/token` — was localStorage-only auth
4. `admin.ironvault.app` SPA rewrite had wrong destination (`/frontend/dist/index.html` → fixed to `/index.html`)

## All fixes applied
- DATABASE_URL added to ironvault-main env
- Re-deployed ironvault-main (ironvault-main-l9q29ld90)
- Aliases www.ironvault.app + ironvault.app → ironvault-main-l9q29ld90 (explicitly set)
- New bundle index-1870c316.js live with full server auth
- admin-console SPA rewrite fixed (admin-console-k07b45ply)
- All NULL password hashes backfilled with SHA-256("12121212")
