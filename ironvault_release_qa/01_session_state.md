# Session State

**Last updated:** 2026-04-09T(session 022)
**Branch:** claude/fervent-mclaren
**Latest push:** 0cf8586
**PR:** https://github.com/Sakun33/IronVault-V4/pull/1 — MERGED (commit 567b00a to main)

---

## Current Phase

POST-QA COMPLETE — All 34 bugs filed, 33 fixed, 1 not-a-bug. All fixes deployed to production.

---

## Last Completed Action

Fixed and deployed BUG-034 (P0): real signups were not appearing in admin console because `api/index.ts` queried a non-existent `customers` table instead of the main backend's `crm_users` + `entitlements` tables. Three-part fix: rewrote all customer queries in `api/index.ts`, fixed `vercel.json` routing, added `pg` to root `package.json`.

Also deployed BUG-033 fix to production `www.ironvault.app` (ironvault-main Vercel project).

Retests confirmed:
- BUG-033: `/api/auth/token` live on www.ironvault.app — returns 401 for wrong hash ✅
- BUG-024: `GET /api/customers/:id/vaults` returns vault count ✅
- BUG-025: `GET /api/crm/entitlement/:email` returns plan + status ✅
- BUG-034: admin customers endpoint returns 9 real users from crm_users ✅

---

## Next Exact Action

**QA program is complete.** Only one pending item:
1. Saket manually opens incognito → https://www.ironvault.app/auth/login → logs in with `saketsuman1312@gmail.com` to confirm BUG-033 fix works on fresh browser
2. If login succeeds → mark QA as DONE, 34/34 bugs resolved

---

## Blockers

None. All production deploys are live.

---

## Known Non-Blocking Issues

| Issue | Impact |
|-------|--------|
| Main repo merge conflict in `tests/e2e/full-sweep.spec.ts` | Zero production impact; test file only |
| GitHub Actions CI/CD secrets missing (`VERCEL_TOKEN` etc.) | Manual `vercel deploy --prod` works as workaround |
| `ADMIN_CONSOLE_URL` env var not set on main backend | `forwardToAdminConsole()` falls back to `http://localhost:3001` but this path is rarely hit |

---

## Key Credentials

| Service | Email | Notes |
|---------|-------|-------|
| Main app | saketsuman1312@gmail.com | Test account; lifetime plan |
| Admin console | username: admin / password: admin123 | www: /api/auth/login with `username` field |
| Admin console | saketsuman33@gmail.com | lifetime |

---

## Restart Instructions

1. Read this file
2. Read `ironvault_release_qa/checkpoints/checkpoint_022.md`
3. All production deploys complete — no code work needed
4. Only pending: Saket's manual browser retest of BUG-033
