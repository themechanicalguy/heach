import Capacitor
import UIKit
import WebKit

/// The whole native app: the hosted web app in a guarded web view (ADR 0016).
final class HeachViewController: CAPBridgeViewController {
    private static let launchScreenLimitMs = 10_000
    private let settings = ShellSettings.current
    private var pageErrors: PageErrors?
    private var bridgeGate: BridgeGate?
    /// A HEACH link that started the app; it loads once the web view exists.
    var linkAtStart: URL?

    override func instanceDescriptor() -> InstanceDescriptor {
        let descriptor = super.instanceDescriptor()
        // Capacitor reads a start path as a file inside the app, so the start page is the server
        // address itself. The server's host is then allowed in full; other hosts open in the
        // browser unless they are partner pages (MA-03).
        descriptor.serverURL = settings.startPage.absoluteString
        descriptor.allowedNavigationHostnames = [settings.server.host ?? ""] + settings.partnerHosts
        // Lets the web app tell which app, and which build of it, it is running in (MA-08).
        descriptor.appendedUserAgentString = "HeachApp/\(settings.audience) HeachShell/\(settings.build)"
        // The web app is laid out for a browser, whose bars keep pages clear of the status bar
        // and the home indicator; in the app the web view does that.
        descriptor.contentInsetAdjustmentBehavior = .automatic
        descriptor.pluginConfigurations = pluginSettings()
        #if DEBUG
        descriptor.loggingBehavior = .debug
        descriptor.isWebDebuggable = true
        #else
        // Capacitor logs page addresses; keep them out of release logs.
        descriptor.loggingBehavior = .none
        descriptor.isWebDebuggable = false
        #endif
        return descriptor
    }

    /**
     MA-09: the launch screen stays until the page says it can be used, so a slow connection
     shows the brand, not a blank screen. It lifts by itself after the limit if the page never does.
     */
    private func pluginSettings() -> [String: Any] {
        let launchScreen: [String: Any] = [
            "launchAutoHide": true,
            "launchShowDuration": Self.launchScreenLimitMs,
            "backgroundColor": settings.brandColour.hex,
        ]
        return ["SplashScreen": launchScreen]
    }

    override func capacitorDidLoad() {
        guard let bridge, let webView,
              let capacitor = webView.navigationDelegate as? WebViewDelegationHandler else { return }
        // MA-06: files the web app hands over open in the phone's viewer; none outlive a restart.
        FilesPlugin.clearOpened()
        bridge.registerPluginInstance(FilesPlugin())
        bridgeGate = BridgeGate(inFrontOf: capacitor, trusting: [settings.server, bridge.config.localURL])
        bridgeGate?.install(in: webView.configuration.userContentController)
        pageErrors = PageErrors(inFrontOf: capacitor, appPages: bridge.config.localURL, retry: settings.startPage)
        webView.navigationDelegate = pageErrors
        // MA-05: an iPhone has no back button; a swipe from the edge goes back through the pages.
        webView.allowsBackForwardNavigationGestures = true
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let link = linkAtStart {
            open(link)
        }
    }

    /// MA-06: a HEACH link opened from outside (a partner's return, an SMS) loads in the app.
    func open(_ link: URL) {
        guard settings.isOurs(link), let page = settings.page(of: link) else { return }
        webView?.load(URLRequest(url: page))
    }
}

private extension UIColor {
    /// `#RRGGBB`, the form Capacitor's plugin settings take.
    var hex: String {
        var red: CGFloat = 0, green: CGFloat = 0, blue: CGFloat = 0, alpha: CGFloat = 0
        getRed(&red, green: &green, blue: &blue, alpha: &alpha)
        let byte = { (value: CGFloat) in Int((value * 255).rounded()) }
        return String(format: "#%02X%02X%02X", byte(red), byte(green), byte(blue))
    }
}
