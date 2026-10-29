import Link from "next/link";
import type { CSSProperties } from "react";
import { Role } from "@prisma/client";
import { buildPayrollMonth } from "@/lib/payroll/consultant-export";
import { defaultPayrollMonth, monthKeyOf, parseMonthKey } from "@/lib/payroll/access";
import { composeMessage, monthName, payrollFileBaseName, templateOf } from "@/lib/payroll/template";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { BillingRequired } from "../billing-required";
import { getDashboardContext } from "../context";
import { EmptyState, Panel } from "../ui";
import { Avatar, capStyle, Card, hoursValue, initials, MonthSwitch, SectionHead } from "./payroll-ui";
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

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "13px 16px",
  borderTop: "1px solid #f1eff8",
  color: "#1f1b3a",
  textDecoration: "none",
};

const dot = (color: string): CSSProperties => ({ width: 7, height: 7, borderRadius: 999, background: color, flex: "0 0 auto" });

const chev = <span style={{ color: "#b7b2cc", fontSize: 18, lineHeight: 1 }}>›</span>;

function GearLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      style={{ width: 40, height: 40, borderRadius: 999, border: "1px solid #e9e6f5", background: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </Link>
  );
}

/**
 * Presenze: today, the month's hours, what needs fixing, everyone's month
 * and the file for the consultant, in one place (it replaced Timbrature,
 * the PDF report and the consultant page on 30 Oct 2026). The owner and
 * their staff see everyone they cover; everyone else sees their own month.
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
  const manager = canStamps || canReports;
  const { mese } = await searchParams;
  // The month to close comes first only in its first days; then the month under way.
  const now = new Date();
  const { year, month } =
    parseMonthKey(mese) ?? (manager && now.getDate() <= 5 ? defaultPayrollMonth(now) : { year: now.getFullYear(), month: now.getMonth() + 1 });
  const key = monthKeyOf(year, month);
  const name = monthName(month, year);

  const shell = (children: React.ReactNode) => (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 6, padding: "0 4px" }}>
        <span style={{ ...capStyle, color: "#0284c7" }}>Presenze</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <MonthSwitch base="/dashboard/presenze" year={year} month={month} />
          {isOwner ? (
            <GearLink href="/dashboard/presenze/impostazioni" label="Impostazioni delle presenze" />
          ) : manager ? (
            <Link href={`/dashboard/presenze/persona/${session.user.id}`} style={{ fontSize: 13.5, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
              Le tue ore
            </Link>
          ) : null}
        </div>
      </header>
      {children}
    </div>
  );

  // Everyone without the permissions: their own month.
  if (!manager) {
    return shell(
      <PersonMonth
        barId={activeBarId}
        userId={session.user.id}
        personName={`${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim()}
        year={year}
        month={month}
        canFixStamps={false}
        canCorrectFile={false}
        canPdf={features.reports}
        timeTracking={features.timeTracking}
      />,
    );
  }

  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const range = { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
  const scope = memberScopeWhere(staff);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const showToday = features.timeTracking && isCurrentMonth;

  const [data, recipients, sends, lastOverride, todayLogs, todayShifts] = await Promise.all([
    buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: scope }),
    canReports ? prisma.payrollRecipient.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    canReports ? prisma.payrollSend.findMany({ where: { barId: activeBarId, month: key }, orderBy: { sentAt: "desc" } }) : Promise.resolve([]),
    prisma.payrollDayOverride.findFirst({ where: { barId: activeBarId, date: range }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
    // Today's stamps, and last night's entry still open.
    showToday
      ? prisma.timeLog.findMany({
          where: { barId: activeBarId, timestamp: { gte: new Date(Math.min(dayStart.getTime(), now.getTime() - 16 * 3_600_000)) } },
          orderBy: { timestamp: "asc" },
          select: { userId: true, type: true, timestamp: true },
        })
      : Promise.resolve([]),
    showToday
      ? prisma.shift.findMany({
          where: { barId: activeBarId, confirmedAt: { not: null }, isOnCall: false, startTime: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) } },
          orderBy: { startTime: "asc" },
          select: { startTime: true, endTime: true, assignedToId: true, assignments: { select: { userId: true } } },
        })
      : Promise.resolve([]),
  ]);

  // Two accounts with the same name are told apart by their email.
  const nameCount = new Map<string, number>();
  for (const person of data.people) {
    const full = `${person.firstName} ${person.lastName}`.trim().toLowerCase();
    nameCount.set(full, (nameCount.get(full) ?? 0) + 1);
  }
  const displayName = (person: (typeof data.people)[number]) => `${person.firstName} ${person.lastName}`.trim();
  const twin = (person: (typeof data.people)[number]) => (nameCount.get(displayName(person).toLowerCase()) ?? 0) > 1;

  // Today, person by person: in since, in and out, or the shift still to come.
  type TodayRow = { userId: string; name: string; order: number; status: string; detail: string; tone: "in" | "done" | "late" | "next" };
  const todayRows: TodayRow[] = [];
  for (const person of data.people) {
    const logs = todayLogs.filter((log) => log.userId === person.userId);
    const pairs: string[] = [];
    let openIn: Date | null = null;
    for (const log of logs) {
      if (log.type === "IN") openIn = log.timestamp;
      else if (openIn) {
        if (log.timestamp >= dayStart) pairs.push(`${clock.format(openIn)}–${clock.format(log.timestamp)}`);
        openIn = null;
      }
    }
    const shift = todayShifts.find((item) => item.assignedToId === person.userId || item.assignments.some((assignment) => assignment.userId === person.userId));
    const label = displayName(person);
    if (openIn) {
      todayRows.push({ userId: person.userId, name: label, order: 0, tone: "in", status: `In lavoro dalle ${clock.format(openIn)}`, detail: pairs.length ? `Prima: ${pairs.join(" · ")}` : "" });
    } else if (pairs.length) {
      const lastOut = logs.filter((log) => log.type === "OUT").at(-1)?.timestamp;
      todayRows.push({ userId: person.userId, name: label, order: 2, tone: "done", status: lastOut ? `Uscito alle ${clock.format(lastOut)}` : "Uscito", detail: pairs.join(" · ") });
    } else if (shift) {
      const late = shift.startTime.getTime() + 15 * 60_000 < now.getTime();
      todayRows.push({
        userId: person.userId,
        name: label,
        order: late ? 0.5 : 1,
        tone: late ? "late" : "next",
        status: late ? `Turno delle ${clock.format(shift.startTime)}, non ha timbrato` : `Entra alle ${clock.format(shift.startTime)}`,
        detail: late ? "" : `Turno ${clock.format(shift.startTime)}–${clock.format(shift.endTime)}`,
      });
    }
  }
  todayRows.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "it"));
  const insideCount = todayRows.filter((item) => item.tone === "in").length;

  // What needs fixing, counted once each instead of a mark on every row.
  const firstWith = (test: (message: string) => boolean) => data.people.find((person) => person.flags.some((flag) => test(flag.message)));
  const countOf = (test: (message: string) => boolean) => data.people.reduce((sum, person) => sum + person.flags.filter((flag) => test(flag.message)).length, 0);
  const peopleWith = (test: (message: string) => boolean) => data.people.filter((person) => person.flags.some((flag) => test(flag.message))).length;
  const isMissing = (message: string) => /senza timbratura/.test(message);
  const isLong = (message: string) => /ore timbrate in un giorno/.test(message);
  const isAway = (message: string) => /in un giorno di/.test(message);
  const fixes = [
    { test: isMissing, one: "turno senza timbratura", many: "turni senza timbratura" },
    { test: isLong, one: "giornata oltre 12 ore", many: "giornate oltre 12 ore" },
    { test: isAway, one: "turno in un giorno di assenza", many: "turni in giorni di assenza" },
  ]
    .map((fix) => ({ ...fix, count: countOf(fix.test), people: peopleWith(fix.test), first: firstWith(fix.test) }))
    .filter((fix) => fix.count > 0);
  const missingCodes = data.people.filter((person) => !person.payrollCode).length;

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

  const totalWorked = data.people.reduce((sum, person) => sum + person.totals.ordinary.hours + person.totals.overtime.hours, 0);
  const totalDays = data.people.reduce((sum, person) => sum + person.workedDays, 0);
  const totalOvertime = data.people.reduce((sum, person) => sum + person.totals.overtime.hours, 0);
  const totalAway = data.people.reduce((sum, person) => sum + person.totals.holiday.days + person.totals.sickness.days, 0);
  const venue = data.legalName || data.venueName;
  const signer = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim();
  const personHref = (userId: string) => `/dashboard/presenze/persona/${userId}?mese=${key}`;

  const stats = [
    { value: hoursValue(totalWorked), label: "ore lavorate", color: "#1f1b3a" },
    data.countOvertime
      ? { value: hoursValue(totalOvertime), label: "straordinari", color: "#7e22ce" }
      : { value: String(totalDays), label: "giorni lavorati", color: "#1f1b3a" },
    { value: `${totalAway} gg`, label: "ferie e malattia", color: "#0f7a4f" },
  ];

  return shell(
    <>
      {todayRows.length ? (
        <section style={{ display: "grid", gap: 8 }}>
          <SectionHead title="Oggi" aside={insideCount ? <span style={{ color: "#0f7a4f", fontWeight: 600 }}>{insideCount} in lavoro</span> : undefined} />
          <Card>
            <div style={{ marginTop: -1 }}>
              {todayRows.map((item) => (
                <Link
                  key={item.userId}
                  href={personHref(item.userId)}
                  style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 3, boxShadow: item.tone === "late" ? "inset 3px 0 0 #f59e0b" : undefined }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={dot(item.tone === "in" ? "#10b981" : item.tone === "late" ? "#f59e0b" : item.tone === "next" ? "#c4b5fd" : "#cbd5e1")} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{item.name}</span>
                    <span
                      style={{
                        fontSize: 13,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        color: item.tone === "in" ? "#0f7a4f" : item.tone === "late" ? "#b45309" : "#6f6a88",
                      }}
                    >
                      {item.status}
                    </span>
                  </span>
                  {item.detail ? <span style={{ fontSize: 12.5, color: "#7c7894", paddingLeft: 17, fontVariantNumeric: "tabular-nums" }}>{item.detail}</span> : null}
                </Link>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", padding: "16px 8px 14px" }}>
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                borderLeft: index === 1 ? "1px solid #f1eff8" : undefined,
                borderRight: index === 1 ? "1px solid #f1eff8" : undefined,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", color: stat.color }}>{stat.value}</span>
              <span style={{ fontSize: 12, color: "#6f6a88" }}>{stat.label}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #f1eff8", padding: "10px 16px", textAlign: "center", fontSize: 12.5, color: "#6f6a88" }}>
          {data.source === "SHIFTS" ? "Dai turni pubblicati, si aggiornano da soli" : "Dalle timbrature, arrotondate"} · {data.people.length}{" "}
          {data.people.length === 1 ? "persona" : "persone"}
        </div>
      </Card>

      {fixes.length || (canReports && missingCodes) || data.draftShifts ? (
        <section style={{ display: "grid", gap: 8 }}>
          <SectionHead title="Da sistemare" />
          <Card>
            <div style={{ marginTop: -1 }}>
              {fixes.map((fix) => (
                <Link key={fix.one} href={fix.first ? personHref(fix.first.userId) : "/dashboard/presenze"} style={row}>
                  <span style={dot("#f59e0b")} />
                  <span style={{ flex: 1, fontSize: 15 }}>
                    {fix.count} {fix.count === 1 ? fix.one : fix.many}
                  </span>
                  <span style={{ fontSize: 13, color: "#6f6a88" }}>
                    {fix.people === 1 && fix.first ? fix.first.firstName : `${fix.people} persone`}
                  </span>
                  {chev}
                </Link>
              ))}
              {data.draftShifts ? (
                <Link href="/dashboard/calendar" style={row}>
                  <span style={dot("#f59e0b")} />
                  <span style={{ flex: 1, fontSize: 15 }}>
                    {data.draftShifts} {data.draftShifts === 1 ? "turno non pubblicato" : "turni non pubblicati"}
                  </span>
                  <span style={{ fontSize: 13, color: "#6f6a88" }}>non contati</span>
                  {chev}
                </Link>
              ) : null}
              {canReports && missingCodes ? (
                <Link href={isOwner ? "/dashboard/presenze/impostazioni" : "/dashboard/presenze"} style={row}>
                  <span style={dot("#6d5ce7")} />
                  <span style={{ flex: 1, fontSize: 15 }}>Matricole per il consulente</span>
                  <span style={{ fontSize: 13, color: "#6f6a88" }}>
                    {data.people.length - missingCodes} di {data.people.length}
                  </span>
                  {chev}
                </Link>
              ) : null}
            </div>
          </Card>
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 8 }}>
        <SectionHead title="Persone" aside="ore del mese" />
        <Card>
          <div style={{ marginTop: -1 }}>
            {data.people.length ? (
              data.people.map((person) => {
                const worked = person.totals.ordinary.hours + person.totals.overtime.hours;
                const sub = [
                  `${person.workedDays} ${person.workedDays === 1 ? "giorno" : "giorni"}`,
                  person.totals.overtime.hours ? `straord. ${hoursValue(person.totals.overtime.hours)} h` : null,
                  person.totals.holiday.days ? `ferie ${person.totals.holiday.days} gg` : null,
                  person.totals.sickness.days ? `malattia ${person.totals.sickness.days} gg` : null,
                  twin(person) ? person.email : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <Link key={person.userId} href={personHref(person.userId)} style={row}>
                    <Avatar text={initials(person.firstName, person.lastName)} />
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 15 }}>{displayName(person)}</span>
                      <span style={{ fontSize: 12.5, color: "#6f6a88", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {person.flags.length ? (
                        <span
                          aria-label={`${person.flags.length} da sistemare`}
                          style={{ fontSize: 11.5, fontWeight: 700, color: "#b45309", background: "#fff4dc", borderRadius: 999, padding: "2px 7px" }}
                        >
                          {person.flags.length}
                        </span>
                      ) : null}
                      <span style={{ fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{hoursValue(worked)} h</span>
                    </span>
                    {chev}
                  </Link>
                );
              })
            ) : (
              <div style={{ ...row, color: "#6f6a88", fontSize: 14 }}>Nessuna persona in questo mese.</div>
            )}
          </div>
        </Card>
      </section>

      {canReports ? (
        <section style={{ display: "grid", gap: 8 }}>
          <SectionHead title="Al consulente" />
          {recipients.length ? (
            recipients.map((recipient) => {
              const template = templateOf(recipient.template);
              const last = sends.find((send) => send.recipientId === recipient.id) ?? null;
              const changedAfter = last && lastChange && lastChange > last.sentAt;
              const firstName = /^(studio|dott|rag|avv)/i.test(recipient.name) ? recipient.name : recipient.name.split(/\s+/)[0];
              const words = recipient.name.split(/\s+/).filter(Boolean);
              return (
                <Card key={recipient.id} style={{ padding: 16, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar text={initials(words[0] ?? "", words[1] ?? "")} tone="blue" />
                    <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                      <span style={{ fontSize: 15 }}>{recipient.name}</span>
                      <span style={{ fontSize: 12.5, color: last ? (changedAfter ? "#b45309" : "#0f7a4f") : "#6f6a88" }}>
                        {last
                          ? changedAfter
                            ? `Mandato il ${when.format(last.sentAt)}, poi è cambiato qualcosa`
                            : `Mandato il ${when.format(last.sentAt)} ${CHANNEL_LABELS[last.channel] ?? ""}`
                          : `${template.fileType === "csv" ? "CSV" : "Excel"}${recipient.sendDay ? ` · promemoria il ${recipient.sendDay} del mese` : ""}`}
                      </span>
                    </span>
                    {isOwner ? (
                      <Link href={`/dashboard/presenze/destinatario/${recipient.id}`} style={{ fontSize: 13, fontWeight: 700, color: "#6d5ce7", textDecoration: "none" }}>
                        Modifica
                      </Link>
                    ) : null}
                  </div>
                  <SendPanel
                    recipientId={recipient.id}
                    firstName={firstName}
                    label={`Invia le presenze di ${name.split(" ")[0]}`}
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
                </Card>
              );
            })
          ) : (
            <Card style={{ padding: 16, display: "grid", gap: 10 }}>
              <span style={{ fontSize: 15 }}>Il file per il consulente</span>
              <span style={{ fontSize: 13, color: "#6f6a88" }}>
                {isOwner
                  ? "Aggiungi il consulente del lavoro o il commercialista: imposti una volta il file come lo vuole lui, poi ogni mese è un tasto."
                  : "Il titolare non ha ancora scelto a chi mandare le presenze."}
              </span>
              {isOwner ? (
                <Link
                  href="/dashboard/presenze/destinatario/nuovo"
                  style={{
                    minHeight: 46,
                    borderRadius: 999,
                    background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 14.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textDecoration: "none",
                    boxShadow: "0 10px 22px rgba(124,58,237,.18)",
                  }}
                >
                  Aggiungi il consulente
                </Link>
              ) : null}
            </Card>
          )}
        </section>
      ) : null}
    </>,
  );
}
