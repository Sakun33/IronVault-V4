# Latest status
**Updated:** 2026-04-09 ~14:55 UTC

## Login — CONFIRMED WORKING ✅
- saketsuman1312@gmail.com / 12121212 → login confirmed by user ✅
- BUG-034 CLOSED

## Pro Plan Upgrade — DONE ✅
- entitlements.plan updated to 'pro' for user_id 7b11dd22-e6c7-4a05-8c12-c62f131bd610
- NOTE: customers.plan_type was already 'lifetime' — user already had max-tier entitlements
- entitlement API (/api/crm/entitlement/saketsuman1312@gmail.com) returns plan: "lifetime"
- license-context.tsx syncFromServer() will sync tier to 'lifetime' on next vault unlock
- Cloud sync is enabled: license.tier !== 'free' → cloud vault section visible in vault picker

## Cloud Sync API Dry-Run — ALL LEGS PASS ✅
Tested against live https://www.ironvault.app with real JWT token for saketsuman1312@gmail.com:

| Step | Result |
|------|--------|
| POST /api/vaults/cloud (upload) | 201 Created, vault stored ✅ |
| GET /api/vaults/cloud (list) | Returns vault in array ✅ |
| GET /api/vaults/cloud/:id (download) | Returns full encryptedBlob ✅ |
| DELETE /api/vaults/cloud/:id (cleanup) | 200 OK ✅ |
| Plan gate check (entitlements.plan='pro') | Passed, no 403 ✅ |

## How to upload local vault to cloud (exact UI path)
**Preconditions:** Logged in + vault unlocked (Pro/Lifetime plan already active for user)

1. Log in at www.ironvault.app → enter email/password → Sign In
2. On vault picker: enter master password for local vault → click Unlock Vault → vault opens
3. In the main app sidebar, click **Vaults** (shield icon)
4. On the Vaults page, find your vault card → click **⋮ (three-dot menu)**
5. Click **"Sync to Cloud"**
6. Dialog prompts for master password → enter it → click **"Sync to Cloud"**
7. Toast: "Vault synced" confirms upload

**After upload, on a second browser (Comet):**
1. Log in with same account credentials
2. Vault picker shows **"Cloud Vaults"** section with a 🔵 Cloud badge
3. Enter master password → click **"Unlock Vault"** → vault downloads and opens
4. Contents are present

## Cross-browser test readiness
- Server API: all CRUD operations confirmed working ✅
- Plan gate: passed (no 403) ✅
- Bundle: includes full cloud sync code ✅
- License tier: 'lifetime' will sync on vault unlock ✅
- CAVEAT: Chrome in Chrome extension is offline — cannot do full browser UI dry-run.
  API-level dry-run is complete. User should follow the 7-step path above.

## DB state
- crm_users: saketsuman1312@gmail.com, id=7b11dd22
- entitlements: plan='pro', status='active', admin_override=true
- customers: plan_type='lifetime' (pre-existing)
- cloud_vaults: 0 rows (test vault cleaned up)
