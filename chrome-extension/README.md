# IronVault Chrome Extension

Chrome extension for IronVault that adds two features to the browser:

1. **Autofill** — detects login forms, matches them against credentials in
   your IronVault vault by domain, and fills the username/password with one
   click.
2. **Guided import** — opens `chrome://settings/passwords`, watches your
   downloads folder for the resulting CSV, and offers to upload it to your
   vault.

The extension is **zero-knowledge**: your master password never leaves the
browser. The vault blob is fetched from `api.ironvault.app` already
encrypted, and decrypted locally inside the extension's service worker.

## Project layout

```
chrome-extension/
├── manifest.json       # Manifest V3
├── background.js       # Service worker — auth, vault sync, decryption,
│                       #   message router, downloads watcher
├── popup.html          # Toolbar popup UI
├── popup.css
├── popup.js            # Sign-in form + quick actions
├── content.js          # Injected on every page — detects login forms
│                       #   and renders the IronVault badge / picker
├── content.css
└── icons/              # 16 / 32 / 48 / 128 px PNG plus source SVG
```

## Build & install (development)

There's no build step — the extension runs as plain ES modules.

1. Clone the repo, then in Chrome go to `chrome://extensions`.
2. Toggle **Developer mode** on (top right).
3. Click **Load unpacked**.
4. Select this `chrome-extension/` directory.
5. Pin the IronVault icon to the toolbar (puzzle-piece menu → pin).

To reload after editing a file, click the ↻ button on the extension's card
in `chrome://extensions`. Reload the page you're testing on too — the
content script only re-injects on a fresh navigation.

## How sign-in works

The popup collects three values:

- **Email** + **account password** — sent to `POST /api/auth/token` to get
  a JWT.
- **Master password** — used locally to decrypt the encrypted vault blob.
  Never sent to the server.

The extension then calls `GET /api/vaults/cloud` to find the user's default
vault, downloads the encrypted blob from `GET /api/vaults/cloud/:vaultId`,
and decrypts it with the master password. The decrypted entry list is
cached in `chrome.storage.local` for fast lookup; the master password is
stored alongside it so the extension can re-sync on demand without
prompting.

To wipe everything: open the popup → **Sign out**.

## How autofill works

`content.js` runs on every page (`<all_urls>`):

1. On `focusin`, it locates `input[type=password]` fields.
2. It asks the background worker for credentials matching
   `location.hostname` (and parent domains).
3. If matches exist, a small **IV** badge appears next to the password
   field.
4. Clicking the badge opens a picker; clicking an entry fills both the
   username and password fields, dispatching `input` and `change` events
   so React/Vue listeners pick up the new value.

Matching is suffix-based: a credential saved for `example.com` will fill
on `app.example.com`. Cross-domain credentials are *not* surfaced to keep
zero-knowledge guarantees against a malicious page.

## How the import flow works

1. The user clicks **Import from Chrome** in the popup.
2. The extension opens a new tab to `chrome://settings/passwords` and
   begins watching `chrome.downloads.onChanged`.
3. When a file matching `*passwords*.csv` finishes downloading, a
   notification fires: "Chrome passwords detected".
4. The user opens the IronVault dashboard (or popup) and uploads the CSV
   through the standard guided-import flow on the web app.

> **Note**: Chrome's CSV export is *plaintext*. Delete it from your
> downloads folder once the import completes.

## Security notes

- All network calls are TLS-only and target `https://www.ironvault.app`.
- The master password is held in `chrome.storage.local`. Chrome encrypts
  this at rest using the OS keychain, but a user with full filesystem
  access could decrypt it. If you'd rather not persist it, sign out at the
  end of each session — the popup re-prompts on next use.
- Decryption uses Web Crypto's AES-GCM + PBKDF2 (250k iterations,
  SHA-256). Compatible with the IronVault web app's vault format.
- The extension does not request `tabs` permission — it uses
  `activeTab` + `scripting` only when you explicitly trigger an action.

## Roadmap

- Save-new-credential prompt when filling a brand-new login form.
- Biometric unlock via WebAuthn instead of master password.
- Per-domain ignore list.
- Auto-resync on a 15-minute timer.

## API endpoints used

| Method | Path | Purpose |
| ------ | ---- | ------- |
| POST   | `/api/auth/token` | Sign in, returns JWT. |
| GET    | `/api/vaults/cloud` | List the user's cloud vaults. |
| GET    | `/api/vaults/cloud/:id` | Fetch the encrypted vault blob. |
| GET    | `/api/vault/autofill` | Convenience endpoint that returns the encrypted blob for the default vault — same data as `/api/vaults/cloud/:id` but doesn't require listing first. |
