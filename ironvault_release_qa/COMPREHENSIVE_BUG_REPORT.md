# IronVault Comprehensive Bug Report
**Date:** 2026-04-17  
**Branch:** claude/xenodochial-mendeleev  
**QA Round:** Phase 2–9 (comprehensive automated + live browser)  
**Previous session bugs:** BUG-001 through BUG-046

---

## NEW BUGS (this session)

---

### BUG-047 — No Delete Confirmation for Passwords
**Severity:** MEDIUM  
**Status:** OPEN  
**Page:** /passwords  
**Reported:** 2026-04-17

**Description:**  
Clicking the delete button (`data-testid="delete-password-{id}"`) on a password card immediately deletes the entry with no confirmation dialog. A "Password deleted successfully" toast appears but there is no "Are you sure?" step.

**Steps to reproduce:**
1. Navigate to /passwords (vault unlocked)
2. Hover over any password card
3. Click the trash/delete icon
4. Password is immediately deleted — no confirmation

**Expected:** Confirmation dialog ("Delete this password? This cannot be undone.") before deletion.  
**Actual:** Immediate deletion with only a success toast.

**Impact:** Accidental deletions are irrecoverable (no trash/undo). Users could lose important credentials.

**Fix suggestion:** Add an AlertDialog confirmation step in `passwords.tsx` before calling `deletePassword()`. Pattern already exists in other entities (e.g., notes uses `deleteNoteTarget` state for confirmation).

---

### BUG-048 — /goals Route Has No "Add Goal" Button
**Severity:** LOW  
**Status:** OPEN  
**Page:** /goals  
**Reported:** 2026-04-17

**Description:**  
Navigating directly to `/goals` renders a Goal list view with search/filter controls but no way to create a new goal. The "Add Goal" functionality is only accessible from `/investments` via the "Goals" tab inside that page.

**Steps to reproduce:**
1. Navigate to /goals
2. Look for any "Add Goal" / "New Goal" / "Create Goal" button
3. No such button exists

**Expected:** `/goals` should have an "Add Goal" button or at minimum a link to create goals.  
**Actual:** Only filters, search, and the existing goal list are shown.

**Note:** The sidebar links to `/investments` for "Investment / Goals" — the `/goals` route appears to be a standalone sub-page without full CRUD. This is a navigation/UX inconsistency.

**Fix suggestion:** Either add an "Add Goal" button to the `/goals` page that opens the investment goal creation modal, or redirect the sidebar "Investment / Goals" link to `/investments?tab=goals`.

---

### BUG-049 — Investment Form Save Fails Silently / "Encryption Key Not Set"
**Severity:** HIGH  
**Status:** OPEN  
**Page:** /investments  
**Reported:** 2026-04-17

**Description:**  
On the `/investments` page, the "Add Investment" form fills and submits without error UI, but the investment is not saved. The console shows:

```
[ERROR] Failed to load license: Error: Encryption key not set
    at i7.getPersistentData
    at license-context
```

This error fires twice on page load. The license context fails to read from `persistent_data` (which is encrypted), likely because the encryption key is not available when the license context initializes on this page. This may cause the investment save handler to fail silently (possibly blocked by a license/feature gate that returns a falsy value due to the failed license load).

**Steps to reproduce:**
1. Unlock vault (any vault)
2. Navigate to /investments via SPA navigation
3. Click "Add Investment"
4. Fill: Investment Name, Type (Fixed Deposit), Institution, Amount, Date
5. Click "Add Investment" submit button
6. Form stays open — no success toast, no error toast
7. Check console → "Failed to load license: Error: Encryption key not set"

**Expected:** Investment saved to IndexedDB with "Investment added" success toast.  
**Actual:** Silent failure — form stays open, no feedback, nothing saved.

**Root cause analysis:**  
The `license-context` calls `getPersistentData('iv_plan_cache')` (or similar) during its initialization effect. If `VaultStorage.encryptionKey` is null at that moment (race condition between license-context mount and vault unlock propagation), the call fails. The failed license load causes `usePlanFeatures()` to return falsy feature flags, potentially gating `saveInvestment()` behind a feature check that fails.

**Fix suggestion:**  
1. In `license-context`: add a guard — only call `getPersistentData` when `storage.isInitialized()` AND `storage.encryptionKey !== null`. Listen for `vault:unlocked` event before attempting the read.
2. In the investment save handler: log the error clearly and show a user-facing error toast rather than failing silently.
3. Check if `AddInvestmentModal` has a feature gate that returns early when `isPaid === false` (due to failed license load).

---

### BUG-050 — Stored XSS in Support Ticket API
**Severity:** HIGH (Security)  
**Status:** OPEN  
**Endpoint:** `POST /api/crm/tickets`  
**Reported:** 2026-04-17

**Description:**  
The `/api/crm/tickets` endpoint accepts arbitrary HTML including `<script>` tags in the `description` field and stores them verbatim in the database without sanitization. The raw script tag is returned in API responses.

**Proof of concept:**
```bash
curl -X POST https://www.ironvault.app/api/crm/tickets \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","subject":"XSS","description":"<script>alert(document.cookie)</script>","priority":"low"}'
```
Response confirms storage of raw `<script>` tag.

**Impact:**  
If ticket data is ever rendered in an admin interface, customer portal, or email as HTML (innerHTML), the stored script will execute in the viewer's browser. This could lead to:
- Session hijacking
- Credential theft
- Admin account compromise

**Fix (server-side):** Sanitize all user input fields before DB insertion. Use a server-side HTML sanitization library (e.g., `sanitize-html` or `DOMPurify` on the server). At minimum, strip `<script>`, `<img onerror>`, `<svg onload>` and other XSS vectors.

**Fix (rendering):** Ensure ticket descriptions are always rendered as plain text (`.textContent`, not `.innerHTML`) in any UI that displays them.

---

### BUG-051 — Overly Permissive CORS (allow-origin: *)
**Severity:** MEDIUM (Security)  
**Status:** OPEN  
**Endpoint:** All `/api/*` endpoints  
**Reported:** 2026-04-17

**Description:**  
All API endpoints return `Access-Control-Allow-Origin: *`, allowing any domain to make cross-origin requests. While authenticated cloud vault endpoints are protected by Bearer token, several sensitive unauthenticated endpoints are freely accessible from any origin:

- `GET /api/crm/entitlement/:userId` — leaks plan details for any user ID/email
- `GET /api/crm/tickets/:email` — exposes support ticket history for any email
- `GET /api/crm/family-invites/:email` — exposes family invite status for any email
- `POST /api/crm/register` — allows cross-origin customer registration
- `POST /api/crm/tickets` — allows cross-origin ticket creation (combined with BUG-050: XSS)

**Impact:**  
A malicious site can make JavaScript `fetch()` calls to these endpoints to enumerate customer plan data, ticket history, and family relationship data for any known email address.

**Fix:** Restrict `Access-Control-Allow-Origin` to specific allowed origins:
```
Access-Control-Allow-Origin: https://www.ironvault.app
Access-Control-Allow-Origin: https://ironvault.app
```
Or use an allowlist check in `api/index.ts`:
```js
const allowed = ['https://www.ironvault.app', 'https://ironvault.app'];
const origin = req.headers.origin;
if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
```

---

## BUG SUMMARY TABLE

| ID | Title | Severity | Status | Page/Endpoint |
|----|-------|----------|--------|---------------|
| BUG-047 | No delete confirmation for passwords | MEDIUM | OPEN | /passwords |
| BUG-048 | /goals route missing Add Goal button | LOW | OPEN | /goals |
| BUG-049 | Investment save fails silently — Encryption key not set | HIGH | OPEN | /investments |
| BUG-050 | Stored XSS in ticket description field | HIGH (Security) | OPEN | POST /api/crm/tickets |
| BUG-051 | CORS allow-origin: * on all endpoints | MEDIUM (Security) | OPEN | All /api/* |

---

## BUGS FROM USER DEVICE TESTING (2026-04-19, Android PWA)

| ID | Title | Severity | Status | Fix |
|----|-------|----------|--------|-----|
| BUG-066 | Weak password not detected in dashboard | MEDIUM | FIXED | Calculate strength via PasswordGenerator.calculateStrength per password |
| BUG-067 | Audit entries duplicated in activity log | MEDIUM | FIXED | Dedup window: skip identical action+description logged within 5 s |
| BUG-068 | Imported data lost after app reopens (cloud vault) | HIGH | FIXED | Dispatch vault:item:saved after importVault/importPasswordsFromCSV to trigger cloud push |
| BUG-069 | Two X close buttons overlapping on sheets | MEDIUM | FIXED | Added hideClose prop to SheetContent; MobileSheet passes hideClose=true |
| BUG-070 | No back navigation on inner pages (Android PWA) | HIGH | FIXED | ChevronLeft back button in mobile header on inner pages; Capacitor backButton handler |

---

## PRE-EXISTING OPEN BUGS (from prior sessions, still unverified on device)

| ID | Title | Status |
|----|-------|--------|
| BUG-046 | Android safe areas / edge-to-edge | APK built, device install pending |
| BUG-042 | Android dialog overflow (svh) | APK built, device install pending |
| BUG-045 | Profile not opening on Android | APK built, device install pending |

---

## OBSERVATIONS (not bugs, but worth noting)

| Item | Observation |
|------|-------------|
| Google Analytics | region1.google-analytics.com returning 503 — analytics data not being collected |
| Family vault key sharing | Manual only — no cryptographic key exchange implemented (documented limitation) |
| Investment form UX | Requires Institution field which is not clearly marked as required until save attempt |
| Currency inconsistency | Investment page shows $ (USD) while expenses shows ₹ (INR) — may be by design (different currency contexts) |
| Biometric (Capacitor 7 compat) | capacitor-native-biometric@4.2.2 built for Capacitor 4/5; compat with Capacitor 7 unverified |
