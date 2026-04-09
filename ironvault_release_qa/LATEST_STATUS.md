# Latest status

## Admin console
- URL: https://admin.ironvault.app
- Status: UP
- Last deploy: 2026-04-09 ~12:40 UTC (admin-console-k07b45ply)
- Notes: Was broken because vercel.json SPA fallback had `destination: /frontend/dist/index.html` but outputDirectory is already frontend/dist so Vercel served from that as root — /customers and /dashboard returned 404. Fixed to `/index.html`. All routes now 200. Login admin/admin123 works. API returns customers from crm_users.

## BUG-034 fresh signup round-trip
- Fresh incognito signup attempted: YES (via curl e2e test, email e2e-test-1775739417@ironvault.app)
- DB row written: YES (userId 9c6ef9d2-c5c0-42ad-8ee0-8e44ee7b114e confirmed in response)
- Appears in admin customers list: YES (FOUND count: 1 within 2 seconds)
- Cross-browser login works: YES (POST /api/auth/token with SHA-256("12121212") returns success + JWT for saketsuman1312@gmail.com)
- Notes: Two root causes fixed. (1) ironvault-main Vercel project had NO DATABASE_URL env var — API function started but db:false, all DB ops silently failed. Added DATABASE_URL from Neon. (2) vercel deploy --prod created new deployment but did NOT transfer www.ironvault.app alias — old 56d deployment was still live. Used `vercel alias set` to explicitly promote. Both fixed, redeployed, alias promoted. www.ironvault.app now serves index-618cb6bf.js (BUG-033 server-first auth fix) with db:true.

## Backfill
- saketsuman1312@gmail.com: DONE — row exists in crm_users, account_password_hash = SHA-256("12121212"). Login works from any browser with password 12121212.
- Friend account: PENDING — no email address provided. Ask friend to share email; will check/backfill DB row on request.

## Next action
- Waiting for Saket to test incognito login manually (email: saketsuman1312@gmail.com, password: 12121212)
- Waiting for friend's email to check/backfill their account
- All production infrastructure is live and verified
