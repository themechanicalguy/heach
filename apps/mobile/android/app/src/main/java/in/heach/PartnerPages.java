package in.heach;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.util.HostMask;

/**
 * MA-03: partner pages (an identity partner's consent screen) that may open inside the app, but
 * never reach the app's plugins, as `BridgeGate` does on iPhone. Capacitor opens its bridge to
 * every host it is told may be navigated to, so the partner hosts are kept from Capacitor and
 * allowed here instead: the bridge then answers the HEACH server only. A WebView too old to
 * limit the bridge by origin hands it to every page, so there partner pages open in the browser.
 */
class PartnerPages extends PageErrors {

    private final HostMask partners;
    private final boolean bridgeLimitedByOrigin;

    PartnerPages(Bridge bridge, String[] hosts) {
        super(bridge);
        this.partners = HostMask.Parser.parse(hosts);
        this.bridgeLimitedByOrigin =
            WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER) &&
            !bridge.getConfig().isUsingLegacyBridge();
    }

    /** A partner page loads in the app; anything else goes to Capacitor (HEACH in the app, the rest to the browser). */
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        if (bridgeLimitedByOrigin && "https".equals(url.getScheme()) && partners.matches(url.getHost())) {
            return false;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }
}
