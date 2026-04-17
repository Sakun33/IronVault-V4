# Checkpoint 026 — BUG-041 through BUG-046 fixed + deployed
**Date:** 2026-04-16
**Branch:** claude/xenodochial-mendeleev
**Deploy:** ironvault-main → ironvault-main-daq2h3p4f → www.ironvault.app (READY)
**APK:** android/app/build/outputs/apk/debug/app-debug.apk — rebuilt, awaiting device install

---

## What was done

### BUG-041: CRUD persistence broken (FIXED — deployed in previous session)
**Root causes (3):**
1. `encryptAndStore('persistent_data')` dispatched `vault:item:saved` → infinite 3s push loop via `exportVault`
2. `doPull()` fired on every navigation (MainLayout remounts in inline arrow Route components) and overwrote optimistic state during the 3s push debounce window
3. `deleteBankStatement/deleteBankTransaction/deleteInvestment/deleteInvestmentGoal` called `store.delete(id)` on wrong empty named stores (not `encrypted_data`)

**Fix:** `storage.ts` skip dispatch for `persistent_data`; fix delete to target `encrypted_data`. `use-cloud-auto-sync.ts` `pushPendingRef` guard at 3 async points; `lastPull` updated after push. `App.tsx` `lastPull` updated after heal push.

---

### BUG-046: Android safe areas / edge-to-edge (FIXED)
**Root cause:** `WindowCompat.setDecorFitsSystemWindows()` not called → system bars not transparent → WebView doesn't extend behind system bars → `env(safe-area-inset-*)` returns 0

**Fix:**
- `android/app/src/main/java/com/ironvault/app/MainActivity.java`: added `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)` + import
- `android/app/src/main/res/values/styles.xml` `AppTheme.NoActionBar`: added:
  - `android:statusBarColor=@android:color/transparent`
  - `android:navigationBarColor=@android:color/transparent`
  - `android:windowDrawsSystemBarBackgrounds=true`
  - `android:windowLayoutInDisplayCutoutMode=shortEdges`

---

### BUG-042: Android text overlapping in dialogs (FIXED)
**Root cause:** `max-h-[Nvh]` Tailwind classes use regular viewport height (includes system bars) → dialogs overflow

**Fix:** `sed` bulk-replaced all `max-h-[Nvh]` → `max-h-[Nsvh]` across all 14 affected TSX files (20+ occurrences). Also fixed `max-height: 90vh` → `90svh` in `mobile-fixes.css`.

**Files changed:** expenses.tsx, document-viewer.tsx, reminders.tsx, security-settings-modal.tsx, goals.tsx, add-investment-modal.tsx, notes.tsx, subscriptions.tsx, passwords.tsx, subscription-analytics.tsx, add-subscription-modal.tsx, pricing-upgrade.tsx, customer-info-dialog.tsx, import-export-modal.tsx, mobile-fixes.css

---

### BUG-044: Multi-vault switch security (FIXED)
**Root cause:** `vault-selection-context.tsx` `switchVault()` only called `vaultManager.setActiveVaultId()` — no master password verification for the target vault

**Fix:**
- `vault-selection-context.tsx`: added `requestVaultSwitch(vaultId)` function + password dialog rendered inside `VaultSelectionProvider` return
  - Dialog shows target vault name + password field + show/hide toggle + error state
  - On confirm: `vaultManager.setActiveVaultId(pendingSwitchId)` then `auth.login(password)`
  - On failure: reverts active vault ID + shows error
- **4 call sites updated** to use `requestVaultSwitch` instead of `switchVault`:
  - `components/vault-selector.tsx`
  - `App.tsx` mobile header dropdown
  - `App.tsx` desktop header dropdown
  - `components/vault-manager-ui.tsx` `handleOpenVault`

---

### BUG-045: Profile section not opening on Android (FIXED)
**Root cause:** Symptom of BUG-046. Android nav bar covered bottom tabs (no edge-to-edge → `env(safe-area-inset-bottom)=0` → `BottomTabs` had zero bottom padding → "More" button in tappable dead zone behind nav bar). MoreSheet content also had insufficient bottom clearance.

**Fix:** Resolved entirely by BUG-046. After edge-to-edge is enabled, `env(safe-area-inset-bottom)` returns the actual nav bar height, and `BottomTabs pb-[env(safe-area-inset-bottom)]` + `MoreSheet pb-[calc(16px+env(safe-area-inset-bottom))]` work correctly.

---

### BUG-043: Landing page too scrollable (FIXED)
**Root cause:** `LandingPage` rendered full `FeaturesSection` + `SecuritySection` + `PricingSection` + `FAQSection` inline (5+ viewport heights). Nav links used `#anchor` scroll instead of routing to subpages.

**Fix:**
- `landing.tsx` `LandingNav`: links updated from `#features/#pricing/#security/#faq` to `/features`/`/pricing`/`/security`/`/faq` routes (using `<Link>` instead of `scrollTo` button). Download link kept as `#download` anchor.
- `HeroSection`: `min-h-[90vh]` → `min-h-[100dvh]` (fills exactly one viewport)
- `LandingPage`: removed `<FeaturesSection />`, `<SecuritySection />`, `<PricingSection />`, `<FAQSection />` from render
- Added compact `QuickLinksGrid` (6 icon cards → `/features` and `/security` links + "See all features" link)
- **New file:** `client/src/pages/info/faq.tsx` — standalone FAQ page with Accordion
- **New route:** `/faq` → `FAQPage` registered in `App.tsx`

---

## Deploy Result
- **URL:** https://ironvault-main-daq2h3p4f-saket-sumans-projects-1f5ede07.vercel.app
- **Target:** production (ironvault-main project)
- **Status:** READY
- **Build:** Vite ✓ 4842 modules, 6.29s (no errors, pre-existing chunk warnings only)

## APK
- **Path:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Build:** `./gradlew assembleDebug` — BUILD SUCCESSFUL in 4s
- **Install:** `adb install -r <path>` — device not connected at time of build; install manually

---

## Files Changed
```
android/app/src/main/java/com/ironvault/app/MainActivity.java  — edge-to-edge WindowCompat
android/app/src/main/res/values/styles.xml                      — transparent system bars + cutout
client/src/styles/mobile-fixes.css                              — max-height 90svh
client/src/**/*.tsx (14 files)                                  — max-h-[Nvh] → max-h-[Nsvh]
client/src/contexts/vault-selection-context.tsx                 — requestVaultSwitch + password dialog
client/src/components/vault-selector.tsx                        — requestVaultSwitch call site
client/src/components/vault-manager-ui.tsx                      — requestVaultSwitch call site
client/src/App.tsx                                              — requestVaultSwitch (2 dropdowns) + /faq route + FAQPage import
client/src/pages/landing.tsx                                    — nav links → routes; HeroSection 100dvh; remove long sections; QuickLinksGrid
client/src/pages/info/faq.tsx                                   — new FAQ page (NEW FILE)
ironvault_release_qa/05_bug_register.csv                        — BUG-041..046 appended
```

---

## Device Install (manual step)
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Remaining Open Items
| Item | Status |
|------|--------|
| Device install + BUG-046 edge-to-edge verification | Awaiting USB/WiFi ADB connection |
| BUG-042 dialog overflow verification on device | Awaiting device install |
| BUG-044 vault switch password dialog end-to-end | Verifiable on www.ironvault.app immediately |
| BUG-045 Profile navigation on device | Awaiting device install |
| CRUD persistence retest | Pass on web; device install will confirm no regression |
