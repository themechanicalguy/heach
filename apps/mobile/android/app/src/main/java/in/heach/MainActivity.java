package in.heach;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import org.json.JSONException;
import org.json.JSONObject;

/** The whole native app: a secured window around the hosted web app (ADR 0016). */
public class MainActivity extends BridgeActivity {

    private static final int LAUNCH_SCREEN_LIMIT_MS = 10_000;
    private PageErrors pageErrors;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // MA-04: any screen may show health data, so none may be captured or shown in recents.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
        config = webAppConfig();
        // MA-06: files the web app hands over open in the phone's viewer; none outlive a restart.
        FilesPlugin.clearOpened(this);
        registerPlugin(FilesPlugin.class);
        super.onCreate(savedInstanceState);
        // The first page is still on its way, so this client is in place before any answer.
        pageErrors = new PartnerPages(bridge, partnerHosts());
        bridge.setWebViewClient(pageErrors);
        getOnBackPressedDispatcher().addCallback(this, backThroughPages());
    }

    /**
     * The session cookie changes each time it is used and the web view writes cookies to disk
     * only now and then. Android may close the app any time after this point; with the old cookie
     * on disk the next start would look like a replay and sign the user out everywhere (SE-07).
     */
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    private CapConfig webAppConfig() {
        return new CapConfig.Builder(this)
            .setServerUrl(BuildConfig.SERVER_URL)
            .setStartPath(BuildConfig.START_PATH)
            // MA-05: shown instead of the browser's error page when the server cannot be reached.
            // "Try again" there returns to the start page.
            .setErrorPath("offline.html?to=" + Uri.encode(BuildConfig.SERVER_URL + BuildConfig.START_PATH))
            // MA-03: no hosts besides the server. Capacitor opens its bridge to each host listed
            // here, so the partner pages that may open in the app are allowed by PartnerPages.
            // Lets the web app tell which app, and which build of it, it is running in (MA-08).
            .setAppendedUserAgentString("HeachApp/" + BuildConfig.FLAVOR + " HeachShell/" + BuildConfig.VERSION_CODE)
            // Capacitor logs page addresses; keep them out of release logs.
            .setLoggingEnabled(BuildConfig.DEBUG)
            .setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            .setPluginsConfiguration(pluginSettings())
            .create();
    }

    /**
     * MA-09: the launch screen stays until the page says it can be used, so a slow connection
     * shows the brand, not a blank screen. It lifts by itself after the limit if the page never does.
     */
    private static JSONObject pluginSettings() {
        try {
            JSONObject launchScreen = new JSONObject()
                .put("launchAutoHide", true)
                .put("launchShowDuration", LAUNCH_SCREEN_LIMIT_MS);
            return new JSONObject().put("SplashScreen", launchScreen);
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String[] partnerHosts() {
        String hosts = BuildConfig.ALLOW_NAVIGATION.trim();
        return hosts.isEmpty() ? new String[0] : hosts.split("\\s*,\\s*");
    }

    /** A link to the HEACH server itself: the only kind the app loads when asked from outside. */
    private static boolean isOurs(Uri link) {
        Uri server = Uri.parse(BuildConfig.SERVER_URL);
        return link != null && "https".equals(link.getScheme()) && server.getAuthority().equals(link.getAuthority());
    }

    /**
     * MA-06: a HEACH link opened from outside (a partner's return, an SMS) loads in the app.
     * Capacitor also calls this with the link that started the app. Only the link's page is
     * taken; the server is always the one this app was built for.
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri link = intent.getData();
        if (isOurs(link) && bridge != null) {
            String origin = link.getScheme() + "://" + link.getEncodedAuthority();
            bridge.getWebView().loadUrl(BuildConfig.SERVER_URL + link.toString().substring(origin.length()));
        }
    }

    /**
     * MA-05: back walks the page history and leaves the app from the first page. The offline page
     * is a dead end: going back from it would only load the page that failed again.
     */
    private OnBackPressedCallback backThroughPages() {
        return new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = bridge == null ? null : bridge.getWebView();
                if (webView != null && webView.canGoBack() && !pageErrors.isShowing(webView)) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        };
    }
}
