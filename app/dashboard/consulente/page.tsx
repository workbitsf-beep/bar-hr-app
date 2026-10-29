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
import { MonthChips, hoursText, ROLE_LABELS } from "./payroll-ui";
import { SendPanel } from "./send-panel";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

const CHANNEL_LABELS: Record<string, string> = {
  mail_app: "dalla tua mail",
  share: "dal telefono",
  mailto: "dalla tua mail",
  workbit: "da Workbit",
};

/** The month's attendance: check it, then send it to whoever does the payroll. */
export default async function ConsultantPage({ searchParams }: { searchParams: Promise<{ mese?: string }> }) {
  const { session, role, staff, activeBarId, billingStatus, features } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Presenze per il consulente">
        <EmptyState message="Seleziona un locale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  const isOwner = role === Role.OWNER;
  if (!isOwner && !can(staff, "reports")) {
    return (
      <Panel title="Presenze per il consulente">
        <EmptyState message="Le presenze per il consulente le prepara il titolare." />
      </Panel>
    );
  }
  if (!features.reports) {
    return (
      <Panel title="Presenze per il consulente">
        <EmptyState message="Modulo report disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const { mese } = await searchParams;
  const { year, month } = parseMonthKey(mese) ?? defaultPayrollMonth();
  const key = monthKeyOf(year, month);
  const range = { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };

  const [data, recipients, sends, lastOverride] = await Promise.all([
    buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: memberScopeWhere(staff) }),
    prisma.payrollRecipient.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" } }),
    prisma.payrollSend.findMany({ where: { barId: activeBarId, month: key }, orderBy: { sentAt: "desc" } }),
    prisma.payrollDayOverride.findFirst({ where: { barId: activeBarId, date: range }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);

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
  const corrected = data.people.reduce((sum, person) => sum + person.overridden.length, 0);
  const missing = data.people.filter((person) => person.warnings.length).length;
  const name = monthName(month, year);
  const venue = data.legalName || data.venueName;
  const signer = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim();

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 2, padding: "0 4px" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#7e22ce" }}>Presenze per il consulente</span>
        <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.03em", textTransform: "capitalize" }}>{name}</h1>
      </header>

      <MonthChips base="/dashboard/consulente" year={year} month={month} />

      <RowsCard>
        <Row first rail={flagged ? "amber" : undefined} style={{ gap: 8 }}>
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
                ? "Ore dai turni pubblicati nel calendario: se aggiungi, sposti o cancelli un turno, il file cambia da solo."
                : "Ore dalle timbrature, arrotondate con le regole del locale. Ferie, permessi e malattia dalle richieste approvate."
            }
          />
          {corrected || missing || data.draftShifts ? (
            <Line
              muted
              left={[
                corrected ? `${corrected} ${corrected === 1 ? "giorno corretto" : "giorni corretti"} da te` : null,
                missing ? `${missing} ${missing === 1 ? "persona" : "persone"} senza matricola o ore di contratto` : null,
                data.draftShifts ? `${data.draftShifts} turni non pubblicati, non contati` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          ) : null}
          <div style={{ paddingTop: 4 }}>
            <Link href={`/dashboard/consulente/revisione?mese=${key}`} style={{ ...softButton, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
              Controlla il mese
            </Link>
          </div>
        </Row>
      </RowsCard>

      <section style={{ display: "grid", gap: 8 }}>
        <SectionLabel aside={isOwner ? <Link href="/dashboard/consulente/impostazioni" style={{ color: "#6d5ce7", textDecoration: "none" }}>Impostazioni</Link> : undefined}>
          Invia
        </SectionLabel>
        <RowsCard>
          {recipients.length ? (
            recipients.map((recipient, index) => {
              const template = templateOf(recipient.template);
              const sent = sends.filter((send) => send.recipientId === recipient.id);
              const last = sent[0] ?? null;
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
              <Line left="A chi le mandi?" />
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
                    href="/dashboard/consulente/destinatario/nuovo"
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

      <section style={{ display: "grid", gap: 8 }}>
        <SectionLabel aside="ore · ferie e malattia in giorni">Il mese, persona per persona</SectionLabel>
        <RowsCard>
          {data.people.length ? (
            data.people.map((person, index) => (
              <Link
                key={person.userId}
                href={`/dashboard/consulente/revisione?mese=${key}#p-${person.userId}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <Row first={index === 0} rail={person.flags.length || person.warnings.length ? "amber" : undefined}>
                  <Line left={`${person.lastName} ${person.firstName}`} right={person.payrollCode ?? ""} />
                  <Line
                    muted
                    left={[
                      `Ordinarie ${hoursText(person.totals.ordinary.hours)}`,
                      person.totals.overtime.hours ? `straordinari ${hoursText(person.totals.overtime.hours)}` : null,
                      person.totals.holiday.days ? `ferie ${person.totals.holiday.days} gg` : null,
                      person.totals.leave.hours || person.totals.leave.days ? `permessi ${person.totals.leave.hours ? `${hoursText(person.totals.leave.hours)} h` : `${person.totals.leave.days} gg`}` : null,
                      person.totals.sickness.days ? `malattia ${person.totals.sickness.days} gg` : null,
                      `${person.workedDays} giorni lavorati`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  {person.flags.length ? (
                    <span style={{ fontSize: 12.5, color: "#b45309" }}>
                      {person.flags.length} {person.flags.length === 1 ? "giorno da guardare" : "giorni da guardare"}
                    </span>
                  ) : null}
                </Row>
              </Link>
            ))
          ) : (
            <Row first>
              <Line muted left="Nessuna persona in questo mese." />
            </Row>
          )}
        </RowsCard>
      </section>
    </div>
  );
}
