# IronVault — Project Context

## What is IronVault?
IronVault is a zero-knowledge encrypted vault app for passwords, finances, notes, and documents. Live at https://www.ironvault.app. Admin console at https://admin.ironvault.app.

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Motion (Framer Motion)
- **Backend:** Express.js serverless API on Vercel (`api/index.ts` — single file, ~3000 lines)
- **Database:** Neon PostgreSQL (cloud)
- **Mobile:** Capacitor 7 (iOS + Android)
- **Chrome Extension:** Manifest V3 with autofill
- **Admin Console:** Separate Vite + React app in `admin-console/`

## Architecture
- **Zero-knowledge encryption:** AES-256-GCM with PBKDF2 key derivation (600k iterations)
- **Two-stage auth:** Stage 1 = email + account password (JWT), Stage 2 = vault master password (client-side decrypt)
- **Storage:** IndexedDB per-vault isolation (`IronVault_{vaultId}`)
- **Cloud sync:** Encrypted blob push/pull with conflict resolution via timestamps
- **Auth:** Custom JWT (HS256), scrypt password hashing, TOTP 2FA

## Key Files
- `api/index.ts` — ALL API endpoints (auth, vault, payments, tickets, CRM, 2FA, webhooks)
- `client/src/App.tsx` — main app shell, routing, sidebar, contexts
- `client/src/contexts/auth-context.tsx` — authentication state, login/logout, 2FA
- `client/src/contexts/vault-context.tsx` — vault CRUD, data management, cloud push
- `client/src/lib/storage.ts` — IndexedDB wrapper for all vault data stores
- `client/src/lib/cloud-vault-sync.ts` — cloud push/pull functions
- `client/src/lib/cloud-sync-queue.ts` — push queue with exponential retry
- `client/src/lib/crypto-service.ts` — AES-256-GCM encryption/decryption
- `client/src/lib/note-editing-guard.ts` — prevents sync during note editing
- `client/src/lib/auth-fetch-interceptor.ts` — global 401 handler with grace period
- `client/src/pages/` — all page components (dashboard, passwords, notes, expenses, etc.)
- `client/src/components/` — shared UI components
- `admin-console/api/index.ts` — admin backend
- `chrome-extension/` — browser extension (Manifest V3)
- `shared/schema.ts` — Zod schemas for all data types

## Sections in the App
1. **Dashboard** — stats, security ring, quick actions, recent activity
2. **Passwords** — CRUD, import (15+ sources), strength meter, favicons via `/api/favicon` proxy, grid/list view
3. **Notes** — Evernote-style with rich editor, notebooks, tags, templates, 2-panel desktop layout
4. **Documents** — upload, view, folders, OCR (Tesseract.js)
5. **Subscriptions** — billing tracking, reminders, grid/list view
6. **Expenses** — Splitwise-style with groups, splits, settlements, balance tracking
7. **Reminders** — with device notifications (Web Notifications API + Capacitor LocalNotifications)
8. **API Keys** — premium card design, masked keys, master-password-gated reveal
9. **Investments** — FDs, mutual funds, stocks, crypto tracking
10. **Bank Statements** — CSV import, transaction categorization
11. **Profile** — 6 tabs (Overview, Data, Security, Vaults, Subscription, Support)

## Integrations
- **Razorpay** — payment processing (test key: rzp_test_ShNBlCGGEA5aHX)
- **Zoho Mail** — SMTP for transactional emails (noreply@ironvault.app)
- **Zoho Desk** — support ticket system
- **Zoho CRM** — customer contact sync
- **Zoho Billing** — subscription webhook handler
- **n8n** — automation workflows (3 active webhook triggers)

## Environment Variables (Vercel)
- `DATABASE_URL` — Neon PostgreSQL
- `JWT_SECRET` — signs all auth tokens (REQUIRED, no fallback)
- `ADMIN_API_KEY` — admin endpoint auth
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` — payments
- `ZOHO_MAIL_PASSWORD` — SMTP auth
- `ZOHO_DESK_*` — Desk OAuth (client ID, secret, refresh token, org ID)
- `ZOHO_CRM_REFRESH_TOKEN` — CRM OAuth
- `ZOHO_BILLING_WEBHOOK_SECRET` — billing webhook auth
- `N8N_API_KEY` — n8n callback auth
- `CRM_NOTIFY_SECRET` — admin→app notification auth
- `RAZORPAY_WEBHOOK_SECRET` — payment webhook HMAC

## Test Credentials
- Pro User: saketsuman1312@gmail.com / Account Password: 12121212 / Vault Master Password: 12121212
- Admin: https://admin.ironvault.app → admin / admin123

## Deployment
- Main app: `npx vercel --prod --yes --archive=tgz` (project: ironvault-main)
- Admin console: `cd admin-console && npx vercel --prod --yes --archive=tgz` (project: admin-console)
- Always push to origin/main BEFORE deploying
- Service worker version must be bumped on significant client changes

## Important Rules
- NEVER work in git worktrees — always work directly on main
- NEVER create branches — commit directly to main
- Always verify deploy with `/api/health` check
- Cloud sync: push queue handles retries, never block UI
- Note editor: portal-rendered, immune to background sync via note-editing-guard
- 401 interceptor: 15s boot grace period + 30s login grace + cloud token presence check
- JWT TDZ fix: JWT_SECRET must be declared at top of handler before any endpoint

## Current State (May 2026)
- **v4.2.0** released on GitHub (2026-05-08)
- 160+ security fixes applied (carried from v4.1.0)
- 5-phase UI overhaul complete (glassmorphism, Motion animations, premium design)
- Lighthouse mobile: Performance **75+** (was 57), Accessibility 97, SEO 100
- Playwright test suite: 12 spec files, 900+ tests, growing pass rate
- iOS + Android native apps shipping via Capacitor 7

### v4.2.0 Highlights
- **Google Sign-In** — OAuth 2.0 on web, iOS, and Android via `@capgo/capacitor-social-login` (Google Cloud project: `citric-bee-495700-v6`)
- **Biometric vault unlock** — Face ID / Touch ID / fingerprint via `@aparajita/capacitor-biometric-auth` and `capacitor-native-biometric`; unified gesture + credential bundle (one place to enroll/use)
- **Centralized plan service** (`planService`) — single source of truth for subscription tier and import limits; fixes Lifetime → Free demotion regressions
- **Anti-wipe cloud sync guard** — always pushes full vault blob; prevents data-loss on partial-state pushes
- **Font size / accessibility settings** — user-configurable text scaling
- **Investments view/edit** — dynamic currency rendering for FDs, MFs, stocks, crypto
- **Notes manual save** — autosave removed; explicit save model is more reliable on iOS (fixes editor closing mid-typing)
- **`apiBase()` helper** — absolute API URLs on Capacitor native (web continues to use relative URLs)
- **iOS/Android polish** — keyboard, safe-area, header alignment, sheet/modal close, toast/banner cleanup, Razorpay flow, swipe gestures
- **CSP updated for Google Sign-In** — `accounts.google.com`, `apis.google.com`, GIS frame allowances
- **iOS build pipeline** — Pod install fixes for Ruby 4.0.2; AppCheckCore reinstall workaround documented

### Native Build Notes
- iOS: `npm run cap:build:ios` → open `ios/App.xcworkspace`; requires `GoogleService-Info.plist` and reversed-client URL scheme
- Android: `npm run cap:build:android`, then in `android/`: `./gradlew assembleDebug` (set `JAVA_HOME` to Android Studio JBR; `GRADLE_OPTS=-Xmx4g` recommended)
