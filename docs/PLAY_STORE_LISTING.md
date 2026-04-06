# Play Store Listing — IronVault

## App Details

| Field | Value |
|---|---|
| **App Name** | IronVault - Password Manager |
| **Package Name** | com.ironvault.app |
| **Category** | Tools > Security |
| **Content Rating** | Everyone |
| **Target Audience** | 18+ (financial and sensitive credential data) |
| **Contact Email** | saketsuman1312@gmail.com |
| **Privacy Policy URL** | https://ironvault.app/privacy |

---

## Short Description (80 chars max)

```
Secure offline password manager with zero-knowledge encryption
```
*(62 characters)*

---

## Full Description (4000 chars max)

```
IronVault — the password manager that keeps your secrets truly secret.

Unlike cloud-based password managers, IronVault stores everything 100% on your device, encrypted with military-grade AES-256 encryption derived from your master password. We can't see your data. Nobody can.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 ZERO-KNOWLEDGE SECURITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• AES-256-GCM encryption on every vault entry
• Key derived via PBKDF2 with 600,000+ iterations
• Master password never stored — not even on your device
• Zero network access for your vault — it never leaves your phone
• We cannot access, read, or recover your data. Ever.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 BIOMETRIC AUTHENTICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Fingerprint and face unlock support
• Auto-lock when app goes to background
• Configurable lock timeout
• No biometric data leaves your device

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🗂️ POWERFUL VAULT MANAGEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Store passwords, secure notes, credit cards, and identities
• Organize entries with categories and tags
• Fast search across your entire vault
• One-tap copy for passwords, usernames, and URLs
• Breach detection to flag compromised passwords
• Password health dashboard — identify weak or reused passwords

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 SMART PASSWORD GENERATOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Generate strong, random passwords or passphrases
• Customize length, character sets, and symbols
• Generate directly when creating a new entry

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 SECURE BACKUP & EXPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Export your entire vault to an encrypted JSON file
• Import from IronVault exports — seamlessly restore on a new device
• You own your data — take it with you anywhere

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 BEAUTIFUL, MODERN DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Clean, intuitive dark and light themes
• Designed for one-handed mobile use
• Instant search and quick-access favourites
• Smooth animations that don't get in the way

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 YOUR PRIVACY, GUARANTEED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• No ads. No tracking. No third-party analytics on vault data.
• No account required for core vault features
• No internet permission needed for vault operations
• Open about what little data we do collect (see Privacy Policy)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 PREMIUM FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unlock the full IronVault experience with a premium subscription:
• Unlimited vault entries (free tier: up to 50)
• Advanced breach monitoring
• Priority customer support
• Exclusive new features first

Subscriptions are monthly or annual, managed via Google Play. Cancel anytime.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IronVault is built for people who take security seriously — security professionals, developers, and anyone who understands that a data breach at a cloud password manager can expose everything. With IronVault, there's nothing to breach on our end.

Questions? Contact us at saketsuman1312@gmail.com
Privacy Policy: https://ironvault.app/privacy
Terms of Service: https://ironvault.app/terms
```

*(Approx. 2,900 characters — well within the 4,000 limit)*

---

## Graphics Requirements

| Asset | Dimensions | Notes |
|---|---|---|
| App Icon | 512 × 512 px | PNG, no alpha |
| Feature Graphic | 1024 × 500 px | Shown at top of listing |
| Phone Screenshots | 16:9 or 9:16 | Min 2, max 8 |
| Tablet Screenshots | Optional | 7" and 10" |

---

## Release Notes Template (What's New)

```
• Improved vault performance and stability
• Biometric lock reliability improvements
• UI polish and accessibility fixes
```

---

## Content Rating Questionnaire Answers

| Question | Answer |
|---|---|
| Violence | No |
| Sexual content | No |
| Profanity | No |
| Controlled substances | No |
| User-generated content shared with others | No |
| Personal/sensitive data collected | Email (for account), anonymous analytics |
| Financial transactions | Yes — in-app subscriptions via Google Play |
| Location data | No |
| Designed for children | No |

**Expected rating: Everyone**

---

## Data Safety Section (Play Store)

### Data Collected

| Data Type | Purpose | Required | Shared with 3rd parties |
|---|---|---|---|
| Email address | Account management, subscription | Yes (for premium) | RevenueCat, Stripe |
| Purchase history | Subscription entitlement | Yes (for premium) | RevenueCat, Google Play |
| App interactions (anonymous) | Analytics & improvement | No | No |
| Crash logs | Bug fixing | No | No |

### Data NOT Collected
- Vault contents (passwords, notes, credentials)
- Location
- Contacts
- Photos/Media
- Device identifiers beyond what Google Play provides

### Security Practices
- Data is encrypted in transit (TLS)
- Vault data encrypted at rest on device (AES-256-GCM)
- Users can request data deletion via email

---

## Developer Notes

- App uses `POST_NOTIFICATIONS` permission — this requires the runtime permission prompt on Android 13+. Only request this permission when the user explicitly enables vault expiry reminders.
- App uses `USE_BIOMETRIC` — declare in manifest, request at runtime on Android 9+.
- `minSdkVersion 24` targets Android 7.0+ (Nougat), covering ~97% of active Android devices as of 2026.
- `targetSdkVersion 35` meets Google Play's current requirement (minimum 34 for new apps as of August 2024; 35 recommended for 2025+).
