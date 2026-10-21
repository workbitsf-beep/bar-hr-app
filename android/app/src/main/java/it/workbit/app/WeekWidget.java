package it.workbit.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Color;
import android.util.TypedValue;
import android.widget.RemoteViews;

/**
 * "La tua settimana" on the home screen: Monday to Sunday with the hours of
 * each shift, today in the app's violet, days off dashed, and the week's
 * total.
 */
public class WeekWidget extends AppWidgetProvider {

    private static final int[] LABELS = {R.id.day0_label, R.id.day1_label, R.id.day2_label, R.id.day3_label, R.id.day4_label, R.id.day5_label, R.id.day6_label};
    private static final int[] CELLS = {R.id.day0_cell, R.id.day1_cell, R.id.day2_cell, R.id.day3_cell, R.id.day4_cell, R.id.day5_cell, R.id.day6_cell};
    private static final int[] FROMS = {R.id.day0_from, R.id.day1_from, R.id.day2_from, R.id.day3_from, R.id.day4_from, R.id.day5_from, R.id.day6_from};
    private static final int[] TOS = {R.id.day0_to, R.id.day1_to, R.id.day2_to, R.id.day3_to, R.id.day4_to, R.id.day5_to, R.id.day6_to};

    private static final int VIOLET_INK = Color.parseColor("#5546C9");
    private static final int MUTED = Color.parseColor("#57536B");
    private static final int LILAC_INK = Color.parseColor("#3B2FA8");

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    static void refresh(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        render(context, manager, manager.getAppWidgetIds(new ComponentName(context, WeekWidget.class)));
    }

    private static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        WidgetStore.Snapshot snapshot = WidgetStore.read(context);
        long now = System.currentTimeMillis();
        long monday = WidgetStore.monday(now);

        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_week);
            long total = 0;

            for (int i = 0; i < 7; i++) {
                long day = WidgetStore.addDays(monday, i);
                boolean today = WidgetStore.sameDay(day, now);
                WidgetStore.Shift first = null;
                for (WidgetStore.Shift shift : snapshot.shifts) {
                    if (WidgetStore.sameDay(shift.start, day)) {
                        total += shift.end - shift.start;
                        if (first == null) first = shift;
                    }
                }

                views.setTextViewText(LABELS[i], WidgetStore.weekday(day));
                views.setTextColor(LABELS[i], today ? VIOLET_INK : MUTED);

                if (first == null) {
                    views.setTextViewText(FROMS[i], "riposo");
                    views.setTextViewText(TOS[i], "");
                    views.setTextColor(FROMS[i], MUTED);
                    views.setTextViewTextSize(FROMS[i], TypedValue.COMPLEX_UNIT_SP, 10f);
                    views.setInt(CELLS[i], "setBackgroundResource", R.drawable.widget_day_off);
                } else {
                    int ink = today ? Color.WHITE : LILAC_INK;
                    views.setTextViewText(FROMS[i], WidgetStore.hour(WidgetStore.clock(first.start)));
                    views.setTextViewText(TOS[i], "–" + WidgetStore.hour(WidgetStore.endClock(first.start, first.end)));
                    views.setTextColor(FROMS[i], ink);
                    views.setTextColor(TOS[i], ink);
                    views.setTextViewTextSize(FROMS[i], TypedValue.COMPLEX_UNIT_SP, 14f);
                    views.setInt(CELLS[i], "setBackgroundResource", today ? R.drawable.widget_day_today : R.drawable.widget_day_shift);
                }
            }

            views.setTextViewText(R.id.week_total, WidgetStore.hours(total));
            views.setTextViewText(R.id.week_range, WidgetStore.monthDays(monday, WidgetStore.addDays(monday, 6)));
            views.setOnClickPendingIntent(R.id.widget_root, NextShiftWidget.openApp(context));
            manager.updateAppWidget(id, views);
        }
    }
}
