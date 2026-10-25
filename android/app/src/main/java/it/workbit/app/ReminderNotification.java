package it.workbit.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.Map;

/**
 * The shift reminders ("Tra 5 minuti inizi", "Turno finito"...) drawn by the
 * app rather than by the system, so the Entra / Esci button is right there
 * under the text. A tap on the reminder itself stamps too. The server sends
 * them as data to the apps that say they can draw them (lib/push.ts).
 */
final class ReminderNotification {

    private static final String CHANNEL = "workbit_shift_reminders";

    private ReminderNotification() {}

    static boolean handles(Map<String, String> data) {
        String type = data.get("type");
        return type != null && (type.startsWith("timelog.clock-in.") || type.startsWith("timelog.clock-out."));
    }

    static void show(Context context, Map<String, String> data) {
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        if (!manager.areNotificationsEnabled()) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Promemoria del turno", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Prima e all'inizio e alla fine del turno, con il tasto per timbrare.");
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }

        boolean entering = data.get("type").startsWith("timelog.clock-in.");
        String path = "/dashboard?azione=timbra&dir=" + (entering ? "in" : "out");
        int id = (data.get("type") + data.get("actionUrl")).hashCode();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_workbit)
            .setColor(Color.parseColor("#6D5CE7"))
            .setContentTitle(valueOr(data.get("title"), entering ? "Timbra l'entrata" : "Timbra l'uscita"))
            .setContentText(valueOr(data.get("body"), ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(open(context, path, id))
            .addAction(0, entering ? "Entra" : "Esci", open(context, path, id + 1));

        try {
            manager.notify(id, builder.build());
        } catch (SecurityException ignored) {
            // Notifications refused: nothing to show.
        }
    }

    private static PendingIntent open(Context context, String path, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(WorkbitWidgetsPlugin.EXTRA_OPEN, path);
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String valueOr(String value, String fallback) {
        return value == null || value.isEmpty() ? fallback : value;
    }
}
