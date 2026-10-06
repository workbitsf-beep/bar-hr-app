import Link from "next/link";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { ClassicToggle } from "../classic-toggle";
import { Avatar, duration, hm } from "../desk-helpers";
import "../desk.css";

/**
 * Clock-ins on a computer, for the owner: entries and exits paired into
 * sessions, each matched to its shift, in a table that can be narrowed to
 * what needs a look (late, exit missing). The manual entry is the same form
 * the phone uses, handed in as `manualEntry`. Shown from 1100px up.
 */

type Log = {
  id: string;
  type: "IN" | "OUT";
  timestamp: Date;
  isManual: boolean;
  note: string | null;
  user: { id: string; firstName: string; lastName: string };
};

type Session = {
  key: string;
  user: Log["user"];
  in: Log;
  out: Log | null;
  shift: { title: string | null; startTime: Date; endTime: Date } | null;
  status: "inside" | "ok" | "late" | "missing";
  manual: boolean;
};

const LATE_AFTER_MS = 5 * 60_000;
const OPEN_TOO_LONG_MS = 16 * 3_600_000;

export async function DesktopTimeLogs({
  barId,
  logs,
  manualEntry,
  filter,
  personId,
}: {
  barId: string;
  logs: Log[];
  manualEntry: ReactNode;
  filter: string;
  personId: string | null;
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const shifts = await prisma.shift.findMany({
    where: { barId, isOnCall: false, startTime: { gte: new Date(monthStart.getTime() - 86_400_000), lte: now } },
    select: { title: true, startTime: true, endTime: true, assignments: { select: { userId: true } } },
  });

  // Pair entries and exits per person, oldest first.
  const sessions: Session[] = [];
  const ordered = [...logs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const open = new Map<string, Session>();
  for (const log of ordered) {
    if (log.type === "IN") {
      const shift =
        shifts
          .filter(
            (s) =>
              s.assignments.some((a) => a.userId === log.user.id) &&
              s.startTime.getTime() - 2 * 3_600_000 <= log.timestamp.getTime() &&
              s.endTime.getTime() >= log.timestamp.getTime()
          )
          .sort(
            (a, b) =>
              Math.abs(a.startTime.getTime() - log.timestamp.getTime()) -
              Math.abs(b.startTime.getTime() - log.timestamp.getTime())
          )[0] ?? null;
      const session: Session = {
        key: log.id,
        user: log.user,
        in: log,
        out: null,
        shift,
        status: "ok",
        manual: log.isManual,
      };
      sessions.push(session);
      open.set(log.user.id, session);
    } else {
      const session = open.get(log.user.id);
      if (session && !session.out) {
        session.out = log;
        session.manual = session.manual || log.isManual;
        open.delete(log.user.id);
      }
    }
  }
  for (const session of sessions) {
    if (!session.out) {
      session.status = now.getTime() - session.in.timestamp.getTime() > OPEN_TOO_LONG_MS ? "missing" : "inside";
    } else if (session.shift && session.in.timestamp.getTime() > session.shift.startTime.getTime() + LATE_AFTER_MS) {
      session.status = "late";
    }
  }

  const people = [...new Map(sessions.map((s) => [s.user.id, s.user])).values()].sort((a, b) =>
    a.firstName.localeCompare(b.firstName)
  );
  const workedMs = sessions.reduce(
    (sum, s) => sum + (s.out ? s.out.timestamp.getTime() - s.in.timestamp.getTime() : 0),
    0
  );
  const inside = sessions.filter((s) => s.status === "inside");
  const late = sessions.filter((s) => s.status === "late");
  const missing = sessions.filter((s) => s.status === "missing");

  const shown = sessions
    .filter((s) => !personId || s.user.id === personId)
    .filter((s) =>
      filter === "anomalie" ? s.status === "late" || s.status === "missing" : filter === "dentro" ? s.status === "inside" : true
    )
    .sort((a, b) => b.in.timestamp.getTime() - a.in.timestamp.getTime());

  const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Rome" });
  const monthName = new Intl.DateTimeFormat("it-IT", { month: "long" }).format(now);
  const href = (next: { f?: string; p?: string | null }) => {
    const params = new URLSearchParams();
    const f = next.f ?? filter;
    const p = next.p === undefined ? personId : next.p;
    if (f && f !== "tutte") params.set("f", f);
    if (p) params.set("p", p);
    const query = params.toString();
    return `/dashboard/timelogs${query ? `?${query}` : ""}`;
  };

  const statusTag = (s: Session) =>
    s.status === "inside" ? (
      <span className="wbd-tag wbd-tag--ok">Dentro</span>
    ) : s.status === "late" ? (
      <span className="wbd-tag wbd-tag--warn">
        In ritardo · {Math.round((s.in.timestamp.getTime() - s.shift!.startTime.getTime()) / 60_000)} min
      </span>
    ) : s.status === "missing" ? (
      <span className="wbd-tag wbd-tag--bad">Uscita mancante</span>
    ) : (
      <span className="wbd-tag wbd-tag--gray">Regolare</span>
    );

  return (
    <div className="wbd">
      <div className="wbd-top">
        <h1>Timbrature</h1>
        <span className="wbd-spacer" />
        <ClassicToggle />
        <Link className="wbd-btn wbd-btn--ghost" href="/dashboard/export">
          Report del mese
        </Link>
        {manualEntry}
      </div>

      <div className="wbd-figs">
        <div className="wbd-fig wbd-fig--hero">
          <span>Ore di {monthName}</span>
          <b>{duration(workedMs)}</b>
          <small>tutto il team, sessioni chiuse</small>
        </div>
        <div className="wbd-fig">
          <span>Dentro adesso</span>
          <b>{inside.length}</b>
          <small>{inside.map((s) => s.user.firstName).join(", ") || "nessuno"}</small>
        </div>
        <div className="wbd-fig">
          <span>Ritardi</span>
          <b>{late.length}</b>
          <small>oltre 5 minuti dall&apos;inizio del turno</small>
        </div>
        <div className="wbd-fig">
          <span>Uscite mancanti</span>
          <b>{missing.length}</b>
          <small>{missing.length ? "da sistemare a mano" : "tutto chiuso"}</small>
        </div>
      </div>

      <section className="wbd-card wbd-table-card">
        <div className="wbd-table-head">
          {[
            ["tutte", "Tutte"],
            ["anomalie", `Solo anomalie · ${late.length + missing.length}`],
            ["dentro", `Dentro adesso · ${inside.length}`],
          ].map(([key, label]) => (
            <Link key={key} href={href({ f: key })} className={`wbd-chip${(filter || "tutte") === key ? " wbd-chip--on" : ""}`} scroll={false}>
              {label}
            </Link>
          ))}
          <span className="wbd-spacer" />
          <Link href={href({ p: null })} className={`wbd-chip${!personId ? " wbd-chip--on" : ""}`} scroll={false}>
            Tutti
          </Link>
          {people.map((person) => (
            <Link
              key={person.id}
              href={href({ p: person.id })}
              className={`wbd-chip${personId === person.id ? " wbd-chip--on" : ""}`}
              scroll={false}
            >
              {person.firstName}
            </Link>
          ))}
        </div>
        <table className="wbd-table">
          <thead>
            <tr>
              <th>Giorno</th>
              <th>Persona</th>
              <th>Turno</th>
              <th>Entrata</th>
              <th>Uscita</th>
              <th className="num">Ore</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: "#847ea3" }}>
                  Nessuna timbratura con questi filtri.
                </td>
              </tr>
            ) : null}
            {shown.map((s) => (
              <tr key={s.key}>
                <td>{dayFmt.format(s.in.timestamp)}</td>
                <td>
                  <span className="wbd-who">
                    <Avatar user={s.user} small />
                    {s.user.firstName} {s.user.lastName}
                  </span>
                </td>
                <td>
                  {s.shift
                    ? `${s.shift.title ? `${s.shift.title} ` : ""}${hm(s.shift.startTime)}–${hm(s.shift.endTime)}`
                    : "fuori turno"}
                </td>
                <td>
                  {hm(s.in.timestamp)}
                  {s.in.isManual ? <span className="wbd-tag wbd-tag--violet" style={{ marginLeft: 6 }}>manuale</span> : null}
                </td>
                <td>
                  {s.out ? hm(s.out.timestamp) : "—"}
                  {s.out && toDateInputValueInTimeZone(s.out.timestamp) !== toDateInputValueInTimeZone(s.in.timestamp) ? (
                    <small style={{ color: "#847ea3" }}> +1</small>
                  ) : null}
                  {s.out?.isManual ? <span className="wbd-tag wbd-tag--violet" style={{ marginLeft: 6 }}>manuale</span> : null}
                </td>
                <td className="num">
                  {s.out
                    ? duration(s.out.timestamp.getTime() - s.in.timestamp.getTime())
                    : s.status === "inside"
                      ? duration(now.getTime() - s.in.timestamp.getTime())
                      : "—"}
                </td>
                <td>{statusTag(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
