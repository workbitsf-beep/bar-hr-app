package it.workbit.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * What the page hands over for the widgets (app/api/widgets): the person's
 * shifts around this week and the entry they are working on. Kept on the
 * phone, so the widgets work out "next shift" and "this week" by themselves
 * as the hours pass.
 */
final class WidgetStore {

    private static final String PREFS = "workbit_widgets";
    private static final String KEY = "snapshot";
    static final Locale ITALIAN = Locale.ITALIAN;

    static final class Shift {
        final long start;
        final long end;
        final String area;

        Shift(long start, long end, String area) {
            this.start = start;
            this.end = end;
            this.area = area;
        }
    }

    static final class Open {
        final long since;
        final long end;
        final String area;

        Open(long since, long end, String area) {
            this.since = since;
            this.end = end;
            this.area = area;
        }
    }

    static final class Snapshot {
        String venue = "";
        /** "ottobre" and the month's closed hours, for "Ore di ottobre: 86 h". */
        String month = "";
        double monthHours = -1;
        final List<Shift> shifts = new ArrayList<>();
        Open open;

        Shift next(long now) {
            for (Shift shift : shifts) {
                if (shift.end > now) return shift;
            }
            return null;
        }
    }

    private WidgetStore() {}

    static void save(Context context, String json) {
        prefs(context).edit().putString(KEY, json).apply();
    }

    static void clear(Context context) {
        prefs(context).edit().remove(KEY).apply();
    }

    static Snapshot read(Context context) {
        Snapshot snapshot = new Snapshot();
        String text = prefs(context).getString(KEY, null);
        if (text == null) return snapshot;
        try {
            JSONObject json = new JSONObject(text);
            snapshot.venue = json.optString("venue", "");
            snapshot.month = json.optString("month", "");
            snapshot.monthHours = json.optDouble("monthHours", -1);
            JSONArray shifts = json.optJSONArray("shifts");
            if (shifts != null) {
                for (int i = 0; i < shifts.length(); i++) {
                    JSONObject shift = shifts.getJSONObject(i);
                    snapshot.shifts.add(new Shift(shift.getLong("start"), shift.getLong("end"), shift.optString("area", "")));
                }
            }
            Collections.sort(snapshot.shifts, (a, b) -> Long.compare(a.start, b.start));
            JSONObject open = json.optJSONObject("open");
            if (open != null) {
                snapshot.open = new Open(open.getLong("since"), open.isNull("end") ? 0 : open.getLong("end"), open.optString("area", ""));
            }
        } catch (Exception ignored) {
            // A snapshot that cannot be read shows as no shifts.
        }
        return snapshot;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---------- words and times, as in the app's notifications ----------

    static String clock(long time) {
        return new SimpleDateFormat("HH:mm", ITALIAN).format(new Date(time));
    }

    /** A shift ending at midnight ends at 24:00, not at 00:00. */
    static String endClock(long start, long end) {
        String text = clock(end);
        return text.equals("00:00") && end > start ? "24:00" : text;
    }

    static String range(Shift shift) {
        return clock(shift.start) + "–" + endClock(shift.start, shift.end);
    }

    /** "18" for 18:00, "18:30" otherwise: the week's cells are narrow. */
    static String hour(String clock) {
        return clock.endsWith(":00") ? clock.substring(0, 2) : clock;
    }

    static boolean sameDay(long a, long b) {
        Calendar x = Calendar.getInstance();
        x.setTimeInMillis(a);
        Calendar y = Calendar.getInstance();
        y.setTimeInMillis(b);
        return x.get(Calendar.YEAR) == y.get(Calendar.YEAR) && x.get(Calendar.DAY_OF_YEAR) == y.get(Calendar.DAY_OF_YEAR);
    }

    static String day(long time, long now) {
        if (sameDay(time, now)) return "Oggi";
        if (sameDay(time, now + 24L * 60 * 60 * 1000)) {
            return "Domani · " + new SimpleDateFormat("EEE d", ITALIAN).format(new Date(time)).toLowerCase(ITALIAN);
        }
        return new SimpleDateFormat("EEE d MMM", ITALIAN).format(new Date(time)).toLowerCase(ITALIAN);
    }

    static String countdown(Shift shift, long now) {
        if (shift.start <= now) return "in corso";
        long minutes = (shift.start - now) / 60000;
        if (minutes < 60) return "tra " + Math.max(minutes, 1) + " min";
        long hours = minutes / 60;
        if (hours < 48) return "tra " + hours + " h";
        return "tra " + (hours / 24) + " giorni";
    }

    static String hours(long millis) {
        long minutes = millis / 60000;
        long h = minutes / 60;
        long m = minutes % 60;
        return m == 0 ? h + " h" : String.format(ITALIAN, "%d h %02d", h, m);
    }

    /** Monday 00:00 of the week holding `now`. */
    static long monday(long now) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(now);
        calendar.set(Calendar.HOUR_OF_DAY, 0);
        calendar.set(Calendar.MINUTE, 0);
        calendar.set(Calendar.SECOND, 0);
        calendar.set(Calendar.MILLISECOND, 0);
        int back = (calendar.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        calendar.add(Calendar.DAY_OF_YEAR, -back);
        return calendar.getTimeInMillis();
    }

    static long addDays(long time, int days) {
        Calendar calendar = Calendar.getInstance();
        calendar.setTimeInMillis(time);
        calendar.add(Calendar.DAY_OF_YEAR, days);
        return calendar.getTimeInMillis();
    }

    static String weekday(long time) {
        return new SimpleDateFormat("EEE", ITALIAN).format(new Date(time)).toLowerCase(ITALIAN);
    }

    static String monthDays(long from, long to) {
        SimpleDateFormat month = new SimpleDateFormat("MMM", ITALIAN);
        Calendar a = Calendar.getInstance();
        a.setTimeInMillis(from);
        Calendar b = Calendar.getInstance();
        b.setTimeInMillis(to);
        String first = String.valueOf(a.get(Calendar.DAY_OF_MONTH));
        String last = String.valueOf(b.get(Calendar.DAY_OF_MONTH));
        if (a.get(Calendar.MONTH) == b.get(Calendar.MONTH)) {
            return first + "–" + last + " " + month.format(new Date(to)).toLowerCase(ITALIAN);
        }
        return first + " " + month.format(new Date(from)).toLowerCase(ITALIAN) + " – " + last + " " + month.format(new Date(to)).toLowerCase(ITALIAN);
    }
}
