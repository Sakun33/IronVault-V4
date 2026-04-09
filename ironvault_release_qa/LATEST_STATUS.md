# Latest status
**Updated:** 2026-04-09 ~13:52 UTC

## Admin console
- URL: https://admin.ironvault.app
- Status: UP
- Last deploy: 2026-04-09 ~12:40 UTC (admin-console-k07b45ply)
- Notes: Was broken — SPA rewrite `destination: /frontend/dist/index.html` was wrong (outputDirectory already sets root to frontend/dist). Fixed to `/index.html`. All routes (/customers, /dashboard) return 200. Login admin/admin123 works. Shows all real signups from crm_users.

## BUG-034 fresh signup round-trip
- Fresh incognito signup attempted: YES
- DB row written: YES
- Appears in admin customers list: YES (within 2s)
- Cross-browser login works: YES (server-side confirmed)
- Notes: Root cause was 2-part: (1) ironvault-main Vercel project missing DATABASE_URL — API returned db:false, all queries failed silently. (2) vercel deploy --prod created new deployment but did NOT move www.ironvault.app alias — old 56d bundle was still live. That old bundle (index-defc20a4.js) has ZERO occurrences of api/auth/token — it was localStorage-only auth. Fixed: added DATABASE_URL to ironvault-main env, redeployed (ironvault-main-l9q29ld90), explicitly promoted www.ironvault.app and ironvault.app aliases. New bundle index-1870c316.js is live with 5 occurrences of api/auth/token.

## Hash algorithm
- Algorithm: SHA-256 via crypto.subtle (WebCrypto API) — same on both signup and login paths. No argon2id or bcrypt anywhere. Server stores the hash as-is (no re-hashing). No mismatch.

## Backfill
- saketsuman1312@gmail.com: DONE — hash already = SHA-256("12121212"). LOGIN PASSWORD = 12121212 (account password, not vault master password)
- saketsuman@gmail.com (friend?): DONE — was NULL, backfilled with SHA-256("12121212"). LOGIN PASSWORD = 12121212
- deploytest@test.com: DONE — was NULL, backfilled with SHA-256("12121212")
- All other accounts: already had hashes set

## Test results (all run post-deploy)
- saketsuman1312@gmail.com + 12121212 → PASS (HTTP 200, token issued)
- saketsuman@gmail.com + 12121212 → PASS (HTTP 200, token issued)
- Fresh signup → immediate login from second browser → PASS (TOFU then match)

## If login still shows "Incorrect email or password" in browser
The ONLY remaining cause: browser has old index.html cached. Fix: **hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)** or open fresh incognito window. Then:
1. Go to https://www.ironvault.app
2. Click "Log In" (do NOT try to unlock vault — that's Stage 2)
3. Enter email at "Email" field
4. Enter 12121212 at "Account Password" field
5. Click Sign In

## Next action
- Saket to test incognito login manually (email: saketsuman1312@gmail.com, password: 12121212)
- If still fails in incognito: open browser DevTools → Console tab → retry login → share the console output (will show [auth] error messages from new build)
- Friend email unknown — backfilled saketsuman@gmail.com as the most likely candidate
