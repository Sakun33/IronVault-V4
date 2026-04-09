# Checkpoint 020 — BUG-033: Cross-Device Login Fix

**Date:** 2026-04-09  
**Branch:** claude/fervent-mclaren  
**Commit:** d521182  
**PR:** https://github.com/Sakun33/IronVault-V4/pull/1

---

## Incident

User report: `saketsuman1312@gmail.com` unable to log in from mobile Safari (different browser) despite using correct credentials.  
Error shown: "Incorrect email or password. Please try again."  
Same credentials work on original browser.

---

## Root Cause

**Stage 1 account auth was 100% localStorage-only.**

`account-auth.ts`: `saveAccountCredentials()` writes `iv_account = {email, sha256(password)}` to localStorage only. `verifyAccountCredentials()` reads localStorage, returns false if key missing.

`auth-context.tsx` `accountLogin()`: called `verifyAccountCredentials()` → localStorage read → empty on new browser → always false → "Incorrect email or password".

The server already had `POST /api/auth/token` with trust-on-first-use logic (`server/routes.ts:790`), but it was never called during signup or login — only as a side effect of acquiring the cloud vault JWT token, and even that only ran AFTER successful local login (which never happened on a new device).

---

## Fix

**Files changed:** `client/src/lib/account-auth.ts`, `client/src/contexts/auth-context.tsx`

### account-auth.ts
- Exported `sha256` (was private; needed by auth-context)

### auth-context.tsx — `accountLogin()`
New flow:
1. Compute `passwordHash = sha256(password)` client-side
2. `POST /api/auth/token` with `{email, accountPasswordHash: passwordHash}`
3. Server trust-on-first-use: if DB hash is NULL → stores it → 200 OK (new user / existing user first sync)
4. Server: if DB hash matches → 200 OK
5. Server: if DB hash doesn't match → 401 → reject immediately (wrong password)
6. Network error → fall back to localStorage (offline support preserved)
7. On any success: call `saveAccountCredentials()` to persist locally for offline, then proceed with session

### auth-context.tsx — `initializeAuth()` (background sync)
When an account session is restored from localStorage on page load, the stored hash is now silently synced to the server in the background via `POST /api/auth/token`. This handles existing users who signed up before this fix was deployed — on their next page load, their hash gets written to the DB, enabling cross-device login immediately.

---

## Why This Works for saketsuman1312@gmail.com

1. User loads app on original browser → `initializeAuth()` restores session → fires `POST /api/auth/token` in background → DB gets their hash (TOFU)
2. User opens incognito / new device → `accountLogin()` calls server → server verifies hash → 200 → login succeeds → credentials saved locally

If the DB already has the hash (e.g. from the background sync on step 1), step 2 verifies against it. Same SHA-256(password), same result.

---

## Note on Bug ID

User requested filing as "BUG-027". BUG-027 was already filed in a prior session as "Entitlement API response shape mismatch" (FIXED). This bug is correctly filed as **BUG-033** (next available ID).

---

## Status

- ✅ Fix committed: `d521182` on `claude/fervent-mclaren`
- ✅ Pushed to origin
- ⚠️ PENDING PR#1 merge to main for production deploy
- ⚠️ Retest pending (requires merge)

---

## Definition of Done for BUG-033

- [ ] PR#1 merged to main → fix deployed to www.ironvault.app
- [ ] Incognito login test with saketsuman1312@gmail.com succeeds
- [ ] Vault picker appears after login
- [ ] No regression on normal (same-browser) login flow
