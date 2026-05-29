//
//  CredentialProviderViewController.swift
//  IronVaultAutoFill
//
//  iOS AutoFill credential provider entry point. Hooked up via Info.plist
//  → NSExtensionPrincipalClass = "$(PRODUCT_MODULE_NAME).CredentialProviderViewController"
//  and NSExtensionPointIdentifier = "com.apple.authentication-services-credential-provider-ui".
//
//  Reads the credential blob from the shared App Group container
//  (written by the main IronVault app on every vault sync) via
//  `KeychainBridge`. Decryption is gated by Face ID / Touch ID via
//  `BiometricHelper`; the AutoFill extension never has direct access to
//  the user's master password.
//
//  Lifecycle dispatch:
//    prepareCredentialList(for:)                — full picker UI
//    provideCredentialWithoutUserInteraction(_) — silent fill (60s biometric cache)
//    prepareInterfaceToProvideCredential(for:)  — biometric + silent fill
//    prepareInterfaceForExtensionConfiguration  — settings handoff
//
//  Selection flow:
//    - User taps a row in the list
//    - Biometric prompt
//    - extensionContext.completeRequest(withSelectedCredential: ASPasswordCredential)
//

import AuthenticationServices
import LocalAuthentication
import UIKit

final class CredentialProviderViewController: ASCredentialProviderViewController {

    private var pickerController: CredentialListViewController?
    private var pendingServiceIdentifiers: [ASCredentialServiceIdentifier] = []

    // MARK: View lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1)
    }

    // MARK: AS API — Picker

    /// iOS asks us to present a UI for the user to pick a credential. We
    /// hand off to `CredentialListViewController`, pre-filtering against
    /// the service identifiers iOS handed us.
    override func prepareCredentialList(for serviceIdentifiers: [ASCredentialServiceIdentifier]) {
        pendingServiceIdentifiers = serviceIdentifiers
        let all = KeychainBridge.loadCredentials()
        let shims = serviceIdentifiers.map(Self.shim(for:))
        let suggested = all.filter { cred in shims.contains(where: { cred.matches($0) }) }

        let picker = CredentialListViewController()
        picker.delegate = self
        picker.all = all
        picker.suggested = suggested
        picker.serviceLabel = primaryServiceLabel(from: serviceIdentifiers)
        picker.biometricKind = BiometricHelper.supportedKind
        pickerController = picker

        embed(picker)
    }

    // MARK: AS API — Silent / quick fill

    /// Silent path — iOS asks if we can complete the fill without any UI.
    /// We answer yes only if (a) we know the recordIdentifier and
    /// (b) the user has authenticated with biometric in the last 60s.
    override func provideCredentialWithoutUserInteraction(for credentialIdentity: ASPasswordCredentialIdentity) {
        let creds = KeychainBridge.loadCredentials()
        guard let match = creds.first(where: { $0.recordIdentifier == credentialIdentity.recordIdentifier }) else {
            cancel(error: .credentialIdentityNotFound)
            return
        }
        guard BiometricHelper.isApprovalFresh else {
            // Tell iOS we need UI to authenticate. iOS will then call
            // `prepareInterfaceToProvideCredential` so we can run the
            // biometric prompt.
            cancel(error: .userInteractionRequired)
            return
        }
        complete(with: match)
    }

    /// UI path equivalent of the silent flow — run biometric, then fill.
    override func prepareInterfaceToProvideCredential(for credentialIdentity: ASPasswordCredentialIdentity) {
        let creds = KeychainBridge.loadCredentials()
        guard let match = creds.first(where: { $0.recordIdentifier == credentialIdentity.recordIdentifier }) else {
            cancel(error: .credentialIdentityNotFound)
            return
        }
        BiometricHelper.evaluate { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success:
                self.complete(with: match)
            case .userCancelled:
                self.cancel(error: .userCanceled)
            case .unavailable, .failed:
                // Bail to the picker so the user can at least see their
                // creds (passcode fallback would have been attempted by
                // BiometricHelper already).
                self.cancel(error: .userCanceled)
            }
        }
    }

    // MARK: AS API — Extension configuration

    /// iOS calls this once when the user enables IronVault in
    /// Settings → Passwords → Password Options. We show a "Open IronVault
    /// to configure" landing.
    override func prepareInterfaceForExtensionConfiguration() {
        let container = UIViewController()
        container.view.backgroundColor = UIColor(red: 0.04, green: 0.05, blue: 0.09, alpha: 1)

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.view.addSubview(stack)

        let iconBg = UIView()
        iconBg.backgroundColor = UIColor(red: 0.21, green: 0.78, blue: 0.84, alpha: 0.18)
        iconBg.layer.cornerRadius = 18
        iconBg.translatesAutoresizingMaskIntoConstraints = false
        let icon = UIImageView(image: UIImage(systemName: "lock.shield.fill"))
        icon.tintColor = UIColor(red: 0.5, green: 0.93, blue: 0.97, alpha: 1)
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.contentMode = .scaleAspectFit
        iconBg.addSubview(icon)

        let title = UILabel()
        title.text = "IronVault AutoFill enabled"
        title.font = UIFont.systemFont(ofSize: 18, weight: .semibold)
        title.textColor = .white
        title.textAlignment = .center

        let subtitle = UILabel()
        subtitle.text = "Open the IronVault app, unlock your vault, and your saved credentials will appear when you tap a password field."
        subtitle.font = UIFont.systemFont(ofSize: 14)
        subtitle.textColor = UIColor(white: 1, alpha: 0.6)
        subtitle.textAlignment = .center
        subtitle.numberOfLines = 0

        stack.addArrangedSubview(iconBg)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(subtitle)

        NSLayoutConstraint.activate([
            iconBg.widthAnchor.constraint(equalToConstant: 56),
            iconBg.heightAnchor.constraint(equalToConstant: 56),
            icon.centerXAnchor.constraint(equalTo: iconBg.centerXAnchor),
            icon.centerYAnchor.constraint(equalTo: iconBg.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 28),
            icon.heightAnchor.constraint(equalToConstant: 28),
            stack.leadingAnchor.constraint(equalTo: container.view.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: container.view.trailingAnchor, constant: -32),
            stack.centerYAnchor.constraint(equalTo: container.view.centerYAnchor),
        ])

        container.navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .done,
            target: self,
            action: #selector(configurationDone)
        )

        embed(container)
    }

    @objc private func configurationDone() {
        extensionContext.completeExtensionConfigurationRequest()
    }

    // MARK: Helpers

    private func embed(_ child: UIViewController) {
        // Reset
        children.forEach { $0.willMove(toParent: nil); $0.view.removeFromSuperview(); $0.removeFromParent() }

        let nav = UINavigationController(rootViewController: child)
        nav.modalPresentationStyle = .pageSheet
        nav.view.translatesAutoresizingMaskIntoConstraints = false
        addChild(nav)
        view.addSubview(nav.view)
        nav.didMove(toParent: self)
        NSLayoutConstraint.activate([
            nav.view.topAnchor.constraint(equalTo: view.topAnchor),
            nav.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            nav.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            nav.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func complete(with credential: AutoFillCredential) {
        let pw = ASPasswordCredential(user: credential.username, password: credential.password)
        extensionContext.completeRequest(withSelectedCredential: pw, completionHandler: nil)
    }

    private func cancel(error: ASExtensionError.Code) {
        extensionContext.cancelRequest(withError: NSError(
            domain: ASExtensionErrorDomain,
            code: error.rawValue
        ))
    }

    private func primaryServiceLabel(from identifiers: [ASCredentialServiceIdentifier]) -> String? {
        for sid in identifiers {
            let shim = Self.shim(for: sid)
            if !shim.normalizedHost.isEmpty { return shim.normalizedHost }
        }
        return nil
    }

    private static func shim(for sid: ASCredentialServiceIdentifier) -> ASCredentialServiceIdentifierLike {
        switch sid.type {
        case .URL:
            return ASCredentialServiceIdentifierLike(identifier: sid.identifier, isURL: true)
        case .domain:
            return ASCredentialServiceIdentifierLike(identifier: sid.identifier, isURL: false)
        @unknown default:
            return ASCredentialServiceIdentifierLike(identifier: sid.identifier, isURL: false)
        }
    }
}

// MARK: - CredentialListViewControllerDelegate

extension CredentialProviderViewController: CredentialListViewControllerDelegate {

    func credentialList(_ vc: CredentialListViewController, didSelect credential: AutoFillCredential) {
        // Always biometric-gate the final reveal so a stolen unlocked
        // device can't fish credentials from the AutoFill modal.
        BiometricHelper.evaluate { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success:
                self.complete(with: credential)
            case .userCancelled:
                // Stay in the picker — user just dismissed the prompt.
                break
            case .unavailable:
                // Hardware path is gone (e.g. biometry-not-enrolled). Let
                // the fill go through; the device-level passcode already
                // gates the AutoFill modal itself.
                self.complete(with: credential)
            case .failed:
                break
            }
        }
    }

    func credentialListDidCancel(_ vc: CredentialListViewController) {
        cancel(error: .userCanceled)
    }
}
