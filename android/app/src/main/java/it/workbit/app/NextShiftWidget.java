package it.workbit.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;

/**
 * "Prossimo turno" on the home screen: the day, the hours, the department
 * and how long to go. Refreshed when the app hands over new shifts and every
 * half hour, so "tra 3 h" keeps counting down.
 */
public class NextShiftWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        render(context, manager, manager.getAppWidgetIds(new ComponentName(context, NextShiftWidget.class)));
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        WidgetStore.Snapshot snapshot = WidgetStore.read(context);
        long now = System.currentTimeMillis();
        WidgetStore.Shift next = snapshot.next(now);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_next_shift);
            if (next == null) {
                views.setTextViewText(R.id.next_day, "Nessun turno");
                views.setTextViewText(R.id.next_range, "in programma");
                views.setViewVisibility(R.id.next_area, View.GONE);
                views.setTextViewText(R.id.next_countdown, "");
            } else {
                views.setTextViewText(R.id.next_day, WidgetStore.day(next.start, now));
                views.setTextViewText(R.id.next_range, WidgetStore.range(next));
                if (next.area == null || next.area.isEmpty()) {
                    views.setViewVisibility(R.id.next_area, View.GONE);
                } else {
                    views.setViewVisibility(R.id.next_area, View.VISIBLE);
                    views.setTextViewText(R.id.next_area, next.area);
                }
                views.setTextViewText(R.id.next_countdown, WidgetStore.countdown(next, now));
            }
            views.setOnClickPendingIntent(R.id.widget_root, openApp(context));
            manager.updateAppWidget(id, views);
        }
    }

    static PendingIntent openApp(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
