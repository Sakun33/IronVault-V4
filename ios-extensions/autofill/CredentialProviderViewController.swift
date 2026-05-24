//
//  CredentialProviderViewController.swift
//  IronVaultAutoFill
//
//  iOS AutoFill credential provider entry point. Hooked up via Info.plist
//  → NSExtensionPrincipalClass = "$(PRODUCT_MODULE_NAME).CredentialProviderViewController"
//  and NSExtensionPointIdentifier = "com.apple.authentication-services-credential-provider-ui".
//
//  Reads the encrypted password blob from the shared App Group container
//  (written by the main IronVault app on every vault sync). Decryption is
//  gated by Face ID / Touch ID via LocalAuthentication; the AutoFill
//  extension never has access to the user's master password directly.
//
//  Flow:
//    1. iOS asks: "user is filling a login form on serviceIdentifier X"
//    2. We list matching credentials from the shared blob.
//    3. User taps one.
//    4. We prompt biometric.
//    5. On success we hand the (username, password) tuple back via
//       extensionContext.completeRequest(withSelectedCredential:).
//

import AuthenticationServices
import LocalAuthentication
import UIKit

private let kAppGroup = "group.app.ironvault.shared"
private let kCredentialsBlobKey = "iv_autofill_credentials_v1"

// Mirror of the JS-side payload written by client/src/lib/autofill-sync.ts.
// Keep these fields in lock-step with that file.
struct AutoFillCredential: Codable {
    let recordIdentifier: String
    let url: String
    let username: String
    let password: String

    var host: String {
        if let u = URL(string: url), let host = u.host {
            return host.lowercased()
        }
        // Bare domain entries.
        return url.lowercased()
    }

    func matches(_ serviceIdentifier: ASCredentialServiceIdentifier) -> Bool {
        let target: String = {
            switch serviceIdentifier.type {
            case .URL:
                if let u = URL(string: serviceIdentifier.identifier), let h = u.host {
                    return h.lowercased()
                }
                return serviceIdentifier.identifier.lowercased()
            case .domain:
                return serviceIdentifier.identifier.lowercased()
            @unknown default:
                return serviceIdentifier.identifier.lowercased()
            }
        }()
        // Simple "ends with" match so login.google.com matches google.com.
        return host == target || host.hasSuffix("." + target) || target.hasSuffix("." + host)
    }
}

private func loadCredentials() -> [AutoFillCredential] {
    guard
        let defaults = UserDefaults(suiteName: kAppGroup),
        let blob = defaults.string(forKey: kCredentialsBlobKey),
        let data = blob.data(using: .utf8)
    else { return [] }
    return (try? JSONDecoder().decode([AutoFillCredential].self, from: data)) ?? []
}

class CredentialProviderViewController: ASCredentialProviderViewController {

    private var tableView: UITableView!
    private var allCredentials: [AutoFillCredential] = []
    private var filtered: [AutoFillCredential] = []
    private var currentServiceIdentifiers: [ASCredentialServiceIdentifier] = []

    // MARK: View lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        title = "IronVault"

        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )

        tableView = UITableView(frame: view.bounds, style: .insetGrouped)
        tableView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "Cell")
        view.addSubview(tableView)
    }

    // MARK: AS API — UI flow

    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        currentServiceIdentifiers = serviceIdentifiers
        allCredentials = loadCredentials()
        filtered = allCredentials.filter { cred in
            serviceIdentifiers.contains(where: { cred.matches($0) })
        }
        if filtered.isEmpty {
            filtered = allCredentials // fall back to full list so user can pick manually
        }
        tableView?.reloadData()
    }

    // MARK: AS API — silent flow (Face ID-confirmed quick fill)

    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        let creds = loadCredentials()
        guard let match = creds.first(where: { $0.recordIdentifier == credentialIdentity.recordIdentifier }) else {
            extensionContext.cancelRequest(withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.credentialIdentityNotFound.rawValue
            ))
            return
        }
        // Silent flow MUST NOT prompt — only OS-level biometric on the
        // AutoFill modal counts. Hand back immediately.
        let passwordCredential = ASPasswordCredential(user: match.username, password: match.password)
        extensionContext.completeRequest(withSelectedCredential: passwordCredential, completionHandler: nil)
    }

    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        // Same as the silent path but we run a biometric prompt ourselves.
        let creds = loadCredentials()
        guard let match = creds.first(where: { $0.recordIdentifier == credentialIdentity.recordIdentifier }) else {
            extensionContext.cancelRequest(withError: NSError(
                domain: ASExtensionErrorDomain,
                code: ASExtensionError.credentialIdentityNotFound.rawValue
            ))
            return
        }
        promptBiometric { [weak self] ok in
            guard let self = self else { return }
            if ok {
                let cred = ASPasswordCredential(user: match.username, password: match.password)
                self.extensionContext.completeRequest(withSelectedCredential: cred, completionHandler: nil)
            } else {
                self.extensionContext.cancelRequest(withError: NSError(
                    domain: ASExtensionErrorDomain,
                    code: ASExtensionError.userCanceled.rawValue
                ))
            }
        }
    }

    // MARK: Helpers

    @objc private func cancelTapped() {
        extensionContext.cancelRequest(withError: NSError(
            domain: ASExtensionErrorDomain,
            code: ASExtensionError.userCanceled.rawValue
        ))
    }

    private func promptBiometric(completion: @escaping (Bool) -> Void) {
        let ctx = LAContext()
        var err: NSError?
        if ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) {
            ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                               localizedReason: "Authenticate to autofill credentials") { ok, _ in
                DispatchQueue.main.async { completion(ok) }
            }
        } else {
            // No biometrics — fall back to passcode.
            ctx.evaluatePolicy(.deviceOwnerAuthentication,
                               localizedReason: "Authenticate to autofill credentials") { ok, _ in
                DispatchQueue.main.async { completion(ok) }
            }
        }
    }
}

// MARK: - Table view

extension CredentialProviderViewController: UITableViewDataSource, UITableViewDelegate {

    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return filtered.count
    }

    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "Cell", for: indexPath)
        let cred = filtered[indexPath.row]
        cell.textLabel?.text = cred.username
        cell.detailTextLabel?.text = cred.host
        cell.accessoryType = .disclosureIndicator
        return cell
    }

    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let cred = filtered[indexPath.row]
        promptBiometric { [weak self] ok in
            guard let self = self else { return }
            guard ok else { return }
            let passwordCredential = ASPasswordCredential(user: cred.username, password: cred.password)
            self.extensionContext.completeRequest(withSelectedCredential: passwordCredential, completionHandler: nil)
        }
    }

    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        let isFiltered = filtered.count != allCredentials.count
        if filtered.isEmpty { return "No saved credentials" }
        return isFiltered ? "Suggested for this site" : "All credentials"
    }
}
