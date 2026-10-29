import Link from "next/link";
import type { ReactNode } from "react";
import { certificateState, daysLeft, latestOnly } from "@/lib/course-certificates";
import { getCourseKind } from "@/lib/course-kinds";
import { relativeDayLabel } from "@/lib/note-list-format";
import { buildPayrollMonth } from "@/lib/payroll/consultant-export";
import { prisma } from "@/lib/prisma";

/*
 * The blocks someone can add to Oggi on top of the base. Each loads its own
 * data, so a block nobody chose costs nothing. They are drawn with the
 * inbox's box and rows, so an added block looks like it was always there.
 */

const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

function Box({ title, aside, link, children }: { title: string; aside?: string | null; link?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="workbit-inbox">
      <div className="workbit-inbox-head">
        <strong>{title}</strong>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
      {link ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Link href={link.href} style={{ color: "#7b2ff7", fontWeight: 800, fontSize: 12.5, textDecoration: "none" }}>
            {link.label}
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

function Row({ icon, title, sub, tone, href }: { icon: string; title: string; sub?: string | null; tone?: "warn" | "good"; href?: string }) {
  return (
    <div className={`workbit-home-row${tone ? ` workbit-home-row--${tone}` : ""}`}>
      <span className="workbit-home-row-icon" aria-hidden="true">
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <b>{title}</b>
        {sub}
      </div>
      {href ? <Link href={href}>Vedi</Link> : null}
    </div>
  );
}

const euro = (cents: number) => (cents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const clock = (hours: number) => {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
};

/** The venue's notes due today or already late. */
export async function HomeNotesBlock({ barId }: { barId: string }) {
  const tomorrow = new Date();
  tomorrow.setHours(24, 0, 0, 0);
  const tasks = await prisma.task.findMany({
    where: { barId, status: { not: "DONE" }, dueDate: { lt: tomorrow } },
    orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
    take: 5,
    select: { id: true, title: true, dueDate: true, isUrgent: true, requiresConfirmation: true },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return (
    <Box title="Note da fare" aside={tasks.length ? `${tasks.length}${tasks.length === 5 ? "+" : ""}` : null} link={{ href: "/dashboard/tasks", label: "Tutte le note" }}>
      {tasks.length === 0 ? <Empty>Niente da fare per oggi.</Empty> : null}
      {tasks.map((task) => {
        const late = task.requiresConfirmation && task.dueDate < today;
        return (
          <Row
            key={task.id}
            icon={task.isUrgent ? "❗" : "📝"}
            title={task.title}
            sub={task.isUrgent ? "urgente" : late ? `in ritardo · ${relativeDayLabel(task.dueDate)}` : relativeDayLabel(task.dueDate)}
            tone={task.isUrgent || late ? "warn" : undefined}
          />
        );
      })}
    </Box>
  );
}

/** The month's hours of the team, and what they cost where the pay is written. */
export async function HomeHoursBlock({ barId }: { barId: string }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const [data, rates] = await Promise.all([
    buildPayrollMonth({ barId, month, year }),
    prisma.employeeBar.findMany({ where: { barId, isActive: true, hourlyRate: { not: null } }, select: { userId: true, hourlyRate: true } }),
  ]);
  const rateOf = new Map(rates.map((rate) => [rate.userId, Number(rate.hourlyRate)]));
  const worked = (person: (typeof data.people)[number]) => person.totals.ordinary.hours + person.totals.overtime.hours;
  const total = data.people.reduce((sum, person) => sum + worked(person), 0);
  const cost = data.people.reduce((sum, person) => sum + worked(person) * (rateOf.get(person.userId) ?? 0), 0);
  const missingRate = data.people.filter((person) => worked(person) > 0 && !rateOf.has(person.userId)).length;
  return (
    <Box title={`Ore di ${MONTHS[month - 1]}`} aside={`${data.people.length} ${data.people.length === 1 ? "persona" : "persone"}`} link={{ href: "/dashboard/presenze", label: "Presenze" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "#20202a", fontVariantNumeric: "tabular-nums" }}>{clock(total)}</span>
        {cost > 0 ? (
          <span style={{ fontSize: 14, color: "#667085" }}>
            <b style={{ color: "#20202a", fontWeight: 800 }}>{euro(Math.round(cost * 100))}</b> di paga lorda
          </span>
        ) : null}
      </div>
      {missingRate ? (
        <span style={{ display: "block", fontSize: 12.5, color: "#92400e", marginTop: 6 }}>
          {missingRate === 1 ? "A una persona manca" : `A ${missingRate} persone manca`} la paga oraria: la scrivi in Team.
        </span>
      ) : null}
    </Box>
  );
}

/** Certificates expired or about to, the person and the days left. */
export async function HomeCoursesBlock({ barId }: { barId: string }) {
  const [certificates, settings] = await Promise.all([
    prisma.courseCertificate.findMany({
      where: { barId, user: { barMemberships: { some: { barId, isActive: true } } } },
      select: { id: true, userId: true, kind: true, title: true, completedAt: true, expiresAt: true, user: { select: { firstName: true } } },
    }),
    prisma.barSettings.findUnique({ where: { barId }, select: { courseReminderDays: true } }),
  ]);
  const lead = settings?.courseReminderDays ?? 60;
  const now = new Date();
  const due = latestOnly(certificates)
    .map((certificate) => ({ certificate, state: certificateState(certificate.expiresAt, lead, now) }))
    .filter((item) => item.state === "expired" || item.state === "expiring")
    .sort((a, b) => (a.certificate.expiresAt?.getTime() ?? 0) - (b.certificate.expiresAt?.getTime() ?? 0));
  return (
    <Box title="Corsi in scadenza" aside={due.length ? String(due.length) : null} link={{ href: "/dashboard/courses", label: "Corsi" }}>
      {due.length === 0 ? <Empty>Tutti gli attestati sono in regola.</Empty> : null}
      {due.slice(0, 4).map(({ certificate, state }) => {
        const name = certificate.kind === "OTHER" ? certificate.title : getCourseKind(certificate.kind).label;
        return (
          <Row
            key={certificate.id}
            icon="🎓"
            title={`${name} di ${certificate.user.firstName}`}
            sub={state === "expired" ? "scaduto" : `scade fra ${daysLeft(certificate.expiresAt!, now)} giorni`}
            tone="warn"
          />
        );
      })}
    </Box>
  );
}

/** What is on the shopping list, as a list instead of behind the cart. */
export function HomeShoppingBlock({ items }: { items: { id: string; name: string; quantity: string | null }[] }) {
  return (
    <Box title="Lista della spesa" aside={items.length ? String(items.length) : null} link={{ href: "/dashboard/shopping-list", label: "Apri la lista" }}>
      {items.length === 0 ? <Empty>Non c&apos;è niente da comprare.</Empty> : null}
      {items.slice(0, 6).map((item) => (
        <Row key={item.id} icon="🛒" title={item.name} sub={item.quantity ? `× ${item.quantity}` : null} />
      ))}
    </Box>
  );
}

/** The suppliers' invoices of the month, read from the uploaded e-invoices. */
export async function HomeCostsBlock({ barId }: { barId: string }) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  const sum = await prisma.supplierInvoice.aggregate({ where: { barId, issueDate: { gte: from, lt: to } }, _sum: { totalCents: true }, _count: true });
  const count = sum._count;
  return (
    <Box title={`Fatture di ${MONTHS[now.getMonth()]}`} aside={count ? `${count} ${count === 1 ? "fattura" : "fatture"}` : null} link={{ href: "/dashboard/costi", label: "Costi" }}>
      {count === 0 ? (
        <Empty>Nessuna fattura caricata questo mese.</Empty>
      ) : (
        <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "#20202a", fontVariantNumeric: "tabular-nums" }}>{euro(sum._sum.totalCents ?? 0)}</span>
      )}
    </Box>
  );
}
