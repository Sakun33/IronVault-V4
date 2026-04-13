# Checkpoint 025 — BUG-035 through BUG-040 fixed + deployed
**Date:** 2026-04-13
**Branch:** claude/xenodochial-mendeleev
**Commit:** 7c6cd70
**Deploy:** ironvault-main → www.ironvault.app (READY, aliased ironvault.app)

---

## What was done

### BUG-035: Cloud sync 60s pull poll (FIXED)
**Root cause:** `useCloudAutoSync` only pushed to cloud (3s debounce on `vault:item:saved`). 
No pull loop existed — Browser B never received changes from Browser A.

**Fix:**
- `client/src/lib/storage.ts`: added `replaceVaultFromBlob(encryptedBlob, masterPassword)` method
  (calls `clearEncryptedItems()` then `importVault()` — full replace, handles deletes correctly)
- `client/src/hooks/use-cloud-auto-sync.ts`: added 60s `setInterval` pull loop that:
  1. Calls `listCloudVaults()` to get `serverUpdatedAt`
  2. Compares with `localStorage.getItem('iv_last_pull_{vaultId}')`
  3. If server is newer: downloads full blob → `replaceVaultFromBlob()` → stores new timestamp
  4. Dispatches `vault:cloud:replaced` custom event
- `client/src/contexts/vault-context.tsx`: added listener for `vault:cloud:replaced` → calls `refreshData()`

### BUG-036: Import handler + test fixture (FIXED)
**Root cause:** Import handler code is correct; user's test JSON had wrong schema.
**Fix:**
- `ironvault_release_qa/test-import.json`: 136-item fixture (25 passwords + 15 subscriptions
  + 15 notes + 12 reminders + 30 expenses + 3 bank statements + 24 bank transactions
  + 8 investments + 4 investment goals) — exact schema match for programmatic testing

### BUG-037: Capacitor build verification (PARTIAL)
- Vite build: ✅ clean (warnings only, no errors)
- `npx cap sync android`: ✅ 10 plugins including `capacitor-native-biometric@4.2.2`
- `./gradlew assembleDebug`: ❌ blocked (no JVM on host) — requires physical dev machine
- `npx cap sync ios`: ❌ blocked (CocoaPods not installed) — env issue, not code

### BUG-038: Android version alignment (FIXED)
- `android/app/build.gradle`: `versionCode 40001 → 10000`, `versionName 4.0.0-beta.1 → 1.0.0`
- Added `signingConfigs.release` block reading `IRONVAULT_STORE_FILE/PASSWORD/KEY_ALIAS/KEY_PASSWORD`
  from `gradle.properties` (set before AAB release build)

### BUG-039: Family invite flow (FIXED — API + UI)
- `api/index.ts`: added `GET /api/crm/family-invites/invitee/:email` (pending invites for invitee)
  — inserted BEFORE owner GET to avoid path conflict
- `client/src/pages/profile.tsx`:
  - Added `Users`, `UserPlus`, `UserX` icon imports
  - Added state: `outgoingInvites`, `incomingInvites`, `inviteEmail`, `inviteLoading`, `invitesLoading`
  - Added `loadFamilyInvites()` useCallback + useEffect
  - Added `handleSendInvite()` / `handleUpdateInvite()` handlers
  - Added Family Sharing card in Subscription tab (send/revoke for pro+; accept/decline always visible)
- **Known limitation:** actual shared vault key exchange not implemented. After accept, owner must
  manually share vault master password with invitee. Future work: proper key exchange.

### BUG-040: Biometric integration plumbing (VERIFIED)
- `capacitor-native-biometric@4.2.2` present in package.json ✅
- `android/capacitor.settings.gradle` includes it ✅
- `android/app/capacitor.build.gradle` has `implementation project(':capacitor-native-biometric')` ✅
- `client/src/native/biometrics.ts` imports `NativeBiometric` ✅
- `cap sync android` detects it as active plugin ✅
- **Version note:** v4.2.2 was built for Capacitor 4/5; runtime compat with Capacitor 7 unverified.
  If biometric fails on physical device: upgrade to `capacitor-native-biometric@5+` or switch to
  `@aparajita/capacitor-biometric-auth`

---

## Deploy Result
- **URL:** https://ironvault-main-d22k0mst8-saket-sumans-projects-1f5ede07.vercel.app
- **Aliased:** https://www.ironvault.app
- **Target:** production
- **Status:** READY
- **Commit:** 7c6cd70
- **Build:** Vite ✓ 4841 modules, 17.43s

---

## Files Changed
```
client/src/lib/storage.ts          — replaceVaultFromBlob()
client/src/hooks/use-cloud-auto-sync.ts — 60s pull poll
client/src/contexts/vault-context.tsx  — vault:cloud:replaced listener
client/src/pages/profile.tsx        — Family Sharing card + handlers
android/app/build.gradle           — version 1.0.0 / 10000 + signingConfig
api/index.ts                       — GET /invitee/:email endpoint
ironvault_release_qa/05_bug_register.csv — BUG-035..040 added
ironvault_release_qa/test-import.json   — 136-item fixture (new file)
```

---

## Remaining Open Items
| Item | Status |
|------|--------|
| `./gradlew assembleDebug` | Blocked — no JVM on host |
| `npx cap sync ios` | Blocked — CocoaPods not installed |
| Biometric runtime test | Requires physical iOS/Android device |
| Vault key sharing (family) | Future work — manual password share for now |
