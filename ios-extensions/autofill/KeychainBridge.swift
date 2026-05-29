//
//  KeychainBridge.swift
//  IronVaultAutoFill
//
//  Shared App Group + Keychain access layer for the AutoFill extension.
//
//  The main IronVault app (Capacitor host) writes the JSON credential blob
//  into the shared App Group UserDefaults on every vault sync via
//  WidgetBridgePlugin. The extension reads from the SAME suite name here,
//  which is why both targets must declare the App Group entitlement
//  `group.app.ironvault.shared`.
//
//  We keep a thin Keychain layer too so that biometric-approval state and
//  the master-password fallback hash survive across extension invocations
//  (UserDefaults inside an extension can be evicted under memory pressure).
//
//  IMPORTANT — keys must match exactly with:
//    - client/src/lib/autofill-sync.ts (JS-side publisher)
//    - WidgetBridgePlugin.swift (host-app bridge)
//

import Foundation
import Security

// MARK: - Shared constants

enum AutoFillConstants {
    /// App Group identifier — must match the entitlement on every target
    /// (main app, widget, autofill).
    static let appGroup = "group.app.ironvault.shared"

    /// Keychain access group — same identifier as the App Group so the
    /// extension can read items written by the main app's Capacitor
    /// keychain plugin.
    static let keychainAccessGroup = "group.app.ironvault.shared"

    /// Key the JS publisher uses for the encrypted credential blob.
    static let credentialsBlobKey = "iv_autofill_credentials_v1"

    /// UNIX timestamp of the last successful biometric approval inside the
    /// extension. Used for the 60-second silent-fill grace window.
    static let biometricApprovalKey = "iv_autofill_last_biometric_approval"

    /// How long (seconds) a single Face ID approval is honoured before we
    /// re-prompt. Apple caches biometric state aggressively for the silent
    /// AutoFill path; this is our own ceiling for the UI path.
    static let biometricCacheSeconds: TimeInterval = 60

    /// Service name used when reading/writing items in the shared keychain.
    static let keychainService = "app.ironvault.autofill"
}

// MARK: - Credential model

/// Mirror of the JS-side payload written by client/src/lib/autofill-sync.ts.
/// Keep these fields in lock-step with that file.
struct AutoFillCredential: Codable, Equatable {
    let recordIdentifier: String
    let url: String
    let username: String
    let password: String

    /// Lower-cased host portion of the stored URL. Bare domains pass through.
    var host: String {
        if let u = URL(string: url), let host = u.host {
            return host.lowercased()
        }
        return url.lowercased()
    }

    /// First letter for the avatar circle. Falls back to a vault glyph.
    var initial: String {
        let trimmed = host
            .replacingOccurrences(of: "www.", with: "")
        if let first = trimmed.first {
            return String(first).uppercased()
        }
        return "•"
    }

    /// Domain match for an AS service identifier. Handles both URL and
    /// bare-domain identifier types and tolerates www / subdomain noise.
    func matches(_ serviceIdentifier: ASCredentialServiceIdentifierLike) -> Bool {
        let target = serviceIdentifier.normalizedHost
        guard !target.isEmpty else { return false }
        let mine = host
        if mine == target { return true }
        if mine.hasSuffix("." + target) { return true }
        if target.hasSuffix("." + mine) { return true }
        return false
    }
}

/// Tiny shim so the matching logic isn't coupled to AuthenticationServices
/// in this file (lets us unit-test the host parser without importing AS).
struct ASCredentialServiceIdentifierLike {
    let identifier: String
    let isURL: Bool

    var normalizedHost: String {
        if isURL, let u = URL(string: identifier), let h = u.host {
            return h.lowercased()
        }
        return identifier.lowercased()
    }
}

// MARK: - Keychain bridge

/// Thin wrapper over the shared App Group UserDefaults *and* the shared
/// Keychain access group. UserDefaults is fine for the credential blob
/// (it's already encrypted at rest by data protection); the Keychain is
/// used for things that must survive eviction or be readable by other
/// extensions in the suite.
enum KeychainBridge {

    // MARK: UserDefaults-backed credential blob

    static func loadCredentials() -> [AutoFillCredential] {
        guard
            let defaults = UserDefaults(suiteName: AutoFillConstants.appGroup),
            let blob = defaults.string(forKey: AutoFillConstants.credentialsBlobKey),
            let data = blob.data(using: .utf8)
        else { return [] }
        return (try? JSONDecoder().decode([AutoFillCredential].self, from: data)) ?? []
    }

    static func clearCredentials() {
        UserDefaults(suiteName: AutoFillConstants.appGroup)?
            .removeObject(forKey: AutoFillConstants.credentialsBlobKey)
    }

    // MARK: Biometric approval timestamp

    static var lastBiometricApproval: Date? {
        let ts = UserDefaults(suiteName: AutoFillConstants.appGroup)?
            .double(forKey: AutoFillConstants.biometricApprovalKey) ?? 0
        return ts > 0 ? Date(timeIntervalSince1970: ts) : nil
    }

    static func markBiometricApproved() {
        UserDefaults(suiteName: AutoFillConstants.appGroup)?
            .set(Date().timeIntervalSince1970,
                 forKey: AutoFillConstants.biometricApprovalKey)
    }

    static func clearBiometricApproval() {
        UserDefaults(suiteName: AutoFillConstants.appGroup)?
            .removeObject(forKey: AutoFillConstants.biometricApprovalKey)
    }

    static func isBiometricApprovalFresh() -> Bool {
        guard let last = lastBiometricApproval else { return false }
        return Date().timeIntervalSince(last) <= AutoFillConstants.biometricCacheSeconds
    }

    // MARK: Generic shared-keychain item (kept for future master-password fallback)

    @discardableResult
    static func setKeychainItem(account: String, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AutoFillConstants.keychainService,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: AutoFillConstants.keychainAccessGroup,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemDelete(query as CFDictionary)

        var addQuery = query
        addQuery[kSecValueData as String] = data
        return SecItemAdd(addQuery as CFDictionary, nil) == errSecSuccess
    }

    static func getKeychainItem(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AutoFillConstants.keychainService,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: AutoFillConstants.keychainAccessGroup,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnData as String: true,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard
            status == errSecSuccess,
            let data = out as? Data,
            let value = String(data: data, encoding: .utf8)
        else { return nil }
        return value
    }

    @discardableResult
    static func removeKeychainItem(account: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AutoFillConstants.keychainService,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: AutoFillConstants.keychainAccessGroup,
        ]
        return SecItemDelete(query as CFDictionary) == errSecSuccess
    }
}
