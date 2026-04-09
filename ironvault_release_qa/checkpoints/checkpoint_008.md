# Checkpoint 008 — BUG-015: Cross-Account Vault Leakage + Dropdown UX Fix

**Date:** 2026-04-07
**Branch:** claude/fervent-mclaren
**Status:** COMPLETE

## Summary

Investigated, implemented, and tested the fix for BUG-015, which had two components:
1. **Cross-account vault leakage** — vault registry stored in a global localStorage key (`ironvault_registry`) shared across all accounts; logging into Account B would show Account A's vaults.
2. **Vault selector dropdown broken** — `activeVault` was null because the global `ironvault_active_vault` key still pointed to Account A's vault ID when Account B was logged in. `VaultSelector` returns null when `activeVault` is null.

## Changes Made

### `client/src/lib/vault-manager.ts`
- Renamed unscoped constants to `VAULT_REGISTRY_KEY` / `ACTIVE_VAULT_KEY` / `VAULT_PASSWORDS_GLOBAL_KEY` (legacy fallback)
- Added `_accountEmail: string | null` instance variable
- Added `emailSuffix(email)` static helper: lower-cased, only `[a-z0-9._@-]` allowed
- Added dynamic getter properties `registryKey`, `activeVaultKey`, `vaultPasswordsKey` — return email-scoped key when `_accountEmail` is set, legacy key otherwise
- `setAccountEmail(email)`: sets `_accountEmail`, performs one-time migration of legacy unscoped registry to scoped key on first login, resets in-memory `activeVaultId`
- `clearAccountEmail()`: clears `_accountEmail` and `activeVaultId` on logout
- `getActiveVaultId()`: validates stored vault ID exists in current scoped registry; discards stale pointer if not found

### `client/src/contexts/auth-context.tsx`
- `initializeAuth()`: calls `vaultManager.setAccountEmail(email)` when restoring saved account session
- `accountLogin()`: calls `vaultManager.setAccountEmail(normalizedEmail)` after successful login
- `accountLogout()`: calls `vaultManager.clearAccountEmail()` and `vaultManager.clearInternalState()`

### `client/src/contexts/vault-selection-context.tsx`
- Added `useAuth()` import to read `accountEmail`
- `loadVaults` effect now depends on `accountEmail` — causes vault list to reload when account switches, fixing the dropdown showing null/stale data

### `client/src/pages/vault-picker.tsx`
- Cloud vault loading effect now depends on `accountEmail` — re-runs when email becomes available after `initializeAuth` resolves

### `tests/e2e/full-sweep.spec.ts`
- **`unlockVault` helper** (line ~136): `hasVault` check updated to check both the email-scoped key (`ironvault_registry_<suffix>`) and the legacy unscoped key for backward compat. This fixes a regression where `hasVault` always returned false (new scoped key not checked), causing `createVaultFull` to be called on every `unlockVault`, creating a fresh empty vault and breaking tests 3.5 and 14.12.
- **Test 17.3**: Changed from destructive registry overwrite to non-destructive append + save/restore pattern, so subsequent tests (17.4) retain the correct Account A vault registry.
- **Section 17** (5 new tests × 2 projects = 10 runs):
  - 17.1: fresh account (0 vaults) → empty state shown, no unlock buttons
  - 17.2: account with 1 synthetic vault → exactly 1 card, 1 unlock button
  - 17.3: cross-account isolation — SECRET VAULT ACCOUNT A not visible to Account B
  - 17.4: vault selector dropdown only lists current-account vaults
  - 17.5: logout Account A → login Account B → 0 unlock buttons (A's vaults not shown)

## Issues Encountered

| Issue | Fix |
|---|---|
| `unlockVault` helper checked `ironvault_registry` (unscoped) but vault data now in `ironvault_registry_<email>` | Updated `hasVault` check to try scoped key first, then fall back to unscoped |
| Test 17.3 overwrote Account A's registry with a fake vault, leaving 17.4's `unlockVault` with wrong vault | Changed 17.3 to save/restore Account A's registry around the fake injection |
| Tests 3.5 and 14.12 failed: vault appeared empty because `unlockVault` was creating a new vault on each call | Root cause was the broken `hasVault` check above |
| Section 17 tests were all skipped (serial block) because 3.5 failure propagated | Resolved by fixing 3.5 root cause |

## E2E Test Results

| Suite | Tests | Status |
|---|---|---|
| Prior suite (sections 1–16) | 188 tests | PASS — no regression |
| Section 17 (vault scoping) | 10 tests (5 × 2 projects) | PASS |
| **Total** | **198 tests** | **PASS** |

## Deployment

- Branch: `claude/fervent-mclaren`
- Target: `www.ironvault.app` (fervent-mclaren Vercel project)
