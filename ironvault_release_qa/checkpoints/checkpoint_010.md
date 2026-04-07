# Checkpoint 010 — BUG-016..025: Mobile UX, Pricing Unification, Plan Gating, DB Schema, Admin CRUD

**Date:** 2026-04-07
**Branch:** claude/fervent-mclaren
**Commit:** 52fbe65
**Deployment:** https://fervent-mclaren-jy8n128tq-saket-sumans-projects-1f5ede07.vercel.app → aliased to www.ironvault.app
**E2E result:** 210/210 passed (105 desktop + 105 mobile) — NO REGRESSION

---

## Bugs Fixed (10 total this session)

### BUG-016 — Vault Switcher Dropdown (Reopened + Final Fix)
**Root cause (attempt 1 was insufficient):** Previous `createPortal` fix escaped DOM stacking contexts but NOT `html/body/#root overflow-y: hidden` set globally by `index.css`. `position: fixed` elements are still clipped when `overflow: hidden` is set on the `html` element.

**Final fix:** Replaced custom portal with Radix `DropdownMenu` (which uses its own internal `DropdownMenuPrimitive.Portal`). Radix portals are genuinely immune to ancestor overflow constraints. Files changed: `client/src/App.tsx` — import from `@/components/ui/dropdown-menu`; removed all `createPortal`, `useRef`, `toggleVaultSwitcher`, `closeVaultSwitcher` code.

---

### BUG-017 — Landing Page Log In CTA + Login Page Forgot Password
- `landing.tsx`: Added "Log In" button (`variant="outline"`) alongside "Get Started free" in hero CTA. Download Android button demoted to `ghost` variant.
- `login.tsx`: Added "Forgot password?" link next to password label — shows toast with support contact email. Footer updated to "New to IronVault? Create a free account".

---

### BUG-018 — Mobile Header Right-Side Icons Hidden
**Root cause:** Mobile header left div had no flex constraint — vault chip grew unboundedly, pushing notification bell, theme toggle, and lock button off-screen.

**Fix (`App.tsx`):** Left div → `min-w-0 flex-1 overflow-hidden`. Right div → `shrink-0`. Vault chip → `min-w-0 max-w-[90px] shrink` (truncates instead of expanding).

---

### BUG-019 — MoreSheet Hamburger Menu Not Scrollable
**Root cause:** `MoreSheet.tsx` container lacked `overflow-hidden flex flex-col`. Content div used inline `maxHeight` style without flex layout — items below the fold were unreachable.

**Fix:** Container → `overflow-hidden flex flex-col`. Content div → `flex-1 overflow-y-auto overscroll-contain` (removed inline maxHeight style).

---

### BUG-020 — App Auto-Navigates to Dashboard Every ~1 Minute (CRITICAL)
**Root cause:** `auto-lock.ts` had `gracePeriodMs: number = 0`. The web `visibilitychange` handler immediately locked the vault on any tab-hide event (screen dim on mobile = tab hidden = instant lock → vault picker shown → unlock → `setLocation('/')` = Dashboard). Cycle repeated every screen dim.

**Fix (`client/src/native/auto-lock.ts`):**
- `gracePeriodMs` default: `0` → `30 * 1000` (30 seconds)
- `loadSettings()` default: `0` → `30 * 1000`
- Web `visibilitychange` handler: removed immediate-lock path for `gracePeriodMs === 0` (web never locks on tab hide — only on tab return after grace period elapsed)
- On tab visible: `resetIdleTimer()` called

---

### BUG-021 — Pricing Inconsistency Across App
**Root cause:** No single source of truth. Each page (landing, signup, pricing, profile, admin) had its own hardcoded plan list with different names (Pro vs Pro Monthly), different prices (USD vs INR), and missing plans (no Lifetime on signup, no Pro Family on pricing).

**Fix:** Created `client/src/lib/plans.ts` — canonical export of `PLANS: Plan[]`, `getPlan()`, `formatINR()`, `planPriceLabel()`. Updated: `pricing.tsx` (full rewrite, 4-column grid, Lifetime added, Coming Soon for family), `signup.tsx`, `landing.tsx`, `customer-info-dialog.tsx`, `profile.tsx`, `admin-console/api/index.ts`.

**Canonical plan set:**
| ID | Name | Price |
|----|------|-------|
| free | Free | ₹0 |
| pro | Pro Monthly | ₹149/mo or ₹1,499/yr |
| family | Pro Family | ₹299/mo — Coming Soon |
| lifetime | Lifetime | ₹9,999 one-time |

---

### BUG-022 — Free Users Can Create Unlimited Local Vaults
**Root cause:** `vaultManager.createVault()` had no plan-limit check. No per-plan vault limit defined anywhere.

**Fix:**
- `plans.ts`: Added `localVaultLimit` field to `Plan` interface (free=1, pro=5, family=5, lifetime=5)
- `vault-manager.ts`: Added `getLocalVaultCount()` helper; `createVault()` now accepts `planLocalLimit` and throws `PLAN_LIMIT` error when `registry.length >= limit`
- NEW `client/src/hooks/use-plan-features.ts`: `usePlanFeatures()` hook — fetches `/api/crm/entitlement/:email`, caches 5 min in `iv_plan_cache` localStorage, returns `PlanFeatures` object
- `create-vault.tsx`: Imports `usePlanFeatures`; shows amber upgrade banner + disables submit when at limit
- `vault-picker.tsx`: Replaces "Add a vault" button with upgrade CTA when at limit

---

### BUG-023 — Missing DB Tables (family_invites, plan_audit_log)
**Root cause:** DB schema only had `customers`, `cloud_vaults`, `tickets`, `ticket_replies`. No family invite or plan change tracking.

**Fix (`api/index.ts`):** Added idempotent `POST /api/crm/migrate` endpoint that runs:
```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone, marketing_consent, vault_count, flagged_over_limit;
CREATE TABLE IF NOT EXISTS family_invites (owner_email FK, invitee_email, status, timestamps, UNIQUE constraint);
CREATE TABLE IF NOT EXISTS plan_audit_log (customer_email, old_plan, new_plan, changed_by, reason);
```
Also added CRUD: `GET/POST /api/crm/family-invites`, `PATCH /api/crm/family-invites/:id`, `POST /api/crm/vaults/report`.

**Migration run:** ✓ confirmed `{ "success": true, "message": "Schema migration complete (BUG-023)" }` post-deploy.

---

### BUG-024 — Admin Console Missing Vault Count + Plan Audit + Family Invites
**Fix (`admin-console/api/index.ts`):** Added:
- `GET /api/customers/:id/vaults` — local vault count from `customers.vault_count` + cloud count from `cloud_vaults` JOIN
- `GET/DELETE /api/customers/:id/family-invites` — view and revoke family invites
- `POST /api/customers/:id/upgrade` — plan change with automatic `plan_audit_log` entry
- `GET /api/customers/:id/plan-history` — full audit trail for a customer
- `GET /api/flagged-accounts` — accounts with `flagged_over_limit = true`
- `GET /api/audit-log` — now returns real data from `plan_audit_log` (was stub returning `[]`)

---

### BUG-025 — Plan-Gated Features Not Server-Checked (Stale Cache)
**Root cause:** Plan data was cached indefinitely in `LicenseContext` with no server refetch. Admin plan changes didn't propagate to running frontend sessions.

**Fix:** NEW `client/src/hooks/use-plan-features.ts`:
- Fetches `/api/crm/entitlement/:email` on mount
- Caches result in `iv_plan_cache` localStorage with 5-minute TTL
- Returns `PlanFeatures` object: `localVaultLimit`, `cloudSyncEnabled`, `bankImportEnabled`, `analyticsEnabled`, `biometricEnabled`, `isPaid`, `isLifetime`, `isLoading`, `refresh()`
- Exported: `savePlanCache()`, `clearPlanCache()`

---

## Deployment

**Vercel issue resolved:** Root directory was set to `client/` in the fervent-mclaren Vercel project, causing builds to fail with `ENOENT: package.json not found`. Fixed by patching `rootDirectory: null` via Vercel REST API (`PATCH /v9/projects/:id`). Fresh production build succeeded (466 files, 54s build, vite 4840 modules transformed).

**Deploy URL:** `fervent-mclaren-jy8n128tq-saket-sumans-projects-1f5ede07.vercel.app` → aliased to `www.ironvault.app`
**Commit:** `52fbe65` (`fix(bugs): BUG-016..025 — mobile UX, auto-lock, pricing, plan gating, DB schema`)

---

## DB State Post-Migration

| Table | Status |
|-------|--------|
| customers | +phone, +marketing_consent, +vault_count, +flagged_over_limit columns added |
| family_invites | Created ✓ |
| plan_audit_log | Created ✓ |
| cloud_vaults | Unchanged (existing) |
| tickets / ticket_replies | Unchanged (existing) |

---

## Account Upgrades

| Email | Plan Before | Plan After | Method |
|-------|-------------|------------|--------|
| saketsuman1312@gmail.com | (new entry) | Lifetime | POST /api/crm/register + plan=lifetime |
| qa-pro@ironvault.app | (new entry) | Pro | POST /api/crm/register + plan=pro |

---

## Pro Test Account Credentials

| Field | Value |
|-------|-------|
| Email | `qa-pro@ironvault.app` |
| Account password | `ProTest@2026!` |
| Vault master password | Set on first sign-up via `/auth/signup` |
| Plan | Pro (server-confirmed) |
| CRM user ID | `b35816c8-5a27-4aec-8e96-3446002a8dff` |

> **Note:** The account password is set server-side (trust-on-first-use cloud token established). To activate the account on the client, visit `/auth/signup` on www.ironvault.app, enter the credentials above, pick a master password, and complete vault creation.

---

## QA Status

| Bug | Code | Deployed | E2E |
|-----|------|----------|-----|
| BUG-016 (Radix dropdown) | ✓ | ✓ | — |
| BUG-017 (Log In + Forgot pw) | ✓ | ✓ | — |
| BUG-018 (mobile header icons) | ✓ | ✓ | — |
| BUG-019 (MoreSheet scroll) | ✓ | ✓ | — |
| BUG-020 (auto-redirect/flicker) | ✓ | ✓ | — |
| BUG-021 (pricing unification) | ✓ | ✓ | — |
| BUG-022 (vault limits) | ✓ | ✓ | — |
| BUG-023 (DB schema) | ✓ | ✓ migration run | — |
| BUG-024 (admin CRUD) | ✓ | ✓ | — |
| BUG-025 (plan gating hook) | ✓ | ✓ | — |

All 10 bug fixes deployed. 210/210 E2E tests green. Manual retest for BUG-016..025 pending (requires interactive mobile/desktop session).

---

## Outstanding

- BUG-016..025 manual retest: PENDING (needs visual verification on mobile device)
- `07_retest_matrix.md` retest status entries for BUG-016..025: `PENDING post-deploy` → should be updated to PASS after manual verification
- `ironvault_release_qa/05_bug_register.csv` retest_status/regression_status: `PENDING` → should be updated to PASS after manual verification
- Admin console DB integration: admin console currently uses `admin-data.json` static data for the customer list; the new `/api/customers/:id/upgrade` and related endpoints use the real Neon DB but the list view does not yet reflect real-time data
