# iOS Extensions — Widget + AutoFill

This directory contains the **Swift source + Info.plist + entitlements** for
two iOS app extensions that ship alongside the Capacitor host app:

| Extension | Purpose | iOS API |
|---|---|---|
| `widget/` | Home-screen + Lock-screen widgets | WidgetKit |
| `autofill/` | System AutoFill credential provider | AuthenticationServices |

The JS side is already wired (`client/src/lib/widget-data.ts`,
`client/src/lib/autofill-sync.ts`, `client/src/native/widget-bridge.ts`)
and a custom Capacitor plugin (`ios/App/App/WidgetBridgePlugin.swift` +
`.m`) bridges JS ↔︎ shared App Group UserDefaults + WidgetKit refresh +
`ASCredentialIdentityStore`.

Capacitor / `npx cap sync` does **not** create extension targets — they
must be added once in Xcode. After that, every `cap sync ios` continues
to work.

---

## Prerequisites (one-time, Apple Developer portal)

1. Make sure the App ID `com.ironvault.app` exists with the **Sign in
   with Apple** + **AutoFill Credential Provider** capabilities enabled.
2. Register two child App IDs under the same prefix:
   - `com.ironvault.app.widget`
   - `com.ironvault.app.autofill`
3. Register an **App Group** named `group.app.ironvault.shared` and add
   it to all three App IDs (main, widget, autofill).
4. Regenerate provisioning profiles.

---

## Xcode setup — IronVaultWidget target

1. Open `ios/App/App.xcworkspace`.
2. **File → New → Target → Widget Extension** (under iOS).
3. Product Name: **IronVaultWidget**. Uncheck "Include Configuration
   Intent" — we use a static configuration. Uncheck "Include Live
   Activity".
4. When Xcode prompts to activate the new scheme, **Activate**.
5. **Delete** the boilerplate Swift files Xcode generated inside the
   new IronVaultWidget folder.
6. **Drag** the three files from this repo's `ios-extensions/widget/`
   into the IronVaultWidget group in Xcode:
   - `IronVaultWidget.swift`
   - `WidgetProvider.swift`
   - `WidgetViews.swift`

   When prompted, choose **Copy items if needed**, and make sure only
   the **IronVaultWidget** target is checked.
7. **Replace** the auto-generated `Info.plist` of the widget target
   with `ios-extensions/widget/Info.plist`.
8. Project settings → **IronVaultWidget** target → **Signing &
   Capabilities** →
   - Set bundle identifier `com.ironvault.app.widget`.
   - **+ Capability → App Groups** → check
     `group.app.ironvault.shared`. (If the entitlement file already
     exists, point Build Settings → `CODE_SIGN_ENTITLEMENTS` to
     `ios-extensions/widget/IronVaultWidget.entitlements`.)
   - Deployment target: iOS 16 (lock-screen widgets need 16+).

---

## Xcode setup — IronVaultAutoFill target

1. **File → New → Target → Credential Provider Extension**.
2. Product Name: **IronVaultAutoFill**. Language: **Swift**.
3. **Delete** the boilerplate files Xcode generated.
4. **Drag** in `ios-extensions/autofill/CredentialProviderViewController.swift`
   (target: IronVaultAutoFill only).
5. **Replace** the auto-generated `Info.plist` with
   `ios-extensions/autofill/Info.plist`.
6. Project settings → **IronVaultAutoFill** target → **Signing &
   Capabilities** →
   - Set bundle identifier `com.ironvault.app.autofill`.
   - **+ Capability → App Groups** → check
     `group.app.ironvault.shared`. (Point
     `CODE_SIGN_ENTITLEMENTS` to
     `ios-extensions/autofill/IronVaultAutoFill.entitlements`.)
   - Deployment target: iOS 14 minimum.

---

## Xcode setup — main App target

The main app's `App.entitlements` was already updated to declare both
the **App Group** and the **AutoFill Credential Provider** capability.
Open the Capabilities tab and make sure those are checked (Xcode
sometimes shows them as inactive until you click them once).

The custom Capacitor plugin **WidgetBridgePlugin** (`ios/App/App/`)
needs no separate target — it's part of the main App target, just two
new files Cocoapods picks up automatically on next `cap sync ios`.

---

## After Xcode setup — verifying the bridge

In the running app, on a device with the Widget target installed:

```js
// In the WebView console, with the app unlocked:
await Capacitor.Plugins.WidgetBridge.setItem({ key: 'iv_widget_security_score', value: '88' });
await Capacitor.Plugins.WidgetBridge.reloadAll();
```

The widget should refresh within a second showing 88. If it doesn't:

- `setItem` rejects with `App Group ... not available` → the widget
  target doesn't share the App Group entitlement. Re-check step 8.
- Widget shows "Vault locked" → check
  `iv_widget_vault_status` is being written to `unlocked`.
- `reloadAll` is a no-op → the widget target isn't installed on the
  device; rebuild and run the IronVaultWidget scheme once to register it.

## After Xcode setup — verifying AutoFill

1. Build & run the **App** scheme on a physical device (AutoFill cannot
   be tested in the simulator reliably).
2. Settings → **Passwords** → **Password Options** → enable
   **IronVault** as an AutoFill provider.
3. In the app, sync a password (or call
   `publishAutoFillCredentials()` from JS).
4. Tap a `<input type="password">` in Safari → IronVault should appear
   in the AutoFill suggestions bar.

---

## Common pitfalls

- **App Group not found at runtime.** Almost always means one target
  doesn't have the entitlement. Run `codesign -d --entitlements - <path>`
  on each target's compiled `.app` / `.appex` and confirm the
  `application-groups` array.
- **Widget icon missing.** Xcode adds an asset catalog (`Assets.xcassets`)
  to the widget target automatically — drop the IronVault icon into its
  `AppIcon` set.
- **AutoFill list is empty.** Vault might be locked, or the JS sync
  hasn't fired. `await Capacitor.Plugins.WidgetBridge.getItem({ key:
  'iv_autofill_credentials_v1' })` should return a JSON array.
- **Force-quit the widget extension after a code change.** WidgetKit
  caches the extension binary aggressively; remove + re-add the widget
  from the home screen if you don't see your change.
