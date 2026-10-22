package it.workbit.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

import com.getcapacitor.JSObject;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The page's way to the widgets (lib/native-widgets.ts): it hands over the
 * person's shifts and open entry; the widgets redraw and the "In servizio"
 * notification comes or goes.
 */
@CapacitorPlugin(name = "WorkbitWidgets")
public class WorkbitWidgetsPlugin extends Plugin {

    /** On the intent that opens the app: the page to show, "?azione=timbra" to stamp. */
    static final String EXTRA_OPEN = "workbit_open";

    private String pendingPath;
    private long pendingAt;

    static PendingIntent stampIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(EXTRA_OPEN, "/dashboard?azione=timbra");
        return PendingIntent.getActivity(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void load() {
        // Opened from "Esci" while the app was closed.
        if (getActivity() != null) take(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        take(intent);
    }

    /** Told to the page if it is listening, otherwise kept until it asks - for a minute at most. */
    private void take(Intent intent) {
        if (intent == null) return;
        String path = intent.getStringExtra(EXTRA_OPEN);
        if (path == null) return;
        intent.removeExtra(EXTRA_OPEN);
        if (hasListeners("open")) {
            JSObject data = new JSObject();
            data.put("path", path);
            notifyListeners("open", data);
        } else {
            pendingPath = path;
            pendingAt = System.currentTimeMillis();
        }
    }

    @PluginMethod
    public void takeOpen(PluginCall call) {
        JSObject result = new JSObject();
        if (pendingPath != null && System.currentTimeMillis() - pendingAt < 60_000) {
            result.put("path", pendingPath);
        }
        pendingPath = null;
        call.resolve(result);
    }

    @PluginMethod
    public void update(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null) {
            call.reject("Dati dei widget mancanti");
            return;
        }
        Context context = getContext();
        WidgetStore.save(context, snapshot);
        refreshAll(context);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        Context context = getContext();
        WidgetStore.clear(context);
        refreshAll(context);
        call.resolve();
    }

    private static void refreshAll(Context context) {
        NextShiftWidget.refresh(context);
        WeekWidget.refresh(context);
        ShiftNotification.sync(context, WidgetStore.read(context));
    }
}
