# IronVault — Final Bug Report

**Generated:** 2026-04-09  
**Branch:** claude/fervent-mclaren  
**PR:** https://github.com/Sakun33/IronVault-V4/pull/1  
**Test Suite:** 454/454 passing (full-sweep.spec.ts + deep-verify.spec.ts)

---

## Summary

| Metric | Count |
|--------|-------|
| Total bugs filed | 32 |
| Fixed | 31 |
| Not a bug | 1 |
| Open / Unresolved | 0 |

All 32 reported defects have been resolved. Code fixes are committed to `claude/fervent-mclaren`. Two fixes (BUG-024, BUG-025) require PR#1 merge to `main` before they are live in production.

---

## Bug Register

| ID | Title | Severity | Status | Fix Summary |
|----|-------|----------|--------|-------------|
| BUG-001 | Sidebar bottom items cut off at standard viewport height | High | ✅ FIXED | App.tsx: sidebar split into scrollable primary + pinned bottom section |
| BUG-002 | Sidebar has no active state indicator for current route | Medium | ✅ FIXED | App.tsx: useLocation() comparison + conditional `bg-accent font-semibold` class |
| BUG-003 | Public info pages (/privacy /terms /about) require authentication | Critical | ✅ FIXED | App.tsx: PUBLIC_PATHS array + public-only Switch branch before auth guard |
| BUG-004 | No standalone marketing/landing page for unauthenticated visitors | Medium | ✅ FIXED | Merged landing page branch; LandingPage at / when !isUnlocked |
| BUG-005 | Admin console branding uses wrong product names | Low | ✅ FIXED | Updated admin-console UI strings to IronVault branding |
| BUG-006 | Admin console accessible without entering credentials | Medium | ✅ NOT A BUG | JWT auth confirmed present and working on all admin routes |
| BUG-007 | Admin customer list shows 0 total despite displaying rows | Medium | ✅ FIXED | admin-console backend: total count query corrected |
| BUG-008 | saketsuman33@gmail.com shown as Free plan despite Lifetime entitlement | High | ✅ FIXED | CRM plan field normalization: Lifetime recognized correctly |
| BUG-009 | Landing page not scrollable; landing→vault path broken | Medium | ✅ FIXED | Overflow CSS fixed; auth routing restored |
| BUG-010 | No signup form — /auth/signup showed vault unlock screen | Critical | ✅ FIXED | signup.tsx: Stage 1 account creation form (name + email + account password) |
| BUG-011 | Log In bypasses account auth — goes directly to master password | Critical | ✅ FIXED | login.tsx: Stage 1 only (email + account password), redirects to vault picker |
| BUG-012 | Signup does not capture account password — only master password | Critical | ✅ FIXED | Combined with BUG-010/011 full auth rework |
| BUG-013 | Landing page not mobile-friendly — touch targets below 44px | High | ✅ FIXED | Landing CSS: min-h-[44px] touch targets, responsive hero layout |
| BUG-014 | Two-stage auth missing — single master password with no account layer | Critical | ✅ FIXED | Full two-stage auth rework: account-auth.ts, auth-context.tsx, App.tsx three-tier routing, vault-picker.tsx, create-vault.tsx |
| BUG-015 | Vault picker cross-account leakage + dropdown UX broken | High | ✅ FIXED | Email-scoped vault registry in localStorage; per-account isolation |
| BUG-016 | Vault switcher dropdown hidden behind page content (z-index/overflow) | High | ✅ FIXED | Radix DropdownMenu with portal rendering; cloud vault unlock path fixed |
| BUG-017 | Landing page missing Log In CTA; login missing Forgot Password link | Medium | ✅ FIXED | Added CTA buttons to landing hero and footer |
| BUG-018 | Mobile header right-side icons hidden behind vault dropdown | High | ✅ FIXED | Combined with BUG-016 fix; flex layout corrected |
| BUG-019 | Hamburger/More menu not scrollable — Settings/Profile clipped | High | ✅ FIXED | overflow-y-auto on mobile sheet content |
| BUG-020 | App auto-navigates to Dashboard every ~1 minute + screen flickering | Critical | ✅ FIXED | Auto-lock grace period changed from 0 → 30 seconds; flicker removed |
| BUG-021 | Pricing inconsistency — multiple hardcoded plan lists with different prices | Medium | ✅ FIXED | Single pricing source of truth in shared config; INR prices aligned |
| BUG-022 | Free-tier user able to create multiple local vaults beyond limit | High | ✅ FIXED | plan-gate check on vault creation; UpgradeGate shown at vault limit |
| BUG-023 | Customer data persistence — family_invites and audit log tables missing | High | ✅ FIXED | shared/schema.ts: family_invites + plan_audit_log tables added; migrations applied |
| BUG-024 | Admin console missing vault count per customer | Medium | ✅ FIXED* | server-simple-working.ts: GET /api/customers/:id/vaults endpoint added. *Pending PR#1 merge for production deploy |
| BUG-025 | Entitlement email lookup returns "free" — UUID lookup required | High | ✅ FIXED* | server/routes.ts: email→userId resolution before entitlement query; top-level `plan` field in response. *Pending PR#1 merge for production deploy |
| BUG-026 | React hooks violation — pro-gated pages broken for ALL users | Critical | ✅ FIXED | UpgradeGate moved below all hooks; conditional return after all hook calls |
| BUG-027 | Entitlement API response shape mismatch — server plan not synced to client | High | ✅ FIXED | server/routes.ts: top-level `plan` field added; LicenseProvider reads it correctly |
| BUG-028 | Pro license reads as free after vault unlock | High | ✅ FIXED | LicenseProvider mounts after vault unlock + entitlement re-fetched on unlock |
| BUG-029 | Notes CRUD buttons invisible on mobile — opacity-0 with no touch override | High | ✅ FIXED | notes.tsx: `hover-none:opacity-100` media query; buttons always visible on touch |
| BUG-030 | Settings Clear Data uses window.confirm() — blocked in some browsers | Medium | ✅ FIXED | settings.tsx: React Dialog pattern replaces window.confirm() |
| BUG-031 | Notes delete uses window.confirm() — blocked in restricted contexts | Medium | ✅ FIXED | notes.tsx: React Dialog delete confirmation with data-testid |
| BUG-032 | Reminders delete uses window.confirm() — blocked in restricted contexts | Medium | ✅ FIXED | reminders.tsx: React Dialog delete confirmation with data-testid |

---

## Production Deploy Status

Two bug fixes are committed and verified in preview but **require PR#1 merge to main** before they go live on production domains:

| Bug | Fix | Production Impact |
|-----|-----|-------------------|
| BUG-024 | `GET /api/customers/:id/vaults` endpoint added to admin backend | `admin.ironvault.app` vault count endpoint still returns 404 until merge |
| BUG-025 | Email-based entitlement lookup + top-level `plan` field | `www.ironvault.app` email entitlement still returns "free" until merge |

UUID-based entitlement lookup (`/api/crm/entitlement/:uuid`) is working correctly in production as of 2026-04-09. These two items are the only remaining production-facing gaps.

---

## Automated Test Coverage

| Suite | Tests | Result | Runtime |
|-------|-------|--------|---------|
| full-sweep.spec.ts | 414 | ✅ PASS | 28 min |
| deep-verify.spec.ts | 40 | ✅ PASS | 3.5 min |
| **Combined** | **454** | **✅ PASS** | **31.3 min** |

All suites run against production `www.ironvault.app` with real credentials. No mocks. Consecutive passing runs confirmed on 2026-04-08 and 2026-04-09.

---

## UNTESTED Areas (Out of Scope)

The following areas were identified but not tested in this release cycle due to requiring external keys or platform access:

- Push/local notifications (requires APNs/FCM keys)
- Stripe/RevenueCat payment integration (requires payment keys)
- Account deletion path (UI present, backend not wired)
- Native app store icons and splash screens
- Touch target accessibility audit (≥ 44px)
- Performance profiling (< 3s load target)
- Android theme switcher parity (known cosmetic parity gap)

These are documented in `08_release_readiness.md` and should be addressed before public app store submission.
