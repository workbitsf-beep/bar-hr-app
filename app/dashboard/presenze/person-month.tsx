import { ActivityType } from "@prisma/client";
import { buildPayrollMonth, type PayrollPerson } from "@/lib/payroll/consultant-export";
import { monthKeyOf } from "@/lib/payroll/access";
import { DAY_KINDS, type PayrollCodeKey } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { buildMonthlyDataset } from "@/lib/reporting";
import { AddDay } from "./day-editor";
import { DayRow, type DayView, type Span } from "./day-item";
import { hoursValue, Quiet, Sheet } from "./payroll-ui";
import { PdfButton } from "./pdf-button";

const AWAY_LABELS: Partial<Record<PayrollCodeKey, string>> = {
  holiday: "Ferie",
  sickness: "Malattia",
  closure: "Chiuso",
  publicHoliday: "Festività",
  leave: "Permesso",
  training: "Formazione",
};

const weekdayOf = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });
const shortMonth = new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "UTC" });
const romeParts = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Rome" });

function clockText(value: Date) {
  return romeParts.format(value);
}

/** Hours from 6:00 to 24:00 as a share of the day's track; after midnight runs to the end. */
function spanOf(start: Date, end: Date): Span {
  const hourOf = (value: Date) => {
    const [hours, minutes] = romeParts.format(value).split(":").map(Number);
    return hours + minutes / 60;
  };
  const from = hourOf(start);
  let to = hourOf(end);
  if (to < from) to = 24;
  const clamp = (value: number) => Math.min(100, Math.max(0, ((value - 6) / 18) * 100));
  const left = clamp(from);
  return { left, width: Math.max(0, clamp(to) - left) };
}

function dayKeyLocal(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function workedOf(entries: PayrollPerson["entries"]) {
  return entries.filter((entry) => entry.kind === "ordinary" || entry.kind === "overtime").reduce((sum, entry) => sum + entry.hours, 0);
}

/**
 * One person's month: first what is to fix, then the weeks, newest open and
 * the rest folded to a line. Rest days are left out. Who may, taps a day to fix
 * its clock-ins or to correct the consultant's file.
 */
export async function PersonMonth({
  barId,
  userId,
  personName,
  year,
  month,
  canFixStamps,
  canCorrectFile,
  canPdf,
  timeTracking,
  embedded = false,
}: {
  barId: string;
  userId: string;
  personName: string;
  year: number;
  month: number;
  canFixStamps: boolean;
  canCorrectFile: boolean;
  canPdf: boolean;
  timeTracking: boolean;
  /** On the main page, for an employee: the month menu is already above. */
  embedded?: boolean;
}) {
  const key = monthKeyOf(year, month);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const [payroll, dataset, notes, shifts] = await Promise.all([
    buildPayrollMonth({ barId, month, year, memberWhere: { userId } }),
    buildMonthlyDataset(barId, userId, month, year, ActivityType.RESTAURANT),
    prisma.payrollDayOverride.findMany({
      where: { barId, userId, date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } },
      select: { date: true, note: true },
    }),
    prisma.shift.findMany({
      where: {
        barId,
        confirmedAt: { not: null },
        isOnCall: false,
        startTime: { gte: monthStart, lt: monthEnd },
        OR: [{ assignedToId: userId }, { assignments: { some: { userId } } }],
      },
      orderBy: { startTime: "asc" },
      select: { startTime: true, endTime: true },
    }),
  ]);
  const person = payroll.people[0] ?? null;
  const noteOf = new Map(notes.map((item) => [item.date.toISOString().slice(0, 10), item.note]));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const minDate = `${key}-01`;
  const maxDate = `${key}-${String(lastDay).padStart(2, "0")}`;
  const now = new Date();
  const todayKey = dayKeyLocal(now);
  const lastShown = Math.min(lastDay, now.getFullYear() === year && now.getMonth() + 1 === month ? now.getDate() : lastDay);

  const shiftOf = new Map<string, { startTime: Date; endTime: Date }>();
  for (const shift of shifts) {
    const day = dayKeyLocal(shift.startTime);
    if (!shiftOf.has(day)) shiftOf.set(day, shift);
  }
  const stampsOf = new Map<string, { segments: Span[]; times: string[]; pairs: DayView["pairs"] }>();
  for (const day of dataset.groupedLogs) {
    if (!day.entries.length) continue;
    stampsOf.set(day.date, {
      segments: day.entries.map((entry) => spanOf(new Date(entry.clockIn), new Date(entry.clockOut))),
      times: day.entries.map((entry) => `${clockText(new Date(entry.clockIn))}–${clockText(new Date(entry.clockOut))}`),
      pairs: day.entries.map((entry) => ({
        logIds: [entry.inLogId, entry.outLogId],
        label: `${clockText(new Date(entry.clockIn))}–${clockText(new Date(entry.clockOut))} · ${hoursValue(entry.roundedHours)} h`,
      })),
    });
  }
  const entriesOf = new Map<string, PayrollPerson["entries"]>();
  for (const entry of person?.entries ?? []) entriesOf.set(entry.date, [...(entriesOf.get(entry.date) ?? []), entry]);
  const flagsOf = new Map<string, string[]>();
  for (const flag of person?.flags ?? []) flagsOf.set(flag.date, [...(flagsOf.get(flag.date) ?? []), flag.message]);

  const views: DayView[] = [];
  for (let day = 1; day <= lastShown; day += 1) {
    const date = `${key}-${String(day).padStart(2, "0")}`;
    const entries = entriesOf.get(date) ?? [];
    const stamps = stampsOf.get(date);
    const flags = flagsOf.get(date) ?? [];
    const shift = shiftOf.get(date) ?? null;
    const worked = workedOf(entries);
    const awayEntry = worked ? null : entries.find((entry) => DAY_KINDS.includes(entry.kind) || (entry.days > 0 && AWAY_LABELS[entry.kind]));
    const away = awayEntry ? AWAY_LABELS[awayEntry.kind] ?? null : null;
    const partial = entries.filter((entry) => !DAY_KINDS.includes(entry.kind) && entry.kind !== "ordinary" && entry.kind !== "overtime" && entry.days === 0);
    const missing = flags.some((flag) => /senza timbratura/.test(flag));
    views.push({
      date,
      weekday: weekdayOf.format(new Date(`${date}T00:00:00Z`)).replace(".", ""),
      day,
      segments: timeTracking ? stamps?.segments ?? [] : [],
      planned: missing && shift ? spanOf(shift.startTime, shift.endTime) : null,
      away,
      times: [
        timeTracking ? stamps?.times.join(" · ") : null,
        !timeTracking && shift && worked ? `Turno ${clockText(shift.startTime)}–${clockText(shift.endTime)}` : null,
        ...partial.map((entry) => `${AWAY_LABELS[entry.kind] ?? ""} ${hoursValue(entry.hours)} h`),
      ]
        .filter(Boolean)
        .join(" · "),
      right: worked ? hoursValue(worked) : away ?? (date === todayKey && !stamps ? "Oggi" : "Riposo"),
      flags,
      overridden: person?.overridden.includes(date) ?? false,
      shift: shift ? { start: clockText(shift.startTime), end: clockText(shift.endTime) } : null,
      pairs: stamps?.pairs ?? [],
      editor:
        canCorrectFile && person
          ? {
              userId,
              date,
              entries: entries.map((entry) => ({ kind: entry.kind, hours: entry.hours, days: entry.days })),
              overridden: person.overridden.includes(date),
              note: noteOf.get(date) ?? null,
              dailyHours: person.dailyHours,
              minDate,
              maxDate,
            }
          : null,
    });
  }

  // A stamp is added only where one is missing: a shift already over, with no stamp
  // and no day away. What was stamped stays as it was.
  const missingStamp = (view: DayView) => {
    const shift = shiftOf.get(view.date);
    return Boolean(shift && shift.endTime < now && !(stampsOf.get(view.date)?.pairs.length) && !view.away);
  };

  const worked = person ? person.totals.ordinary.hours + person.totals.overtime.hours : 0;
  const summary = person
    ? [
        `${person.workedDays} ${person.workedDays === 1 ? "giorno" : "giorni"}`,
        person.totals.overtime.hours ? `straord. ${hoursValue(person.totals.overtime.hours)}` : null,
        person.totals.holiday.days ? `ferie ${person.totals.holiday.days}` : null,
        person.totals.sickness.days ? `malattia ${person.totals.sickness.days}` : null,
        person.totals.leave.hours ? `permessi ${hoursValue(person.totals.leave.hours)}` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const toFix = (view: DayView) => canFixStamps && timeTracking && missingStamp(view);
  // Only the days with something in them: a rest day says nothing.
  const shown = views.filter((view) => !toFix(view) && (view.right !== "Riposo" && view.right !== "Oggi" || view.flags.length || view.overridden || view.times));
  const fixRows = [...views].filter(toFix).reverse();

  // Week by week, newest first; only the latest is open, the rest fold to one line.
  const weeks: { key: string; label: string; days: DayView[]; hours: number }[] = [];
  for (const view of [...shown].reverse()) {
    const date = new Date(`${view.date}T00:00:00Z`);
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    const weekKey = monday.toISOString().slice(0, 10);
    let week = weeks.find((entry) => entry.key === weekKey);
    if (!week) {
      const sunday = new Date(monday);
      sunday.setUTCDate(monday.getUTCDate() + 6);
      const sameMonth = monday.getUTCMonth() === sunday.getUTCMonth();
      const label = `${monday.getUTCDate()}${sameMonth ? "" : ` ${shortMonth.format(monday)}`} – ${sunday.getUTCDate()} ${shortMonth.format(sunday)}`;
      week = { key: weekKey, label, days: [], hours: 0 };
      weeks.push(week);
    }
    week.days.push(view);
    week.hours += workedOf(entriesOf.get(view.date) ?? []);
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gap: 2 }}>
        {embedded ? (
          <span style={{ fontSize: 52, fontWeight: 750, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{hoursValue(worked)}</span>
        ) : null}
        <Quiet style={{ fontSize: 14.5 }}>
          {embedded ? "ore nel mese" : <span style={{ color: "#1f1b3a", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{hoursValue(worked)} ore</span>}
          {summary ? ` · ${summary}` : ""}
          {payroll.source === "SHIFTS" ? " · dai turni" : ""}
        </Quiet>
      </div>

      {fixRows.length ? (
        <section style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, color: "#b45309", padding: "0 18px" }}>Da sistemare · {fixRows.length}</span>
          <Sheet style={{ boxShadow: "inset 3px 0 0 #f59e0b" }}>
            <div style={{ marginTop: -1 }}>
              {fixRows.map((view) => (
                <DayRow key={view.date} view={view} userId={userId} personName={personName} canFix />
              ))}
            </div>
          </Sheet>
        </section>
      ) : null}

      {weeks.length ? (
        weeks.map((week, index) => (
          <details key={week.key} open={index === 0} className="wb-week" style={{ display: "grid", gap: 8 }}>
            <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "4px 18px", fontSize: 13, color: "#8a85a3" }}>
              <span style={{ flex: 1 }}>
                Settimana {week.label} · {week.days.length} {week.days.length === 1 ? "giorno" : "giorni"}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "#1f1b3a", fontSize: 14 }}>{hoursValue(week.hours)}</span>
              <span aria-hidden className="wb-week-chev" style={{ color: "#c4c0d6", fontSize: 16 }}>›</span>
            </summary>
            <Sheet style={{ marginTop: 8 }}>
              <div style={{ marginTop: -1 }}>
                {week.days.map((view) => (
                  <DayRow key={view.date} view={view} userId={userId} personName={personName} canFix={false} />
                ))}
              </div>
            </Sheet>
          </details>
        ))
      ) : fixRows.length ? null : (
        <Sheet>
          <div style={{ padding: "10px 0" }}>
            <Quiet>Nessun giorno lavorato in questo mese.</Quiet>
          </div>
        </Sheet>
      )}

      {canCorrectFile && person ? (
        <Sheet>
          <div style={{ marginTop: -1 }}>
            <AddDay editor={{ userId, dailyHours: person.dailyHours, minDate, maxDate }} />
          </div>
        </Sheet>
      ) : null}

      {embedded && canPdf ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <PdfButton
            userId={userId}
            month={month}
            year={year}
            style={{ border: 0, background: "transparent", color: "#5e4ae3", fontSize: 15, fontWeight: 600, cursor: "pointer", minHeight: 44 }}
          />
        </div>
      ) : null}
    </div>
  );
}
