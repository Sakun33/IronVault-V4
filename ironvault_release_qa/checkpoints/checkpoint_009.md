# Checkpoint 009 — BUG-016 (dropdown z-index) + Cloud Vault thorough testing

**Date:** 2026-04-07
**Branch:** claude/fervent-mclaren
**Status:** COMPLETE

## BUG-016 — Vault Switcher Dropdown Z-Index Fix

### Root causes
1. **Mobile header** had `overflow-hidden` — clipped any `absolute`-positioned child, including the vault switcher dropdown
2. **Desktop**: The `sticky` + `backdrop-blur-xl` header creates a new stacking context. The `absolute` dropdown at z-50 was confined to that stacking context; cards with CSS `transform` (hover animations) could render above it. Also: the root container `overflow-hidden` could clip overflow content.

### Fix (`client/src/App.tsx`)
- Added `createPortal` from `react-dom`
- Added `useRef` for mobile (`mobileVaultBtnRef`) and desktop (`desktopVaultBtnRef`) vault-switcher trigger buttons
- Added `vaultDropdownPos` state for computed position
- `toggleVaultSwitcher(btnRef)` — computes `getBoundingClientRect()` of the trigger, stores `{top, left}`, sets `showVaultSwitcher = true`
- `closeVaultSwitcher()` — resets both states
- Removed `overflow-hidden` from mobile header (`lg:hidden fixed top-0...`)
- Both trigger buttons (mobile chip, desktop outline) now use refs and `toggleVaultSwitcher()`
- Single shared portal rendered to `document.body` at `z-index: 9999` — completely escapes all stacking contexts and overflow containers

## Cloud Vault Thorough Testing

### Defect found: `handleCloudUnlock` broken on second device

**Root cause**: When unlocking a cloud vault that doesn't exist locally (second device scenario):
1. `vaultStorage.switchToVault(id)` — creates empty IndexedDB
2. `vaultStorage.importVault(blob, pw)` — tries to save items, but `this.encryptionKey` is null (vault not initialized) → silent failure
3. `login(pw)` — fails because vault has no encryption metadata → "Incorrect master password"

**Same device**: Calling `importVault` when vault already exists locally re-imports all items → **duplicates** every password/note/etc.

### Fix (`client/src/pages/vault-picker.tsx`)
- `handleCloudUnlock` now checks `existing`:
  - **New device** (`!existing`): add to registry → `createVault(pw)` (initialises encryption) → `importVault(blob, pw)` (restores items) → `login(pw)`
  - **Same device** (`existing`): just switch + `login(pw)`, skip import (avoids duplicates)

### E2E Section 18 (6 tests × 2 projects = 12 new runs)

| Test | What it covers |
|---|---|
| 18.1 | Sync dialog opens from vault kebab menu (UI) |
| 18.2 | Sync to cloud succeeds — dialog, password, success toast |
| 18.3 | Cloud section visible in picker after sync |
| 18.4 | Cloud vault unlock from picker → Dashboard (same-device flow) |
| 18.5 | Free plan shows "Cloud Sync — Pro feature" upgrade prompt |
| 18.6 | Cleanup: delete synced cloud vaults via API |

## E2E Results

| Suite | Tests | Status |
|---|---|---|
| Sections 1–17 (prior) | 198 tests | PASS — no regression |
| Section 18 (cloud UI) | 12 tests (6×2) | PASS |
| **Total** | **210 tests** | **PASS** |

## Issues Found and Fixed

| Issue | Fix |
|---|---|
| Mobile header `overflow-hidden` clips vault dropdown | Removed `overflow-hidden` from mobile header |
| Desktop sticky header stacking context traps dropdown | Portal to `document.body` at z-9999 |
| Test 18.3 had stray `document.body` reference in Node context | Wrapped in `page.evaluate()` |
| Cloud unlock: duplicate items on same device | Skip `importVault` when vault exists locally |
| Cloud unlock: fails silently on new device (no `createVault` before `importVault`) | Call `vaultStorage.createVault(pw)` for new vaults before importing items |

## Deployment

- Branch: `claude/fervent-mclaren`
- Target: `https://www.ironvault.app` (fervent-mclaren Vercel project)
- Commits: `c6082c9` (BUG-016 fix + cloud fix + section 18 tests), `b521148` (test 18.3 fix)
