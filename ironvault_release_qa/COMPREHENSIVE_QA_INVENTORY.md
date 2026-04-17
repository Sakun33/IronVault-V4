# IronVault Comprehensive QA Inventory
**Generated:** 2026-04-17  
**Branch:** claude/xenodochial-mendeleev  
**Deploy target:** www.ironvault.app  
**Test account:** saketsuman1312@gmail.com / 12121212 (Lifetime)

---

## 1. ROUTE INVENTORY

### 1.1 Public Routes (no auth required)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | LandingPage | Marketing landing page — hero, quick links grid |
| `/auth/login` | Login | Email + password login |
| `/auth/signup` | SignupPage | Email + password signup |
| `/login` | Login | Alias for /auth/login |
| `/about` | AboutPage | Company story, mission, team |
| `/faq` | FAQPage | 10 FAQ accordion items |
| `/features` | FeaturesPage | 8 feature categories × 6 items |
| `/security` | SecurityPage | AES-256, PBKDF2, zero-knowledge details |
| `/contact` | ContactPage | Contact form + support channels |
| `/docs` | DocsPage | User documentation |
| `/support` | DocsPage | Alias for /docs |
| `/privacy` | PrivacyPage | Privacy policy (DPDP Act 2023) |
| `/terms` | TermsPage | Terms of service |
| `/disclaimer` | DisclaimerPage | Warranty disclaimer |
| `/cookies` | PrivacyPage | Cookie policy (alias for /privacy) |
| `/pricing` | PricingPage | Pricing tiers display |
| `/blog` | BlogPage | Blog post listings |
| `/changelog` | ChangelogPage | Version history |
| `/status` | StatusPage | Service health status |
| `/roadmap` | AboutPage | Roadmap (alias for /about) |
| `/api` | AboutPage | API reference (alias for /about) |

### 1.2 Auth-Flow Routes (logged in but vault locked)

| Path | Component | Description |
|------|-----------|-------------|
| `/auth/create-vault` | CreateVaultPage | Create first vault — name + master password |
| `/auth/signup` | VaultPickerPage | Post-signup vault selection (overrides public route) |
| `/auth/login` | VaultPickerPage | Post-login vault selection (overrides public route) |
| `/multi-vault-login` | MultiVaultLoginPage | Login dialog for secondary vault |

### 1.3 Authenticated App Routes (vault unlocked)

| Path | Component | Sidebar Section | Description |
|------|-----------|-----------------|-------------|
| `/` | Dashboard | Core Vault | Overview cards + quick stats |
| `/passwords` | PasswordsPage | Core Vault | Password manager |
| `/subscriptions` | SubscriptionsPage | Core Vault | Subscription tracker |
| `/notes` | NotesPage | Core Vault | Encrypted notes |
| `/expenses` | ExpensesPage | Finance | Expense tracker with charts |
| `/reminders` | RemindersPage | Core Vault | Reminder/task manager |
| `/bank-statements` | BankStatementsPage | Finance | Bank statement import + analysis |
| `/investments` | InvestmentsPage | Finance | Investment portfolio tracker |
| `/goals` | GoalsPage | Finance | Financial goals + calculators |
| `/profile` | ProfilePage | Bottom | User profile + settings + family |
| `/documents` | DocumentsPage | Core Vault | Document storage + viewer |
| `/api-keys` | ApiKeysPage | — | API key management |
| `/logging` | LoggingPage | — | Activity log viewer |
| `/settings` | SettingsPage | Bottom | App settings |
| `/qa` | QAPage | — | QA/test utilities page |
| `/vaults` | VaultsPage | — | Multi-vault management |
| `/upgrade` | PricingUpgradePage | — | Upgrade/purchase flow |

---

## 2. API ENDPOINT INVENTORY

**Base URL:** `https://www.ironvault.app/api`  
**Auth:** Bearer token (JWT) via `POST /api/auth/token`

### 2.1 Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | None | Health check; returns status, timestamp, environment, DB connection |

### 2.2 CRM / Customer Registration

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/crm/register` | None | Register or upsert customer (email, fullName, country, platform, appVersion, planType) |
| GET | `/api/crm/entitlement/:userId` | None | Fetch plan entitlements (accepts UUID or email); returns tier, limits, feature flags |
| POST | `/api/crm/heartbeat` | None | Update `last_active` timestamp (email or userId) |
| POST | `/api/crm/vaults/sync` | None | Update vault count + last_active |
| POST | `/api/crm/vaults/report` | None | Report vault count; flag over-limit accounts |
| POST | `/api/crm/migrate` | None | Idempotent schema migration (run once; safe to re-run) |

### 2.3 Support Tickets

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/crm/tickets` | None | Create support ticket (email, subject, description, priority) |
| GET | `/api/crm/tickets/:email` | None | Fetch all tickets for an email |

### 2.4 Family Invites

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/crm/family-invites/:ownerEmail` | None | List invites sent BY owner |
| GET | `/api/crm/family-invites/invitee/:email` | None | List pending invites received BY invitee |
| POST | `/api/crm/family-invites` | None | Create invite (ownerEmail, inviteeEmail; requires Pro+ plan) |
| PATCH | `/api/crm/family-invites/:id` | None | Update invite status: `accepted` \| `declined` \| `revoked` |

### 2.5 Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/token` | None | Generate JWT (email, accountPasswordHash); trust-on-first-use |

### 2.6 Cloud Vaults

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/vaults/cloud` | Bearer | List all cloud vaults for authenticated user |
| GET | `/api/vaults/cloud/:vaultId` | Bearer | Fetch specific cloud vault + encrypted blob |
| POST | `/api/vaults/cloud` | Bearer | Create cloud vault (vaultId, vaultName, encryptedBlob; plan check: free blocked) |
| PUT | `/api/vaults/cloud/:vaultId` | Bearer | Update cloud vault; client-modified-at merge logic |
| DELETE | `/api/vaults/cloud/:vaultId` | Bearer | Delete cloud vault |
| PATCH | `/api/vaults/cloud/:vaultId/default` | Bearer | Set vault as default |

---

## 3. PLAN TIERS & FEATURE GATES

### 3.1 Plan Definitions

| Plan | Price (INR) | Billing | Seats | Available | Local Vaults |
|------|------------|---------|-------|-----------|--------------|
| **Free** | ₹0 | Forever | 1 | ✓ | 1 |
| **Pro Monthly** | ₹149/mo or ₹1,499/yr | Monthly/Yearly | 1 | ✓ | 5 |
| **Pro Family** | ₹299/mo or ₹2,999/yr | Monthly/Yearly | 6 | ✗ (Coming Soon) | 5 |
| **Lifetime** | ₹9,999 one-time | One-time | 1 | ✓ | 5 |

### 3.2 Feature Limits by Plan

| Feature | Free | Pro | Lifetime |
|---------|------|-----|----------|
| Passwords | 50 | Unlimited | Unlimited |
| Notes | 10 | Unlimited | Unlimited |
| Subscriptions | 10 | Unlimited | Unlimited |
| Reminders | 10 | Unlimited | Unlimited |
| Documents | 5 | Unlimited | Unlimited |
| Expenses | No | Yes | Yes |
| Bank Statements | No | Yes | Yes |
| Investments | No | Yes | Yes |
| Goals (calculators) | No | Yes | Yes |
| Cloud Sync | No | Yes | Yes |
| Biometric Auth | No | Yes | Yes |
| Family Sharing | No | Pro+ | Yes |
| Priority Support | No | Yes | Yes |
| Local Vaults | 1 | 5 | 5 |

### 3.3 `use-plan-features` Hook — Feature Flags Returned

`localVaultLimit`, `cloudSyncEnabled`, `familySharingEnabled`, `bankImportEnabled`, `analyticsEnabled`, `biometricEnabled`, `prioritySupportEnabled`, `isPaid`, `isLifetime`

### 3.4 `use-subscription` Hook — Limits Object

`{ passwords: 50|∞, notes: 5|∞, subscriptions: bool, expenses: bool, bankStatements: bool, investments: bool, documents: bool, apiKeys: bool, reminders: 10|∞ }`

---

## 4. COMPONENT INVENTORY

### 4.1 Feature Components

| Component | File | Key Functions |
|-----------|------|---------------|
| ImportExportModal | import-export-modal.tsx | Export encrypted JSON, import encrypted/plain JSON, CSV import (7 parsers), CSV templates download |
| SecuritySettingsModal | security-settings-modal.tsx | KDF preset selector (4 levels), benchmark runner, vault re-encryption with progress |
| PricingUpgrade | pricing-upgrade.tsx | Pro/Lifetime plan cards, billing toggle, web fallback buttons, entitlement check |
| VaultManagerUI | vault-manager-ui.tsx | Vault grid, create/rename/delete vault, biometric toggle, cloud sync enable/disable |
| VaultSelector | vault-selector.tsx | Vault picker dropdown for header |
| VaultSelectionContext | vault-selection-context.tsx | `requestVaultSwitch()` — password verification dialog before switching vaults |
| SubscriptionAnalytics | subscription-analytics.tsx | Subscription spend analytics, category breakdown |
| DocumentViewer | document-viewer.tsx | PDF and image viewer component |
| CustomerInfoDialog | customer-info-dialog.tsx | Customer profile dialog |
| AddInvestmentModal | add-investment-modal.tsx | Investment creation form |
| AddSubscriptionModal | add-subscription-modal.tsx | Subscription creation/edit form |

### 4.2 Auth/Security Components

| Component | Function |
|-----------|----------|
| VerifyAccessModal | Master password re-verification gate for sensitive reveals |
| TwoFactorAuth | TOTP 2FA setup/toggle |
| SupportTicketSubmission | Support ticket form |

### 4.3 Mobile Components (client/src/components/mobile/)

`BottomTabs`, `MobileSheet`, `MobileDialog`, `MobilePage`, `SearchModal`, `MoreSheet`

### 4.4 UI Component Library (shadcn/ui)

`Button`, `Input`, `Dialog`, `Card`, `Tabs`, `Badge`, `Select`, `Checkbox`, `Textarea`, `Label`, `DropdownMenu`, `Toast`, `Alert`, `Accordion`, `Tooltip`, `Drawer`, `Sheet`, `Popover`, `Avatar`, `Calendar`, `Switch`, `Progress`, `Separator`

---

## 5. DATA ENTITY INVENTORY

### 5.1 Stored Entities (IndexedDB `encrypted_data` store)

| Entity | Key Fields | CRUD Methods |
|--------|-----------|--------------|
| **Password** | id, name, username, password, url, category, strength | save/get/getAll/delete |
| **Subscription** | id, name, category, cost, billingCycle, nextBillingDate, credentials | save/get/getAll/delete |
| **Note** | id, title, content, notebook, tags, isPinned, noteType | save/get/getAll/delete |
| **Expense** | id, title, amount, currency, category, date, isRecurring, tags | save/get/getAll/delete |
| **Reminder** | id, title, dueDate, priority, category, isCompleted, isRecurring, tags | save/get/getAll/delete |
| **BankStatement** | id, accountName, bank, period, transactions[] | save/get/getAll/delete |
| **BankTransaction** | id, statementId, date, description, amount, category | save/get/getAll/delete |
| **Investment** | id, type, name, amount, startDate, returns | save/get/getAll/delete |
| **InvestmentGoal** | id, name, category, targetAmount, monthlyContribution, timePeriod | save/get/getAll/delete |

### 5.2 Non-Encrypted Stores (IndexedDB `persistent_data` store)

Vault metadata, backup metadata, KDF config, password count, last sync timestamps

---

## 6. PAGE-BY-PAGE UI ELEMENT INVENTORY

### 6.1 Passwords Page (`/passwords`)

**Buttons:**
- "Add Password" (`data-testid: add-password-button`)
- "Templates" (16 templates: Gmail, Facebook, Amazon, GitHub, PayPal, WiFi, etc.)
- Per-row: Reveal/Hide, Copy username, Copy password, Edit, Delete, Share

**Filters:**
- Search input (searches name, username, url, category)
- Category dropdown (All + `PASSWORD_CATEGORIES`)
- Strength dropdown (All / Weak / Medium / Strong)

**Modals:**
- Add/Edit password modal
- Templates modal (2-column grid)
- Share password modal
- Verify access modal (first reveal requires master password re-check)

**State tracked:** `showAddModal`, `editingPassword`, `categoryFilter`, `strengthFilter`, `visiblePasswords (Set)`, `copiedId`, `showShareModal`, `showVerifyModal`, `isVerified`, `pendingRevealId`, `showTemplatesModal`

---

### 6.2 Notes Page (`/notes`)

**Buttons:**
- "Add Note" (`data-testid: button-add-note`)
- "Templates" (12 templates: Grocery, Meeting Notes, Daily Tasks, Recipe, Travel Checklist, etc.)
- Per-note: Pin/Unpin, Edit, Delete, View

**Filters:**
- Search input
- Notebook filter (Default, personal, work)
- Tag filter (multi-select)
- Pinned-only toggle

**Modals:**
- Add/Edit note modal with rich text editor
- View note modal (full content rendering)
- Templates modal (2-column)
- Delete confirmation dialog

**Special Features:**
- Code syntax highlighting (JSON, CSV, XML auto-formatting)
- Markdown preview / rich text toggle

---

### 6.3 Subscriptions Page (`/subscriptions`)

**Buttons:**
- Add subscription
- "Templates" (8 templates: Netflix, Spotify, Amazon Prime, iCloud, Gym, etc.)
- Per-subscription: Reveal credentials (gated), Copy username/email/password/accountId, Edit, Delete, Open platform URL

**Filters:** Search, Category, Status (active/inactive), Upcoming renewals filter

**Summary Cards:** Monthly spend, Yearly spend, Active count

**Modals:**
- Add/Edit subscription modal
- Templates modal
- Credential reveal verify modal
- Analytics tab (SubscriptionAnalytics component)

---

### 6.4 Expenses Page (`/expenses`)

**Buttons:**
- "Add Expense" (`data-testid: button-add-expense`)
- "Templates" (18 templates: Groceries, Coffee, Gas, Rent, Electricity, etc.)
- View mode tabs: Overview / Categories / Trends
- Per-expense: Edit, Delete

**Filters:** Search, Category, Date range (All/Week/Month/Year), Recurring-only toggle, Tags

**Analytics:**
- Summary cards: Total Spent, Count, Average, Recurring count
- Pie chart (Recharts) — spending by category
- Bar chart (Recharts) — monthly trends (last 6 months)
- Category breakdown table

---

### 6.5 Reminders Page (`/reminders`)

**Buttons:**
- Add reminder
- Per-reminder: Complete checkbox, Edit, Delete

**Filters:** Search, Category, Priority, Date (Today/Week/Month/All), Tags, Show completed toggle, Show overdue toggle

**Stats Cards:** Total, Completed, Overdue, Due today, Due tomorrow, This week

**View Modes:** List view, Calendar/grid view

**Features:** Recurring reminders, notification scheduling, alarm config

---

### 6.6 Goals Page (`/goals`)

**Buttons:**
- Add goal (12 templates: Retirement, Education, Home, Car, Wedding, etc.)
- Per-goal: Edit, Delete

**Calculators (9):** SIP, Lump Sum, Mutual Fund, FD, PPF, NPS, Retirement Planner, Education Fund, Home Purchase

**Filters:** Search, Priority, Category

**Upgrade gate:** Non-paid users see feature lock

---

### 6.7 Profile Page (`/profile`)

**Tabs:** Overview | Data Management | Security | Vaults | Subscription | Support

**Actions per tab:**

*Overview:* Edit name, email, phone; view stats (passwords/notes/subscriptions/vault size MB); preferences (theme, language, currency, notifications); privacy toggles (analytics, crash reports, marketing)

*Data Management:* Export CSV/JSON/encrypted ZIP, import JSON/CSV, backup + restore

*Security:* Change master password (with re-encryption), toggle 2FA, biometric unlock setup, KDF settings (via SecuritySettingsModal)

*Vaults:* VaultManagementSection — create/rename/delete/biometric/cloud-sync per vault

*Subscription:* Current tier display, Family Sharing section (send/revoke invites), incoming invite accept/decline

*Support:* Create ticket (title, category, priority, description); view existing tickets

**Account Deletion:** Requires typing "DELETE"; clears all localStorage + drops IndexedDB

---

### 6.8 Bank Statements Page (`/bank-statements`)

**Actions:** Import CSV (auto-detects bank format), view transactions, delete statement, view analytics

**Auto-categorization:** Income, Food & Dining, Shopping, Transportation, etc.

---

### 6.9 Investments Page (`/investments`)

**Actions:** Add investment (types: FD, RD, Mutual Fund, Stocks, Crypto, NFT, etc.), edit, delete, view portfolio analytics

---

### 6.10 Documents Page (`/documents`)

**Actions:** Upload document (PDF, image), view via DocumentViewer, delete, search

**Upgrade gate:** Free plan limited to 5 documents

---

### 6.11 Settings Page (`/settings`)

**Sections:**
- Theme: Light / Dark / System
- Privacy: Analytics toggle, support ticket toggle
- Data: Manual sync trigger, last sync display, clear-data dialog
- Vault Backup: Password-protected backup creation

---

### 6.12 Landing Page (`/`)

**Nav links:** Features (`/features`), Pricing (`/pricing`), Security (`/security`), FAQ (`/faq`), Download (`#download`)

**Sections:** HeroSection (100dvh), TrustStrip, QuickLinksGrid (6 icon cards)

**CTAs:** "Get started free" → `/auth/signup`, "Log in" → `/auth/login`, Download for Android (APK)

---

### 6.13 Info Pages

| Page | Route | Content |
|------|-------|---------|
| FAQ | `/faq` | 10 Q&A: zero-knowledge, forgot password, family plan, offline use, data location, cancellation, open source, iOS, import, biometric |
| Features | `/features` | 8 categories × 6 features each |
| Security | `/security` | AES-256-GCM, PBKDF2 600k+ iterations, zero-knowledge |
| About | `/about` | Company story, tech stack, contact: subsafeironvault@gmail.com |
| Privacy | `/privacy` | DPDP Act 2023 compliance, no tracking cookies |
| Terms | `/terms` | Service agreement, acceptable use |
| Disclaimer | `/disclaimer` | Warranty disclaimer |
| Contact | `/contact` | Contact form (Name, Email, Subject, Message) |
| Docs | `/docs` | User guides, getting started |
| Blog | `/blog` | Blog post listings |
| Changelog | `/changelog` | Version history |
| Status | `/status` | Service uptime |
| Pricing | `/pricing` | Tier comparison matrix |

---

## 7. STORAGE / CONTEXT / HOOK INVENTORY

### 7.1 Contexts

| Context | Provides |
|---------|----------|
| auth-context | `login()`, `logout()`, `user`, `isAuthenticated`, `accountEmail` |
| license-context | `tier` (free/pro/family/lifetime), `status`, `billingCycle`, `isTrial` |
| vault-context | `vault`, `unlockVault()`, `lockVault()`, `refreshData()`, `isUnlocked` |
| vault-selection-context | `vaults[]`, `activeVaultId`, `requestVaultSwitch()`, `createVault()`, `deleteVault()` |
| multi-vault-context | Multi-vault state aggregation |
| multi-vault-auth-context | Auth flows across vaults |
| theme-context | `theme` (light/dark/system), `setTheme()` |
| logging-context | Centralized logging |
| currency-context | `currency`, `setCurrency()`, `formatAmount()` |

### 7.2 Hooks

| Hook | Returns |
|------|---------|
| `use-plan-features` | Feature flags from `/api/crm/entitlement/`; 5min cache |
| `use-subscription` | Plan type + limits object |
| `use-toast` | `toast()` function (1-toast limit, 3s auto-dismiss) |
| `use-vault-autofill` | Autofill for password fields; never-list domains |
| `use-cloud-auto-sync` | Push (3s debounce) + pull (60s poll) bi-directional sync |
| `use-mobile` | `isMobile: boolean` based on 768px breakpoint |

### 7.3 Key Storage Methods (storage.ts)

**Vault lifecycle:** `init()`, `createVault()`, `unlockVault()`, `unlockVaultWithKey()`, `switchToVault()`, `recreateDatabase()`, `reencryptVault()`

**Cloud sync:** `exportVault()`, `importVault()`, `clearEncryptedItems()`, `replaceVaultFromBlob()`

**KDF:** `getKDFConfig()`, `reencryptVault()` with 4 presets (100k/600k/1M/2M)

**CRUD per entity:** `save*/get*/getAll*/delete*` × 9 entity types

**Persistent data (non-encrypted):** `savePersistentData()`, `getPersistentData()`, `getBackupMetadata()`, `hasRecentBackup()`

---

## 8. ADMIN CONSOLE

**Status: NOT FOUND in codebase.**  
No `/pages/admin/` directory exists. No `/admin` route registered in App.tsx.  
Admin console (if it exists) is a separate deployment not part of this client repo.

---

## 9. SECURITY BOUNDARIES

### 9.1 Client-side Encryption
- **Algorithm:** AES-256-GCM (authenticated encryption)
- **KDF:** PBKDF2 with 600k+ SHA-256 iterations (or SHA-512 at higher presets); unique salt per vault
- **Argon2id:** Mentioned in FAQ/security pages (may be aspirational; implementation uses PBKDF2 via Web Crypto API)
- **Storage:** IndexedDB; encrypted blobs only
- **Keys:** Never stored; re-derived from master password on each unlock

### 9.2 API Authentication
- **Mechanism:** JWT Bearer token (trust-on-first-use on first login)
- **Scope:** Cloud vault endpoints only
- **No server-side vault decryption:** Server stores/returns encrypted blobs only

### 9.3 Feature Gates
- Free tier enforced client-side via `use-plan-features` + `use-subscription`
- Server enforces: cloud sync blocked for free tier on POST `/api/vaults/cloud`
- Family invite creation blocked server-side for non-Pro accounts

### 9.4 Vault Switch Security (BUG-044 fix)
- `requestVaultSwitch(vaultId)` shows password dialog
- Calls `auth.login(password)` to verify; reverts on failure
- Active vault ID reverted to previous if verification fails

---

## 10. KNOWN LIMITATIONS & GAPS

| Area | Limitation |
|------|-----------|
| Family vault key sharing | Manual — owner must share master password with invitee manually. No cryptographic key exchange implemented. |
| iOS native app | Not available. PWA on Safari only. |
| Admin console | Not found in codebase. |
| Biometric (Capacitor) | `capacitor-native-biometric@4.2.2` built for Capacitor 4/5; runtime compat with Capacitor 7 unverified |
| Argon2id | FAQ/security pages claim Argon2id; implementation uses PBKDF2 via Web Crypto API |
| Payment/upgrade | Web fallback buttons only ("Activate Pro" / "Activate Lifetime"); Stripe/RevenueCat integration pending |
| CSV import parsers | 7 parsers defined; only bank CSV auto-categorization is automated; others require manual column mapping |

---

## 11. TEST ACCOUNT CREDENTIALS

| Account | Email | Password | Tier | Notes |
|---------|-------|----------|------|-------|
| Primary test | saketsuman1312@gmail.com | 12121212 | Lifetime | All features unlocked |
| Vault master password | (same as above) | 12121212 | — | Use for vault unlock |

---

## 12. ENVIRONMENT

| Item | Value |
|------|-------|
| Production URL | https://www.ironvault.app |
| Alias | https://ironvault.app |
| Latest deploy | ironvault-main-7g30kdegn |
| Framework | Vite + React + TypeScript + Wouter |
| UI library | shadcn/ui (Radix + Tailwind) |
| Charts | Recharts |
| Native | Capacitor 7 (Android APK) |
| Backend | Vercel serverless (api/index.ts) |
| DB | PostgreSQL (Neon) via Vercel integration |
| SW cache | ironvault-v2.0.0 |
