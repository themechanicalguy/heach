import Capacitor
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var app: HeachViewController?
    private var shield: ScreenShield?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let app = HeachViewController()
        // MA-06: a HEACH link that started the app opens its page.
        app.linkAtStart = connectionOptions.userActivities.compactMap(Self.webLink).first
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = app
        window.makeKeyAndVisible()
        shield = ScreenShield(over: window, colour: ShellSettings.current.brandColour)
        self.window = window
        self.app = app

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneWillResignActive(_ scene: UIScene) {
        shield?.setAway(true)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        shield?.setAway(false)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    /// MA-06: a HEACH link opened while the app runs (a partner's return, an SMS).
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        if let link = Self.webLink(userActivity) {
            app?.open(link)
        }
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    private static func webLink(_ activity: NSUserActivity) -> URL? {
        activity.activityType == NSUserActivityTypeBrowsingWeb ? activity.webpageURL : nil
    }
}
