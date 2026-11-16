package in.heach;

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
            // Lets the web app tell which app it is running in (MA-08).
            .setAppendedUserAgentString("HeachApp/" + BuildConfig.FLAVOR)
            // Capacitor logs page addresses; keep them out of release logs.
            .setLoggingEnabled(BuildConfig.DEBUG)
            .setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            .create();
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
