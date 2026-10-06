import Link from "next/link";
import { RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { coverRequestShiftsAction, reviewRequestAction } from "../actions";
import { ClassicToggle } from "../classic-toggle";
import { addDaysKey, Avatar, hm, mondayKey, REQUEST_LABEL, REQUEST_TONE } from "../desk-helpers";
import "../desk.css";

/**
 * Requests on a computer, for whoever decides them: the list on the left, the
 * request on the right with what it does to its week and who is free to cover.
 * The decision goes through reviewRequestAction, the cover through
 * coverRequestShiftsAction (draft copies of the shifts). Shown from 1100px up;
 * "Vista classica" brings back the full page with closures and archives.
 */

const LUNCH_BEFORE_HOUR = 16;
const ABSENCE_TYPES = [RequestType.VACATION, RequestType.PERMISSION, RequestType.SICKNESS];

export async function DesktopRequests({
  barId,
  userId,
  selectedId,
  coverResult,
  canSeePrivate,
}: {
  barId: string;
  userId: string;
  selectedId: string | null;
  coverResult: string | null;
  canSeePrivate: boolean;
}) {
  const userSelect = { select: { id: true, firstName: true, lastName: true } } as const;
  const since = new Date(Date.now() - 45 * 86_400_000);

  const [pending, decided] = await Promise.all([
    prisma.request.findMany({
      where: { barId, status: RequestStatus.PENDING },
      orderBy: { createdAt: "asc" },
      take: 40,
      select: {
        id: true, type: true, status: true, reason: true, certificateCode: true, startsAt: true, endsAt: true,
        createdAt: true, peerStatus: true, employeeId: true, employee: userSelect, swapWith: userSelect, reviewedBy: userSelect,
      },
    }),
    prisma.request.findMany({
      where: { barId, status: { not: RequestStatus.PENDING }, updatedAt: { gte: since } },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true, type: true, status: true, reason: true, certificateCode: true, startsAt: true, endsAt: true,
        createdAt: true, peerStatus: true, employeeId: true, employee: userSelect, swapWith: userSelect, reviewedBy: userSelect,
      },
    }),
  ]);

  const all = [...pending, ...decided];
  const selected = all.find((request) => request.id === selectedId) ?? pending[0] ?? decided[0] ?? null;
  const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });
  const weekday = new Intl.DateTimeFormat("it-IT", { weekday: "short", timeZone: "UTC" });

  const range = (from: Date | null, to: Date | null) => {
    if (!from) return "—";
    if (!to || toDateInputValueInTimeZone(from) === toDateInputValueInTimeZone(to)) return shortDate.format(from);
    return `${shortDate.format(from)} – ${shortDate.format(to)}`;
  };

  // ---- what the selected request does to its week ----
  let week: Array<{ key: string; lunch: number; evening: number; hit: boolean; lost: number }> = [];
  let free: Array<{ id: string; firstName: string; lastName: string }> = [];
  let vacationDaysThisYear = 0;
  let affectedShifts = 0;

  if (selected?.startsAt) {
    const fromKey = toDateInputValueInTimeZone(selected.startsAt);
    const toKey = toDateInputValueInTimeZone(selected.endsAt ?? selected.startsAt);
    const weekKey = mondayKey(fromKey);
    const keys = Array.from({ length: 7 }, (_, index) => addDaysKey(weekKey, index));
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    const [shifts, members, absences, vacations] = await Promise.all([
      prisma.shift.findMany({
        where: {
          barId,
          startTime: { gte: parseDateTimeLocal(`${weekKey}T00:00`), lt: parseDateTimeLocal(`${addDaysKey(weekKey, 7)}T00:00`) },
          isOnCall: false,
        },
        select: { startTime: true, endTime: true, assignments: { select: { userId: true } } },
      }),
      prisma.employeeBar.findMany({
        where: { barId, isActive: true, role: { not: Role.OWNER } },
        select: { user: userSelect },
      }),
      prisma.request.findMany({
        where: {
          barId,
          status: RequestStatus.APPROVED,
          type: { in: ABSENCE_TYPES },
          startsAt: { lt: parseDateTimeLocal(`${addDaysKey(toKey, 1)}T00:00`) },
          endsAt: { gte: parseDateTimeLocal(`${fromKey}T00:00`) },
        },
        select: { employeeId: true },
      }),
      prisma.request.findMany({
        where: { barId, employeeId: selected.employeeId, type: RequestType.VACATION, status: RequestStatus.APPROVED, startsAt: { gte: yearStart } },
        select: { startsAt: true, endsAt: true },
      }),
    ]);

    vacationDaysThisYear = vacations.reduce((sum, v) => {
      if (!v.startsAt) return sum;
      const a = toDateInputValueInTimeZone(v.startsAt);
      const b = toDateInputValueInTimeZone(v.endsAt ?? v.startsAt);
      return sum + Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
    }, 0);

    const isAbsence = (ABSENCE_TYPES as RequestType[]).includes(selected.type);
    week = keys.map((key) => {
      const day = shifts.filter((shift) => toDateInputValueInTimeZone(shift.startTime) === key);
      const count = (lunch: boolean) =>
        new Set(
          day
            .filter((shift) => (Number(hm(shift.startTime).slice(0, 2)) < LUNCH_BEFORE_HOUR) === lunch)
            .flatMap((shift) => shift.assignments.map((a) => a.userId))
        ).size;
      const hit = key >= fromKey && key <= toKey;
      const lost = hit && isAbsence ? day.filter((shift) => shift.assignments.some((a) => a.userId === selected.employeeId)).length : 0;
      return { key, lunch: count(true), evening: count(false), hit, lost };
    });
    affectedShifts = week.reduce((sum, day) => sum + day.lost, 0);

    const busy = new Set(
      shifts
        .filter((shift) => {
          const key = toDateInputValueInTimeZone(shift.startTime);
          return key >= fromKey && key <= toKey;
        })
        .flatMap((shift) => shift.assignments.map((a) => a.userId))
    );
    const away = new Set(absences.map((a) => a.employeeId));
    free = members
      .map((member) => member.user)
      .filter((user) => user.id !== selected.employeeId && !busy.has(user.id) && !away.has(user.id));
  }

  const canDecide = (request: (typeof all)[number]) =>
    request.status === RequestStatus.PENDING &&
    request.employeeId !== userId &&
    request.type !== RequestType.SICKNESS &&
    (request.type !== RequestType.SHIFT_CHANGE || request.peerStatus === RequestStatus.APPROVED);

  const item = (request: (typeof all)[number]) => (
    <Link
      key={request.id}
      href={`/dashboard/requests?r=${request.id}`}
      className={`wbd-li${request.id === selected?.id ? " wbd-li--on" : ""}`}
      scroll={false}
    >
      <Avatar user={request.employee} />
      <span>
        <b>
          {request.employee.firstName} {request.employee.lastName[0]}.
        </b>
        <small>
          {range(request.startsAt, request.endsAt)} ·{" "}
          {request.status === RequestStatus.PENDING
            ? request.type === RequestType.SHIFT_CHANGE && request.peerStatus !== RequestStatus.APPROVED
              ? "aspetta il collega"
              : "da decidere"
            : request.status === RequestStatus.APPROVED
              ? "approvata"
              : "rifiutata"}
        </small>
      </span>
      <span className={`wbd-tag ${REQUEST_TONE[request.type] ?? "wbd-tag--gray"}`}>{REQUEST_LABEL[request.type] ?? "Richiesta"}</span>
    </Link>
  );

  const anyLow = week.some((day) => day.hit && day.lost > 0);

  return (
    <div className="wbd">
      <div className="wbd-top">
        <h1>Richieste</h1>
        <span className="wbd-tag wbd-tag--violet">{pending.length} da decidere</span>
        <span className="wbd-spacer" />
        <ClassicToggle label="Vista classica · chiusure e archivio" />
      </div>

      {coverResult !== null ? (
        <p className={`wbd-note ${coverResult === "0" ? "wbd-note--warn" : "wbd-note--ok"}`}>
          {coverResult === "0"
            ? "Nessun turno copiato: la persona scelta non era libera in quegli orari, o i turni erano già passati."
            : `${coverResult} ${coverResult === "1" ? "turno copiato" : "turni copiati"} come bozza. Pubblica la settimana da Turni.`}
        </p>
      ) : null}

      <section className="wbd-card wbd-split">
        <div className="wbd-list">
          <div className="wbd-lh">Da decidere · {pending.length}</div>
          {pending.length === 0 ? <p className="wbd-empty" style={{ padding: "0 16px 10px" }}>Tutto deciso.</p> : pending.map(item)}
          <div className="wbd-lh">Ultime decise</div>
          {decided.length === 0 ? <p className="wbd-empty" style={{ padding: "0 16px 10px" }}>Ancora nessuna.</p> : decided.map(item)}
        </div>

        {selected ? (
          <div className="wbd-detail">
            <div>
              <span className={`wbd-tag ${REQUEST_TONE[selected.type] ?? "wbd-tag--gray"}`}>{REQUEST_LABEL[selected.type] ?? "Richiesta"}</span>
              <h2>
                {selected.employee.firstName} {selected.employee.lastName}
                {selected.type === RequestType.SHIFT_CHANGE && selected.swapWith
                  ? ` ↔ ${selected.swapWith.firstName} ${selected.swapWith.lastName}`
                  : ""}
              </h2>
              {selected.reason && (canSeePrivate || selected.type !== RequestType.SICKNESS) ? (
                <p className="wbd-quote">«{selected.reason}»</p>
              ) : null}
            </div>

            <div className="wbd-boxes">
              <div className="wbd-box">
                <span>Quando</span>
                <b>
                  {range(selected.startsAt, selected.endsAt)}
                  {selected.type === RequestType.PERMISSION || selected.type === RequestType.OVERTIME
                    ? selected.startsAt && selected.endsAt
                      ? ` · ${hm(selected.startsAt)}–${hm(selected.endsAt)}`
                      : ""
                    : ""}
                </b>
              </div>
              <div className="wbd-box">
                <span>Ferie già usate</span>
                <b>{vacationDaysThisYear} {vacationDaysThisYear === 1 ? "giorno" : "giorni"} nel {new Date().getFullYear()}</b>
              </div>
              <div className="wbd-box">
                <span>Turni toccati</span>
                <b>{affectedShifts}</b>
              </div>
            </div>

            {week.length ? (
              <div>
                <p className="wbd-sub">La settimana, persone a giorno e a sera</p>
                <div className="wbd-miniweek">
                  {week.map((day) => (
                    <div key={day.key} className={day.hit ? (day.lost ? "low" : "hit") : ""}>
                      {weekday.format(new Date(`${day.key}T12:00:00Z`)).toUpperCase()} {Number(day.key.slice(8))}
                      <br />
                      {day.hit && day.lost
                        ? `${day.lunch + day.evening - day.lost} persone, senza ${selected.employee.firstName}`
                        : `${day.lunch} · ${day.evening}`}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {anyLow ? (
              <p className="wbd-note wbd-note--warn">
                Se approvi, {selected.employee.firstName} lascia {affectedShifts} {affectedShifts === 1 ? "turno" : "turni"} scoperti.
              </p>
            ) : null}

            {canDecide(selected) ? (
              <div className="wbd-acts">
                <form action={reviewRequestAction}>
                  <input type="hidden" name="requestId" value={selected.id} />
                  <input type="hidden" name="decision" value="APPROVED" />
                  <button type="submit" className="wbd-btn wbd-btn--primary">Approva</button>
                </form>
                <form action={reviewRequestAction}>
                  <input type="hidden" name="requestId" value={selected.id} />
                  <input type="hidden" name="decision" value="REJECTED" />
                  <button type="submit" className="wbd-btn wbd-btn--danger">Rifiuta</button>
                </form>
              </div>
            ) : selected.status === RequestStatus.PENDING ? (
              <p className="wbd-note wbd-note--warn">
                {selected.type === RequestType.SHIFT_CHANGE
                  ? "Aspetta che il collega accetti lo scambio: poi la decidi tu."
                  : "Questa richiesta non la decidi da qui."}
              </p>
            ) : (
              <p className="wbd-note wbd-note--ok">
                {selected.status === RequestStatus.APPROVED ? "Approvata" : "Rifiutata"}
                {selected.reviewedBy ? ` da ${selected.reviewedBy.firstName}` : ""}.
              </p>
            )}

            {affectedShifts > 0 && (ABSENCE_TYPES as RequestType[]).includes(selected.type) ? (
              <div>
                <p className="wbd-sub">Chi è libero per coprire</p>
                {free.length === 0 ? (
                  <p className="wbd-empty">Nessuno è libero in quei giorni.</p>
                ) : (
                  <div className="wbd-free">
                    {free.map((user) => (
                      <form key={user.id} action={coverRequestShiftsAction}>
                        <input type="hidden" name="requestId" value={selected.id} />
                        <input type="hidden" name="coverUserId" value={user.id} />
                        <button type="submit" title={`Copia i turni di ${selected.employee.firstName} a ${user.firstName}, come bozza`}>
                          <Avatar user={user} small />
                          Copri con {user.firstName}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="wbd-detail">
            <p className="wbd-empty">Nessuna richiesta negli ultimi 45 giorni.</p>
          </div>
        )}
      </section>
    </div>
  );
}
