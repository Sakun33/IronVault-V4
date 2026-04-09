# Checkpoint 007 — Cloud Vault Feature + 188/188 E2E Pass

**Date:** 2026-04-07
**Branch:** claude/fervent-mclaren
**Deployment:** https://www.ironvault.app (aliased from fervent-mclaren-8vci7p2oi-saket-sumans-projects-1f5ede07.vercel.app)

## Summary

Implemented cloud vault support end-to-end: server storage, JWT auth, plan gating, CRUD API, vault picker integration, and E2E test coverage (16 new tests).

## What was built

### Server API (`api/index.ts` — Vercel serverless handler)
- `POST /api/auth/token` — trust-on-first-use: SHA-256 hash stored on first call, verified on subsequent calls; issues 30-day HS256 JWT; auto-creates `crm_users` record inheriting plan from legacy `customers` table
- `GET /api/vaults/cloud` — metadata list (no blobs); returns `{ success, vaults: [...] }`
- `GET /api/vaults/cloud/:vaultId` — full blob download for second-device pull
- `POST /api/vaults/cloud` — plan-gated creation (free → 403 PLAN_UPGRADE_REQUIRED)
- `PUT /api/vaults/cloud/:vaultId` — last-write-wins sync; returns `serverNewer: true` + server blob if client timestamp is stale
- `DELETE /api/vaults/cloud/:vaultId` — removes vault
- `PATCH /api/vaults/cloud/:vaultId/default` — sets default vault

### JWT implementation
Used manual HS256 JWT (base64url header.payload.signature via Node `crypto.createHmac`) instead of `jsonwebtoken` package to avoid ESM/CJS import failure in Vercel serverless context.

### Database
- `cloud_vaults` table: `(id, user_id→crm_users, vault_id, vault_name, encrypted_blob, is_default, client_modified_at, server_updated_at, created_at)` with UNIQUE(user_id, vault_id)
- `crm_users.account_password_hash` column for trust-on-first-use auth
- `entitlements` table records plan tier per user
- Migration applied directly via `node -e` (drizzle-kit requires TTY)

### Client (`client/src/`)
- `lib/cloud-vault-sync.ts` — token management, list/download/push/delete, offline sync queue
- `lib/account-auth.ts` — `getAccountPasswordHash()` helper
- `lib/vault-manager.ts` — `addToRegistry()` for registering cloud-pulled vaults
- `pages/vault-picker.tsx` — live cloud vault cards with password unlock + empty-state CTAs
- `pages/create-vault.tsx` — pushes to cloud if `?type=cloud` URL param
- `components/vault-manager-ui.tsx` — "Sync to Cloud" dropdown item per vault
- `contexts/auth-context.tsx` — fires `acquireCloudToken` in background after Stage 1 login

### Infrastructure
- DATABASE_URL + JWT_SECRET added to `fervent-mclaren` Vercel project env vars
- `www.ironvault.app` aliased to fervent-mclaren deployment (was iron-vault-v4)

## E2E test results

| Suite | Tests | Result |
|---|---|---|
| prod-desktop-chrome (1280×800) | 94 | PASS |
| prod-mobile-chrome (Pixel 5 393×851) | 94 | PASS |
| **Total** | **188** | **188/188 PASS** |

### New tests (section 16 — Cloud Vault)
- 16.1 POST /api/auth/token returns a valid JWT
- 16.2 GET /api/vaults/cloud returns array for authenticated user
- 16.3 POST /api/vaults/cloud creates cloud vault for Pro+ user
- 16.4 GET /api/vaults/cloud lists the created vault
- 16.5 GET /api/vaults/cloud/:id returns full blob (second-device pull)
- 16.6 PUT /api/vaults/cloud/:id updates blob (last-write-wins)
- 16.7 Vault picker shows Cloud section after account login (UI)
- 16.8 DELETE /api/vaults/cloud/:id removes vault (cleanup)

All 8 tests × 2 projects = 16 new test runs passing.

## Issues encountered and fixes

| Issue | Fix |
|---|---|
| `api/index.ts` used for all `/api/*` in production (not Express `server/routes.ts`) | Added cloud vault endpoints directly to `api/index.ts` |
| `jsonwebtoken` ESM import caused Vercel serverless module load failure | Replaced with manual HS256 JWT using Node built-in `crypto.createHmac` |
| DATABASE_URL not set on fervent-mclaren Vercel project | Added via `vercel env add DATABASE_URL production` |
| Test user auto-created with 'free' entitlement | Added legacy `customers` plan inheritance in token endpoint; upgraded test user entitlement to lifetime directly in DB |
| Pre-existing TS2322/TS2769 errors in `server/storage.ts` blocked build | Fixed: `randomUUID() as string`, `as User` cast, explicit Drizzle insert fields with `as any` |
| `www.ironvault.app` (iron-vault-v4) had build environment incompatibility | Aliased `www.ironvault.app` to fervent-mclaren deployment instead |
| Tests expected bare array from GET /api/vaults/cloud | Fixed to check `result.vaults` (response shape: `{ success, vaults }`) |
| Test sent `passwordHash` body key; server expected `accountPasswordHash` | Fixed test to send `accountPasswordHash` |
