# IronVault

Zero-knowledge encrypted vault for passwords, finance, notes, and documents — across web, mobile, and browser.

> Your data is encrypted on your device. The server stores ciphertext only and **never** sees your master password or plaintext data.

- **Web app:** [https://www.ironvault.app](https://www.ironvault.app)
- **Admin console:** [https://admin.ironvault.app](https://admin.ironvault.app)
- **Mobile:** iOS + Android (Capacitor 7)
- **Browser:** Chrome / Chromium extension (Manifest V3)

---

## What is IronVault?

IronVault is an end-to-end encrypted personal vault. One master password unlocks **everything**: logins, banking & investment records, expenses, subscriptions, notes, reminders, and uploaded documents. Everything is encrypted client-side with AES-256-GCM, with keys derived from your master password using PBKDF2-HMAC-SHA256 at 600 000 iterations. The server stores opaque blobs.

You can run IronVault fully offline (data lives in IndexedDB), or enable cloud sync to roam between web, mobile, and the Chrome extension.

## Key features

### Security
- **AES-256-GCM** authenticated encryption for all vault data
- **PBKDF2-HMAC-SHA256, 600 000 iterations** for master-password key derivation
- **scrypt** for account-password hashing (with automatic legacy migration)
- **TOTP-based 2FA** with QR-code setup, encrypted secret at rest, and scrypt-hashed backup codes
- **Biometric unlock** (Face ID / Touch ID / Android Biometric) on mobile via Capacitor
- **Per-vault IndexedDB isolation** — switching vaults wipes the previous vault from memory and storage
- **Two-stage authentication** — account password to sign in, master password to unlock the vault
- **Timing-safe comparisons** on all secrets, tokens, and API keys
- **Rate limiting** on auth, 2FA, password-reset, and import endpoints
- **HSTS, CSP, X-Frame-Options, Referrer-Policy** and a hardened header set

### Vault contents
- **Passwords** with autofill, password strength scoring, breach reuse detection
- **Banking & finance** — accounts, cards, investments, expenses, multi-currency support
- **Subscriptions** — billing reminders, yearly cost rollups
- **Notes** — rich text via Tiptap (XSS-sanitized with DOMPurify)
- **Documents** — encrypted file uploads with folder organization, in-browser PDF viewer, OCR via Tesseract.js
- **Reminders** — local notifications on mobile

### Sync, sharing & import
- **Cloud sync** — encrypted vault blob backed up to PostgreSQL; the server never holds the key
- **Multiple vaults per account** — vault registry scoped to user email; cross-account isolation enforced
- **Family sharing** — invite family members to a shared vault
- **Password import** from 15+ sources: Chrome, Firefox, Safari, Edge, Brave, 1Password, Bitwarden, LastPass, Dashlane, KeePass, NordPass, Keeper, RoboForm, Apple Passwords, generic CSV
- **Mass export / mass delete** across every section

### Browser extension
- **Chrome / Chromium MV3** — same encrypted blob, decrypted locally with the master password
- **Origin-locked autofill** — credentials for `evil.example.com` cannot fill on `example.com`
- **Per-session re-wrap** — entries are re-encrypted with a freshly generated session key after vault unlock; only the requested credential ever crosses to the popup or page
- **Incognito split** — vault state is not shared between regular and private windows
- **`chrome.storage.session`** — never written to disk, automatically wiped when the browser closes
- See [`chrome-extension/README.md`](chrome-extension/README.md) for the full extension security model

## Architecture

```
+---------------------+       +---------------------+       +---------------------+
|   React + Vite SPA  |       |   Vercel Functions  |       |   Neon PostgreSQL   |
|   client/           | <---> |   api/  (Express)   | <---> |   (managed)         |
|   - IndexedDB       |       |   - Drizzle ORM     |       |   - users           |
|   - Web Crypto API  |       |   - JWT auth        |       |   - encrypted_vault |
|   - Tiptap, Recharts|       |   - Razorpay/Zoho   |       |   - sessions, 2FA   |
+---------------------+       +---------------------+       +---------------------+
        |                                                            ^
        |                                                            |
        v                                                            |
+---------------------+       +---------------------+                |
|  Capacitor 7 Mobile |       |   Chrome Extension  | ---------------+
|  iOS + Android      |       |   (Manifest V3)     |
+---------------------+       +---------------------+
```

### Zero-knowledge model
- The **master password never leaves the device.** It's used to derive an AES-GCM key, which is held in memory only while the vault is unlocked.
- Cloud sync uploads `{ version, salt, iv, data }` — the server stores ciphertext blobs and metadata. There is no path on the server to decrypt them.
- Two-stage auth keeps the **account password** (which authenticates with the API) cryptographically separate from the **master password** (which decrypts the vault).
- Per-vault IndexedDB isolation: every vault gets its own DB namespace; switching vaults clears the prior namespace before loading the new one.

### Tech stack

| Layer | Stack |
|---|---|
| Web app | React 18 + TypeScript + Vite, Tailwind CSS + shadcn/ui, wouter, TanStack Query |
| API | Express (deployed as Vercel Functions on Fluid Compute), Drizzle ORM, Zod |
| Database | Neon PostgreSQL (serverless) |
| Mobile | Capacitor 7 (iOS + Android), Capacitor Biometric Auth |
| Browser | Chrome Extension Manifest V3, Web Crypto API |
| Crypto | Web Crypto API (AES-GCM, PBKDF2), `scrypt` (account passwords), `otplib` (TOTP) |
| Rich content | Tiptap editor, DOMPurify, Tesseract.js (OCR), pdfjs-dist |
| Payments | Razorpay (subscriptions + webhooks) |
| Email | Nodemailer via SendPulse SMTP |
| Workflows | Zoho (Desk, CRM, Billing, Mail), n8n automation |

## Deployment

| Surface | Host |
|---|---|
| `www.ironvault.app` | Vercel |
| `admin.ironvault.app` | Vercel (separate project — see [`admin-console/`](admin-console/README.md)) |
| API | Vercel Functions (Fluid Compute, Node.js runtime) |
| Database | Neon PostgreSQL |
| Mobile | App Store / Play Store (Capacitor builds) |
| Extension | Loaded unpacked or via Chrome Web Store |

## Getting started

### Prerequisites
- Node.js >= 18, npm >= 9
- A Neon (or any) PostgreSQL database for the API

### Install

```bash
git clone https://github.com/Sakun33/IronVault-V4
cd IronVault
npm install
```

### Environment variables

Create a `.env.local` at the repo root:

```bash
# --- API ---
DATABASE_URL=postgres://...                # Neon connection string
JWT_SECRET=                                 # required, no fallback. Long random string.

# --- Razorpay (payments) ---
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

# --- Email (SendPulse SMTP) ---
SMTP_HOST=smtp-pulse.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="IronVault <noreply@ironvault.app>"

# --- Zoho ---
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=

# --- App ---
VITE_API_BASE_URL=http://localhost:3000
```

> **Never** commit secrets. The repository ships no fallback for `JWT_SECRET` — the API will refuse to boot without it.

### Run the dev server

```bash
npm run dev          # Vite dev server (web + API via Vercel dev rewrites)
npm run type-check   # TypeScript
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:e2e     # Playwright end-to-end
```

### Build for production

```bash
npm run build:prod   # Vite production build
```

### Mobile (Capacitor)

```bash
npm run cap:build:ios       # Build web + sync to iOS project
npm run cap:open:ios        # Open in Xcode
npm run cap:build:android   # Build web + sync to Android project
npm run cap:open:android    # Open in Android Studio
```

### Chrome extension

See [`chrome-extension/README.md`](chrome-extension/README.md). Load the `chrome-extension/` folder unpacked from `chrome://extensions`.

### Admin console

See [`admin-console/README.md`](admin-console/README.md).

## Project layout

```
IronVault/
├── client/              React + Vite single-page app
├── api/                 Express + Drizzle API (Vercel Functions)
├── shared/              Cross-cutting Zod schemas
├── chrome-extension/    Manifest V3 browser extension
├── admin-console/       Separate Vercel project — admin UI + admin API
├── android/, ios/       Capacitor native projects
├── packages/            Internal workspace packages
├── tests/               Playwright e2e
├── scripts/             Migration / maintenance scripts
└── docs/                Internal docs
```

## Security disclosures

If you find a vulnerability, please email **security@ironvault.app** — do not open a public issue.

## License

MIT — see `package.json`.
