import UIKit
import Capacitor
import AppShortcutsPlugin

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = WorkbitBridgeViewController()
        window?.makeKeyAndVisible()

        // Opened from "Timbra" on the app icon (long press): handed to the
        // app shortcuts plugin, which tells the page.
        if let shortcutItem = connectionOptions.shortcutItem {
            NotificationCenter.default.post(name: NSNotification.Name(AppShortcutsPlugin.notificationName), object: nil, userInfo: [AppShortcutsPlugin.userInfoShortcutItemKey: shortcutItem])
        }

        // Opened from "Esci" on the Live Activity while the app was closed.
        for context in connectionOptions.urlContexts {
            WorkbitWidgetsPlugin.open(context.url)
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        NotificationCenter.default.post(name: NSNotification.Name(AppShortcutsPlugin.notificationName), object: nil, userInfo: [AppShortcutsPlugin.userInfoShortcutItemKey: shortcutItem])
        completionHandler(true)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // workbit:// links come from the widgets and the Live Activity.
        let ours = URLContexts.filter { WorkbitWidgetsPlugin.open($0.url) }
        if ours.count == URLContexts.count { return }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts.subtracting(ours))
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
