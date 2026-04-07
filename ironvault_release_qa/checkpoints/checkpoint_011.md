# Checkpoint 011 — Pro Feature Gating & 264-Test Full Suite Green

**Date:** 2026-04-07  
**Branch:** claude/fervent-mclaren  
**Session:** Context continuation from checkpoint_010

---

## Status

**E2E Suite: 264/264 PASS** (desktop + mobile, sections 1–24)  
Production URL: https://www.ironvault.app  
Vercel deployment: `fervent-mclaren-osthep7pz-saket-sumans-projects-1f5ede07.vercel.app`

---

## Bugs Fixed This Session

### BUG-026 · React Hooks Violation (Critical)
**Symptom:** Buttons on 7 pro-gated pages completely non-functional for ALL users (free and pro).  
**Root cause:** Hooks called after `if (!isFeatureAvailable(...)) return <UpgradeGate>` conditional early return. When `isFeatureAvailable` flips between renders, React's hook call order changes → broken state.  
**Files:** `expenses.tsx`, `subscriptions.tsx`, `api-keys.tsx`, `bank-statements.tsx`, `documents.tsx`, `goals.tsx`, `investments.tsx`  
**Fix:** Moved ALL hooks to top of component. Moved UpgradeGate guard to just before main JSX `return`. Added `licenseLoading` check to prevent UpgradeGate flash during license load.

### BUG-027 · Entitlement API Response Shape Mismatch (High)
**Symptom:** Pro users always shown UpgradeGate — server plan never synced.  
**Root cause:** `getEntitlementStatus()` reads `data.entitlement.plan` but API returned flat `{plan,status}`. `data.entitlement` was always `undefined` → sync short-circuited.  
**Files:** `api/index.ts`  
**Fix:** Endpoint now returns `{ ...flatFields, entitlement: { ...flatFields } }` for both found and not-found cases.

### BUG-028 · Pro License Reads as Free After Vault Unlock (Critical)
**Symptom:** Pro user sees UpgradeGate on all pro pages even after vault unlock. Persists for entire session.  
**Root cause:** `LicenseProvider` mounts when vault is LOCKED (at vault picker) → `vaultStorage.getPersistentData('license')` can't decrypt (no vault key) → returns `null` → free default license. No mechanism to reload license after vault unlock.  
**Files:** `client/src/contexts/license-context.tsx`  
**Fix:** Added `useAuth()` to `LicenseProvider`. New `useEffect([isUnlocked])`: when vault unlocks, resets `hasSyncedFromServer.current = false` and calls `loadLicense().then(syncFromServer())` — loads the now-decryptable license from IndexedDB and re-syncs with the server entitlement API.

---

## E2E Test Suite Expansion (Sections 19–24)

Added 54 new Playwright tests covering pro feature CRUD across:
- **19 · Expenses** (9 tests): UpgradeGate check, Add modal, form submit, seed 4 more, search, date filter, template, categories chart, delete
- **20 · Subscriptions** (5 tests): UpgradeGate, Add modal, create + verify, search filter, delete
- **21 · Bank Statements** (3 tests): UpgradeGate, Add sample statement, data appears
- **22 · Investments** (4 tests): UpgradeGate, Add modal, Goals UpgradeGate, Add Goal modal
- **23 · API Keys** (4 tests): UpgradeGate, Add modal, create + verify, delete
- **24 · Documents** (2 tests): UpgradeGate, toolbar buttons present

**Total suite:** 264 tests (was 210 before this session)

### Key Test Infrastructure Fixes
- `navigatePro()`: Changed from full `page.goto` (clears sessionStorage, locks vault) to `pushState` client-side navigation (keeps vault unlocked + license loaded)
- `unlockProVault()`: Added 3s wait in the unlock-existing-vault path for license sync
- `waitForFunction` in `navigatePro`: Changed to detect `"Upgrade to unlock"` (UpgradeGate body copy) instead of generic text that matched non-gate elements
- UpgradeGate assertions: Changed from `text.includes('Upgrade to Pro')` (appears elsewhere) to `text.includes('Upgrade to unlock')` (unique to UpgradeGate component)
- Mobile overflow-hidden: Switched to `page.evaluate()` clicks and `waitForFunction` DOM checks for buttons in overflow-hidden containers (`button-add-expense`, expense search input, document toolbar)
- Form selectors: Scoped combobox/input selectors to `[role="dialog"]` to avoid matching page-level filters
- Data-testid selectors: Used `button-add-expense`, `input-service-name`, `input-cost`, `save-subscription-button`, `billing-date-trigger`, `input-expenses-search`

---

## Deployment Notes

- `www.ironvault.app` alias must be manually updated after each `vercel deploy --prod` (it was pointing to the 2-day-old deployment at the start of this session)
- Command to re-alias: `vercel alias set fervent-mclaren-{DEPLOYMENT_ID}.vercel.app www.ironvault.app`

---

## Next Tasks

1. **Seed data via UI** — add 30 expenses, 20 passwords, 15 notes etc. using the pro test account to populate modules with realistic data for visual/manual QA
2. **Comprehensive manual QA** — all pages at 1920/1440/1280/414/390/375/360px viewports  
3. **Admin console verification** — every page at admin.ironvault.app, table sorts, filters, actions  
4. **Bug register audit** — review and close BUG-021 through BUG-025 retest items (marked PENDING)  
5. **Release readiness report** — update 08_release_readiness.md  
