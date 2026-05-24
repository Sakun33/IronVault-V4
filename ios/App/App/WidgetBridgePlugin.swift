//
//  WidgetBridgePlugin.swift
//  App
//
//  Custom Capacitor plugin that bridges JS → shared App Group UserDefaults
//  so the IronVaultWidget extension and the AutoFill credential provider
//  can read live data from the main app without it ever crossing the
//  network. Also relays `WidgetCenter.reloadAllTimelines()` calls from JS
//  and pushes a credential identity list into the system's AutoFill
//  store via `ASCredentialIdentityStore`.
//
//  This file is referenced from JS via:
//    const Native = registerPlugin<WidgetBridgePlugin>('WidgetBridge')
//
//  Swift / Capacitor pairs the plugin name with the @objc(WidgetBridgePlugin)
//  declaration plus the corresponding .m exported method list below.
//

import Foundation
import Capacitor
import WidgetKit
import AuthenticationServices

// App Group identifier — must match the entitlement on every target that
// needs to read/write the shared container (main app + widget extension +
// AutoFill provider).
private let kAppGroup = "group.app.ironvault.shared"

@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin {

    private func sharedDefaults() -> UserDefaults? {
        return UserDefaults(suiteName: kAppGroup)
    }

    @objc func setItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }
        let value = call.getString("value") ?? ""
        guard let defaults = sharedDefaults() else {
            call.reject("App Group \(kAppGroup) not available")
            return
        }
        defaults.set(value, forKey: key)
        call.resolve()
    }

    @objc func getItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }
        guard let defaults = sharedDefaults() else {
            call.resolve(["value": NSNull()])
            return
        }
        if let value = defaults.string(forKey: key) {
            call.resolve(["value": value])
        } else {
            call.resolve(["value": NSNull()])
        }
    }

    @objc func removeItem(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }
        sharedDefaults()?.removeObject(forKey: key)
        call.resolve()
    }

    /// Force WidgetKit to refresh every widget timeline this app owns. The
    /// "kind" string is ignored — passing nil reloads all of them.
    @objc func reloadAll(_ call: CAPPluginCall) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }

    /// Receive a list of credential identity tuples and write them to the
    /// system AutoFill credential store. Apple's
    /// `ASCredentialIdentityStore` API normalises domain matching for us
    /// (so `accounts.google.com` matches login fields on google.com).
    /// The actual password is *never* sent into the store — only the
    /// (recordIdentifier, serviceIdentifier, user) triple. When AutoFill
    /// activates on a login field, the system asks the extension to
    /// resolve the recordIdentifier back to a real password, at which
    /// point the extension authenticates the user with Face ID/Touch ID
    /// and reads from the shared Keychain.
    @objc func syncCredentialIdentities(_ call: CAPPluginCall) {
        guard let identities = call.getArray("identities", JSObject.self) else {
            call.reject("identities array required")
            return
        }
        if #available(iOS 12.0, *) {
            let store = ASCredentialIdentityStore.shared
            store.getState { state in
                guard state.isEnabled else {
                    // User hasn't enabled IronVault as an AutoFill provider
                    // in Settings → Passwords → Password Options. Calling
                    // saveCredentialIdentities would be a silent no-op
                    // anyway, so resolve with a non-error signal.
                    call.resolve(["enabled": false, "count": 0])
                    return
                }
                let entries: [ASPasswordCredentialIdentity] = identities.compactMap { item in
                    guard
                        let recordId = item["recordIdentifier"] as? String,
                        let url = item["url"] as? String,
                        let user = item["username"] as? String
                    else { return nil }
                    let svc = ASCredentialServiceIdentifier(identifier: url, type: .URL)
                    return ASPasswordCredentialIdentity(
                        serviceIdentifier: svc,
                        user: user,
                        recordIdentifier: recordId
                    )
                }
                // Replace wholesale so deletes propagate.
                store.replaceCredentialIdentities(with: entries) { success, error in
                    if let error = error {
                        call.reject("Failed to sync identities: \(error.localizedDescription)")
                        return
                    }
                    call.resolve(["enabled": true, "count": entries.count, "success": success])
                }
            }
        } else {
            call.resolve(["enabled": false, "count": 0])
        }
    }
}
