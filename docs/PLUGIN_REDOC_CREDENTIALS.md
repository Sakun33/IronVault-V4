# RevenueCat API v2 — Credentials & Configuration Reference

> **Source file:** `plugin-redoc-0.yaml`
> **API Version:** 2.0.0
> **Base URL:** `https://api.revenuecat.com/v2`
> **Generated:** 2026-04-04

---

## What This Plugin Is

This file is the **RevenueCat Developer REST API v2** OpenAPI specification (rendered via Redoc). RevenueCat is a subscription and in-app purchase management platform. The API allows backend servers to manage customers, subscriptions, entitlements, products, offerings, paywalls, invoices, virtual currencies, and project configuration — across all major app stores.

---

## 1. Core RevenueCat API Authentication

All requests require a `Bearer` token in the `Authorization` header.

```
Authorization: Bearer YOUR_REVENUECAT_V2_SECRET_KEY
```

> ⚠️ **V1 keys do not work with the v2 API.** You must generate new V2 keys with specific permissions.

| Variable | Description | Where to Get It | Format |
|---|---|---|---|
| `REVENUECAT_V2_SECRET_KEY` | V2 Secret API key for server-side requests | RevenueCat Dashboard → Project Settings → API Keys → **+ New** → select **V2** | `sk_...` (keep secret, server-side only) |
| `REVENUECAT_PROJECT_ID` | The ID of your RevenueCat project | RevenueCat Dashboard → Project Settings | `proj1ab2c3d4` (1–255 chars) |

---

## 2. API Key Permissions (Scopes)

When generating your V2 secret key, you must select the required permission scopes. Based on the endpoints in this spec, the full set of possible scopes is:

### Customer Information Domain (480 req/min)
- `customer_information:customers:read`
- `customer_information:customers:read_write`
- `customer_information:subscriptions:read`
- `customer_information:subscriptions:read_write`
- `customer_information:purchases:read`
- `customer_information:purchases:read_write`
- `customer_information:invoices:read`

### Project Configuration Domain (60 req/min)
- `project_configuration:projects:read`
- `project_configuration:projects:read_write`
- `project_configuration:apps:read`
- `project_configuration:apps:read_write`
- `project_configuration:products:read`
- `project_configuration:products:read_write`
- `project_configuration:entitlements:read`
- `project_configuration:entitlements:read_write`
- `project_configuration:offerings:read`
- `project_configuration:offerings:read_write`
- `project_configuration:packages:read`
- `project_configuration:packages:read_write`
- `project_configuration:integrations:read`
- `project_configuration:integrations:read_write`
- `project_configuration:collaborators:read`
- `project_configuration:audit_logs:read`
- `project_configuration:virtual_currencies:read`
- `project_configuration:virtual_currencies:read_write`

### Charts & Metrics Domain (5 req/min)
- `charts_metrics:overview:read`
- `charts_metrics:charts:read`

### Virtual Currencies Domain (480 req/min)
- _(covered under project_configuration:virtual_currencies above)_

> **Recommendation:** Create separate API keys with minimal scopes per service/integration (principle of least privilege).

---

## 3. App Store Integration Credentials

Each app platform you connect to RevenueCat requires its own credentials, set when creating or updating an App (`POST /projects/{project_id}/apps`).

### 3a. Apple App Store (`type: app_store`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `APPLE_BUNDLE_ID` | The bundle identifier of your iOS app | Apple Developer Portal / App Store Connect | e.g. `com.yourcompany.app` |
| `APPLE_SHARED_SECRET` | App-specific shared secret for receipt validation | App Store Connect → Your App → In-App Purchases → Manage → App-Specific Shared Secret | 32-char hex string |
| `APPLE_SUBSCRIPTION_PRIVATE_KEY` | In-App Purchase EC private key (PKCS#8 PEM format) | App Store Connect → Users and Access → Keys → In-App Purchase | `-----BEGIN EC PRIVATE KEY-----` PEM block |
| `APPLE_SUBSCRIPTION_KEY_ID` | ID of the downloaded In-App Purchase key | App Store Connect (shown when you download the key) | e.g. `6345942CC3` (10 chars) |
| `APPLE_SUBSCRIPTION_KEY_ISSUER` | Issuer ID for the In-App Purchase key | App Store Connect → Users and Access → Keys (top of page) | UUID format, e.g. `5a049d62-1b9b-453c-b605-1988189d8129` |
| `ASC_API_KEY` | App Store Connect API Key (PEM contents) | App Store Connect → Users and Access → Integrations → App Store Connect API | PEM file contents (optional, for product imports) |
| `ASC_API_KEY_ID` | App Store Connect API Key ID | App Store Connect (shown when key is created) | e.g. `XXXXXXXXXX` |
| `ASC_API_KEY_ISSUER` | App Store Connect API Key Issuer ID | App Store Connect → Users and Access → Integrations | UUID format |
| `ASC_VENDOR_NUMBER` | Vendor number from App Store Connect | App Store Connect → Payments and Financial Reports | Numeric string (needed for financial reports) |

### 3b. Mac App Store — Legacy (`type: mac_app_store`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `MAC_BUNDLE_ID` | Bundle ID of your macOS app | Apple Developer Portal | e.g. `com.yourcompany.macapp` |
| `MAC_SHARED_SECRET` | Shared secret for the mac app | App Store Connect | 32-char hex string, nullable |

### 3c. Google Play Store (`type: play_store`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `GOOGLE_PACKAGE_NAME` | Android package name | Google Play Console | e.g. `com.yourcompany.app` |

> **Note:** Google Play Store integration also requires connecting a Google Service Account to RevenueCat via the dashboard (not exposed directly in this API spec).

### 3d. Amazon Appstore (`type: amazon`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `AMAZON_PACKAGE_NAME` | Amazon app package name | Amazon Developer Console | e.g. `com.yourcompany.amazonapp` |
| `AMAZON_SHARED_SECRET` | Amazon Developer Identity Shared Key | Amazon Developer Console → Apps & Services → App Details | Hex string, nullable |

### 3e. Stripe (`type: stripe`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `STRIPE_ACCOUNT_ID` | Stripe connected account ID (linked to RevenueCat) | Stripe Dashboard → Settings → Account Details | `acct_XXXXXXXXXXXXXXXXX` — must be connected to RevenueCat first |

### 3f. RevenueCat Web Billing / RC Billing (`type: rc_billing`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `RC_BILLING_APP_NAME` | Display name shown in checkout, emails, receipts | Your branding | 1–256 chars |
| `RC_BILLING_SUPPORT_EMAIL` | Reply-to address for customer emails | Your support inbox | Valid email, 1–320 chars; defaults to RevenueCat account email if blank |
| `RC_BILLING_DEFAULT_CURRENCY` | Default currency for Web Billing | Business decision | ISO 4217 code (e.g. `USD`) |
| `RC_BILLING_STRIPE_ACCOUNT_ID` | Linked Stripe account (optional if only one Stripe account) | Stripe Dashboard | `acct_XXXXXXXXXXXXXXXXX`, nullable |

### 3g. Roku Channel Store (`type: roku`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `ROKU_API_KEY` | Roku Pay API key | Roku Pay Web Services page in Roku Developer Dashboard | Exactly 33 chars, nullable |
| `ROKU_CHANNEL_ID` | Roku channel ID | Roku Channel page in Developer Dashboard | Exactly 6 chars, nullable |
| `ROKU_CHANNEL_NAME` | Display name of your Roku channel | Roku Channel page | 1–30 chars, nullable |

### 3h. Paddle Billing (`type: paddle`)

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `PADDLE_API_KEY` | Paddle Server-side API key | Paddle Dashboard → Developer Tools → Authentication | Exactly 50 chars, nullable |
| `PADDLE_IS_SANDBOX` | Whether to use Paddle sandbox environment | Config choice | `true` / `false` |

---

## 4. Webhook Integration Credentials

When creating webhook integrations (`POST /projects/{project_id}/integrations/webhooks`), you configure an endpoint to receive RevenueCat events.

| Variable | Description | Where to Get It | Format/Notes |
|---|---|---|---|
| `REVENUECAT_WEBHOOK_URL` | Your server's HTTPS endpoint to receive events | Your backend infrastructure | Full HTTPS URL |
| `REVENUECAT_WEBHOOK_AUTH_HEADER` | Optional authorization header for your webhook endpoint | Your backend config | Any secret header value you define |

---

## 5. Runtime Path Parameters (Not Secrets, but Required)

These are IDs you'll obtain from your RevenueCat dashboard or API responses and use in API calls:

| Parameter | Description | Example |
|---|---|---|
| `project_id` | RevenueCat project identifier | `proj1ab2c3d4` |
| `app_id` | RevenueCat app identifier | `app1ab2c3d4` |
| `customer_id` / `app_user_id` | Your user's ID in RevenueCat | `user-1456` (URL-encode before use) |
| `entitlement_id` | Entitlement identifier | `ent12354` |
| `offering_id` | Offering identifier | `ofrng123456789a` |
| `package_id` | Package identifier | — |
| `product_id` | Product identifier | `prod1a2b3c4d5e` |
| `paywall_id` | Paywall identifier | `pwXXXXXXXXXXXXXX` |
| `webhook_integration_id` | Webhook integration ID | — |

---

## 6. Public API Keys (Client-Side)

The endpoint `GET /projects/{project_id}/apps/{app_id}/public_api_keys` manages **public** API keys used in client-side SDKs. These are less sensitive (safe to embed in apps) but still belong to specific apps.

| Variable | Description | Notes |
|---|---|---|
| `REVENUECAT_PUBLIC_API_KEY` | Public key for SDK initialization | Retrieved/managed via this endpoint |

---

## 7. Summary of Services & Integrations

This API spec covers the following external services and integrations:

- **Apple App Store** — iOS/macOS subscription validation, product imports, financial reports
- **Google Play Store** — Android subscription management
- **Amazon Appstore** — Amazon device subscription management
- **Stripe** — Web/desktop payment processing (must be connected to RevenueCat)
- **RevenueCat Web Billing (RC Billing)** — RevenueCat's own web payment flow (Stripe-backed)
- **Roku Channel Store** — Roku device subscription management
- **Paddle Billing** — Paddle-based subscription management (sandbox + production)
- **Webhooks** — Custom HTTP callbacks to your server for subscription events
- **Charts & Metrics** — RevenueCat's analytics and reporting endpoints

---

## 8. Setup Checklist

- [ ] Create a RevenueCat account and project at [app.revenuecat.com](https://app.revenuecat.com)
- [ ] Generate a **V2 Secret API key** with the required permission scopes
- [ ] Note your `project_id` from project settings
- [ ] For each app platform you support, create an App in RevenueCat and supply the relevant store credentials (see Section 3)
- [ ] If using web billing, connect your Stripe account to RevenueCat first
- [ ] Configure webhook endpoint URL if you need real-time subscription events
- [ ] Store all secrets in environment variables — never commit them to source control
- [ ] Use separate API keys per environment (staging vs. production)

---

## 9. References

- RevenueCat API v2 Docs: https://www.revenuecat.com/docs/api-v2
- Authentication Guide: https://www.revenuecat.com/docs/welcome/authentication
- In-App Purchase Key Configuration: https://www.revenuecat.com/docs/in-app-purchase-key-configuration
- RevenueCat Status Page: https://status.revenuecat.com/
- Error Reference: https://errors.rev.cat/
