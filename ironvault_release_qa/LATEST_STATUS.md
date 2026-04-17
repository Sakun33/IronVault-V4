# Latest status
**Updated:** 2026-04-16

## PRODUCTION DEPLOY — ironvault-main-daq2h3p4f ✅
- Deployment: `ironvault-main-daq2h3p4f-saket-sumans-projects-1f5ede07.vercel.app`
- Target: www.ironvault.app / ironvault.app
- Branch: claude/xenodochial-mendeleev
- Build: Vite ✓ 4842 modules

## APK
- Built: `android/app/build/outputs/apk/debug/app-debug.apk` ✅
- Install: `adb install -r <path>` — device not connected; install manually

## Bugs in this deploy

| Bug | Title | Status |
|-----|-------|--------|
| BUG-041 | CRUD persistence broken (prev session) | LIVE ✅ |
| BUG-042 | Android text overlapping (vh→svh) | LIVE ✅ |
| BUG-043 | Landing page too scrollable | LIVE ✅ |
| BUG-044 | Multi-vault switch security | LIVE ✅ |
| BUG-045 | Profile not opening on Android | LIVE ✅ (via BUG-046) |
| BUG-046 | Android safe areas / edge-to-edge | APK ✅ (needs device install) |

## Pending verification
- BUG-046/042/045: requires APK install on physical device
- BUG-044: verifiable immediately at www.ironvault.app with 2+ vaults
