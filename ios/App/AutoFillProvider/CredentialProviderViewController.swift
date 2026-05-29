//
//  CredentialProviderViewController.swift
//  AutoFillProvider
//
//  IronVault iOS AutoFill Credential Provider Extension.
//
//  This extension allows IronVault to appear in iOS Settings > Passwords >
//  AutoFill Passwords, and to surface saved credentials in the system
//  QuickType bar / autofill sheet when the user focuses a username/password
//  field in another app or Safari.
//
//  Architecture:
//  - Credentials are persisted by the host app into the shared App Group
//    container (group.app.ironvault.shared) as an encrypted blob. The host
//    app is responsible for writing the *decrypted-on-unlock* credential
//    index (URL → username, plus an encrypted password) into the shared
//    container after the user unlocks their vault.
//  - This extension reads that index on demand. If the index is missing or
//    locked, the extension shows its own UI prompting the user to unlock
//    the vault inside the IronVault app.
//
//  NOTE: This file deliberately keeps the surface minimal — Apple requires
//  the extension to respond to the standard ASCredentialProviderViewController
//  lifecycle methods; richer credential picking UI can be layered on later
//  without changing the contract iOS expects.
//

import AuthenticationServices
import UIKit

private let sharedAppGroup = "group.app.ironvault.shared"
private let credentialIndexFilename = "autofill-credentials.json"

final class CredentialProviderViewController: ASCredentialProviderViewController {

    private let messageLabel: UILabel = {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.numberOfLines = 0
        label.textAlignment = .center
        label.font = .systemFont(ofSize: 16, weight: .medium)
        label.textColor = .label
        return label
    }()

    private let openAppButton: UIButton = {
        let button = UIButton(type: .system)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.setTitle("Open IronVault", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        return button
    }()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        view.addSubview(messageLabel)
        view.addSubview(openAppButton)

        NSLayoutConstraint.activate([
            messageLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            messageLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -20),
            messageLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            messageLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),

            openAppButton.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 24),
            openAppButton.centerXAnchor.constraint(equalTo: view.centerXAnchor)
        ])

        openAppButton.addTarget(self, action: #selector(cancelToHostApp), for: .touchUpInside)
    }

    // MARK: - ASCredentialProviderViewController overrides

    /// Called when the user taps a credential in the QuickType bar that this
    /// extension previously offered. We must return the matching credential
    /// without showing UI when possible.
    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        guard let entry = loadCredentialEntry(for: credentialIdentity) else {
            let error = NSError(domain: ASExtensionErrorDomain,
                                code: ASExtensionError.userInteractionRequired.rawValue)
            extensionContext.cancelRequest(withError: error)
            return
        }

        let credential = ASPasswordCredential(user: entry.username, password: entry.password)
        extensionContext.completeRequest(withSelectedCredential: credential, completionHandler: nil)
    }

    /// Called when iOS needs the extension to present UI before returning a
    /// credential (e.g. when the vault is locked or the credential needs
    /// disambiguation).
    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        messageLabel.text = "Unlock IronVault to autofill this credential.\n\n\(credentialIdentity.serviceIdentifier.identifier)"
    }

    /// Called when the user opens the AutoFill picker for a service. Show a
    /// list of all matching credentials, or instructions to unlock the vault
    /// if the index isn't available yet.
    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        let serviceText: String
        if let first = serviceIdentifiers.first {
            serviceText = "for \(first.identifier)"
        } else {
            serviceText = ""
        }

        let entries = loadAllCredentials()
        if entries.isEmpty {
            messageLabel.text = "No saved credentials available \(serviceText).\n\nOpen IronVault and unlock your vault to enable AutoFill."
        } else {
            messageLabel.text = "IronVault has \(entries.count) saved credential(s) \(serviceText).\n\nFull picker UI ships in a follow-up; tap below to open IronVault."
        }
    }

    @objc private func cancelToHostApp() {
        let error = NSError(domain: ASExtensionErrorDomain,
                            code: ASExtensionError.userCanceled.rawValue)
        extensionContext.cancelRequest(withError: error)
    }

    // MARK: - Shared container access

    private struct CredentialEntry: Codable {
        let id: String
        let serviceIdentifier: String
        let username: String
        let password: String
    }

    private func sharedContainerURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: sharedAppGroup)
    }

    private func loadAllCredentials() -> [CredentialEntry] {
        guard let containerURL = sharedContainerURL() else { return [] }
        let fileURL = containerURL.appendingPathComponent(credentialIndexFilename)
        guard let data = try? Data(contentsOf: fileURL) else { return [] }
        return (try? JSONDecoder().decode([CredentialEntry].self, from: data)) ?? []
    }

    private func loadCredentialEntry(for identity: ASPasswordCredentialIdentity) -> CredentialEntry? {
        let entries = loadAllCredentials()
        let targetService = identity.serviceIdentifier.identifier
        let targetUser = identity.user
        return entries.first { entry in
            entry.serviceIdentifier == targetService && entry.username == targetUser
        }
    }
}
