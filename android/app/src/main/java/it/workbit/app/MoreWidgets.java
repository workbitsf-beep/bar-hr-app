package it.workbit.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.widget.RemoteViews;

import java.text.NumberFormat;

/**
 * The second round of widgets: for the owner and the managers Ritardi, La
 * giornata, Ore della settimana and Plancia; for everyone Con chi lavori,
 * Ore del mese and Da fare oggi. Each reads what the app or the last
 * refresh left (WidgetStore) and refreshes by itself like the others.
 *
 * The day's chart and the month's ring are drawn into a picture: a home
 * screen widget on Android cannot place bars by the minute otherwise.
 */
public final class MoreWidgets {

    private MoreWidgets() {}

    private static final int AMBER = Color.parseColor("#F59E0B");
    private static final int AMBER_INK = Color.parseColor("#92400E");
    private static final int GREEN = Color.parseColor("#10B981");
    private static final int GREEN_INK = Color.parseColor("#047857");
    private static final int SKY = Color.parseColor("#0EA5E9");
    private static final int VIOLET = Color.parseColor("#6D5CE7");
    private static final int INK = Color.parseColor("#1B1830");
    private static final int MUTED = Color.parseColor("#57536B");
    private static final int TRACK = Color.parseColor("#F3F1F8");
    private static final int LILAC_BAR = Color.parseColor("#C9C2F5");
    private static final int DONE_BAR = Color.parseColor("#D6D1EA");
    private static final int NOW_LINE = Color.parseColor("#E0868F");

    /** Draws itself, then fetches fresh data and draws again. */
    public abstract static class Base extends AppWidgetProvider {
        abstract int layout();

        abstract void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now);

        @Override
        public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
            draw(context, manager, ids);
            final PendingResult pending = goAsync();
            WidgetStore.refreshFromServer(context, pending::finish);
        }

        void draw(Context context, AppWidgetManager manager, int[] ids) {
            if (ids == null || ids.length == 0) return;
            WidgetStore.Snapshot snapshot = WidgetStore.read(context);
            long now = System.currentTimeMillis();
            for (int id : ids) {
                RemoteViews views = new RemoteViews(context.getPackageName(), layout());
                fill(context, views, snapshot, now);
                views.setOnClickPendingIntent(R.id.widget_root, NextShiftWidget.openApp(context));
                manager.updateAppWidget(id, views);
            }
        }
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Base[] all = {new Late(), new Day(), new WeekHours(), new Board(), new Mates(), new Month(), new Tasks()};
        for (Base widget : all) {
            widget.draw(context, manager, manager.getAppWidgetIds(new ComponentName(context, widget.getClass())));
        }
    }

    private static String floorOnly(WidgetStore.Snapshot snapshot) {
        return snapshot.hasData ? "Per titolare e responsabili" : "Apri Workbit";
    }

    private static String hours(double value) {
        return Math.round(value) == value ? (long) value + " h" : String.format(WidgetStore.ITALIAN, "%.1f h", value);
    }

    // ---------- Ritardi ----------

    public static class Late extends Base {
        private static final int[] ROWS = {R.id.late_row0, R.id.late_row1, R.id.late_row2};
        private static final int[] RAILS = {R.id.late_rail0, R.id.late_rail1, R.id.late_rail2};
        private static final int[] NAMES = {R.id.late_name0, R.id.late_name1, R.id.late_name2};
        private static final int[] DETAILS = {R.id.late_detail0, R.id.late_detail1, R.id.late_detail2};
        private static final int[] PILLS = {R.id.late_pill0, R.id.late_pill1, R.id.late_pill2};

        @Override
        int layout() {
            return R.layout.widget_late;
        }

        @Override
        void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now) {
            WidgetStore.Team team = snapshot.team;
            views.setTextViewText(R.id.late_time, "alle " + WidgetStore.clock(now));
            int shown = 0;
            if (team != null) {
                for (String[] due : team.late) {
                    if (shown == 3) break;
                    row(views, shown++, due[0], due[1], WidgetStore.lateMinutes(snapshot, due, now) + " min", true);
                }
                for (String[] due : team.arriving) {
                    if (shown == 3) break;
                    row(views, shown++, due[0], due[1], "tra " + due[2] + " min", false);
                }
            }
            for (int i = shown; i < 3; i++) views.setViewVisibility(ROWS[i], View.GONE);
            views.setViewVisibility(R.id.late_empty, shown == 0 ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.late_empty, team == null ? floorOnly(snapshot) : "Tutti puntuali");
        }

        private void row(RemoteViews views, int i, String name, String detail, String pill, boolean late) {
            views.setViewVisibility(ROWS[i], View.VISIBLE);
            views.setTextViewText(NAMES[i], name);
            views.setTextViewText(DETAILS[i], detail);
            views.setTextViewText(PILLS[i], pill);
            views.setTextColor(PILLS[i], late ? AMBER_INK : MUTED);
            views.setInt(PILLS[i], "setBackgroundResource", late ? R.drawable.widget_pill_amber : R.drawable.widget_pill);
            views.setInt(RAILS[i], "setBackgroundResource", late ? R.drawable.widget_rail_amber : R.drawable.widget_rail_done);
        }
    }

    // ---------- La giornata ----------

    public static class Day extends Base {
        @Override
        int layout() {
            return R.layout.widget_day;
        }

        @Override
        void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now) {
            WidgetStore.Team team = snapshot.team;
            if (team == null || team.day.isEmpty()) {
                views.setViewVisibility(R.id.day_chart, View.GONE);
                views.setViewVisibility(R.id.day_empty, View.VISIBLE);
                views.setTextViewText(R.id.day_empty, team == null ? floorOnly(snapshot) : "Nessun turno oggi");
                views.setTextViewText(R.id.day_people, "");
                return;
            }
            views.setViewVisibility(R.id.day_chart, View.VISIBLE);
            views.setViewVisibility(R.id.day_empty, View.GONE);
            java.util.Set<String> people = new java.util.HashSet<>();
            for (String[] row : team.day) people.add(row[0]);
            views.setTextViewText(R.id.day_people, people.size() + " persone");
            views.setImageViewBitmap(R.id.day_chart, chart(context, team, now));
        }

        private static Bitmap chart(Context context, WidgetStore.Team team, long now) {
            float d = context.getResources().getDisplayMetrics().density;
            int rows = Math.min(5, team.day.size());
            int width = Math.round(300 * d);
            float label = 64 * d;
            float rowHeight = 12 * d;
            float gap = 6 * d;
            float top = 14 * d;
            int height = Math.round(top + rows * (rowHeight + gap));
            Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
            Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
            long span = Math.max(3_600_000L, team.dayTo - team.dayFrom);
            float chartWidth = width - label;

            text.setTextSize(9 * d);
            text.setColor(MUTED);
            long firstHour = (long) Math.ceil(team.dayFrom / 3_600_000.0);
            long lastHour = team.dayTo / 3_600_000L;
            long step = Math.max(1, (lastHour - firstHour) / 5);
            for (long hour = firstHour; hour <= lastHour; hour += step) {
                float x = label + (hour * 3_600_000L - team.dayFrom) / (float) span * chartWidth;
                String mark = WidgetStore.hour(WidgetStore.clock(hour * 3_600_000L));
                canvas.drawText(mark, Math.min(Math.max(x - 4 * d, label), width - 12 * d), 9 * d, text);
            }

            text.setTextSize(11 * d);
            for (int i = 0; i < rows; i++) {
                String[] row = team.day.get(i);
                float y = top + i * (rowHeight + gap);
                text.setColor("late".equals(row[3]) ? AMBER_INK : INK);
                canvas.drawText(ellipsize(row[0], text, label - 6 * d), 0, y + rowHeight - 2 * d, text);
                fill.setColor(TRACK);
                canvas.drawRoundRect(new RectF(label, y, width, y + rowHeight), rowHeight / 2, rowHeight / 2, fill);
                long start = Long.parseLong(row[1]);
                long end = Long.parseLong(row[2]);
                float left = label + (start - team.dayFrom) / (float) span * chartWidth;
                float right = Math.max(left + 6 * d, label + (end - team.dayFrom) / (float) span * chartWidth);
                fill.setColor("in".equals(row[3]) ? SKY : "late".equals(row[3]) ? AMBER : "done".equals(row[3]) ? DONE_BAR : LILAC_BAR);
                canvas.drawRoundRect(new RectF(left, y, Math.min(right, width), y + rowHeight), rowHeight / 2, rowHeight / 2, fill);
            }

            float position = (now - team.dayFrom) / (float) span;
            if (position > 0 && position < 1) {
                fill.setColor(NOW_LINE);
                float x = label + position * chartWidth;
                canvas.drawRoundRect(new RectF(x - d, top - 3 * d, x + d, height), d, d, fill);
            }
            return bitmap;
        }

        private static String ellipsize(String value, Paint paint, float width) {
            if (paint.measureText(value) <= width) return value;
            String cut = value;
            while (cut.length() > 1 && paint.measureText(cut + "…") > width) cut = cut.substring(0, cut.length() - 1);
            return cut + "…";
        }
    }

    // ---------- Ore della settimana ----------

    public static class WeekHours extends Base {
        @Override
        int layout() {
            return R.layout.widget_week_hours;
        }

        @Override
        void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now) {
            WidgetStore.Team team = snapshot.team;
            boolean has = team != null && team.weekWorked >= 0;
            views.setViewVisibility(R.id.wh_body, has ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.wh_empty, has ? View.GONE : View.VISIBLE);
            views.setTextViewText(R.id.wh_empty, floorOnly(snapshot));
            if (!has) {
                views.setTextViewText(R.id.wh_label, "");
                return;
            }
            views.setTextViewText(R.id.wh_label, team.weekLabel);
            views.setTextViewText(R.id.wh_worked, hours(team.weekWorked));
            views.setTextViewText(R.id.wh_planned, "di " + hours(team.weekPlanned));
            if (team.weekCost >= 0) {
                views.setViewVisibility(R.id.wh_cost_box, View.VISIBLE);
                NumberFormat format = NumberFormat.getNumberInstance(WidgetStore.ITALIAN);
                format.setMaximumFractionDigits(0);
                views.setTextViewText(R.id.wh_cost, format.format(team.weekCost) + " €");
                views.setTextViewText(R.id.wh_cost_note, team.missingRates > 0 ? team.missingRates + " senza paga oraria" : "costo stimato");
                views.setTextColor(R.id.wh_cost_note, team.missingRates > 0 ? AMBER_INK : MUTED);
            } else {
                views.setViewVisibility(R.id.wh_cost_box, View.GONE);
            }
            int percent = team.weekPlanned > 0 ? (int) Math.min(100, Math.round(team.weekWorked / team.weekPlanned * 100)) : 0;
            views.setProgressBar(R.id.wh_progress, 100, percent, false);
        }
    }

    // ---------- Plancia ----------

    public static class Board extends Base {
        private static final int[] ROWS = {R.id.bp_row0, R.id.bp_row1, R.id.bp_row2};
        private static final int[] RAILS = {R.id.bp_rail0, R.id.bp_rail1, R.id.bp_rail2};
        private static final int[] ICONS = {R.id.bp_icon0, R.id.bp_icon1, R.id.bp_icon2};
        private static final int[] TITLES = {R.id.bp_title0, R.id.bp_title1, R.id.bp_title2};
        private static final int[] WHENS = {R.id.bp_when0, R.id.bp_when1, R.id.bp_when2};

        @Override
        int layout() {
            return R.layout.widget_board;
        }

        @Override
        void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now) {
            WidgetStore.Team team = snapshot.team;
            views.setTextViewText(R.id.board_venue, snapshot.venue.isEmpty() ? "Workbit" : snapshot.venue);
            views.setTextViewText(R.id.board_time, WidgetStore.clock(now));
            views.setViewVisibility(R.id.board_body, team == null ? View.GONE : View.VISIBLE);
            views.setViewVisibility(R.id.board_empty, team == null ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.board_empty, floorOnly(snapshot));
            if (team == null) return;

            views.setTextViewText(R.id.board_in, String.valueOf(team.inServiceInitials.size()));
            views.setTextViewText(R.id.board_of, "di " + team.expected);
            views.setTextViewText(R.id.board_in_names, join(team.inServiceNames, 3));
            views.setTextViewText(R.id.board_late, String.valueOf(team.late.size()));
            StringBuilder late = new StringBuilder();
            for (int i = 0; i < Math.min(2, team.late.size()); i++) {
                if (i > 0) late.append(" · ");
                late.append(team.late.get(i)[0]).append(' ').append(WidgetStore.lateMinutes(snapshot, team.late.get(i), now)).append('′');
            }
            views.setTextViewText(R.id.board_late_names, team.late.isEmpty() ? "tutti puntuali" : late.toString());
            views.setTextColor(R.id.board_late_names, team.late.isEmpty() ? GREEN_INK : AMBER_INK);
            views.setInt(R.id.board_late_rail, "setBackgroundResource", team.late.isEmpty() ? R.drawable.widget_rail_green : R.drawable.widget_rail_amber);

            views.setTextViewText(R.id.board_pending_count, String.valueOf(team.pendingCount));
            int shown = Math.min(3, team.pending.size());
            for (int i = 0; i < 3; i++) {
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
            views.setViewVisibility(R.id.board_pending_empty, shown == 0 ? View.VISIBLE : View.GONE);
        }

        private static String join(java.util.List<String> names, int max) {
            if (names.isEmpty()) return "nessuno";
            StringBuilder out = new StringBuilder();
            for (int i = 0; i < Math.min(max, names.size()); i++) {
                if (i > 0) out.append(", ");
                out.append(names.get(i));
            }
            if (names.size() > max) out.append(" e altri ").append(names.size() - max);
            return out.toString();
        }
    }

    // ---------- Con chi lavori ----------

    public static class Mates extends Base {
        private static final int[] ROWS = {R.id.mate_row0, R.id.mate_row1, R.id.mate_row2};
        private static final int[] AVATARS = {R.id.mate_avatar0, R.id.mate_avatar1, R.id.mate_avatar2};
        private static final int[] NAMES = {R.id.mate_name0, R.id.mate_name1, R.id.mate_name2};

        @Override
        int layout() {
            return R.layout.widget_mates;
        }

        @Override
        void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now) {
            WidgetStore.Mates mates = snapshot.mates;
            if (mates == null) {
                views.setTextViewText(R.id.mate_when, snapshot.hasData ? "Nessun turno in programma" : "Apri Workbit");
                for (int row : ROWS) views.setViewVisibility(row, View.GONE);
                views.setTextViewText(R.id.mate_more, "");
                return;
            }
            String day = WidgetStore.day(mates.start, now);
            int dot = day.indexOf(" · ");
            views.setTextViewText(R.id.mate_when, (dot > 0 ? day.substring(0, dot) : day) + " · "
                + WidgetStore.clock(mates.start) + "–" + WidgetStore.endClock(mates.start, mates.end));
            for (int i = 0; i < 3; i++) {
                if (i < mates.people.size()) {
                    views.setViewVisibility(ROWS[i], View.VISIBLE);
                    views.setTextViewText(AVATARS[i], mates.people.get(i)[1]);
                    views.setTextViewText(NAMES[i], mates.people.get(i)[0]);
                } else {
                    views.setViewVisibility(ROWS[i], View.GONE);
                }
            }
            views.setTextViewText(R.id.mate_more, mates.people.isEmpty() ? "Da solo"
                : mates.people.size() > 3 ? "e altri " + (mates.people.size() - 3) : "");
        }
    }

    // ---------- Ore del mese ----------

    public static class Month extends Base {
        @Override
        int layout() {
            return R.layout.widget_month;
        }

        @Override
        void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now) {
            double worked = Math.max(0, snapshot.monthHours);
            double planned = snapshot.monthPlannedHours;
            views.setTextViewText(R.id.month_label, ("ORE DI " + (snapshot.month.isEmpty() ? "QUESTO MESE" : snapshot.month)).toUpperCase(WidgetStore.ITALIAN));
            views.setTextViewText(R.id.month_worked, hours(worked));
            views.setTextViewText(R.id.month_planned, planned > 0 ? "di " + hours(planned) : "lavorate");
            float progress = planned > 0 ? (float) Math.min(1, worked / planned) : 0;
            views.setImageViewBitmap(R.id.month_ring, ring(context, progress));
        }

        private static Bitmap ring(Context context, float progress) {
            float d = context.getResources().getDisplayMetrics().density;
            int size = Math.round(92 * d);
            float stroke = 9 * d;
            Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(stroke);
            paint.setStrokeCap(Paint.Cap.ROUND);
            RectF box = new RectF(stroke / 2, stroke / 2, size - stroke / 2, size - stroke / 2);
            paint.setColor(Color.parseColor("#EBE8F6"));
            canvas.drawArc(box, 0, 360, false, paint);
            paint.setColor(VIOLET);
            canvas.drawArc(box, -90, Math.max(1, 360 * progress), false, paint);
            return bitmap;
        }
    }

    // ---------- Da fare oggi ----------

    public static class Tasks extends Base {
        private static final int[] ROWS = {R.id.task_row0, R.id.task_row1, R.id.task_row2, R.id.task_row3};
        private static final int[] BOXES = {R.id.task_box0, R.id.task_box1, R.id.task_box2, R.id.task_box3};
        private static final int[] TITLES = {R.id.task_title0, R.id.task_title1, R.id.task_title2, R.id.task_title3};
        private static final int[] URGENT = {R.id.task_urgent0, R.id.task_urgent1, R.id.task_urgent2, R.id.task_urgent3};

        @Override
        int layout() {
            return R.layout.widget_tasks;
        }

        @Override
        void fill(Context context, RemoteViews views, WidgetStore.Snapshot snapshot, long now) {
            views.setTextViewText(R.id.task_count, snapshot.tasksTotal > 0 ? snapshot.tasksDone + " di " + snapshot.tasksTotal + " fatte" : "");
            int shown = Math.min(4, snapshot.tasks.size());
            for (int i = 0; i < 4; i++) {
                if (i < shown) {
                    String[] task = snapshot.tasks.get(i);
                    boolean done = "1".equals(task[1]);
                    views.setViewVisibility(ROWS[i], View.VISIBLE);
                    views.setTextViewText(TITLES[i], task[0]);
                    views.setTextColor(TITLES[i], done ? MUTED : INK);
                    views.setTextViewText(BOXES[i], done ? "✓" : "");
                    views.setInt(BOXES[i], "setBackgroundResource", done ? R.drawable.widget_box_done : R.drawable.widget_box);
                    views.setViewVisibility(URGENT[i], "1".equals(task[2]) && !done ? View.VISIBLE : View.GONE);
                } else {
                    views.setViewVisibility(ROWS[i], View.GONE);
                }
            }
            views.setViewVisibility(R.id.task_empty, shown == 0 ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.task_empty, snapshot.hasData ? "Niente da fare oggi" : "Apri Workbit");
        }
    }
}
