import Link from "next/link";
import { Role } from "@prisma/client";
import { buildPayrollMonth } from "@/lib/payroll/consultant-export";
import { defaultPayrollMonth, monthKeyOf, parseMonthKey } from "@/lib/payroll/access";
import { composeMessage, monthName, payrollFileBaseName, templateOf } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../billing-required";
import { getDashboardContext } from "../context";
import { Line, Row, RowsCard, SectionLabel, softButton } from "../costi/cost-ui";
import { EmptyState, Panel } from "../ui";
import { hoursText, MonthChips, ROLE_LABELS } from "./payroll-ui";
import { PersonMonth } from "./person-month";
import { SendPanel } from "./send-panel";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

const CHANNEL_LABELS: Record<string, string> = {
  mail_app: "dalla tua mail",
  share: "dal telefono",
  mailto: "dalla tua mail",
  workbit: "da Workbit",
};

/**
 * Presenze: the month's hours, the clock-ins behind them and the file for
 * the consultant, in one place (it replaced Timbrature, the PDF report and
 * the consultant page on 30 Oct 2026). The owner and their staff see
 * everyone they cover; everyone else sees their own month.
 */
export default async function PresencePage({ searchParams }: { searchParams: Promise<{ mese?: string }> }) {
  const { session, role, staff, activeBarId, billingStatus, features } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Presenze">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (!features.timeTracking && !features.reports) {
    return (
      <Panel title="Presenze">
        <EmptyState message="Timbrature e report sono spenti nelle impostazioni." />
      </Panel>
    );
  }

  const isOwner = role === Role.OWNER;
  const canStamps = isOwner || can(staff, "timelogs");
  const canReports = isOwner || can(staff, "reports");
  const { mese } = await searchParams;
  // The month to close comes first only in its first days; then the month under way.
  const today = new Date();
  const { year, month } =
    parseMonthKey(mese) ??
    (canStamps || canReports ? (today.getDate() <= 5 ? defaultPayrollMonth(today) : { year: today.getFullYear(), month: today.getMonth() + 1 }) : { year: today.getFullYear(), month: today.getMonth() + 1 });
  const key = monthKeyOf(year, month);
  const name = monthName(month, year);

  const header = (
    <header style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, padding: "0 4px" }}>
      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0284c7" }}>Presenze</span>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.03em", textTransform: "capitalize" }}>{name}</h1>
      </div>
      {isOwner ? (
        <Link href="/dashboard/presenze/impostazioni" style={{ fontSize: 13.5, fontWeight: 700, color: "#6d5ce7", textDecoration: "none", paddingBottom: 6 }}>
          Impostazioni
        </Link>
      ) : canStamps || canReports ? (
        <Link href={`/dashboard/presenze/persona/${session.user.id}`} style={{ fontSize: 13.5, fontWeight: 700, color: "#6d5ce7", textDecoration: "none", paddingBottom: 6 }}>
          Le tue ore
        </Link>
      ) : null}
    </header>
  );
  const shell = (children: React.ReactNode) => (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      {header}
      <MonthChips base="/dashboard/presenze" year={year} month={month} />
      {children}
    </div>
  );

  // Everyone without the permissions: their own month.
  if (!canStamps && !canReports) {
    return shell(
      <PersonMonth
        barId={activeBarId}
        userId={session.user.id}
        year={year}
        month={month}
        canFixStamps={false}
        canCorrectFile={false}
        canPdf={features.reports}
        timeTracking={features.timeTracking}
      />,
    );
  }

  const now = new Date();
  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const range = { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
  const scope = memberScopeWhere(staff);

  const [data, recipients, sends, lastOverride, lastStamps] = await Promise.all([
    buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: scope }),
    canReports ? prisma.payrollRecipient.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    canReports ? prisma.payrollSend.findMany({ where: { barId: activeBarId, month: key }, orderBy: { sentAt: "desc" } }) : Promise.resolve([]),
    prisma.payrollDayOverride.findFirst({ where: { barId: activeBarId, date: range }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    // Who is in right now: everyone whose last stamp of the last 16 hours is an entry.
    features.timeTracking && isCurrentMonth
      ? prisma.timeLog.findMany({
          where: { barId: activeBarId, timestamp: { gte: new Date(now.getTime() - 16 * 3_600_000) } },
          orderBy: [{ userId: "asc" }, { timestamp: "desc" }],
          distinct: ["userId"],
          select: { userId: true, type: true, timestamp: true, user: { select: { firstName: true } } },
        })
      : Promise.resolve([]),
  ]);

  const peopleIds = new Set(data.people.map((person) => person.userId));
  const inside = lastStamps.filter((stamp) => stamp.type === "IN" && peopleIds.has(stamp.userId)).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Shifts moved after the files went out change them, when the hours come from the shifts.
  const firstSend = sends.at(-1)?.sentAt ?? null;
  const lastShiftChange =
    data.source === "SHIFTS" && firstSend
      ? await prisma.shift.findFirst({
          where: { barId: activeBarId, startTime: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        })
      : null;
  const lastChange = [lastOverride?.updatedAt, lastShiftChange?.updatedAt].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] ?? null;

  const flagged = data.people.reduce((sum, person) => sum + person.flags.length, 0);
  const missing = data.people.filter((person) => person.warnings.length).length;
  const venue = data.legalName || data.venueName;
  const signer = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim();

  return shell(
    <>
      {inside.length ? (
        <RowsCard>
          <Row first style={{ gap: 4 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: "#10b981" }} />
              <span style={{ fontWeight: 650 }}>{inside.length} dentro adesso</span>
            </span>
            <Line muted left={inside.map((stamp) => `${stamp.user.firstName} dalle ${clock.format(stamp.timestamp)}`).join(" · ")} />
          </Row>
        </RowsCard>
      ) : null}

      <RowsCard>
        <Row first rail={flagged ? "amber" : undefined} style={{ gap: 6 }}>
          <Line
            left={`${data.people.length} ${data.people.length === 1 ? "persona" : "persone"}`}
            right={
              flagged ? (
                <span style={{ color: "#b45309" }}>{flagged} {flagged === 1 ? "giorno da guardare" : "giorni da guardare"}</span>
              ) : (
                <span style={{ color: "#0f7a4f" }}>nessun giorno strano</span>
              )
            }
          />
          <Line
            muted
            left={
              data.source === "SHIFTS"
                ? "Ore dai turni pubblicati: se cambi un turno, il mese si aggiorna da solo."
                : "Ore dalle timbrature, arrotondate con le regole del locale."
            }
          />
          {missing || data.draftShifts ? (
            <Line
              muted
              left={[
                missing ? `${missing} ${missing === 1 ? "persona" : "persone"} senza matricola o ore di contratto` : null,
                data.draftShifts ? `${data.draftShifts} turni non pubblicati, non contati` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ) : null}
        </Row>
      </RowsCard>

      <section style={{ display: "grid", gap: 8 }}>
        <SectionLabel aside="tocca per i giorni">Persone</SectionLabel>
        <RowsCard>
          {data.people.length ? (
            data.people.map((person, index) => {
              const worked = person.totals.ordinary.hours + person.totals.overtime.hours;
              const away = [
                person.totals.holiday.days ? `ferie ${person.totals.holiday.days} gg` : null,
                person.totals.sickness.days ? `malattia ${person.totals.sickness.days} gg` : null,
                person.totals.leave.hours ? `permessi ${hoursText(person.totals.leave.hours)} h` : null,
              ].filter(Boolean);
              return (
                <Link
                  key={person.userId}
                  href={`/dashboard/presenze/persona/${person.userId}?mese=${key}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <Row first={index === 0} rail={person.flags.length ? "amber" : undefined}>
                    <Line left={`${person.lastName} ${person.firstName}`} right={<span style={{ fontVariantNumeric: "tabular-nums" }}>{hoursText(worked)} h ›</span>} />
                    <Line
                      muted
                      left={
                        person.flags.length ? (
                          <span style={{ color: "#b45309" }}>{person.flags.length} {person.flags.length === 1 ? "giorno da guardare" : "giorni da guardare"}</span>
                        ) : (
                          [`${person.workedDays} giorni`, person.totals.overtime.hours ? `straordinari ${hoursText(person.totals.overtime.hours)} h` : null, ...away].filter(Boolean).join(" · ")
                        )
                      }
                    />
                  </Row>
                </Link>
              );
            })
          ) : (
            <Row first>
              <Line muted left="Nessuna persona in questo mese." />
            </Row>
          )}
        </RowsCard>
      </section>

      {canReports ? (
        <section style={{ display: "grid", gap: 8 }}>
          <SectionLabel>Al consulente</SectionLabel>
          <RowsCard>
            {recipients.length ? (
              recipients.map((recipient, index) => {
                const template = templateOf(recipient.template);
                const last = sends.find((send) => send.recipientId === recipient.id) ?? null;
                const changedAfter = last && lastChange && lastChange > last.sentAt;
                const firstName = /^(studio|dott|rag|avv)/i.test(recipient.name) ? recipient.name : recipient.name.split(/\s+/)[0];
                return (
                  <Row key={recipient.id} first={index === 0} rail={last && !changedAfter ? "green" : undefined} style={{ gap: 10 }}>
                    <Line left={recipient.name} right={ROLE_LABELS[recipient.role] ?? ""} />
                    <Line
                      muted
                      left={
                        last ? (
                          <span style={{ color: changedAfter ? "#b45309" : "#0f7a4f" }}>
                            {changedAfter
                              ? `Mandato il ${when.format(last.sentAt)}, poi è cambiato qualcosa: rimandalo`
                              : `Mandato il ${when.format(last.sentAt)} ${CHANNEL_LABELS[last.channel] ?? ""}`}
                          </span>
                        ) : (
                          `${recipient.email}${recipient.sendDay ? ` · promemoria il ${recipient.sendDay} del mese` : ""}`
                        )
                      }
                    />
                    <SendPanel
                      recipientId={recipient.id}
                      firstName={firstName}
                      to={recipient.email}
                      cc={recipient.cc ?? ""}
                      subject={`Presenze ${name} – ${venue}`}
                      body={composeMessage(recipient.message, {
                        name: recipient.name,
                        month: name,
                        venue,
                        people: data.people.length,
                        signature: [signer, venue].filter(Boolean).join("\n"),
                      })}
                      fileName={`${payrollFileBaseName(data, template)}.${template.fileType}`}
                      month={month}
                      year={year}
                    />
                  </Row>
                );
              })
            ) : (
              <Row first style={{ gap: 10 }}>
                <Line left="Il file per il consulente" />
                <Line
                  muted
                  left={
                    isOwner
                      ? "Aggiungi il consulente del lavoro o il commercialista: imposti una volta il file come lo vuole lui, poi ogni mese è un tasto."
                      : "Il titolare non ha ancora scelto a chi mandare le presenze."
                  }
                />
                {isOwner ? (
                  <div>
                    <Link
                      href="/dashboard/presenze/destinatario/nuovo"
                      style={{ ...softButton, display: "inline-flex", alignItems: "center", textDecoration: "none" }}
                    >
                      Aggiungi il consulente
                    </Link>
                  </div>
                ) : null}
              </Row>
            )}
          </RowsCard>
        </section>
      ) : null}
    </>,
  );
}
