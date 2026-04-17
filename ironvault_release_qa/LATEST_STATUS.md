# Latest status
**Updated:** 2026-04-17

## PRODUCTION DEPLOY — ironvault-main-bwkx8nfth ✅
- Deployment: `ironvault-main-bwkx8nfth-saket-sumans-projects-1f5ede07.vercel.app`
- Target: www.ironvault.app / ironvault.app
- Branch: claude/xenodochial-mendeleev (merged → main)
- Build: Vite ✓ — bundle `index-6971de40.js`

## APK
- Built: `android/app/build/outputs/apk/debug/app-debug.apk` ✅
- Rebuilt: 2026-04-17 with @aparajita/capacitor-biometric-auth@9.1.2
- Install: `adb install -r <path>` — device not connected; install manually

## Latest session — three bugs fixed

| Bug | Title | Status |
|-----|-------|--------|
| BUG-055 | Vault picker deduplication + Synced badge | LIVE ✅ |
| BUG-056 | Cloud vault CRUD race (isBulkImporting + lastPull) | LIVE ✅ |
| BUG-057 | Landing page single-viewport; remove duplicate Log In | LIVE ✅ |

## Previous bugs (still live)

| Bug | Title | Status |
|-----|-------|--------|
| BUG-052 | Family vault cryptographic key exchange | BUILT ✅ (device test pending) |
| BUG-053 | Argon2id → PBKDF2-SHA256 copy fix | LIVE ✅ |
| BUG-054 | Biometric plugin Capacitor 7 upgrade | APK ✅ (device install pending) |
| BUG-047 | No delete confirmation for passwords | LIVE ✅ |
| BUG-048 | /goals missing labelled Add Goal button | LIVE ✅ |
| BUG-049 | License-context mount race (Encryption key not set) | LIVE ✅ |
| BUG-050 | Stored XSS in ticket description API | LIVE ✅ |
| BUG-051 | CORS allow-origin: * | LIVE ✅ |
| BUG-041 | CRUD persistence broken (prev session) | LIVE ✅ |
| BUG-042 | Android text overlapping (vh→svh) | LIVE ✅ |
| BUG-043 | Landing page too scrollable | LIVE ✅ |
| BUG-044 | Multi-vault switch security | LIVE ✅ |
| BUG-045 | Profile not opening on Android | APK ✅ (needs device install) |
| BUG-046 | Android safe areas / edge-to-edge | APK ✅ (needs device install) |

## Open items (not blocking release)

| Item | Notes |
|------|-------|
| Android APK install (BUG-052/054/045/046/042) | Requires physical device |
| Family vault sharing e2e test | Needs two accounts on device |
| iOS PWA | Roadmap: late 2026 |

## Release verdict
**✅ READY FOR PUBLIC PROMOTION** — All blocking bugs fixed and deployed.

## QA Artifacts
- `COMPREHENSIVE_QA_INVENTORY.md` — all routes, endpoints, components, plans
- `COMPREHENSIVE_TEST_RESULTS.md` — phase-by-phase test outcomes
- `COMPREHENSIVE_BUG_REPORT.md` — BUG-047..051 with root causes + fix guidance
- `RELEASE_READINESS_FINAL.md` — original verdict + blocker list
- `05_bug_register.csv` — full bug registry BUG-041..057
