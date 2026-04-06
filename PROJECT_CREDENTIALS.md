# IronVault — Project Credentials & Configuration

> Last updated: 2026-04-06

## Production URLs

| Service | URL | Status |
|---------|-----|--------|
| Main App (Web) | https://www.ironvault.app | Pending domain transfer |
| Main App (Vercel) | https://ironvault-steel.vercel.app | Live |
| API Health | https://ironvault-steel.vercel.app/api/health | Live |
| Admin Console | TBD (separate deployment) | Pending |

## Local Development URLs

| Service | URL | How to Start |
|---------|-----|-------------|
| Main App | http://localhost:5001 | `npm run dev` |
| Admin Backend | http://localhost:3001 | `PORT=3001 npx tsx admin-console/backend/server-simple-working.ts` |
| Admin Frontend | http://localhost:5174 | `cd admin-console/frontend && npx vite --port 5174` |
| Android Emulator | http://10.0.2.2:5001 | `CAPACITOR_SERVER_URL="http://10.0.2.2:5001" npx cap sync android` |

## Admin Console Credentials

| Field | Value |
|-------|-------|
| Username | admin |
| Password | admin123 |
| NOTE | In production, set ADMIN_USERNAME and ADMIN_PASSWORD env vars |

## Test Vault

| Field | Value |
|-------|-------|
| Master Password | 12121212 |
| NOTE | This is for local testing only |

## Database (Local Dev)

| Field | Value |
|-------|-------|
| Host | localhost |
| Port | 5432 |
| Database | ironvault |
| User | bytebook |
| Password | (none — local dev) |
| URL | postgresql://bytebook@localhost:5432/ironvault |

## GitHub

| Field | Value |
|-------|-------|
| Repo | https://github.com/Sakun33/IronVault-V4 |
| Account | Sakun33 (also ByteBookPro) |
| Email | saketsuman1312@gmail.com |
| Latest Tag | v1.0.0 |

## Vercel

| Field | Value |
|-------|-------|
| Project | ironvault |
| Team | saket-sumans-projects-1f5ede07 |
| Deploy URL | https://ironvault-steel.vercel.app |
| Custom Domain | https://www.ironvault.app (pending transfer) |
| Old Project | iron-vault-v4 (needs domain removed) |

## Android App

| Field | Value |
|-------|-------|
| Package Name | com.ironvault.app |
| App Name | IronVault |
| Min SDK | 24 (Android 7.0) |
| Target SDK | 35 |
| Compile SDK | 35 |
| Capacitor | 7 |
| Debug APK | android/app/build/outputs/apk/debug/app-debug.apk (7.4 MB) |
| Release AAB | android/app/build/outputs/bundle/release/app-release.aab (5.7 MB) |

## Lifetime Pro Users

| Email | Plan | Set By |
|-------|------|--------|
| saketsuman33@gmail.com | lifetime | Admin console |

## Third-Party Services (Need Configuration for Production)

| Service | Env Vars | Dashboard |
|---------|----------|-----------|
| Supabase | SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY | https://supabase.com/dashboard |
| Stripe | STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET | https://dashboard.stripe.com/apikeys |
| RevenueCat | VITE_REVENUECAT_API_KEY_IOS, VITE_REVENUECAT_API_KEY_ANDROID | https://app.revenuecat.com |

## All Environment Variables

| Variable | Purpose | Required For |
|----------|---------|-------------|
| PORT | Server port (default 5001) | Optional |
| NODE_ENV | development / production | Optional |
| DATABASE_URL | PostgreSQL connection string | Cloud DB |
| JWT_SECRET | Signs JWT tokens | Production |
| SESSION_SECRET | Express session encryption | Production |
| ADMIN_SECRET_KEY | Admin console auth | Production |
| CRM_API_KEY | CRM endpoint auth header | Production |
| ADMIN_CONSOLE_URL | Admin console backend URL | CRM forwarding |
| ADMIN_USERNAME | Admin login username | Production |
| ADMIN_PASSWORD | Admin login password | Production |
| STRIPE_SECRET_KEY | Stripe API secret | Billing |
| STRIPE_PUBLISHABLE_KEY | Stripe public key | Billing |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signature | Billing |
| SUPABASE_URL | Supabase project URL | Cloud DB |
| SUPABASE_ANON_KEY | Supabase public key | Cloud DB |
| SUPABASE_SERVICE_ROLE_KEY | Supabase admin key | Cloud DB |
| VITE_REVENUECAT_API_KEY_IOS | RevenueCat iOS key | Mobile IAP |
| VITE_REVENUECAT_API_KEY_ANDROID | RevenueCat Android key | Mobile IAP |
| CAPACITOR_SERVER_URL | Dev server URL for emulator | Android dev |

## DevOps Automation

| Task | Schedule | Script | Output |
|------|----------|--------|--------|
| Backup + Git Push | 11:00 PM daily | ~/DevOps/scripts/daily_backup.sh | ~/Desktop/Backups/ |
| Changelog | 9:00 PM daily | ~/DevOps/scripts/generate_changelog.sh | ~/Desktop/ProjectDocs/changelogs/ |
| Security Audit | 8:00 AM daily | ~/DevOps/scripts/security_audit.sh | ~/Desktop/ProjectDocs/security/ |

## Key Commands

```bash
# === Local Development ===
npm run dev                                          # Main app on :5001
npm run admin:start                                  # Admin backend on :3001
cd admin-console/frontend && npx vite --port 5174    # Admin frontend on :5174

# === Android Build ===
npm run build
CAPACITOR_SERVER_URL="http://10.0.2.2:5001" npx cap sync android
cd android && ./gradlew assembleDebug && cd ..

# === Deploy to Emulator ===
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.ironvault.app/.MainActivity

# === Deploy to Vercel ===
npx vercel --prod --yes --archive=tgz

# === Start Android Emulator ===
$ANDROID_HOME/emulator/emulator -avd Pixel_7 -no-snapshot -gpu host &

# === New Project (DevOps) ===
~/DevOps/scripts/init_project.sh MyNewProject
```

## Subscription Plans

| Plan | Price (INR) | Limits |
|------|-------------|--------|
| Free | ₹0 | 50 passwords, 5 notes, 10 reminders, 1 vault |
| Pro | ₹199/mo or ₹1,999/yr | Unlimited everything, 5 vaults |
| Family | ₹299/mo or ₹2,999/yr | Pro + 6 members, shared vaults |
| Lifetime | ₹9,999 one-time | Same as Pro, forever |

## 10 App Themes

Ocean Blue (default), Forest Green, Sunset Amber, Rose Quartz, Royal Purple, Arctic Teal, Midnight, Warm Earth, Sakura, Monochrome
