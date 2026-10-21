package it.workbit.app;

import android.content.Context;

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
