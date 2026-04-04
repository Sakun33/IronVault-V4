# GitHub Secrets Configuration

All secrets below must be added to your GitHub repository under **Settings → Secrets and variables → Actions**.

---

## Database

| Secret | Description |
|--------|-------------|
| `DATABASE_URL_TEST` | PostgreSQL connection string for CI test database |

---

## Vercel Deployment

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel personal access token (vercel.com → Account → Tokens) |
| `VERCEL_ORG_ID` | Your Vercel team/org ID |
| `VERCEL_BACKEND_PROJECT_ID` | Vercel project ID for backend API |
| `VERCEL_ADMIN_PROJECT_ID` | Vercel project ID for admin console |

---

## RevenueCat (In-App Purchases)

| Secret | Description |
|--------|-------------|
| `VITE_REVENUECAT_API_KEY_IOS` | RevenueCat iOS public API key (starts with `appl_`) |
| `VITE_REVENUECAT_API_KEY_ANDROID` | RevenueCat Android public API key (starts with `goog_`) |

> These are public SDK keys, not secret keys. Safe to include in VITE_ env vars.

---

## Android Build

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded release keystore file (`base64 -i ironvault-release.keystore`) |
| `ANDROID_KEYSTORE_PASSWORD` | Password for the keystore |
| `ANDROID_KEY_ALIAS` | Key alias within the keystore |
| `ANDROID_KEY_PASSWORD` | Password for the key |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Google Play service account JSON (plain text, not base64) |

### How to generate the Android keystore:
```bash
keytool -genkey -v \
  -keystore ironvault-release.keystore \
  -alias ironvault \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
# Then base64 encode it:
base64 -i ironvault-release.keystore | pbcopy
```

---

## iOS Build

| Secret | Description |
|--------|-------------|
| `IOS_DISTRIBUTION_CERT_BASE64` | Base64-encoded .p12 distribution certificate |
| `IOS_DISTRIBUTION_CERT_PASSWORD` | Password for the .p12 certificate |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded .mobileprovision file |
| `KEYCHAIN_PASSWORD` | Temporary keychain password (any strong random string) |
| `APPLE_TEAM_ID` | Your Apple Developer Team ID (10-character string) |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API Key ID |
| `APP_STORE_CONNECT_API_ISSUER_ID` | App Store Connect API Issuer ID |
| `APP_STORE_CONNECT_API_KEY_BASE64` | Base64-encoded .p8 API key file |

---

## E2E / Smoke Tests

| Secret | Description |
|--------|-------------|
| `TEST_USER_EMAIL` | Email of a test account in production |
| `TEST_USER_PASSWORD` | Password of the test account |

---

## Security Notes

1. **Never** commit `.env`, `.env.production`, or `.env.local` — they are gitignored
2. **Never** commit Android keystores or iOS certificates
3. RevenueCat public keys are safe to prefix with `VITE_` (they are not secret)
4. Stripe secret keys (`sk_live_*`) must NEVER appear in client-side code
5. Rotate all secrets immediately if they are accidentally exposed
