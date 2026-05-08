# Changelog

All notable changes to IronVault are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.2.0] — 2026-05-08

### Added
- **Google Sign-In** — OAuth 2.0 across web, iOS, and Android via `@capgo/capacitor-social-login`. Plugin initialised at app boot; native plumbing (URL scheme, `GoogleService-Info.plist`, reversed-client ID) wired for iOS; Google Cloud project `citric-bee-495700-v6`.
- **Biometric vault unlock** — Face ID, Touch ID, and Android fingerprint via `@aparajita/capacitor-biometric-auth` + `capacitor-native-biometric`. Unified into a single gesture + credential bundle so enrollment, Stage-1 login bypass, and cloud-vault unlock all share one path.
- **Biometric Stage-1 login bypass** — re-unlock the app account directly via Face ID / fingerprint without retyping the account password.
- **Centralized plan service** (`planService`) — single source of truth for subscription tier, feature gating, and import limits. Eliminates the "Lifetime → Free" demotion mid token-refresh and the "Local only" pill flicker.
- **Anti-wipe cloud sync guard** — every cloud push uploads the full vault blob, preventing partial-state pushes that previously caused data loss on cross-device sign-in.
- **Font size / accessibility settings** — user-configurable text scaling for the app shell and content surfaces.
- **Investment view/edit** — read and edit FDs, mutual funds, stocks, and crypto with **dynamic currency rendering** that respects each entry's currency.
- **`apiBase()` helper** — Capacitor native builds now hit absolute API URLs (`https://www.ironvault.app/api/...`); web continues with relative URLs. Fixes "fetch failed" on iOS and Android.
- **Note templates** — pre-built note structures with template dropdown on the New Note button.
- **Test data seed hooks** — `__importTestData` re-unlocks via master password; bypass-UI seed script for direct IndexedDB injection in Playwright.
- **Comprehensive Playwright E2E suite** — 12 spec files covering all flows; auto-lock disabled and unlock timeouts extended for stability.

### Changed
- **Notes — manual save** — autosave removed in favour of explicit save. The editor is decoupled from notes-array changes, popstate-based close was removed, and the editor no longer closes mid-typing on iOS. Service Worker bumped through v3.9.3 → v3.9.5 to ship the fixes.
- **Mobile header layout** — tightened gap, fixed safe-area on iPhone Pro Max, fixed alignment and overflow on small screens.
- **Cloud sync rewrite** — push queue with retry, always-visible status indicator, no blocking gates. Vault-context no longer holds its own silent gate.
- **Capacitor native API calls** — every fetch in the client tree migrated from relative paths to `apiBase()` so iOS/Android builds resolve to the production API.
- **Content Security Policy** — extended to allow `accounts.google.com`, `apis.google.com`, and Google Identity Services (GIS) frames for Google Sign-In.
- **iOS build pipeline** — `Podfile` workflow updated for Ruby 4.0.2 toolchain; `AppCheckCore` pod reinstall step documented for clean iOS builds.
- **Premium landing page** — refreshed marketing surface with app mockups, consistent dark theme, and mobile fixes.

### Fixed
- **P0 — Cloud sign-in incomplete on cross-user mobile login** — token now persists correctly when switching accounts.
- **P0 — Android vault picker freeze** while loading cloud vaults.
- **P0 — Cloud sync data loss** caused by partial push payloads.
- **P0 — Cloud login on new devices** — `clearCloudToken` was wiping the token it had just stored.
- **P0 — Vault fetch error on new devices** — graceful fallback added.
- **P0 — JWT TDZ** caused entitlement 401s with valid Bearer token (`JWT_SECRET` declared at the top of the handler).
- **P0 — Stale-token rejection** — removed `verifyTokenNotStale` that rejected fresh tokens; resolved `iat` vs `password_changed_at` clock-skew that produced the same 401.
- **P0 — `Local only` pill flicker** for Lifetime users mid token-refresh (now driven by `planService`).
- **P0 — Notes editor close** mid-typing and unmount during background sync (`note-editing-guard`).
- **P0 — 2FA enable** flow regression.
- **iOS Google Sign-In hang** — verbose native logging surfaces real errors; client + URL scheme wired correctly.
- **iOS QA pass** — editor placeholder, sheet close, header overflows; biometric stripped from initial login screen; note tap border cleaned; iOS keyboard zoom suppressed; screenshot privacy on lock.
- **Android crash** during plan-tier sync.
- **14 QA bugs** from comprehensive iOS testing — globe link, currency display, filter chips, modal stacking, navigation focus, greeting name, blank space, entitlement `crmUserId` sync.
- **10 mobile issues** — keyboard handling, biometric prompt, app menu, toast stacking, plan limits, swipe gestures, Razorpay flow.
- **Lighthouse failures** — accessibility, performance, contrast, and source-map issues; mobile Performance moved from **57 → 75+**.
- **Note templates / expense groups / API keys redesign / reminders / light theme** — accumulated fixes across these surfaces.
- **Timing-safe verification code compare** + larger mobile touch targets.
- **401 interceptor** — robust grace period and token presence check; fixes "login broken" regression.

### Removed
- **Note editor autosave** — replaced with explicit manual save.
- **Popstate-based editor close** — caused "editor closes mid-typing" on iOS.
- **Stale `app.e2e` / `admin.e2e` specs** that blocked the test suite.

### Native Apps
- iOS and Android builds now first-class via Capacitor 7. Pod install pipeline fixed for Ruby 4.0.2.
- iOS: `GoogleService-Info.plist` added; URL scheme registered for Google Sign-In; `AppCheckCore` reinstall workaround for clean builds.
- Android: APK builds via `./gradlew assembleDebug`; Java home pinned to Android Studio JBR; `GRADLE_OPTS=-Xmx4g` recommended.

---

## [4.1.0] — 2026-05-04

### Security
- Migrated account-password hashing from SHA-256 to **scrypt** with automatic legacy migration on next sign-in.
- Removed tokenless password-reset vulnerability that enabled account takeover.
- Payment verification now validates the Razorpay signature against the **stored order** to prevent client-side plan tampering.
- `JWT_SECRET` no longer has an insecure fallback — the API refuses to boot without it.
- XSS prevention with **DOMPurify** on every rich-text surface (notes, tickets, admin replies).
- All API-key, token, and OTP comparisons use **timing-safe comparison**.
- **TOTP secrets** are encrypted at rest; backup codes hashed with scrypt instead of single-pass HMAC.
- Rate limiting added to auth, password-reset, 2FA, and import endpoints.
- HSTS, CSP, X-Frame-Options, Referrer-Policy and a hardened security-header set.
- Admin API key separated from the main JWT secret.
- Sessions invalidated on password change and on account deletion.
- User-enumeration oracle closed — login and reset flows return generic error messages.

### Added
- **TOTP-based 2FA** with QR-code setup, encrypted secret storage, and scrypt-hashed backup codes.
- **First-party favicon proxy** (`/api/favicon`) — resolves Google `s2/favicons` blockages by ad-blockers.
- **Account deletion** endpoint (`DELETE /api/auth/account`) that cleans vault, sessions, 2FA, and subscriptions.
- **Razorpay webhook handler** for the full subscription lifecycle (created / activated / charged / cancelled / expired).
- **Subscription expiry enforcement** — feature gating respects active billing state.
- **Loading skeletons** on every data page; **React error boundaries** at section level.
- **`React.lazy` code splitting** — initial JS bundle reduced from **2.25 MB → 1.08 MB** (52%).
- **Mass delete** across passwords, banking, expenses, subscriptions, notes, documents.
- **Document folder persistence** to IndexedDB (folders survive reload).
- **Vault registry orphan cleanup** — stale registry rows are pruned on logout/login.

### Fixed
- Cloud-vault data loss on logout / login cycle.
- Vault-isolation breach when switching between cloud-synced vaults.
- "6 of 5 vaults" off-by-one count display bug.
- CSV export producing blank files (wrong field name lookup).
- Documents page OCR initialization error on first load.
- Favicon loading failures behind common ad-blockers.
- Master-password change now runs sequentially against all entries — no race condition that previously left some entries undecryptable.
- Admin console — customer creation, plan changes, and ticket flows now functional.
- 120+ additional security and functional fixes from a comprehensive multi-agent QA audit.

### Changed
- Admin console CORS restricted to `admin.ironvault.app`.
- Zoho Billing webhook now handles cancellation and expiration events.
- Chrome extension security hardened — strict origin / subdomain matching, incognito split, narrower activity log.
- Backup codes use scrypt instead of a single HMAC pass.
- Removed dead `server/` code and legacy migration files.

---

## [4.0.0] — Prior releases

Earlier releases predate this changelog. See `git log` for the full history.
