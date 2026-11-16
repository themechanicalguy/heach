package in.heach;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Opens a file the web app has already fetched (a record, a report, a prescription) in the
 * phone's own viewer (MA-06). A web view cannot download the in-memory files the web app makes,
 * so "Download" would otherwise do nothing. The file sits in the app's private cache only until
 * the next file is opened or the app next starts; nothing is written to shared storage.
 */
@CapacitorPlugin(name = "HeachFiles")
public class FilesPlugin extends Plugin {

    private static final String FOLDER = "opened";

    /** Removes anything opened earlier; called at app start and before each new file. */
    static void clearOpened(Context context) {
        File[] files = new File(context.getCacheDir(), FOLDER).listFiles();
        if (files == null) return;
        for (File file : files) {
            file.delete();
        }
    }

    @PluginMethod
    public void open(PluginCall call) {
        String name = call.getString("name", "");
        String contentType = call.getString("contentType", "");
        String content = call.getString("contentBase64", "");
        // On the main thread: the page's address can only be read there.
        getActivity().runOnUiThread(() -> {
            if (!calledByHeach() || name.isEmpty() || contentType.isEmpty() || content.isEmpty()) {
                call.reject("refused");
                return;
            }
            try {
                show(write(name, Base64.decode(content, Base64.DEFAULT)), contentType);
                call.resolve();
            } catch (IOException | IllegalArgumentException e) {
                // No detail: a message could carry the file's name.
                call.reject("failed");
            }
        });
    }

    /** Only HEACH's own pages may hand files over, not a partner page open in the app. */
    private boolean calledByHeach() {
        String page = bridge.getWebView().getUrl();
        Uri server = Uri.parse(BuildConfig.SERVER_URL);
        return page != null && server.getAuthority().equals(Uri.parse(page).getAuthority());
    }

    private File write(String name, byte[] bytes) throws IOException {
        Context context = getContext();
        clearOpened(context);
        File folder = new File(context.getCacheDir(), FOLDER);
        folder.mkdirs();
        // The name comes from a record's title: keep it a plain file name.
        File file = new File(folder, name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_"));
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return file;
    }

    /** The phone's viewer for this type; with none installed, the share sheet (save or send). */
    private void show(File file, String contentType) {
        Context context = getContext();
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        Intent view = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, contentType)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            getActivity().startActivity(view);
        } catch (ActivityNotFoundException e) {
            Intent send = new Intent(Intent.ACTION_SEND)
                .setType(contentType)
                .putExtra(Intent.EXTRA_STREAM, uri)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(send, null));
        }
    }
}
