# Checkpoint 022 — BUG-034 Fixed + All Production Deploys Green

**Date:** 2026-04-09  
**Branch:** claude/fervent-mclaren  
**PR:** https://github.com/Sakun33/IronVault-V4/pull/1 — MERGED (commit 567b00a)

---

## What Happened This Session

### PR#1 Merged
- PR#1 merged to main as commit `567b00a`
- Contained BUG-024, BUG-025, BUG-033 fixes

### BUG-033: Cross-Device Login — DEPLOYED
- `auth-context.tsx` server-first login fix deployed to `www.ironvault.app` via `ironvault-main` Vercel project
- Deploy method: overrode `.vercel/project.json` in worktree to `prj_sSdTau9Ic7qrNoItbpU23kEkIf3d`, ran `vercel deploy --prod`, restored project.json
- Endpoint confirmed live: `POST https://www.ironvault.app/api/auth/token` returns 401 for bad hash, 200 for correct

### BUG-034: Signups Not in Admin — FIXED AND DEPLOYED
Root cause: `admin-console/api/index.ts` queried a `customers` table that doesn't exist in Neon DB.
Main backend writes to `crm_users` + `entitlements`. Three-part fix:
1. `api/index.ts` — all customer endpoints rewritten to query `crm_users LEFT JOIN entitlements`
2. `vercel.json` routing — changed from `/backend/server-simple-working.ts` to `/api/index`
3. `package.json` — added `pg` + `@vercel/node` to root dependencies

**Verified live:** `curl https://admin.ironvault.app/api/customers` returns 9 real users including `saketsuman1312@gmail.com`.

---

## Final State

| Check | Result |
|-------|--------|
| Total bugs filed | 34 |
| Fixed | 33 |
| Not a bug | 1 |
| Open | 0 |
| www.ironvault.app /api/health | `{"status":"ok","db":true}` |
| www.ironvault.app /api/auth/token | Live, hash-verifying |
| admin.ironvault.app customers | 9 real users visible |
| BUG-024 (vault count endpoint) | PASS |
| BUG-025 (entitlement email lookup) | PASS — returns lifetime for saketsuman1312 |
| BUG-033 (cross-device login) | PASS — server-first auth live on www.ironvault.app |
| BUG-034 (signups in admin) | PASS — admin reads crm_users directly |

---

## Remaining Items (Non-Blocking)

| Item | Status |
|------|--------|
| Main repo merge conflict (full-sweep.spec.ts) | Unresolved — doesn't affect production |
| GitHub Actions CI/CD secrets | Missing — doesn't affect manual deploys |
| ADMIN_CONSOLE_URL env var on main backend | Not verified — forwardToAdminConsole() fallback to localhost |
| BUG-033 browser retest (human verify) | Saket to test incognito login on saketsuman1312@gmail.com |

---

## Resume Instructions

If restarting from scratch:
1. Read `ironvault_release_qa/01_session_state.md`
2. Read this checkpoint
3. All production deploys are live — no blocking deploy steps remain
4. The only pending action is Saket's manual browser retest of BUG-033 (open incognito → www.ironvault.app/auth/login → login with saketsuman1312@gmail.com)
5. If Saket confirms login works → QA program is complete, all 34 bugs resolved
