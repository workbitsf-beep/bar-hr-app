import { ActivityType } from "@prisma/client";
import { buildPayrollMonth, type PayrollPerson } from "@/lib/payroll/consultant-export";
import { monthKeyOf } from "@/lib/payroll/access";
import { DAY_KINDS, PAYROLL_CODE_LABELS, PAYROLL_KINDS, type PayrollCodeKey } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { buildMonthlyDataset } from "@/lib/reporting";
import { Line, Row, RowsCard } from "../costi/cost-ui";
import { AddDay } from "./day-editor";
import { AddStamp, DayItem, type StampPair } from "./day-item";
import { hoursText } from "./payroll-ui";
import { PdfButton } from "./pdf-button";

const SHORT: Record<PayrollCodeKey, string> = {
  ordinary: "Ord.",
  overtime: "Straord.",
  holiday: "Ferie",
  leave: "Permesso",
  sickness: "Malattia",
  closure: "Chiuso",
  publicHoliday: "Festività",
  training: "Formazione",
};

const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", timeZone: "UTC" });
const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

function summaryOf(entries: PayrollPerson["entries"]) {
  return entries
    .map((entry) =>
      DAY_KINDS.includes(entry.kind) && entry.days
        ? `${SHORT[entry.kind]}${entry.days === 1 ? "" : ` ${entry.days} gg`}`
        : `${SHORT[entry.kind]} ${hoursText(entry.hours)}`,
    )
    .join(" · ");
}

export const pdfButtonStyle = {
  minHeight: 36,
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13.5,
  fontWeight: 740,
  cursor: "pointer",
  padding: "0 14px",
} as const;

/**
 * One person's month, day by day: hours as the files will say them, the
 * clock-ins behind them, what needs a look. Who may, fixes a clock-in or
 * corrects the file from the day itself.
 */
export async function PersonMonth({
  barId,
  userId,
  year,
  month,
  canFixStamps,
  canCorrectFile,
  canPdf,
  timeTracking,
}: {
  barId: string;
  userId: string;
  year: number;
  month: number;
  canFixStamps: boolean;
  canCorrectFile: boolean;
  canPdf: boolean;
  timeTracking: boolean;
}) {
  const key = monthKeyOf(year, month);
  const [payroll, dataset, notes] = await Promise.all([
    buildPayrollMonth({ barId, month, year, memberWhere: { userId } }),
    buildMonthlyDataset(barId, userId, month, year, ActivityType.RESTAURANT),
    prisma.payrollDayOverride.findMany({
      where: { barId, userId, date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } },
      select: { date: true, note: true },
    }),
  ]);
  const person = payroll.people[0] ?? null;
  const noteOf = new Map(notes.map((item) => [item.date.toISOString().slice(0, 10), item.note]));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const minDate = `${key}-01`;
  const maxDate = `${key}-${String(lastDay).padStart(2, "0")}`;

  // Clock-ins by day, as pairs that can be taken away.
  const stampsByDay = new Map<string, { text: string[]; pairs: StampPair[] }>();
  for (const day of dataset.groupedLogs) {
    if (!day.entries.length) continue;
    stampsByDay.set(day.date, {
      text: day.entries.map((entry) => `${clock.format(new Date(entry.clockIn))}–${clock.format(new Date(entry.clockOut))}`),
      pairs: day.entries.map((entry) => ({
        logIds: [entry.inLogId, entry.outLogId],
        label: `${clock.format(new Date(entry.clockIn))}–${clock.format(new Date(entry.clockOut))} · ${hoursText(entry.roundedHours)} h`,
        manual: false,
      })),
    });
  }

  const byDay = new Map<string, PayrollPerson["entries"]>();
  for (const entry of person?.entries ?? []) byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]);
  const flagsByDay = new Map<string, string[]>();
  for (const flag of person?.flags ?? []) flagsByDay.set(flag.date, [...(flagsByDay.get(flag.date) ?? []), flag.message]);
  const days = Array.from(new Set([...byDay.keys(), ...flagsByDay.keys(), ...stampsByDay.keys(), ...(person?.overridden ?? [])])).sort();

  const totals = person
    ? PAYROLL_KINDS.filter((kind) => person.totals[kind].hours || person.totals[kind].days)
        .map((kind) =>
          DAY_KINDS.includes(kind) ? `${PAYROLL_CODE_LABELS[kind]} ${person.totals[kind].days} gg` : `${PAYROLL_CODE_LABELS[kind]} ${hoursText(person.totals[kind].hours)}`,
        )
        .join(" · ")
    : "";
  const worked = person ? person.totals.ordinary.hours + person.totals.overtime.hours : 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <RowsCard>
        <Row first rail={person?.warnings.length ? "amber" : undefined} style={{ gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 26, fontWeight: 780, letterSpacing: "-0.03em" }}>{hoursText(worked)} h</span>
            <span style={{ fontSize: 13, color: "#7c7894" }}>
              {person?.workedDays ?? 0} giorni lavorati · {payroll.source === "SHIFTS" ? "dai turni" : "dalle timbrature"}
            </span>
          </div>
          {totals ? <Line muted left={totals} /> : null}
          {person?.contractWeeklyHours || person?.certificates.length ? (
            <Line
              muted
              left={[
                person.contractWeeklyHours ? `Contratto ${hoursText(person.contractWeeklyHours)} h a settimana` : null,
                person.certificates.length ? `Certificati ${person.certificates.join(", ")}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ) : null}
          {(person?.warnings ?? []).map((warning) => (
            <span key={warning} style={{ fontSize: 12.5, color: "#b45309" }}>
              {warning}
            </span>
          ))}
          {canPdf ? (
            <div style={{ paddingTop: 4 }}>
              <PdfButton userId={userId} month={month} year={year} style={pdfButtonStyle} />
            </div>
          ) : null}
        </Row>
      </RowsCard>

      <RowsCard>
        {days.length ? (
          days.map((day, index) => {
            const entries = byDay.get(day) ?? [];
            const stamps = stampsByDay.get(day);
            return (
              <div key={day} style={index === 0 ? { marginTop: -1 } : undefined}>
                <DayItem
                  label={dayLabel.format(new Date(`${day}T00:00:00Z`))}
                  summary={summaryOf(entries)}
                  stamps={timeTracking && stamps ? stamps.text.join(" · ") : ""}
                  flags={flagsByDay.get(day) ?? []}
                  overridden={person?.overridden.includes(day) ?? false}
                  editor={
                    canCorrectFile && person
                      ? {
                          userId,
                          date: day,
                          entries: entries.map((entry) => ({ kind: entry.kind, hours: entry.hours, days: entry.days })),
                          overridden: person.overridden.includes(day),
                          note: noteOf.get(day) ?? null,
                          dailyHours: person.dailyHours,
                          minDate,
                          maxDate,
                        }
                      : null
                  }
                  fix={canFixStamps && timeTracking ? { userId, date: day, pairs: stamps?.pairs ?? [] } : null}
                />
              </div>
            );
          })
        ) : (
          <Row first>
            <Line muted left="Nessuna ora e nessuna assenza in questo mese." />
          </Row>
        )}
        {canFixStamps && timeTracking ? <AddStamp userId={userId} minDate={minDate} maxDate={maxDate} /> : null}
        {canCorrectFile && person ? <AddDay editor={{ userId, dailyHours: person.dailyHours, minDate, maxDate }} /> : null}
      </RowsCard>
    </div>
  );
}
