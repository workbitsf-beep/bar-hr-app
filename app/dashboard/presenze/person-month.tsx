import { ActivityType } from "@prisma/client";
import { buildPayrollMonth, type PayrollPerson } from "@/lib/payroll/consultant-export";
import { monthKeyOf } from "@/lib/payroll/access";
import { DAY_KINDS, type PayrollCodeKey } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { buildMonthlyDataset } from "@/lib/reporting";
import { AddDay } from "./day-editor";
import { AddStampButton, DayRow, type DayChoice, type DayView, type Span } from "./day-item";
import { Card, ghostButton, hoursValue, MonthSwitch, SectionHead } from "./payroll-ui";
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
const romeParts = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Rome" });
const dayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });

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

function weekStart(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function workedOf(entries: PayrollPerson["entries"]) {
  return entries.filter((entry) => entry.kind === "ordinary" || entry.kind === "overtime").reduce((sum, entry) => sum + entry.hours, 0);
}

/**
 * One person's month, week by week: a track per day with the stamped spans
 * (6:00 to midnight), the exact times, the hours. Who may, taps a day to fix
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

  // A stamp is added only where none is: days so far with no stamp and no day away.
  const stampChoices: DayChoice[] = views
    .filter((view) => !(stampsOf.get(view.date)?.pairs.length) && !view.away)
    .reverse()
    .map((view) => ({ date: view.date, weekday: view.weekday, day: view.day, shift: view.shift }));

  // Newest week first: the days that matter now sit on top.
  const weeks = new Map<string, DayView[]>();
  for (const view of views) weeks.set(weekStart(view.date), [...(weeks.get(weekStart(view.date)) ?? []), view]);
  const weekList = Array.from(weeks.entries()).reverse();

  const worked = person ? person.totals.ordinary.hours + person.totals.overtime.hours : 0;
  const chips = person
    ? [
        { text: `${person.workedDays} ${person.workedDays === 1 ? "giorno" : "giorni"}`, tone: "grey" },
        person.totals.overtime.hours ? { text: `Straord. ${hoursValue(person.totals.overtime.hours)} h`, tone: "violet" } : null,
        person.totals.holiday.days ? { text: `Ferie ${person.totals.holiday.days} gg`, tone: "green" } : null,
        person.totals.sickness.days ? { text: `Malattia ${person.totals.sickness.days} gg`, tone: "blue" } : null,
        person.totals.leave.hours ? { text: `Permessi ${hoursValue(person.totals.leave.hours)} h`, tone: "green" } : null,
        person.totals.closure.days + person.totals.publicHoliday.days
          ? { text: `Chiuso ${person.totals.closure.days + person.totals.publicHoliday.days} gg`, tone: "grey" }
          : null,
      ].filter((item): item is { text: string; tone: string } => item !== null)
    : [];
  const chipColors: Record<string, [string, string]> = {
    grey: ["#f3f1fa", "#4b4763"],
    violet: ["#f5eefe", "#7e22ce"],
    green: ["#e2f6ed", "#0f7a4f"],
    blue: ["#e6f4ff", "#0369a1"],
  };
  const base = `/dashboard/presenze/persona/${userId}`;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ padding: 16, display: "grid", gap: 12 }}>
        <MonthSwitch base={base} year={year} month={month} size="small" />
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "center" }}>
          <span style={{ fontSize: 40, fontWeight: 750, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums" }}>{hoursValue(worked)}</span>
          <span style={{ fontSize: 16, color: "#6f6a88" }}>ore</span>
        </div>
        {chips.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            {chips.map((chip) => (
              <span
                key={chip.text}
                style={{ fontSize: 12, borderRadius: 999, padding: "4px 10px", fontWeight: 600, background: chipColors[chip.tone][0], color: chipColors[chip.tone][1] }}
              >
                {chip.text}
              </span>
            ))}
          </div>
        ) : null}
        {canPdf || (canFixStamps && timeTracking) ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {canPdf ? <PdfButton userId={userId} month={month} year={year} style={ghostButton} /> : null}
            {canFixStamps && timeTracking ? <AddStampButton userId={userId} personName={personName} choices={stampChoices} style={ghostButton} /> : null}
          </div>
        ) : null}
        <span style={{ fontSize: 12, color: "#9a95b2", textAlign: "center" }}>{payroll.source === "SHIFTS" ? "Ore dai turni pubblicati" : "Ore dalle timbrature, arrotondate"}</span>
      </Card>

      {weekList.map(([start, days]) => {
        const first = days[0];
        const last = days[days.length - 1];
        const total = days.reduce((sum, view) => sum + workedOf(entriesOf.get(view.date) ?? []), 0);
        return (
          <section key={start} style={{ display: "grid", gap: 8 }}>
            <SectionHead
              title={
                first.date === last.date
                  ? dayMonth.format(new Date(`${first.date}T00:00:00Z`))
                  : `${first.day} – ${dayMonth.format(new Date(`${last.date}T00:00:00Z`))}`
              }
              aside={total ? `${hoursValue(total)} h` : undefined}
            />
            <Card>
              <div style={{ marginTop: -1 }}>
                {[...days].reverse().map((view) => (
                  <div key={view.date} style={view.right === "Riposo" && !view.flags.length && !view.segments.length ? { opacity: 0.55 } : undefined}>
                    <DayRow view={view} userId={userId} personName={personName} canFix={canFixStamps && timeTracking} />
                  </div>
                ))}
              </div>
            </Card>
          </section>
        );
      })}

      {timeTracking ? (
        <div style={{ display: "flex", gap: 14, padding: "0 6px", flexWrap: "wrap", fontSize: 12, color: "#6f6a88" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 6, borderRadius: 3, background: "#6d5ce7" }} />
            timbrato
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 14, height: 6, borderRadius: 3, border: "1.5px dashed #f59e0b", boxSizing: "border-box" }} />
            turno senza timbratura
          </span>
          <span>barra dalle 6 a mezzanotte</span>
        </div>
      ) : null}

      {canCorrectFile && person ? (
        <Card>
          <div style={{ marginTop: -1 }}>
            <AddDay editor={{ userId, dailyHours: person.dailyHours, minDate, maxDate }} />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
