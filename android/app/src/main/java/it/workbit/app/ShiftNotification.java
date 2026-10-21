package it.workbit.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Android's counterpart of the iPhone's Live Activity: while an entry is
 * open, a notification that stays put says "In servizio" with a counter
 * that runs by itself from the entry time. It goes when the exit is stamped.
 */
final class ShiftNotification {

    private static final String CHANNEL = "workbit_in_service";
    private static final int ID = 7301;
    private static final String PREFS = "workbit_widgets";
    private static final String SHOWN = "in_service_since";

    private ShiftNotification() {}

    static void sync(Context context, WidgetStore.Snapshot snapshot) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        if (snapshot.open == null) {
            manager.cancel(ID);
            prefs.edit().remove(SHOWN).apply();
            return;
        }

        // Shown once per entry: posting it again at every app opening would
        // bring it back after the person had swiped it away.
        if (prefs.getLong(SHOWN, 0) == snapshot.open.since) return;
        if (!manager.areNotificationsEnabled()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "In servizio", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Il tempo dall'entrata, finché non timbri l'uscita.");
            channel.setShowBadge(false);
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }

        WidgetStore.Open open = snapshot.open;
        String place = open.area == null || open.area.isEmpty() ? snapshot.venue : snapshot.venue + " · " + open.area;
        String detail = "Entrata " + WidgetStore.clock(open.since)
            + (open.end > open.since ? " · fine turno " + WidgetStore.endClock(open.since, open.end) : "");

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workbit)
            .setColor(Color.parseColor("#6D5CE7"))
            .setContentTitle("In servizio · " + place)
            .setContentText(detail)
            .setWhen(open.since)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(NextShiftWidget.openApp(context));

        try {
            manager.notify(ID, builder.build());
            prefs.edit().putLong(SHOWN, open.since).apply();
        } catch (SecurityException ignored) {
            // Notifications refused: nothing to show.
        }
    }
}
