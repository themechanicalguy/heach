package in.heach;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;

/** The whole native app: a secured window around the hosted web app (ADR 0016). */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // MA-04: any screen may show health data, so none may be captured or shown in recents.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        config = webAppConfig();
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, backThroughPages());
    }

    private CapConfig webAppConfig() {
        return new CapConfig.Builder(this)
            .setServerUrl(BuildConfig.SERVER_URL)
            .setStartPath(BuildConfig.START_PATH)
            // MA-05: shown instead of the browser's error page when the server cannot be reached.
            // "Try again" there returns to the start page.
            .setErrorPath("offline.html?to=" + Uri.encode(BuildConfig.SERVER_URL + BuildConfig.START_PATH))
            // MA-03: partner pages that may open in the app; anything else opens in the browser.
            .setAllowNavigation(partnerHosts())
            // Lets the web app tell which app it is running in (MA-08).
            .setAppendedUserAgentString("HeachApp/" + BuildConfig.FLAVOR)
            // Capacitor logs page addresses; keep them out of release logs.
            .setLoggingEnabled(BuildConfig.DEBUG)
            .setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            .create();
    }

    private static String[] partnerHosts() {
        String hosts = BuildConfig.ALLOW_NAVIGATION.trim();
        return hosts.isEmpty() ? new String[0] : hosts.split("\\s*,\\s*");
    }

    /** MA-06: a HEACH link opened from outside (a partner's return, an SMS) loads in the app. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri link = intent.getData();
        Uri server = Uri.parse(BuildConfig.SERVER_URL);
        boolean ours =
            link != null && "https".equals(link.getScheme()) && server.getAuthority().equals(link.getAuthority());
        if (ours && bridge != null) {
            bridge.getWebView().loadUrl(link.toString());
        }
    }

    /** MA-05: back walks the page history and leaves the app from the first page. */
    private OnBackPressedCallback backThroughPages() {
        return new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = bridge == null ? null : bridge.getWebView();
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        };
    }
}
