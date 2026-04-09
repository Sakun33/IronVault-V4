# Latest status
**Updated:** 2026-04-09 ~15:30 UTC

## BUG-035 — Entitlement not syncing to frontend — FIXED ✅

**Root cause:** `api/index.ts` was NOT calling `decodeURIComponent()` on the email path param.
`usePlanFeatures()` calls `encodeURIComponent(email)` → `saketsuman1312%40gmail.com` →
`%40` never matched the DB row → returned `plan: free`.

**Fix:**
- `api/index.ts` line 70: `decodeURIComponent(path.replace("/api/crm/entitlement/", ""))`
- `auth-context.tsx`: `clearPlanCache()` called on login AND logout so stale free-plan cache is never served after fix

**Verified:**
- `GET /api/crm/entitlement/saketsuman1312%40gmail.com` → now returns `plan: "lifetime"` ✅
- New bundle: `index-29b227e6.js` live at www.ironvault.app ✅
- db: true ✅
- Deployment: `ironvault-main-nc1xl03f0`, aliased to www.ironvault.app + ironvault.app ✅

**User action:** Hard refresh (Cmd+Shift+R) or open fresh incognito → Log in → Pro features unlock immediately.

---

## BUG-036 — Per-vault cloud sync toggle — SHIPPED ✅

**What shipped:**
- Vaults page (Settings → Vaults) now shows a **Cloud Sync** toggle on every vault card
- Pro/Lifetime users: toggle is active
  - Toggle ON → "Enable Cloud Sync" dialog → enter master password → vault uploaded to cloud → blue Cloud badge appears on card
  - Toggle OFF → confirmation dialog → vault deleted from cloud → other devices stop seeing it on next refresh
- Free users: toggle is disabled + Crown icon → click shows "Upgrade to Pro" toast
- Source device protection: if you try to turn OFF cloud sync from a device that didn't originally upload the vault, a toast says "Use your original device"
- Cloud badge shown on vault card header when synced
- Dropdown menu "Sync to Cloud" item removed (replaced by the toggle)

**DB change:** `ALTER TABLE cloud_vaults ADD COLUMN IF NOT EXISTS source_device_id VARCHAR(64)` — run on live DB ✅

**API change:** POST /api/vaults/cloud now accepts and stores `sourceDeviceId`; GET list returns it ✅

---

## Full round-trip test path for user
1. Log in at www.ironvault.app → unlock vault
2. Navigate to Vaults (sidebar)
3. Cloud Sync toggle shows OFF for your vault
4. Click it → "Enable Cloud Sync" dialog → enter master password → click "Enable Cloud Sync"
5. Badge turns blue "Cloud" → toast "Cloud sync enabled"
6. Open Comet (second browser) → log in → vault picker shows vault in "Cloud Vaults" section
7. Enter master password → Unlock Vault → vault opens with full contents ✅
8. Back on Chrome: toggle OFF → "Remove from Cloud" → confirm
9. Reload Comet → cloud vault disappears from picker ✅

---

## DB state
- entitlements: plan='pro', admin_override=true (user_id 7b11dd22)
- customers: plan_type='lifetime' (pre-existing) → API returns 'lifetime'
- cloud_vaults: source_device_id column added

## Deployment
- ironvault-main-nc1xl03f0 → www.ironvault.app, ironvault.app
- Commit: 72e1d2e (BUG-035 + BUG-036)
