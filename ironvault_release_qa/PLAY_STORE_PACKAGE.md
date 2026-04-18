# IronVault — Play Store Package
**Version:** 1.0.0  
**Generated:** 2026-04-18  
**Package name:** `app.ironvault.vault`

---

## 1. Store Listing

### App Title (30 chars max)
```
IronVault - Password Manager
```

### Short Description (80 chars max)
```
Encrypted vault for passwords, finance & documents. Zero-knowledge. Offline-first.
```

### Long Description (4000 chars max)

```
IronVault is a zero-knowledge personal vault designed for people who take privacy seriously. Everything you store is encrypted on-device using AES-256-GCM before it ever touches the cloud.

🔒 SECURE BY DESIGN
• AES-256-GCM encryption with PBKDF2 key derivation
• Your master password never leaves your device
• Zero plaintext stored anywhere — not even on our servers
• Biometric unlock (fingerprint / face ID) for quick access
• Auto-lock with configurable timeout

🗝️ PASSWORD VAULT
• Unlimited passwords on Pro (50 on Free)
• Copy username/password with one tap
• Built-in password reveal toggle
• Search and filter your vault instantly

📄 DOCUMENT VAULT
• Store PDFs, images, and text files encrypted
• Export with optional password-protected ZIP
• All file types supported: PDF, JPG, PNG, WebP, HEIC, TXT, MD

💳 FINANCE MANAGER
• Track subscriptions with renewal dates and amounts
• Log expenses by category with full history
• Bank statement storage and transaction tracking
• Investment portfolio with cost basis tracking
• Financial goals monitoring

📝 SECURE NOTES
• Rich text notes with pin-to-top support
• Search across all notes instantly
• Free: 10 notes | Pro: unlimited

⏰ SMART REMINDERS
• Set reminders for renewals, deadlines, and tasks
• Free: 10 reminders | Pro: unlimited

🔑 API KEY VAULT
• Store API keys, tokens, and credentials
• Encrypted with the rest of your vault (Pro only)

☁️ CLOUD SYNC (PRO)
• End-to-end encrypted cloud backup
• Sync across multiple devices
• 3-second push + 60-second pull for near-real-time sync
• Multiple vaults with per-vault master passwords

🆓 FREE PLAN INCLUDES
• 50 passwords
• 10 notes
• 10 subscriptions
• 5 documents
• 10 reminders
• Offline-first storage — no account required to start

💎 PRO PLAN (₹149/month or ₹9,999 lifetime)
• Everything in Free, unlimited
• Cloud sync across devices
• Expenses, bank statements, investments
• API key vault
• Up to 5 local vaults

--- 

PRIVACY: IronVault is offline-first. You can use the entire app without creating an account. Cloud sync is opt-in and end-to-end encrypted — we have zero ability to read your data.

OPEN SOURCE COMPONENTS: IronVault uses open-source libraries under MIT/Apache 2.0 licenses. See our website for the full list.

Website: https://www.ironvault.app
Privacy Policy: https://www.ironvault.app/privacy
Terms of Service: https://www.ironvault.app/terms
Support: support@ironvault.app
```

---

## 2. Screenshot Guidance

Capture these screens on a Pixel 7 (1080×2400) or Pixel 5 (1080×2340) in portrait orientation. Use light mode for screenshots 1–5 and dark mode for 6–8.

### Screenshot 1 — Hero: Vault Dashboard
**Screen:** `/` (Dashboard after unlock)  
**State:** Vault with several passwords, 2 notes, 3 subscriptions showing  
**Caption:** "Your encrypted vault, always at hand"  
**Key elements:** Sidebar showing Vault/Finance sections; welcome message; quick-access cards

### Screenshot 2 — Password Vault
**Screen:** `/passwords`  
**State:** 6+ passwords with different service icons (Google, GitHub, Netflix, etc.)  
**Caption:** "Store unlimited passwords — encrypted, searchable"  
**Key elements:** Search bar, copy button, show/hide password toggle visible on one entry

### Screenshot 3 — Finance Dashboard
**Screen:** `/subscriptions`  
**State:** 4–5 subscriptions (Netflix, Spotify, GitHub, AWS) with amounts + next renewal dates  
**Caption:** "Never miss a renewal again"  
**Key elements:** Subscription cards, total monthly cost, upcoming dates

### Screenshot 4 — Document Vault
**Screen:** `/documents`  
**State:** 3 documents: a PDF, a JPG, a TXT file with file size and date  
**Caption:** "Secure document storage with encrypted export"  
**Key elements:** File type badges (PDF/IMAGE/TXT), Shield icon header, Import button

### Screenshot 5 — Add Password (Light Mode)
**Screen:** Add password modal open  
**State:** Form partially filled  
**Caption:** "Add any credential in seconds"  
**Key elements:** Clean modal, field labels, password strength visible

### Screenshot 6 — Dark Mode + Biometric
**Screen:** Vault picker (dark mode)  
**State:** Two vaults listed; "Unlock with Biometrics" button visible  
**Caption:** "Dark mode + biometric unlock"  
**Key elements:** Dark terminal aesthetic, vault cards, biometric shortcut

### Screenshot 7 — Investments (Dark Mode)
**Screen:** `/investments`  
**State:** Portfolio with 3–4 holdings (AAPL, BTC, INFY, etc.)  
**Caption:** "Track your investment portfolio privately"  
**Key elements:** Holdings list, cost basis, no external API calls (all local)

### Screenshot 8 — Security Card
**Screen:** `/profile` → Security tab  
**State:** Biometric enabled, auto-lock set to 5 min  
**Caption:** "Zero-knowledge. Your data, your keys."  
**Key elements:** Encryption info card, biometric toggle, auto-lock setting

---

## 3. Graphic Assets

### Feature Graphic (1024×500)
Dark background (#0a0c10) with IronVault wordmark in blue (#3b82f6), shield icon center, subtitle "AES-256 Encrypted Vault" in light gray.

### App Icon
- Already in `android/app/src/main/res/` (mipmap-* directories)
- Shield icon with "IV" monogram on dark navy background
- Confirm adaptive icon foreground + background are separate layers

### Promo Video (optional, 30s)
1. Landing page → Get Started
2. Signup in 10 seconds
3. Add a password, copy it
4. Show document import + encryption badge
5. Enable cloud sync
6. Lock + biometric unlock
7. End card: IronVault.app

---

## 4. Content Rating

**IARC Rating:** Everyone (E)  
**Content:** No violence, no adult content, no user-generated public content  
**Data Safety declaration:**
- Data encrypted on device: YES
- Data collected: Email (account creation only), encrypted vault blob (cloud sync only)
- Data shared with third parties: NO
- Data deletable on request: YES (`/settings → Clear All Data` + email support@ironvault.app)

---

## 5. Privacy Policy (Play Store Summary)

**Full URL:** https://www.ironvault.app/privacy

**Key points for Play Store Data Safety form:**

| Data Type | Collected | Purpose | Shared | Optional |
|-----------|-----------|---------|--------|----------|
| Email address | Yes | Account login (cloud sync only) | No | Yes — app works fully offline without account |
| Encrypted vault blob | Yes (cloud sync only) | Cross-device sync | No | Yes — cloud sync is opt-in |
| Crash logs | No | — | — | — |
| Precise location | No | — | — | — |
| Contacts | No | — | — | — |
| Financial info | Stored locally only, end-to-end encrypted | Personal finance tracking | No | Yes |

**Encryption in transit:** TLS 1.3  
**Encryption at rest:** AES-256-GCM (user's master password derived key — server cannot decrypt)  
**Data deletion:** User can delete all data from Settings → Clear All Data. Cloud vaults deleted via Profile → Manage Vaults.

---

## 6. Store Categories

**Primary category:** Productivity  
**Secondary category:** Tools  
**Tags:** password manager, vault, security, privacy, encrypted, finance tracker, document storage

---

## 7. Release Notes (What's New)

```
Version 1.0.0 — Initial Release

IronVault is here! Your all-in-one encrypted personal vault.

✦ Password vault with AES-256 encryption
✦ Secure document storage (PDF, images, text)
✦ Finance tools: subscriptions, expenses, investments
✦ Optional cloud sync — end-to-end encrypted
✦ Biometric unlock support
✦ Completely offline-capable — no account required

Free plan available. Pro plan unlocks unlimited storage and cloud sync.
```

---

## 8. Contact Information

**Developer name:** IronVault  
**Email:** support@ironvault.app  
**Website:** https://www.ironvault.app  
**Privacy policy:** https://www.ironvault.app/privacy
