//
//  BiometricHelper.swift
//  IronVaultAutoFill
//
//  LAContext wrapper used by the AutoFill extension to gate access to the
//  decrypted credential blob behind Face ID / Touch ID.
//
//  Apple's AutoFill modal already runs over a biometric scrim *if* the user
//  has enabled "AutoFill Passwords" with biometric protection in Settings,
//  but that gate only protects entering the modal — once inside, the
//  extension may still want a fresh approval before revealing a credential
//  the user explicitly tapped. We do that here, with a 60-second cache so
//  the user doesn't have to authenticate twice in a row.
//
//  If Face ID / Touch ID is unavailable (hardware missing, user opted out)
//  we fall back to the device passcode via `.deviceOwnerAuthentication`.
//

import Foundation
import LocalAuthentication

enum BiometricResult {
    case success
    case userCancelled
    case unavailable
    case failed(String)
}

enum BiometricHelper {

    /// Returns the kind of biometric the device supports — used to render
    /// the right icon / copy in the UI.
    enum BiometricKind {
        case faceID
        case touchID
        case opticID      // Vision Pro
        case none
    }

    static var supportedKind: BiometricKind {
        let ctx = LAContext()
        var err: NSError?
        guard ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) else {
            return .none
        }
        switch ctx.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        default: return .none
        }
    }

    /// Cheap predicate: is the user within the 60-second approval window?
    /// The silent AutoFill path uses this directly.
    static var isApprovalFresh: Bool {
        KeychainBridge.isBiometricApprovalFresh()
    }

    /// Run biometric auth (with passcode fallback). On success we cache the
    /// approval timestamp so subsequent silent fills within 60s don't have
    /// to prompt again. Completion is dispatched to main.
    static func evaluate(
        reason: String = "Authenticate to autofill your IronVault credentials",
        allowPasscodeFallback: Bool = true,
        completion: @escaping (BiometricResult) -> Void
    ) {
        let ctx = LAContext()
        ctx.localizedFallbackTitle = allowPasscodeFallback ? "Use Passcode" : ""

        var err: NSError?
        let biometricsAvailable = ctx.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics, error: &err
        )

        let policy: LAPolicy
        if biometricsAvailable {
            policy = .deviceOwnerAuthenticationWithBiometrics
        } else if allowPasscodeFallback,
                  ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) {
            policy = .deviceOwnerAuthentication
        } else {
            DispatchQueue.main.async { completion(.unavailable) }
            return
        }

        ctx.evaluatePolicy(policy, localizedReason: reason) { ok, evalError in
            DispatchQueue.main.async {
                if ok {
                    KeychainBridge.markBiometricApproved()
                    completion(.success)
                    return
                }
                guard let laError = evalError as? LAError else {
                    completion(.failed(evalError?.localizedDescription ?? "Unknown error"))
                    return
                }
                switch laError.code {
                case .userCancel, .appCancel, .systemCancel, .userFallback:
                    completion(.userCancelled)
                case .biometryNotAvailable, .biometryNotEnrolled, .passcodeNotSet:
                    completion(.unavailable)
                default:
                    completion(.failed(laError.localizedDescription))
                }
            }
        }
    }

    /// Reset the approval window — call this on lock, logout, or after a
    /// failed silent attempt that should re-prompt the user.
    static func resetApproval() {
        KeychainBridge.clearBiometricApproval()
    }
}
