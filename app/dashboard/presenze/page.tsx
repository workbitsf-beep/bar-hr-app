import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
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
import { Avatar, MixCard, Pill } from "../mix-ui";
import { GearLink, hoursValue, initials, MonthMenu, Quiet } from "./payroll-ui";
import { PersonMonth } from "./person-month";
import { SendPanel } from "./send-panel";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });
const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #f2f0f8", color: "#1f1b3a", textDecoration: "none" };
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase() || "?";
const dot = (color: string): CSSProperties => ({ width: 8, height: 8, borderRadius: 999, background: color, flex: "0 0 auto" });

/** A card with its bold title inside and the count on the right. */
function Group({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <MixCard title={title} aside={count}>
      {children}
    </MixCard>
  );
}

/**
 * Presenze, kept to what is read every day: the month's hours, today, what
 * is missing, everyone's hours, and one button to the consultant. Settings
 * and the consultant's setup live on their own pages.
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
  const now = new Date();
  // The month to close comes first only in its first days; then the month under way.
  const { year, month } =
    parseMonthKey(mese) ?? (manager && now.getDate() <= 5 ? defaultPayrollMonth(now) : { year: now.getFullYear(), month: now.getMonth() + 1 });
  const key = monthKeyOf(year, month);
  const name = monthName(month, year);

  const shell = (children: ReactNode) => (
    <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 640, margin: "0 auto", width: "100%", padding: "4px 4px 0" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 56 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.05 }}>Presenze</h1>
        </div>
        {isOwner ? (
          <GearLink href="/dashboard/presenze/impostazioni" label="Impostazioni delle presenze" />
        ) : manager ? (
          <Link href={`/dashboard/presenze/persona/${session.user.id}`} style={{ fontSize: 14.5, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", }}>
            Le tue ore
          </Link>
        ) : null}
      </header>
      <MonthMenu base="/dashboard/presenze" year={year} month={month} />
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
        embedded
      />,
    );
  }

  const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
  const range = { gte: new Date(Date.UTC(year, month - 1, 1)), lt: new Date(Date.UTC(year, month, 1)) };
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const showToday = features.timeTracking && isCurrentMonth;

  const [data, recipients, sends, lastOverride, todayLogs, todayShifts] = await Promise.all([
    buildPayrollMonth({ barId: activeBarId, month, year, memberWhere: memberScopeWhere(staff) }),
    canReports ? prisma.payrollRecipient.findMany({ where: { barId: activeBarId }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    canReports ? prisma.payrollSend.findMany({ where: { barId: activeBarId, month: key }, orderBy: { sentAt: "desc" } }) : Promise.resolve([]),
    prisma.payrollDayOverride.findFirst({ where: { barId: activeBarId, date: range }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
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
  const fullName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`.trim();
  for (const person of data.people) nameCount.set(fullName(person).toLowerCase(), (nameCount.get(fullName(person).toLowerCase()) ?? 0) + 1);
  const personHref = (userId: string) => `/dashboard/presenze/persona/${userId}?mese=${key}`;

  // Today, as three groups: in now, late without a stamp, later or already gone.
  type TodayRow = { userId: string; name: string; status: string };
  const inNow: TodayRow[] = [];
  const late: TodayRow[] = [];
  const laterOrDone: (TodayRow & { done: boolean })[] = [];
  for (const person of data.people) {
    const logs = todayLogs.filter((log) => log.userId === person.userId);
    const pairs: string[] = [];
    let openIn: Date | null = null;
    for (const log of logs) {
      if (log.type === "IN") openIn = log.timestamp;
      else if (openIn) {
        if (log.timestamp >= dayStart) pairs.push(`${clock.format(openIn)} – ${clock.format(log.timestamp)}`);
        openIn = null;
      }
    }
    const shift = todayShifts.find((item) => item.assignedToId === person.userId || item.assignments.some((assignment) => assignment.userId === person.userId));
    const label = fullName(person);
    if (openIn) inNow.push({ userId: person.userId, name: label, status: `dalle ${clock.format(openIn)}` });
    else if (pairs.length) laterOrDone.push({ userId: person.userId, name: label, status: pairs.join(" · "), done: true });
    else if (shift && shift.startTime.getTime() + 15 * 60_000 < now.getTime()) late.push({ userId: person.userId, name: label, status: `Turno delle ${clock.format(shift.startTime)}, non ha timbrato` });
    else if (shift) laterOrDone.push({ userId: person.userId, name: label, status: `entra alle ${clock.format(shift.startTime)}`, done: false });
  }
  laterOrDone.sort((a, b) => Number(a.done) - Number(b.done) || a.name.localeCompare(b.name, "it"));

  const missingCount = data.people.reduce((sum, person) => sum + person.flags.length, 0);
  const firstFlagged = data.people.find((person) => person.flags.length);
  const missingCodes = data.people.filter((person) => !person.payrollCode).length;

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
  const venue = data.legalName || data.venueName;
  const signer = `${session.user.firstName ?? ""} ${session.user.lastName ?? ""}`.trim();
  const recipient = recipients[0] ?? null;
  const lastSend = recipient ? sends.find((send) => send.recipientId === recipient.id) ?? null : null;
  const changedAfter = Boolean(lastSend && lastChange && lastChange > lastSend.sentAt);

  return shell(
    <>
      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{hoursValue(totalWorked)}</span>
        <Quiet style={{ fontSize: 14.5 }}>
          ore nel mese · {data.people.length} {data.people.length === 1 ? "persona" : "persone"}
          {data.source === "SHIFTS" ? " · dai turni" : ""}
        </Quiet>
      </div>

      {showToday && !inNow.length && !late.length && !laterOrDone.length ? (
        <Group title="Oggi">
          <div style={{ ...row, borderTop: 0 }}>
            <span style={dot("#cbd5e1")} />
            <Quiet style={{ fontSize: 15 }}>Nessuno in lavoro e nessun turno oggi</Quiet>
          </div>
        </Group>
      ) : null}

      {inNow.length ? (
        <Group title="In lavoro adesso" count={inNow.length}>
          {inNow.map((item, index) => (
            <Link key={item.userId} href={personHref(item.userId)} style={{ ...row, borderTop: index ? row.borderTop : 0 }}>
              <Avatar>{initialsOf(item.name)}</Avatar>
              <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                <b style={{ fontSize: 15, fontWeight: 650 }}>{item.name}</b>
                <Quiet style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{item.status}</Quiet>
              </span>
              <Pill tone="good">dentro</Pill>
            </Link>
          ))}
        </Group>
      ) : null}

      {late.length ? (
        <Group title="Da sistemare oggi" count={late.length}>
          {late.map((item, index) => (
            <Link key={item.userId} href={personHref(item.userId)} style={{ ...row, borderTop: index ? row.borderTop : 0 }}>
              <Avatar>{initialsOf(item.name)}</Avatar>
              <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                <b style={{ fontSize: 15, fontWeight: 650 }}>{item.name}</b>
                <span style={{ fontSize: 13, color: "#b45309" }}>{item.status}</span>
              </span>
              <Pill tone="wait">Sistema</Pill>
            </Link>
          ))}
        </Group>
      ) : null}

      {laterOrDone.length ? (
        <Group title="Più tardi e già usciti">
          {laterOrDone.map((item, index) => (
            <Link key={item.userId} href={personHref(item.userId)} style={{ ...row, borderTop: index ? row.borderTop : 0 }}>
              <Avatar>{initialsOf(item.name)}</Avatar>
              <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                <b style={{ fontSize: 15, fontWeight: 650 }}>{item.name}</b>
                <Quiet style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{item.status}</Quiet>
              </span>
              <Pill tone={item.done ? "grey" : "violet"}>{item.done ? "uscito" : "più tardi"}</Pill>
            </Link>
          ))}
        </Group>
      ) : null}

      {missingCount || (canReports && missingCodes) ? (
        <div style={{ display: "grid", gap: 10, padding: "0 4px" }}>
          {missingCount ? (
            <Link href={firstFlagged ? personHref(firstFlagged.userId) : "/dashboard/presenze"} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "#b45309", textDecoration: "none" }}>
              <span style={dot("#f59e0b")} />
              {missingCount} {missingCount === 1 ? "turno senza timbratura nel mese" : "turni senza timbratura nel mese"}
              <span style={{ marginLeft: "auto" }}>›</span>
            </Link>
          ) : null}
          {canReports && missingCodes ? (
            <Link href={isOwner ? "/dashboard/presenze/impostazioni/persone" : "/dashboard/presenze"} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: "#5e4ae3", textDecoration: "none" }}>
              <span style={dot("#6d5ce7")} />
              Matricole per il consulente: {data.people.length - missingCodes} di {data.people.length}
              <span style={{ marginLeft: "auto" }}>›</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      <Group title="Persone" count={data.people.length}>
        {data.people.length ? (
          data.people.map((person, index) => {
            const twin = (nameCount.get(fullName(person).toLowerCase()) ?? 0) > 1;
            return (
              <Link key={person.userId} href={personHref(person.userId)} style={{ ...row, borderTop: index ? row.borderTop : 0 }}>
                <Avatar>{initials(person.firstName, person.lastName)}</Avatar>
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                  <span style={{ fontSize: 15.5 }}>{fullName(person)}</span>
                  {twin ? <Quiet style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.email}</Quiet> : null}
                </span>
                {person.flags.length ? <span aria-label={`${person.flags.length} da sistemare`} style={dot("#f59e0b")} /> : null}
                <b style={{ fontSize: 15.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{hoursValue(person.totals.ordinary.hours + person.totals.overtime.hours)}</b>
                <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>
              </Link>
            );
          })
        ) : (
          <div style={{ ...row, borderTop: 0 }}>
            <Quiet>Nessuna persona in questo mese.</Quiet>
          </div>
        )}
      </Group>

      {canReports ? (
        recipient ? (
          <div style={{ display: "grid", gap: 8, paddingBottom: 8 }}>
            <SendPanel
              recipientId={recipient.id}
              firstName={/^(studio|dott|rag|avv)/i.test(recipient.name) ? recipient.name : recipient.name.split(/\s+/)[0]}
              label={`Invia le presenze a ${recipient.name}`}
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
              fileName={`${payrollFileBaseName(data, templateOf(recipient.template))}.${templateOf(recipient.template).fileType}`}
              month={month}
              year={year}
            />
            <Quiet style={{ fontSize: 12.5, textAlign: "center", color: lastSend ? (changedAfter ? "#b45309" : "#0f7a4f") : undefined }}>
              {lastSend
                ? changedAfter
                  ? `Mandate il ${when.format(lastSend.sentAt)}, poi è cambiato qualcosa: rimandale`
                  : `Mandate il ${when.format(lastSend.sentAt)}`
                : recipient.sendDay
                  ? `Da mandare entro il ${recipient.sendDay} del mese dopo`
                  : `A ${recipient.email}`}
              {recipients.length > 1 ? ` · altri ${recipients.length - 1} destinatari in Impostazioni` : ""}
            </Quiet>
          </div>
        ) : isOwner ? (
          <Link
            href="/dashboard/presenze/destinatario/nuovo"
            style={{
              minHeight: 52,
              borderRadius: 999,
              border: "1px solid #ddd6fe",
              background: "#ffffff",
              color: "#4c1d95",
              fontSize: 15.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
              marginBottom: 8,
            }}
          >
            Collega il consulente
          </Link>
        ) : null
      ) : null}
    </>,
  );
}
