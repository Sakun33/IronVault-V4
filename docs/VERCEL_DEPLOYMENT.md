# Vercel Deployment Guide

## Prerequisites
- Vercel account at vercel.com
- GitHub repo connected: github.com/ByteBookPro/ironvault-app

## Deploy Main App (Backend + Frontend)

1. Go to vercel.com → "Add New Project"
2. Import `ByteBookPro/ironvault-app`
3. Framework: Other
4. Root Directory: `.` (root of repo)
5. Build Command: `npm run build:prod`
6. Output Directory: `dist/public`
7. Install Command: `npm install --legacy-peer-deps`
8. Add Environment Variables (from .env.production.example)
9. Click Deploy

## Deploy Admin Console (CRM)

1. Go to vercel.com → "Add New Project" again
2. Import same repo `ByteBookPro/ironvault-app`
3. Root Directory: `admin-console`
4. Configure as per admin-console/vercel.json
5. Add admin-specific environment variables
6. Click Deploy

> **Note:** The admin console backend (`server-simple-working.ts`) uses file-system
> storage (`data/admin-data.json`). Vercel's serverless filesystem is ephemeral, so
> data will not persist between function invocations. Migrate to a database
> (Supabase/Postgres) before going to production with the admin console.

## After Deployment

- Set `FRONTEND_URL` env var to your main Vercel URL
- Set `ADMIN_CONSOLE_URL` env var to your admin Vercel URL
- Add both Vercel URLs to Supabase allowed origins
- Update Stripe webhook endpoint to `https://your-app.vercel.app/api/webhooks/stripe`

## Stripe Webhook Setup

Stripe webhooks require the raw request body for signature verification. Make sure
the `/api/stripe/webhook` route uses `express.raw()` instead of `express.json()`.
Add this in `server/routes.ts` before mounting the stripe router:

```typescript
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
```

## GitHub Secrets for CI/CD Auto-Deploy

Add to repo → Settings → Secrets:
- `VERCEL_TOKEN` — from vercel.com/account/tokens
- `VERCEL_ORG_ID` — from vercel.com/account (team settings)
- `VERCEL_BACKEND_PROJECT_ID` — from Vercel project settings
- `VERCEL_ADMIN_PROJECT_ID` — from admin Vercel project settings
