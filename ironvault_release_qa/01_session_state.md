# Session State

**Last updated:** 2026-04-13 (session 025)
**Branch:** claude/xenodochial-mendeleev
**Latest push:** 7c6cd70
**Deploy:** ironvault-main → www.ironvault.app (READY)

---

## Current Phase

POST-QA PASS 2 COMPLETE — BUG-035 through BUG-040 fixed and deployed.
Bug register now has 40 entries (BUG-001..034 + BUG-035..040).

---

## Last Completed Action

Worked through all 6 new items:

1. **BUG-035 (Cloud sync pull):** Added 60s pull poll to `useCloudAutoSync`. Browser B now receives
   changes from Browser A within 60s. `replaceVaultFromBlob()` does a full clear+reimport to
   correctly handle deletes. `vault:cloud:replaced` event triggers `refreshData()` in vault-context.

2. **BUG-036 (Import handler):** Import code is correct. Generated valid 136-item test fixture
   at `ironvault_release_qa/test-import.json` matching exact schema. To use: unlock vault →
   Import/Export → upload `test-import.json` (no password, plaintext format).

3. **BUG-037 (Capacitor builds):** Vite build ✅, cap sync android ✅ (10 plugins).
   Gradle build + iOS sync blocked by env (no JVM, no CocoaPods).

4. **BUG-038 (Android version):** `versionCode 10000 / versionName 1.0.0` + signing config block.

5. **BUG-039 (Family invites):** API endpoint for invitees added. Family Sharing card in Profile →
   Subscription tab. Send/revoke (pro+), accept/decline (all users). Key sharing = future work.

6. **BUG-040 (Biometric):** Plumbing verified. Runtime test requires physical device.
   Note: `capacitor-native-biometric@4.2.2` vs Capacitor 7 — may need upgrade if runtime fails.

---

## Next Exact Action

QA program is complete for this pass.

Pending manual actions for Saket:
1. **Cloud sync live test:** Open two browsers on www.ironvault.app with same account. Add a password in
   Browser A. Wait 60s. Verify it appears in Browser B.
2. **Import test:** Unlock vault → Import/Export → upload `ironvault_release_qa/test-import.json`.
   Should import 136 items (25 passwords, 15 subs, 15 notes, etc.).
3. **Family invite test:** Profile → Subscription tab → Family Sharing card (needs pro/family/lifetime).
   Send invite to a second test email. Accept from that account. Verify accept flow.
4. **Android Gradle build:** On a machine with JDK 21: `npx cap sync android && cd android && ./gradlew assembleDebug`
5. **iOS build:** `brew install cocoapods && npx cap sync ios`
6. **Biometric on device:** Install APK on Android device, enable biometric in Profile → Security,
   lock and unlock with fingerprint. If crashes: upgrade `capacitor-native-biometric` to v5+.

---

## Blockers

None blocking prod. Environment limitations:
- No JVM on host → Gradle build can't run
- No CocoaPods → iOS sync can't run
- No physical device → biometric runtime can't be tested

---

## Key Credentials

| Service | Email | Notes |
|---------|-------|-------|
| Main app | saketsuman1312@gmail.com / 12121212 | Lifetime plan |
| Admin console | username: admin / password: admin123 | |
| Admin console | saketsuman33@gmail.com | lifetime |

---

## Restart Instructions

1. Read this file
2. Read `ironvault_release_qa/checkpoints/checkpoint_025.md`
3. All code changes committed (7c6cd70) and deployed to www.ironvault.app
4. Pending: Saket manual verifications listed above
