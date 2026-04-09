# Checkpoint 005 — BUG-014 Two-Stage Auth Rework, 81/81 E2E Pass

**Timestamp**: 2026-04-07
**Phase**: QA Program Complete — GO state maintained
**Previous checkpoint**: checkpoint_004.md

---

## What was accomplished

### BUG-014: Full Two-Stage Auth + Account Session Persistence + Vault Picker

**Root cause**: BUG-011/012 stored account credentials but did not persist a login session across page loads. Every reload re-showed the Stage 1 form. No dedicated vault picker page existed. Signup created both account and vault in a single step. Login page handled both stages inline with complex state. Sidebar items ungrouped.

### Authoritative Spec Implemented

1. **Stage 1 (account login)** — email + account password, persists in `iv_account_session` localStorage. Survives page reloads and browser restarts. Cleared on explicit logout.

2. **Stage 2 (vault master password)** — per-session only, stored in `iv_session` sessionStorage. Must re-enter after browser close or page reload.

3. **Three-tier App.tsx routing**:
   - Tier 1 (`!isAccountLoggedIn`): landing page + auth routes + public info pages
   - Tier 2 (`isAccountLoggedIn && !isUnlocked`): vault picker + `/auth/create-vault` + public pages
   - Tier 3 (`isUnlocked`): main app

4. **Web gating**: Landing page shown when no `iv_account_session`. Once account session cached → skip landing, show vault picker directly.

### Files Changed

**`client/src/lib/account-auth.ts`** — Added:
- `saveAccountSession(email)` — saves `iv_account_session` to localStorage
- `isAccountSessionActive()` — reads localStorage flag
- `getAccountSessionEmail()` — reads email from session
- `clearAccountSession()` — removes session on logout
- `markOnboardingShown()` / `hasSeenOnboarding()` — first-launch gating flag

**`client/src/contexts/auth-context.tsx`** — Added:
- `isAccountLoggedIn` + `accountEmail` state
- `initializeAuth()` restores account session from localStorage
- `accountLogin(email, password)` — verifies credentials → saves session → sets React state
- `accountLogout()` — clears session + locks vault

**`client/src/pages/vault-picker.tsx`** (NEW):
- Account home shown after Stage 1 login
- Lists all local vaults (via `vaultManager.getExistingVaults()`)
- Per-vault master password input + unlock button (`button-unlock-vault`, `input-unlock-password`)
- Biometric shortcut for default vault (native apps: `button-biometric-unlock`)
- Cloud vault placeholder "coming soon" section
- "Add a vault" CTA (`button-create-new-vault`) → `/auth/create-vault`
- Account email display + Sign out (`button-account-logout`)

**`client/src/pages/create-vault.tsx`** (NEW):
- Stage 2 onboarding / "add additional vault"
- Fields: vault name (`input-vault-name`), master password (`input-create-password`), confirm (`input-confirm-password`)
- Submit (`button-create-vault`) → creates vault → redirects to Dashboard

**`client/src/pages/signup.tsx`** — Reworked to Stage 1 only:
- Removed vault name and master password fields
- Kept: email, name, country, phone, plan, account password, confirm account password, marketing consent
- On submit: `saveAccountCredentials` → `accountLogin` (sets React state) → redirect to `/auth/create-vault`
- Shows two-step progress indicator (Step 1 active, Step 2 pending)

**`client/src/pages/login.tsx`** — Reworked to Stage 1 only:
- Simple form: email (`input-account-email`) + account password (`input-account-password`)
- Submit (`button-account-login`) → `accountLogin` → Router switches to Tier 2 (vault picker)
- Removed all vault creation / lockout / biometric logic (moved to vault-picker.tsx)

**`client/src/App.tsx`** — Three-tier routing + sidebar groups:
- Imports `VaultPickerPage` and `CreateVaultPage`
- `PUBLIC_INFO_ROUTES` constant reused across tiers
- Router: three `if (!isAccountLoggedIn)` / `if (!isUnlocked)` / else branches
- `coreNavItems` (Vault group: Dashboard, Vaults, Passwords, Notes, Documents, API Keys)
- `financeNavItems` (Finance group: Subscriptions, Expenses, Bank Statements, Investments, Reminders)
- `bottomNavItems` (pinned: Profile, Activity Logs, Settings, Upgrade)
- Sidebar renders section headers "Vault" and "Finance" between groups

**`tests/e2e/full-sweep.spec.ts`** — Updated helpers + 8 new BUG-014 tests:
- Added `ACCOUNT_PW = 'accountPw99'` constant
- New `injectAccountSession(page)` helper — SHA-256 hashes ACCOUNT_PW + sets both `iv_account` and `iv_account_session` localStorage keys
- `createVaultFull` — navigates to `/auth/create-vault` directly (account session already set)
- `unlockVault` — injects account session if missing, then handles vault picker flow
- `navigate` — detects vault picker (`button-unlock-vault`) or landing page for re-auth
- Tests 1.1-1.4 updated for new Stage 1 login page
- 8 new BUG-014 tests (14.1–14.8) covering: session persistence, vault picker visibility, vault unlock, logout, signup redirect, vault creation, sidebar labels, web-cached-visit gating

### E2E Result
**81/81 PASS** — 8 new tests, zero regressions

### Deployment
- `vercel --prod --yes --force` from worktree
- Aliased to `www.ironvault.app`
- Deployment: `fervent-mclaren-clt8crx89-saket-sumans-projects-1f5ede07.vercel.app`

---

## Updated Bug Scorecard

| Bug ID | Severity | Resolution | Status |
|--------|----------|------------|--------|
| BUG-001 | High/P0 | Sidebar scrollable + pinned bottom | FIXED |
| BUG-002 | Medium/P1 | Sidebar active state via useLocation | FIXED |
| BUG-003 | Critical/P0 | PUBLIC_PATHS → LandingPage router | FIXED |
| BUG-004 | Medium/P1 | Marketing landing page at / | FIXED |
| BUG-005 | High/P0 | Admin console IronVault branding | FIXED |
| BUG-006 | High/P1 | 24h JWT session — expected behavior | CLOSED (N/A) |
| BUG-007 | Medium/P1 | Customer list total count | FIXED |
| BUG-008 | Low/P2 | admin-data.json plan_name | FIXED |
| BUG-009 | High/P0 | Landing page scroll + login flow | FIXED |
| BUG-010 | High/P0 | Signup form with customer details + plan | FIXED |
| BUG-011 | High/P0 | Two-stage auth (account → vault) — initial impl | FIXED (superseded by BUG-014) |
| BUG-012 | High/P0 | Account password on signup — initial impl | FIXED (superseded by BUG-014) |
| BUG-013 | Medium/P1 | Landing page mobile responsiveness | FIXED |
| BUG-014 | High/P0 | Full two-stage auth rework (session persistence, vault picker, two-stage onboarding, sidebar groups) | FIXED |

**All P0 bugs**: 7/7 FIXED
**All P1 bugs**: 5/5 resolved (BUG-006 N/A)
**All P2 bugs**: 1/1 FIXED
**E2E suite**: 81/81 PASS

---

## Release Verdict

### **GO** ✓

All functional bugs resolved. Two-stage auth fully implemented with proper session persistence, vault picker, biometric wiring, cloud placeholder, and two-stage onboarding. Sidebar reorganized with Vault/Finance section groups. 81/81 automated tests passing including 8 new BUG-014 coverage scenarios.
