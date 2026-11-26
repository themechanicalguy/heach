import Capacitor
import WebKit

/**
 Only HEACH's own pages may reach the app's plugins (files, launch screen, vibration). WebKit
 gives every page and every frame inside it the bridge's message handler, so without this gate a
 partner page or an embedded frame could call the plugins too.
 */
final class BridgeGate: NSObject, WKScriptMessageHandler {
    private static let handlerName = "bridge"
    private weak var capacitor: WebViewDelegationHandler?
    private let trusted: [URL]

    init(inFrontOf capacitor: WebViewDelegationHandler, trusting origins: [URL]) {
        self.capacitor = capacitor
        self.trusted = origins
    }

    /// Takes the place of Capacitor's handler, which then hears only trusted pages.
    func install(in contentController: WKUserContentController) {
        contentController.removeScriptMessageHandler(forName: Self.handlerName)
        contentController.add(self, name: Self.handlerName)
    }

    func userContentController(_ contentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, isTrusted(message.frameInfo.securityOrigin) else { return }
        capacitor?.userContentController(contentController, didReceive: message)
    }

    private func isTrusted(_ origin: WKSecurityOrigin) -> Bool {
        trusted.contains { url in
            url.scheme == origin.protocol && url.host == origin.host && (url.port ?? 0) == origin.port
        }
    }
}
