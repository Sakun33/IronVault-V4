# IronVault — Secure Autofill (Chrome Extension)

Zero-knowledge browser extension that fills passwords from your IronVault
encrypted vault on any website. The vault never leaves your IronVault account
unencrypted — the extension fetches the same end-to-end encrypted blob the
mobile/web app uses, decrypts it locally with your master password, and only
ever exposes one credential at a time.

## Install (developer / unpacked)

1. Download or clone this folder (`chrome-extension/`) to your computer.
2. Open `chrome://extensions` in Chrome (or any Chromium browser).
3. Toggle **Developer mode** (top-right).
4. Click **Load unpacked** and pick this folder.
5. Pin the IronVault icon to the toolbar.

The extension requires Chrome 116+ (Manifest V3, modular service worker).

## How to use

1. Click the IronVault toolbar icon.
2. Sign in with:
   - your **IronVault account email + account password** (same one you use on
     the web/mobile app), and
   - the **master password** for the vault you want to unlock.
3. If your account has multiple cloud-synced vaults, pick one.
4. The popup shows a list of saved logins. Use the search box to filter.
5. **👁 reveal** shows a password for 5 seconds. **⎘ copy** copies it (auto-clears
   from clipboard after 30s).
6. On any login form, the **🛡 IronVault badge** appears next to the password
   field. Click it → pick a credential → it autofills both username and password.

## Security model

- **End-to-end encrypted at rest and in transit.** The cloud server only stores
  the same `{ salt, iv, data }` AES-GCM blob produced by the IronVault app
  (PBKDF2-HMAC-SHA256, 600 000 iterations → 256-bit key). The server never sees
  your master password.
- **Master password is never stored.** It's used to derive the AES-GCM master
  key once at unlock, and immediately discarded.
- **Per-session re-wrap.** After the cloud blob is decrypted, every individual
  password is re-encrypted with a freshly-generated session AES-GCM key. Only
  metadata (id, name, url, username, domain) lives in the clear in the
  extension's session memory.
- **One credential at a time.** A password is only decrypted in response to an
  explicit user gesture (reveal-eye, copy, or in-page picker click) — and only
  the requested credential ever crosses to the popup or content script. The
  full vault is never reconstructed.
- **Browser-isolated session storage.** State lives in `chrome.storage.session`
  — held in browser memory, never written to disk, automatically wiped when
  the browser closes.
- **Auto-lock.** Configurable in Settings (default 5 min, range 1–120). A
  background alarm checks `lastActivity` every minute and wipes session state
  on timeout.
- **No `eval`, no inline scripts.** CSP is `script-src 'self'; object-src 'self'`.
- **Minimum permissions.** `storage`, `activeTab`, `alarms`, plus host
  permissions only for `ironvault.app` (so we can call the auth and vault APIs).
  No `<all_urls>` host permission — content-script matches give access without
  granting cross-origin fetch.
- **Content scripts get only one credential.** Domain-matched lookups are done
  in the background using `sender.tab.url` (so a hostile page can't lie about
  its origin); only the picked credential is sent to the page.

## Architecture

```
chrome-extension/
├─ manifest.json          MV3 manifest, minimum permissions
├─ background.js          Service worker — auth + decrypt + state + auto-lock
├─ popup.html             Login → vault list → settings (modules)
├─ popup.css
├─ popup.js               Renders state, forwards user actions to background
├─ content.js             Detects login forms, shows IronVault badge
├─ content.css            Badge + picker styles (prefixed iv-autofill-*)
├─ lib/
│  ├─ crypto.js           PBKDF2 + AES-GCM + b64 (byte-compatible w/ web)
│  └─ api.js              authToken, listCloudVaults, downloadCloudVault
└─ icons/                 16/32/48/128
```

### Message types (popup ↔ background ↔ content)

| Type                   | From    | Notes                                           |
|------------------------|---------|-------------------------------------------------|
| `STATUS`               | popup   | Returns unlock state + remembered email.        |
| `LOGIN`                | popup   | `{email, accountPassword, masterPassword, vaultId?}`. |
| `LOCK`                 | popup   | Wipe session storage.                           |
| `SEARCH`               | popup   | Filtered metadata-only list.                    |
| `GET_DOMAIN_MATCHES`   | content | Origin from `sender.tab.url`, never trusted.    |
| `GET_PASSWORD_FOR_FILL`| both    | Decrypts ONE entry. Caller drops it after use.  |
| `GET_SETTINGS` / `SET_AUTOLOCK` | popup | Auto-lock minutes (1–120).             |

## What's NOT in this version

- **Biometric / WebAuthn unlock.** Designed but deferred to v1.1. The plan is
  a `navigator.credentials.create({ userVerification: 'required',
  authenticatorAttachment: 'platform' })` flow, with the master-password-derived
  key wrapped under a Chrome-protected secret that biometric verification
  gates access to. Not shipped here because it adds substantial cross-platform
  testing surface; password unlock works on every Chromium browser today.
- **Saving new passwords from the page.** The extension is read-only for now.
  Use the IronVault app to add or edit entries; they sync to the extension
  next time you re-unlock.

## Verifying byte-compatibility with the web app

The extension's `lib/crypto.js` is intentionally a slim re-implementation of
`client/src/lib/crypto.ts`:

- PBKDF2 iterations: **600 000** (matches `KDF_PRESETS.standard`)
- Hash: **SHA-256**
- Salt: **16 bytes** (matches `generateSalt`)
- IV: **12 bytes** (matches `generateIV`)
- Wire format: `JSON.stringify({ version: 2, salt: b64, iv: b64, data: b64 })`
  — exactly what `VaultStorage.exportVault()` produces.

Any vault exported by the IronVault web/mobile app and synced to the cloud is
decryptable by this extension with the same master password, and vice versa.
