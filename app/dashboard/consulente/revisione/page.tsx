import Link from "next/link";
import { Role } from "@prisma/client";
import { buildPayrollMonth, type PayrollPerson } from "@/lib/payroll/consultant-export";
import { defaultPayrollMonth, monthKeyOf, parseMonthKey } from "@/lib/payroll/access";
import { DAY_KINDS, monthName, PAYROLL_CODE_LABELS, PAYROLL_KINDS, type PayrollCodeKey } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { Line, Row, RowsCard, SectionLabel } from "../../costi/cost-ui";
import { EmptyState, Panel } from "../../ui";
import { AddDay, DayRow } from "../day-editor";
import { hoursText, MonthChips } from "../payroll-ui";

export const dynamic = "force-dynamic";

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

function summaryOf(entries: PayrollPerson["entries"]) {
  return entries
    .map((entry) =>
      DAY_KINDS.includes(entry.kind) && entry.days ? `${SHORT[entry.kind]}${entry.days === 1 ? "" : ` ${entry.days} gg`}` : `${SHORT[entry.kind]} ${hoursText(entry.hours)}`,
    )
    .join(" · ");
}

/** The month day by day, person by person: the strange days first in sight, each one correctable. */
export default async function PayrollReviewPage({ searchParams }: { searchParams: Promise<{ mese?: string }> }) {
  const { role, staff, activeBarId, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Controlla il mese">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (role !== Role.OWNER && !can(staff, "reports")) {
    return (
      <Panel title="Controlla il mese">
        <EmptyState message="Le presenze per il consulente le prepara il titolare." />
      </Panel>
    );
  }

  const { mese } = await searchParams;
  const { year, month } = parseMonthKey(mese) ?? defaultPayrollMonth();
  const key = monthKeyOf(year, month);
  const [data, notes] = await Promise.all([
    buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: memberScopeWhere(staff) }),
    prisma.payrollDayOverride.findMany({
      where: { barId: activeBarId, date: { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) } },
      select: { userId: true, date: true, note: true },
    }),
  ]);
  const noteOf = new Map(notes.map((item) => [`${item.userId}:${item.date.toISOString().slice(0, 10)}`, item.note]));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const minDate = `${key}-01`;
  const maxDate = `${key}-${String(lastDay).padStart(2, "0")}`;

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 4, padding: "0 4px" }}>
        <Link href={`/dashboard/consulente?mese=${key}`} style={{ fontSize: 13, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
          ‹ Presenze per il consulente
        </Link>
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: "-0.03em" }}>
          Controlla <span style={{ textTransform: "capitalize" }}>{monthName(month, year)}</span>
        </h1>
        <span style={{ fontSize: 13.5, color: "#7c7894" }}>
          Tocca un giorno per correggerlo. La correzione cambia solo il file da mandare: {data.source === "SHIFTS" ? "i turni" : "le timbrature"} restano come sono.
        </span>
      </header>

      <MonthChips base="/dashboard/consulente/revisione" year={year} month={month} />

      {data.people.length ? (
        data.people.map((person) => {
          const byDay = new Map<string, PayrollPerson["entries"]>();
          for (const entry of person.entries) byDay.set(entry.date, [...(byDay.get(entry.date) ?? []), entry]);
          const flagsByDay = new Map<string, string[]>();
          for (const flag of person.flags) flagsByDay.set(flag.date, [...(flagsByDay.get(flag.date) ?? []), flag.message]);
          const days = Array.from(new Set([...byDay.keys(), ...flagsByDay.keys(), ...person.overridden])).sort();
          const totals = PAYROLL_KINDS.filter((kind) => person.totals[kind].hours || person.totals[kind].days)
            .map((kind) =>
              DAY_KINDS.includes(kind) ? `${PAYROLL_CODE_LABELS[kind]} ${person.totals[kind].days} gg` : `${PAYROLL_CODE_LABELS[kind]} ${hoursText(person.totals[kind].hours)}`,
            )
            .join(" · ");
          return (
            <section key={person.userId} id={`p-${person.userId}`} style={{ display: "grid", gap: 8, scrollMarginTop: 80 }}>
              <SectionLabel aside={person.flags.length ? <span style={{ color: "#b45309" }}>{person.flags.length} da guardare</span> : undefined}>
                {person.lastName} {person.firstName}
              </SectionLabel>
              <RowsCard>
                <Row first rail={person.warnings.length ? "amber" : undefined}>
                  <Line left={totals || "Nessuna ora nel mese"} />
                  <Line
                    muted
                    left={`${person.workedDays} giorni lavorati${person.contractWeeklyHours ? ` · contratto ${hoursText(person.contractWeeklyHours)} h/sett.` : ""}${person.certificates.length ? ` · certificati ${person.certificates.join(", ")}` : ""}`}
                  />
                  {person.warnings.map((warning) => (
                    <span key={warning} style={{ fontSize: 12.5, color: "#b45309" }}>
                      {warning}
                    </span>
                  ))}
                </Row>
                {days.map((day) => {
                  const entries = byDay.get(day) ?? [];
                  return (
                    <DayRow
                      key={day}
                      label={dayLabel.format(new Date(`${day}T00:00:00Z`))}
                      summary={summaryOf(entries)}
                      flags={flagsByDay.get(day) ?? []}
                      overridden={person.overridden.includes(day)}
                      editor={{
                        userId: person.userId,
                        date: day,
                        entries: entries.map((entry) => ({ kind: entry.kind, hours: entry.hours, days: entry.days })),
                        overridden: person.overridden.includes(day),
                        note: noteOf.get(`${person.userId}:${day}`) ?? null,
                        dailyHours: person.dailyHours,
                        minDate,
                        maxDate,
                      }}
                    />
                  );
                })}
                <AddDay editor={{ userId: person.userId, dailyHours: person.dailyHours, minDate, maxDate }} />
              </RowsCard>
            </section>
          );
        })
      ) : (
        <RowsCard>
          <Row first>
            <Line muted left="Nessuna persona in questo mese." />
          </Row>
        </RowsCard>
      )}
    </div>
  );
}
