import UIKit
import Capacitor

// Extension to make UIWindow secure (prevents screenshots from capturing content)
extension UIWindow {
    func makeSecure() {
        let field = UITextField()
        field.isSecureTextEntry = true
        self.addSubview(field)
        field.centerYAnchor.constraint(equalTo: self.centerYAnchor).isActive = true
        field.centerXAnchor.constraint(equalTo: self.centerXAnchor).isActive = true
        self.layer.superlayer?.addSublayer(field.layer)
        field.layer.sublayers?.last?.addSublayer(self.layer)
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var securityOverlay: UIView?
    private var secureField: UITextField?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Setup screenshot and screen recording prevention
        setupScreenshotPrevention()
        
        // Setup secure layer to prevent screenshot content capture
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.setupSecureLayer()
        }
        
        return true
    }
    
    // MARK: - Secure Layer (Makes screenshots blank)
    
    private func setupSecureLayer() {
        guard let window = self.window else { return }
        
        // Create a secure text field - iOS treats this specially and won't capture its superview
        let textField = UITextField()
        textField.isSecureTextEntry = true
        textField.isUserInteractionEnabled = false
        
        // Add it to the window but make it invisible
        window.addSubview(textField)
        textField.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            textField.centerXAnchor.constraint(equalTo: window.centerXAnchor),
            textField.centerYAnchor.constraint(equalTo: window.centerYAnchor),
            textField.widthAnchor.constraint(equalToConstant: 1),
            textField.heightAnchor.constraint(equalToConstant: 1)
        ])
        
        // Get the secure layer and apply it to the entire window
        if let secureLayer = textField.layer.sublayers?.first {
            secureLayer.frame = window.bounds
            window.layer.superlayer?.addSublayer(secureLayer)
        }
        
        // Alternative approach: Make the entire window secure using layer trick
        window.makeSecure()
        
        secureField = textField
    }
    
    // MARK: - Screenshot & Screen Recording Prevention
    
    private func setupScreenshotPrevention() {
        // Listen for screenshot notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(userDidTakeScreenshot),
            name: UIApplication.userDidTakeScreenshotNotification,
            object: nil
        )
        
        // Listen for screen capture changes (screen recording)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screenCaptureDidChange),
            name: UIScreen.capturedDidChangeNotification,
            object: nil
        )
    }
    
    @objc private func userDidTakeScreenshot() {
        // Log the screenshot attempt
        print("⚠️ Screenshot detected - IronVault security alert")
        
        // Show a brief alert to inform the user (screenshot should be blank)
        if let rootVC = window?.rootViewController {
            let alert = UIAlertController(
                title: "Screenshot Blocked",
                message: "For security reasons, screenshots of IronVault appear blank.",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            rootVC.present(alert, animated: true)
        }
    }
    
    @objc private func screenCaptureDidChange() {
        if UIScreen.main.isCaptured {
            // Screen recording started - show security overlay
            showSecurityOverlay()
            print("⚠️ Screen recording detected - hiding sensitive content")
        } else {
            // Screen recording stopped - remove overlay
            hideSecurityOverlay()
        }
    }
    
    private func showSecurityOverlay() {
        guard securityOverlay == nil, let window = self.window else { return }
        
        let overlay = UIView(frame: window.bounds)
        overlay.backgroundColor = UIColor.systemBackground
        overlay.tag = 999
        
        let label = UILabel()
        label.text = "🔒 Screen Recording Blocked\n\nFor your security, IronVault content\nis hidden during screen recording."
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        label.textColor = .label
        label.translatesAutoresizingMaskIntoConstraints = false
        
        overlay.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            label.leadingAnchor.constraint(greaterThanOrEqualTo: overlay.leadingAnchor, constant: 40),
            label.trailingAnchor.constraint(lessThanOrEqualTo: overlay.trailingAnchor, constant: -40)
        ])
        
        window.addSubview(overlay)
        securityOverlay = overlay
    }
    
    private func hideSecurityOverlay() {
        securityOverlay?.removeFromSuperview()
        securityOverlay = nil
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Show blur overlay when app is backgrounded (for app switcher privacy)
        showPrivacyOverlay()
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Keep privacy overlay visible
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Remove privacy overlay when returning to foreground
        hidePrivacyOverlay()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Remove privacy overlay and check for screen recording
        hidePrivacyOverlay()
        
        // Check if screen is being recorded when app becomes active
        if UIScreen.main.isCaptured {
            showSecurityOverlay()
        }
    }
    
    // MARK: - Privacy Overlay (for App Switcher)
    
    private func showPrivacyOverlay() {
        guard let window = self.window, window.viewWithTag(998) == nil else { return }
        
        let blurEffect = UIBlurEffect(style: .regular)
        let blurView = UIVisualEffectView(effect: blurEffect)
        blurView.frame = window.bounds
        blurView.tag = 998
        
        let iconLabel = UILabel()
        iconLabel.text = "🔒"
        iconLabel.font = UIFont.systemFont(ofSize: 60)
        iconLabel.translatesAutoresizingMaskIntoConstraints = false
        
        blurView.contentView.addSubview(iconLabel)
        NSLayoutConstraint.activate([
            iconLabel.centerXAnchor.constraint(equalTo: blurView.contentView.centerXAnchor),
            iconLabel.centerYAnchor.constraint(equalTo: blurView.contentView.centerYAnchor)
        ])
        
        window.addSubview(blurView)
    }
    
    private func hidePrivacyOverlay() {
        window?.viewWithTag(998)?.removeFromSuperview()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
