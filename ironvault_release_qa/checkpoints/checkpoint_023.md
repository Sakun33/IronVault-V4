# Checkpoint 023 — Session Resume: All Production Endpoints Verified Green

**Date:** 2026-04-09
**Branch:** claude/fervent-mclaren
**Committed:** f46c3c1 (admin-console vercel.json SPA rewrite fix)

## What was verified this run

### www.ironvault.app
- `/api/health` → `{"status":"ok","db":true}` ✅
- `/api/auth/token` POST with SHA256("12121212") for `saketsuman1312@gmail.com` → HTTP 200, JWT token issued ✅
- HTML served → loads bundle `index-1870c316.js` (new server-auth build, 5× `/api/auth/token` calls) ✅
- `www.ironvault.app` alias → `ironvault-main-l9q29ld90` (correct deployment) ✅

### admin.ironvault.app
- SPA rewrite fix committed (was: `/frontend/dist/index.html`, fixed: `/index.html`) ✅
- Already deployed as `admin-console-k07b45ply`, all routes return 200 ✅

### Database
- `crm_users` table: `saketsuman1312@gmail.com` hash = SHA-256("12121212") ✅
- `saketsuman@gmail.com` hash = SHA-256("12121212") (backfilled) ✅
- `deploytest@test.com` hash = SHA-256("12121212") (backfilled) ✅

## SHA-256("12121212") = `054e3b308708370ea029dc2ebd1646c498d59d7203c9e1a44cf0484df98e581a`

## Conclusion
All server-side infrastructure is confirmed working. The login failure the user previously
reported was caused by: (1) missing DATABASE_URL on ironvault-main, (2) old deployment
still served at www.ironvault.app. Both are fixed and verified.

## Awaiting user confirmation
Saket still needs to test login in a FRESH INCOGNITO window:
1. Open fresh incognito → https://www.ironvault.app
2. Click "Log In"
3. Email: saketsuman1312@gmail.com
4. Account Password: 12121212
5. Should succeed — if still fails, open DevTools Console → retry → share console output

## Env vars on ironvault-main project
- `DATABASE_URL` — Production (added during previous session)
- `JWT_SECRET` — Production

## VITE_BACKEND_API_URL impact on auth
None — `auth-context.tsx` uses relative URLs (`/api/auth/token`), not affected by this var.
`VITE_BACKEND_API_URL` is only used in profile.tsx, notifications.ts, encrypted-support-tickets.ts,
customer-registration.ts, profile-management.ts.

## Next tasks
1. Saket tests login in incognito → confirm fixed ✓
2. QA pass continues from last verified module
3. GitHub Actions CI/CD secrets still need to be added (VERCEL_TOKEN, etc.)
