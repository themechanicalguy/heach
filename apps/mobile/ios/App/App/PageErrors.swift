import Capacitor
import WebKit

/**
 What the app shows when a page cannot be had (MA-05). An unreachable server gets the app's
 offline page and a server fault (5xx) the same page with its own words; any other answer, such
 as "not found", keeps the web app's own page. Everything else goes on to Capacitor's handler.
 */
final class PageErrors: NSObject, WKNavigationDelegate {
    private weak var capacitor: WebViewDelegationHandler?
    private let offlinePage: URL
    private let retry: URL

    /// The failures that mean the server could not be reached, as opposed to a cancelled load.
    private static let unreachable: Set<Int> = [
        NSURLErrorNotConnectedToInternet, NSURLErrorNetworkConnectionLost, NSURLErrorCannotConnectToHost,
        NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed, NSURLErrorTimedOut,
        NSURLErrorInternationalRoamingOff, NSURLErrorDataNotAllowed, NSURLErrorSecureConnectionFailed,
    ]

    init(inFrontOf capacitor: WebViewDelegationHandler, appPages: URL, retry: URL) {
        self.capacitor = capacitor
        self.offlinePage = appPages.appendingPathComponent("offline.html")
        self.retry = retry
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let status = (navigationResponse.response as? HTTPURLResponse)?.statusCode ?? 0
        guard navigationResponse.isForMainFrame, status >= 500 else {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        show(serverFault: true, in: webView)
    }

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showIfUnreachable(error, in: webView)
    }

    // swiftlint:disable:next implicitly_unwrapped_optional
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        capacitor?.webView(webView, didFail: navigation, withError: error)
        showIfUnreachable(error, in: webView)
    }

    private func showIfUnreachable(_ error: Error, in webView: WKWebView) {
        let failure = error as NSError
        guard failure.domain == NSURLErrorDomain, Self.unreachable.contains(failure.code) else { return }
        show(serverFault: false, in: webView)
    }

    /// "Try again" there returns to the start page.
    private func show(serverFault: Bool, in webView: WKWebView) {
        var page = URLComponents(url: offlinePage, resolvingAgainstBaseURL: false)
        page?.queryItems = [URLQueryItem(name: "to", value: retry.absoluteString)]
            + (serverFault ? [URLQueryItem(name: "why", value: "server")] : [])
        if let url = page?.url {
            webView.load(URLRequest(url: url))
        }
    }

    // Every other navigation decision and event is Capacitor's.

    override func responds(to aSelector: Selector!) -> Bool {
        super.responds(to: aSelector) || capacitor?.responds(to: aSelector) == true
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        capacitor?.responds(to: aSelector) == true ? capacitor : nil
    }
}
