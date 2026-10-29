import Link from "next/link";
import type { ReactNode } from "react";
import { Prisma, RequestStatus, RequestType } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { certificateState, daysLeft, latestOnly } from "@/lib/course-certificates";
import { getCourseKind } from "@/lib/course-kinds";
import { buildCostReport, monthLabel } from "@/lib/costs/analysis";
import { buildPayrollMonth } from "@/lib/payroll/consultant-export";
import { prisma } from "@/lib/prisma";
import { reviewRequestAction } from "./actions";

/*
 * The widgets someone can add to Oggi on top of the base. Each loads its own
 * data, so a widget nobody chose costs nothing. They are drawn as the base's
 * cards are, so an added one looks like it was always there.
 */

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const DAY = 86_400_000;

const muted = { color: "#667085", fontSize: 12.5 } as const;
const line = { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid rgba(94, 92, 230, 0.09)", fontSize: 14 } as const;
const chip = { fontSize: 12, padding: "3px 9px", borderRadius: 999, background: "#f4f3f9", color: "#6f6a88", whiteSpace: "nowrap" } as const;

function Card({ emoji, title, aside, link, children }: { emoji: string; title: string; aside?: string | null; link?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="workbit-inbox">
      <div className="workbit-inbox-head">
        <strong>
          {emoji} {title}
        </strong>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
      {link ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <Link href={link.href} style={{ color: "#7b2ff7", fontWeight: 800, fontSize: 12.5, textDecoration: "none" }}>
            {link.label} ›
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="workbit-inbox-empty">
      <i aria-hidden="true" /> {children}
    </p>
  );
}

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const shortDay = (date: Date) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" }).format(date).replace(/\.$/, "");

function Change({ now, before }: { now: number; before: number | null }) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (!pct) return <span style={muted}>come il mese prima</span>;
  return (
    <span style={{ fontSize: 13.5, fontWeight: 750, color: pct > 0 ? "#b3202f" : "#0f7a4f" }}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/** The month's costs in one card: the total against the month before, where it goes, and one saving. */
export async function HomeCostsWidget({ barId }: { barId: string }) {
  const report = await buildCostReport(barId, null);
  if (!report) {
    return (
      <Card emoji="💶" title="Analisi costi" link={{ href: "/dashboard/costi", label: "Carica le fatture" }}>
        <Empty>Ancora nessuna fattura: caricale in Costi e qui trovi il resoconto del mese.</Empty>
      </Card>
    );
  }
  const labor = report.labor?.cents ?? 0;
  const total = report.suppliersCents + labor;
  const before = report.previousSuppliersCents !== null ? report.previousSuppliersCents + (report.labor?.previousCents ?? 0) : null;
  const parts = [
    ...(labor ? [{ label: "Personale", color: "#8b6cf0", cents: labor }] : []),
    ...[...report.categories].sort((a, b) => b.cents - a.cents).slice(0, 3).map((category) => ({ label: category.label, color: category.color, cents: category.cents })),
  ].filter((part) => part.cents > 0);
  const shown = parts.reduce((sum, part) => sum + part.cents, 0);
  if (total - shown > 0) parts.push({ label: "Altro", color: "#94a3b8", cents: total - shown });
  const tip = report.savings[0];
  return (
    <Card emoji="💶" title={`Costi di ${monthLabel(report.month).split(" ")[0]}`} aside={`${report.invoiceCount} fatture`} link={{ href: "/dashboard/costi", label: "Analisi completa" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "#20202a", fontVariantNumeric: "tabular-nums" }}>{euro(total)}</span>
        <Change now={total} before={before} />
        {before ? <span style={muted}>sul mese prima</span> : null}
      </div>
      {total > 0 ? (
        <>
          <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", background: "#f1eff8", marginTop: 12 }}>
            {parts.map((part) => (
              <span key={part.label} style={{ width: `${(part.cents / total) * 100}%`, background: part.color }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px", marginTop: 10, fontSize: 13 }}>
            {parts.map((part) => (
              <span key={part.label} style={{ display: "flex", gap: 6, alignItems: "baseline", minWidth: 0 }}>
                <span style={{ color: part.color }}>●</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475467" }}>{part.label}</span>
                <b style={{ marginLeft: "auto", color: "#20202a", fontVariantNumeric: "tabular-nums" }}>{euro(part.cents)}</b>
              </span>
            ))}
          </div>
        </>
      ) : null}
      {report.labor?.missingRates ? (
        <span style={{ display: "block", ...muted, marginTop: 8 }}>
          Personale senza la paga oraria di {report.labor.missingRates} {report.labor.missingRates === 1 ? "persona" : "persone"}: la scrivi in Team.
        </span>
      ) : null}
      {tip ? (
        <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 14, background: "#fff7e6", fontSize: 13, color: "#92400e", lineHeight: 1.4 }}>
          💡 {tip.title}
          {tip.yearlyCents ? (
            <>
              : <b>{euro(tip.yearlyCents)} l&apos;anno</b>
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/** The products whose price moved most, read from the invoices. */
export async function HomePricesWidget({ barId }: { barId: string }) {
  const report = await buildCostReport(barId, null);
  const changes = [...(report?.priceChanges ?? [])].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 4);
  return (
    <Card emoji="📈" title="Prezzi che salgono" aside="dalle fatture" link={{ href: "/dashboard/costi", label: "Costi" }}>
      {changes.length === 0 ? <Empty>Nessun prezzo cambiato rispetto alle fatture prima.</Empty> : null}
      {changes.map((change, index) => (
        <div key={change.productKey} style={{ ...line, ...(index ? {} : { borderTop: 0, paddingTop: 0 }) }}>
          <span style={{ minWidth: 0, display: "grid" }}>
            <span style={{ color: "#20202a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{change.label}</span>
            <span style={muted}>{change.supplier}</span>
          </span>
          <span style={{ marginLeft: "auto", fontWeight: 750, color: change.changePct > 0 ? "#b3202f" : "#0f7a4f" }}>
            {change.changePct > 0 ? "+" : "−"}
            {Math.abs(Math.round(change.changePct))}%
          </span>
        </div>
      ))}
    </Card>
  );
}

/** The month's work: hours, overtime, pay, and what share of the costs it is. */
export async function HomeStaffWidget({ barId }: { barId: string }) {
  const now = new Date();
  const [data, rates] = await Promise.all([
    buildPayrollMonth({ barId, month: now.getMonth() + 1, year: now.getFullYear() }),
    prisma.employeeBar.findMany({ where: { barId, hourlyRate: { not: null } }, select: { userId: true, hourlyRate: true } }),
  ]);
  const rateOf = new Map(rates.map((rate) => [rate.userId, Number(rate.hourlyRate)]));
  let worked = 0;
  let overtime = 0;
  let cents = 0;
  for (const person of data.people) {
    const hours = person.totals.ordinary.hours + person.totals.overtime.hours;
    worked += hours;
    overtime += person.totals.overtime.hours;
    cents += Math.round(hours * (rateOf.get(person.userId) ?? 0) * 100);
  }
  const tile = (value: string, label: string, tone?: string) => (
    <span style={{ display: "grid", gap: 2, textAlign: "center" }}>
      <b style={{ fontSize: 21, fontWeight: 800, color: tone ?? "#20202a", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{value}</b>
      <span style={muted}>{label}</span>
    </span>
  );
  return (
    <Card emoji="⏱" title="Personale del mese" aside={MONTHS[now.getMonth()]} link={{ href: "/dashboard/presenze", label: "Presenze" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {tile(`${Math.round(worked)}h`, "lavorate")}
        {tile(`${Math.round(overtime)}h`, "straordinari", overtime ? "#b45309" : undefined)}
        {tile(cents ? euro(cents) : "—", "paga lorda")}
      </div>
      <span style={{ display: "block", ...muted, marginTop: 10 }}>
        {data.people.length} {data.people.length === 1 ? "persona" : "persone"}
        {cents ? "" : " · scrivi la paga oraria in Team per vedere quanto costa"}
      </span>
    </Card>
  );
}

const ABSENCE_LABEL: Partial<Record<RequestType, string>> = {
  [RequestType.VACATION]: "🌴 Ferie",
  [RequestType.SICKNESS]: "🤒 Malattia",
  [RequestType.PERMISSION]: "🕐 Permesso",
};
const REQUEST_LABEL: Record<RequestType, string> = {
  VACATION: "Ferie",
  PERMISSION: "Permesso",
  SHIFT_CHANGE: "Cambio turno",
  SICKNESS: "Assenza",
  OVERTIME: "Straordinario",
};

type PendingRequest = { id: string; type: RequestType; startsAt: Date | null; endsAt: Date | null; employee: { firstName: string; lastName: string } };

function when(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt) return "";
  if (!endsAt || shortDay(startsAt) === shortDay(endsAt)) return shortDay(startsAt);
  return `${shortDay(startsAt)} – ${shortDay(endsAt)}`;
}

const round = { width: 36, height: 36, borderRadius: 999, border: 0, fontWeight: 900, fontSize: 15, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" } as const;

/** What waits for an answer, answered from here, and who is away this week. */
export async function HomeAbsencesWidget({ barId, pending, employeeWhere }: { barId: string; pending: PendingRequest[]; employeeWhere: Prisma.UserWhereInput }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekEnd = new Date(today.getTime() + 7 * DAY);
  const away = await prisma.request.findMany({
    where: {
      barId,
      status: RequestStatus.APPROVED,
      type: { in: [RequestType.VACATION, RequestType.SICKNESS, RequestType.PERMISSION] },
      employee: employeeWhere,
      startsAt: { lt: weekEnd },
      OR: [{ endsAt: { gte: today } }, { endsAt: null, startsAt: { gte: today } }],
    },
    orderBy: { startsAt: "asc" },
    take: 8,
    select: { id: true, type: true, startsAt: true, endsAt: true, employee: { select: { firstName: true } } },
  });
  return (
    <Card emoji="📨" title="Richieste e assenze" aside={pending.length ? `${pending.length} da decidere` : null} link={{ href: "/dashboard/requests", label: "Tutte le richieste" }}>
      {pending.length === 0 ? <Empty>Nessuna richiesta da decidere.</Empty> : null}
      {pending.map((request, index) => (
        <div key={request.id} style={{ ...line, ...(index ? {} : { borderTop: 0, paddingTop: 0 }) }}>
          <span style={{ display: "grid", minWidth: 0 }}>
            <b style={{ color: "#20202a", fontSize: 14.5, fontWeight: 750 }}>
              {REQUEST_LABEL[request.type]} · {request.employee.firstName}
            </b>
            <span style={muted}>{when(request.startsAt, request.endsAt)}</span>
          </span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <ActionForm action={reviewRequestAction} success="Richiesta approvata.">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="decision" value="APPROVED" />
              <input type="hidden" name="notifySuccess" value="1" />
              <button type="submit" aria-label={`Approva ${REQUEST_LABEL[request.type]} di ${request.employee.firstName}`} style={{ ...round, background: "#dcfce7", color: "#166534" }}>
                ✓
              </button>
            </ActionForm>
            <ActionForm action={reviewRequestAction} success="Richiesta rifiutata.">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="decision" value="REJECTED" />
              <input type="hidden" name="notifySuccess" value="1" />
              <button type="submit" aria-label={`Rifiuta ${REQUEST_LABEL[request.type]} di ${request.employee.firstName}`} style={{ ...round, background: "#fdecec", color: "#b3202f" }}>
                ✕
              </button>
            </ActionForm>
          </span>
        </div>
      ))}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", paddingTop: 10, marginTop: pending.length ? 0 : 6, borderTop: pending.length ? "1px solid rgba(94, 92, 230, 0.09)" : 0 }}>
        <span style={muted}>{away.length ? "Fuori questa settimana:" : "Questa settimana non manca nessuno."}</span>
        {away.map((item) => (
          <span key={item.id} style={chip}>
            {ABSENCE_LABEL[item.type]} {item.employee.firstName} {when(item.startsAt, item.endsAt)}
          </span>
        ))}
      </div>
    </Card>
  );
}

/** The next 30 days: certificates running out, courses booked, notes with a date. */
export async function HomeDeadlinesWidget({ barId, courses, notes }: { barId: string; courses: boolean; notes: boolean }) {
  const now = new Date();
  const until = new Date(now.getTime() + 30 * DAY);
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const [certificates, booked, dated] = await Promise.all([
    courses
      ? prisma.courseCertificate.findMany({
          where: { barId, user: { barMemberships: { some: { barId, isActive: true } } } },
          select: { id: true, userId: true, kind: true, title: true, completedAt: true, expiresAt: true, user: { select: { firstName: true } } },
        })
      : Promise.resolve([]),
    courses
      ? prisma.course.findMany({ where: { barId, startsAt: { gte: now, lt: until } }, orderBy: { startsAt: "asc" }, take: 4, select: { id: true, title: true, startsAt: true } })
      : Promise.resolve([]),
    notes
      ? prisma.task.findMany({
          where: { barId, status: { not: "DONE" }, repeatEvery: null, dueDate: { gte: tomorrow, lt: until } },
          orderBy: { dueDate: "asc" },
          take: 4,
          select: { id: true, title: true, dueDate: true },
        })
      : Promise.resolve([]),
  ]);
  const items = [
    ...latestOnly(certificates)
      .filter((certificate) => certificate.expiresAt && certificate.expiresAt < until && certificateState(certificate.expiresAt, 30, now) !== "valid")
      .map((certificate) => {
        const expired = certificateState(certificate.expiresAt, 30, now) === "expired";
        const name = certificate.kind === "OTHER" ? certificate.title : getCourseKind(certificate.kind).label;
        return {
          id: certificate.id,
          at: certificate.expiresAt!,
          title: `${name} di ${certificate.user.firstName}`,
          tag: expired ? "scaduto" : `fra ${daysLeft(certificate.expiresAt!, now)} gg`,
          alarm: true,
        };
      }),
    ...booked.map((course) => ({ id: course.id, at: course.startsAt, title: course.title, tag: "corso", alarm: false })),
    ...dated.map((task) => ({ id: task.id, at: task.dueDate, title: task.title, tag: "nota", alarm: false })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, 5);
  return (
    <Card emoji="⏰" title="Scadenze" aside="prossimi 30 giorni">
      {items.length === 0 ? <Empty>Niente in scadenza nei prossimi 30 giorni.</Empty> : null}
      {items.map((item, index) => (
        <div key={item.id} style={{ ...line, ...(index ? {} : { borderTop: 0, paddingTop: 0 }) }}>
          <b style={{ width: 48, flex: "0 0 auto", color: item.alarm && item.at < now ? "#b3202f" : "#20202a", fontSize: 13.5 }}>{shortDay(item.at)}</b>
          <span style={{ minWidth: 0, color: "#20202a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
          <span style={{ ...chip, marginLeft: "auto", ...(item.alarm ? { background: "#fdecec", color: "#b3202f" } : {}) }}>{item.tag}</span>
        </div>
      ))}
    </Card>
  );
}
