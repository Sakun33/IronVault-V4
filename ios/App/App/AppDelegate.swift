import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Screenshot / screen-recording prevention has been intentionally
        // disabled in this build. The previous implementation made every
        // screenshot blank via a UITextField secure-layer trick and added
        // blur overlays on background, but it interfered with debugging,
        // demos, and accessibility. We will re-introduce a privacy overlay
        // behind a user-toggleable Settings switch in a later phase.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // No-op: privacy overlay disabled.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // No-op: privacy overlay disabled.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // No-op: privacy overlay disabled.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // No-op: privacy overlay disabled.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
