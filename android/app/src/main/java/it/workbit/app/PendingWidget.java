package it.workbit.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

/**
 * "Da approvare" for the owner and the managers: leave, permissions and
 * stamps waiting for them, the first three with how many in all. Fetches
 * fresh data by itself every half hour (WidgetStore.refreshFromServer).
 */
public class PendingWidget extends AppWidgetProvider {

    private static final int[] ROWS = {R.id.row0, R.id.row1, R.id.row2};
    private static final int[] RAILS = {R.id.row0_rail, R.id.row1_rail, R.id.row2_rail};
    private static final int[] ICONS = {R.id.row0_icon, R.id.row1_icon, R.id.row2_icon};
    private static final int[] TITLES = {R.id.row0_title, R.id.row1_title, R.id.row2_title};
    private static final int[] WHENS = {R.id.row0_when, R.id.row1_when, R.id.row2_when};

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
        final PendingResult pending = goAsync();
        WidgetStore.refreshFromServer(context, pending::finish);
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        render(context, manager, manager.getAppWidgetIds(new ComponentName(context, PendingWidget.class)));
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        WidgetStore.Snapshot snapshot = WidgetStore.read(context);
        WidgetStore.Team team = snapshot.team;

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_pending);
            int shown = team == null ? 0 : Math.min(3, team.pending.size());

            if (team != null && team.pendingCount > 0) {
                views.setViewVisibility(R.id.pending_count, View.VISIBLE);
                views.setTextViewText(R.id.pending_count, String.valueOf(team.pendingCount));
            } else {
                views.setViewVisibility(R.id.pending_count, View.GONE);
            }

            if (shown == 0) {
                views.setViewVisibility(R.id.pending_empty, View.VISIBLE);
                views.setTextViewText(
                    R.id.pending_empty,
                    team != null ? "Niente da approvare" : snapshot.hasData ? "Per titolare e responsabili" : "Apri Workbit"
                );
            } else {
                views.setViewVisibility(R.id.pending_empty, View.GONE);
            }

            for (int i = 0; i < ROWS.length; i++) {
                if (i < shown) {
                    String[] item = team.pending.get(i);
                    views.setViewVisibility(ROWS[i], View.VISIBLE);
                    views.setTextViewText(ICONS[i], item[0]);
                    views.setTextViewText(TITLES[i], item[1]);
                    views.setTextViewText(WHENS[i], item[2]);
                    views.setInt(RAILS[i], "setBackgroundResource", "1".equals(item[3]) ? R.drawable.widget_rail_amber : R.drawable.widget_rail_green);
                } else {
                    views.setViewVisibility(ROWS[i], View.GONE);
                }
            }

            views.setOnClickPendingIntent(R.id.widget_root, NextShiftWidget.openApp(context));
            manager.updateAppWidget(id, views);
        }
    }
}
