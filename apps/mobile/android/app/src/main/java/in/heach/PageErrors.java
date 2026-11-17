package in.heach;

import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * What the app shows when a page cannot be had (MA-05). Capacitor swaps in the offline page for
 * every failure, including an answer such as "not found", which then tells a connected user to
 * check their internet. Here the web app's own page stays for those; only a server fault
 * (5xx) gets the app's page, with its own words, and an unreachable server the offline page.
 */
class PageErrors extends BridgeWebViewClient {

    private final String errorPage;
    private boolean onErrorPage;

    PageErrors(Bridge bridge) {
        super(bridge);
        this.errorPage = bridge.getErrorUrl();
    }

    /** Whether the web view is on the app's own error page rather than a page of the web app. */
    boolean isShowing(WebView webView) {
        String url = webView.getUrl();
        return url != null && url.startsWith(errorPage);
    }

    /** Not passed on to Capacitor, which would load the offline page for every status. */
    @Override
    public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
        if (request.isForMainFrame() && response.getStatusCode() >= 500) {
            view.loadUrl(errorPage + "&why=server");
        }
    }

    /** Once a page loads after the error page, the failed pages behind it are not history. */
    @Override
    public void doUpdateVisitedHistory(WebView view, String url, boolean isReload) {
        super.doUpdateVisitedHistory(view, url, isReload);
        boolean nowOnErrorPage = isShowing(view);
        if (onErrorPage && !nowOnErrorPage) view.clearHistory();
        onErrorPage = nowOnErrorPage;
    }
}
