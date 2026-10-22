package it.workbit.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/**
 * "In servizio" for the owner and the managers: how many are in now against
 * those on today, with their initials. Fetches fresh data by itself every
 * half hour (WidgetStore.refreshFromServer).
 */
public class TeamNowWidget extends AppWidgetProvider {

    private static final int[] AVATARS = {R.id.team_a0, R.id.team_a1, R.id.team_a2, R.id.team_a3, R.id.team_a4};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
        final PendingResult pending = goAsync();
        WidgetStore.refreshFromServer(context, pending::finish);
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        render(context, manager, manager.getAppWidgetIds(new ComponentName(context, TeamNowWidget.class)));
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        WidgetStore.Snapshot snapshot = WidgetStore.read(context);
        WidgetStore.Team team = snapshot.team;

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_team_now);
            if (team == null) {
                views.setTextViewText(R.id.team_count, "");
                views.setTextViewText(R.id.team_of, snapshot.hasData ? "Per titolare e responsabili" : "Apri Workbit");
                for (int avatar : AVATARS) views.setViewVisibility(avatar, View.GONE);
            } else {
                views.setTextViewText(R.id.team_count, String.valueOf(team.inServiceInitials.size()));
                views.setTextViewText(R.id.team_of, "di " + team.expected);
                for (int i = 0; i < AVATARS.length; i++) {
                    if (i < team.inServiceInitials.size()) {
                        views.setViewVisibility(AVATARS[i], View.VISIBLE);
                        views.setTextViewText(AVATARS[i], team.inServiceInitials.get(i));
                    } else {
                        views.setViewVisibility(AVATARS[i], View.GONE);
                    }
                }
            }
            views.setOnClickPendingIntent(R.id.widget_root, NextShiftWidget.openApp(context));
            manager.updateAppWidget(id, views);
        }
    }
}
