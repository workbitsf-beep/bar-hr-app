import Link from "next/link";
import { RequestStatus, RequestType, Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildMonthlyTotals } from "@/lib/reporting";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { Avatar, duration, REQUEST_LABEL } from "./desk-helpers";
import "./desk.css";

/**
 * The right-hand column some pages get on a computer. The page itself is the
 * one the phone shows; next to it, in `.wb-desk-split`, a summary that only
 * has room on a wide screen. Hidden below 1100px.
 */

const DAY_MS = 86_400_000;
const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });

function daysBetween(from: Date, to: Date | null) {
  const a = toDateInputValueInTimeZone(from);
  const b = toDateInputValueInTimeZone(to ?? from);
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS) + 1;
}

export async function RequestsAside({ barId, userId }: { barId: string; userId: string }) {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const mine = await prisma.request.findMany({
    where: { barId, employeeId: userId, createdAt: { gte: new Date(yearStart.getTime() - 60 * DAY_MS) } },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, type: true, status: true, startsAt: true, endsAt: true },
  });
  const approvedThisYear = mine.filter(
    (r) => r.status === RequestStatus.APPROVED && r.startsAt && r.startsAt >= yearStart
  );
  const vacationDays = approvedThisYear
    .filter((r) => r.type === RequestType.VACATION)
    .reduce((sum, r) => sum + daysBetween(r.startsAt!, r.endsAt), 0);
  const permissionCount = approvedThisYear.filter((r) => r.type === RequestType.PERMISSION).length;
  const pending = mine.filter((r) => r.status === RequestStatus.PENDING);
  const upcoming = mine
    .filter((r) => r.status === RequestStatus.APPROVED && r.startsAt && r.startsAt >= new Date())
    .sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime())
    .slice(0, 4);

  return (
    <div className="wbd" style={{ gap: 14 }}>
      <div className="wbd-figs" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="wbd-fig wbd-fig--hero">
          <span>Ferie {new Date().getFullYear()}</span>
          <b>{vacationDays} gg</b>
          <small>approvate</small>
        </div>
        <div className="wbd-fig">
          <span>Permessi</span>
          <b>{permissionCount}</b>
          <small>approvati</small>
        </div>
      </div>
      <section className="wbd-card">
        <h3>In attesa del titolare</h3>
        {pending.length === 0 ? <p className="wbd-empty">Nessuna richiesta in attesa.</p> : null}
        {pending.map((r) => (
          <div key={r.id} className="wbd-line">
            <i>{REQUEST_LABEL[r.type]?.slice(0, 4).toUpperCase() ?? "RICH"}</i>
            <span>
              <b>{REQUEST_LABEL[r.type] ?? "Richiesta"}</b>
              <small>{r.startsAt ? shortDate.format(r.startsAt) : ""}</small>
            </span>
            <span className="wbd-tag wbd-tag--violet">In attesa</span>
          </div>
        ))}
      </section>
      <section className="wbd-card">
        <h3>Prossime assenze</h3>
        {upcoming.length === 0 ? <p className="wbd-empty">Nessuna assenza in programma.</p> : null}
        {upcoming.map((r) => (
          <div key={r.id} className="wbd-line">
            <i>{shortDate.format(r.startsAt!).toUpperCase()}</i>
            <span>
              <b>{REQUEST_LABEL[r.type] ?? "Assenza"}</b>
              <small>
                {daysBetween(r.startsAt!, r.endsAt)} {daysBetween(r.startsAt!, r.endsAt) === 1 ? "giorno" : "giorni"}
              </small>
            </span>
            <span className="wbd-tag wbd-tag--ok">Approvata</span>
          </div>
        ))}
      </section>
    </div>
  );
}

export async function NotesAside({ barId, userId, manage }: { barId: string; userId: string; manage: boolean }) {
  const now = new Date();
  const todayKey = toDateInputValueInTimeZone(now);
  const tasks = await prisma.task.findMany({
    where: {
      barId,
      ...(manage ? {} : { OR: [{ assignedToId: userId }, { assignedToAll: true }] }),
      OR: [{ status: { not: TaskStatus.DONE } }, { completedAt: { gte: new Date(now.getTime() - DAY_MS) } }],
    },
    select: {
      status: true,
      isUrgent: true,
      dueDate: true,
      requiresConfirmation: true,
      assignedToAll: true,
      assignedTo: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  const open = tasks.filter((t) => t.status !== TaskStatus.DONE);
  const done = tasks.filter((t) => t.status === TaskStatus.DONE);
  const urgent = open.filter((t) => t.isUrgent);
  const late = open.filter((t) => t.requiresConfirmation && toDateInputValueInTimeZone(t.dueDate) < todayKey);
  const perPerson = new Map<string, { user: { id: string; firstName: string; lastName: string }; count: number }>();
  for (const task of open) {
    if (!task.assignedTo) continue;
    const entry = perPerson.get(task.assignedTo.id) ?? { user: task.assignedTo, count: 0 };
    entry.count += 1;
    perPerson.set(task.assignedTo.id, entry);
  }

  return (
    <div className="wbd" style={{ gap: 14 }}>
      <div className="wbd-figs" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="wbd-fig wbd-fig--hero">
          <span>Da fare</span>
          <b>{open.length}</b>
          <small>{urgent.length ? `${urgent.length} urgenti` : "nessuna urgente"}</small>
        </div>
        <div className="wbd-fig">
          <span>Fatte</span>
          <b>{done.length}</b>
          <small>nelle ultime 24 ore</small>
        </div>
      </div>
      {late.length ? (
        <p className="wbd-note wbd-note--warn">
          {late.length} {late.length === 1 ? "nota è" : "note sono"} in ritardo.
        </p>
      ) : null}
      {manage ? (
        <section className="wbd-card">
          <h3>Da fare, per persona</h3>
          {perPerson.size === 0 ? <p className="wbd-empty">Niente di assegnato.</p> : null}
          {[...perPerson.values()]
            .sort((a, b) => b.count - a.count)
            .map(({ user, count }) => (
              <div key={user.id} className="wbd-line" style={{ gridTemplateColumns: "32px minmax(0, 1fr) auto" }}>
                <Avatar user={user} small />
                <span>
                  <b>
                    {user.firstName} {user.lastName}
                  </b>
                </span>
                <span className="wbd-tag wbd-tag--violet">{count}</span>
              </div>
            ))}
        </section>
      ) : (
        <section className="wbd-card">
          <h3>Come funziona</h3>
          <p className="wbd-empty" style={{ lineHeight: 1.55 }}>
            Spunta una nota quando l&apos;hai fatta: chi l&apos;ha scritta lo vede subito. Le note fatte
            restano visibili un giorno, poi passano in archivio.
          </p>
        </section>
      )}
    </div>
  );
}

export async function DocumentsAside({ barId, userId }: { barId: string; userId: string }) {
  const docs = await prisma.document.findMany({
    where: { barId, isActive: true, OR: [{ assignedToId: userId }, { assignedToAll: true }] },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true, createdAt: true, assignedToAll: true },
  });
  const personal = docs.filter((d) => !d.assignedToAll).length;

  return (
    <div className="wbd" style={{ gap: 14 }}>
      <div className="wbd-figs" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        <div className="wbd-fig wbd-fig--hero">
          <span>I tuoi</span>
          <b>{personal}</b>
          <small>documenti personali</small>
        </div>
        <div className="wbd-fig">
          <span>Del team</span>
          <b>{docs.length - personal}</b>
          <small>per tutti</small>
        </div>
      </div>
      <section className="wbd-card">
        <h3>Ultimi caricati</h3>
        {docs.length === 0 ? <p className="wbd-empty">Ancora nessun documento.</p> : null}
        {docs.map((doc) => (
          <div key={doc.id} className="wbd-line">
            <i>DOC</i>
            <span>
              <b>{doc.title}</b>
              <small>
                {shortDate.format(doc.createdAt)} · {doc.assignedToAll ? "per tutto il team" : "solo tuo"}
              </small>
            </span>
          </div>
        ))}
      </section>
      <section className="wbd-card">
        <h3>Chi li vede</h3>
        <p className="wbd-empty" style={{ lineHeight: 1.55 }}>
          I documenti personali li vedi tu, il titolare e l&apos;amministrazione. I colleghi no.
        </p>
      </section>
    </div>
  );
}

export async function ReportAside({ barId, userId, role }: { barId: string; userId: string; role: Role }) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const team = role === Role.OWNER || role === Role.AMMINISTRAZIONE;
  const members = await prisma.employeeBar.findMany({
    where: { barId, isActive: true, ...(team ? { role: { not: Role.OWNER } } : { userId }) },
    take: 40,
    select: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  const totals = await Promise.all(
    members.map(async (member) => ({
      user: member.user,
      totals: await buildMonthlyTotals(barId, member.user.id, month, year),
    }))
  );
  totals.sort((a, b) => b.totals.roundedHours - a.totals.roundedHours);
  const sum = totals.reduce((acc, t) => acc + t.totals.roundedHours, 0);
  const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(now);

  return (
    <div className="wbd" style={{ gap: 14 }}>
      <div className="wbd-figs" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="wbd-fig wbd-fig--hero">
          <span>
            {team ? "Il team" : "Le tue ore"} · {monthName}
          </span>
          <b>{duration(sum * 3_600_000)}</b>
          <small>ore arrotondate finora</small>
        </div>
      </div>
      {team ? (
        <section className="wbd-card">
          <h3>Ore del mese, per persona</h3>
          {totals.length === 0 ? <p className="wbd-empty">Nessuna persona nel locale.</p> : null}
          {totals.map(({ user, totals: t }) => (
            <div key={user.id} className="wbd-line" style={{ gridTemplateColumns: "32px minmax(0, 1fr) auto" }}>
              <Avatar user={user} small />
              <span>
                <b>
                  {user.firstName} {user.lastName}
                </b>
                <small>reali {duration(t.realHours * 3_600_000)}</small>
              </span>
              <b>{duration(t.roundedHours * 3_600_000)}</b>
            </div>
          ))}
        </section>
      ) : null}
      <section className="wbd-card">
        <h3>Il PDF</h3>
        <p className="wbd-empty" style={{ lineHeight: 1.55 }}>
          Scegli il mese{team ? " e la persona" : ""} a sinistra e scarica il PDF: ore reali e arrotondate, ferie,
          permessi, straordinari, corsi e reperibilità.
        </p>
        <Link className="wbd-r" href="/dashboard/timelogs" style={{ marginLeft: 0 }}>
          Vedi le timbrature →
        </Link>
      </section>
    </div>
  );
}
