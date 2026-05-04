# Changelog

All notable changes to IronVault are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
