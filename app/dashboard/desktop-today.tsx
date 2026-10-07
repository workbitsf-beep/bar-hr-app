import Link from "next/link";
import { RequestStatus, RequestType, Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildMonthlyTotals } from "@/lib/reporting";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { toDateInputValueInTimeZone, toTimeInputValueInTimeZone } from "@/lib/time-zone";
import { groupSharedTasks } from "@/lib/task-groups";
import { completeTaskAction, reviewRequestAction } from "./actions";

/**
 * "Oggi" on a computer: the venue right now, then the day, then the week, with
 * what needs a decision always on the right. Shown from 1100px up only (the
 * wb-desk-only rules in DashboardAppShellStyles); the phone keeps its home.
 *
 * It reads and shows; anything it changes goes through the actions the rest
 * of the app already uses - reviewRequestAction for requests,
 * completeTaskAction for notes - so the rules stay in one place.
 */

const DAY_MS = 86_400_000;
const LUNCH_BEFORE_HOUR = 16;

function addDaysKey(dayKey: string, days: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function mondayKey(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysKey(dayKey, -((weekday + 6) % 7));
}

const hm = (value: Date) => toTimeInputValueInTimeZone(value);
const hourOf = (value: Date) => Number(hm(value).slice(0, 2));
const initials = (user: { firstName: string; lastName: string }) =>
  `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

function duration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

const PALETTE = ["#6d3df0", "#e0679a", "#2fa8a0", "#f2a93b", "#3a6ff0", "#8b5cff", "#ef6fa4", "#13806f"];
function colorFor(id: string) {
  let sum = 0;
  for (const char of id) sum = (sum + char.charCodeAt(0)) % 997;
  return PALETTE[sum % PALETTE.length];
}

function Avatar({ user, small }: { user: { id: string; firstName: string; lastName: string }; small?: boolean }) {
  return (
    <span className={small ? "wbt-av wbt-av--sm" : "wbt-av"} style={{ background: colorFor(user.id) }} aria-hidden="true">
      {initials(user)}
    </span>
  );
}

const REQUEST_LABEL: Record<string, string> = {
  VACATION: "Ferie",
  PERMISSION: "Permesso",
  OVERTIME: "Straordinario",
  SHIFT_CHANGE: "Cambio turno",
  SICKNESS: "Malattia",
};

export async function DesktopToday({
  barId,
  userId,
  firstName,
  role,
  locale,
}: {
  barId: string;
  userId: string;
  firstName: string;
  role: Role;
  locale: string;
}) {
  const manage = role === Role.OWNER || role === Role.MANAGER;
  const now = new Date();
  const todayKey = toDateInputValueInTimeZone(now);
  const dayStart = parseDateTimeLocal(`${todayKey}T00:00`);
  const dayEnd = parseDateTimeLocal(`${addDaysKey(todayKey, 1)}T00:00`);
  const weekKey = mondayKey(todayKey);
  const weekKeys = Array.from({ length: 7 }, (_, index) => addDaysKey(weekKey, index));
  const weekStart = parseDateTimeLocal(`${weekKey}T00:00`);
  const weekEnd = parseDateTimeLocal(`${addDaysKey(weekKey, 7)}T00:00`);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon = new Date(now.getTime() + 30 * DAY_MS);

  const userSelect = { select: { id: true, firstName: true, lastName: true } } as const;

  const [weekShifts, todayLogs, pending, myRequests, tasks, courses, members, documents, overtime] =
    await Promise.all([
      prisma.shift.findMany({
        where: { barId, startTime: { gte: weekStart, lt: weekEnd } },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          isOnCall: true,
          confirmedAt: true,
          assignments: { select: { user: userSelect } },
        },
      }),
      prisma.timeLog.findMany({
        where: { barId, timestamp: { gte: dayStart, lt: dayEnd } },
        orderBy: { timestamp: "asc" },
        select: { userId: true, type: true, timestamp: true, user: userSelect },
      }),
      manage
        ? prisma.request.findMany({
            where: { barId, status: RequestStatus.PENDING, type: { not: RequestType.SICKNESS } },
            orderBy: { createdAt: "asc" },
            take: 8,
            select: {
              id: true,
              type: true,
              reason: true,
              startsAt: true,
              endsAt: true,
              createdAt: true,
              peerStatus: true,
              employeeId: true,
              employee: userSelect,
            },
          })
        : Promise.resolve([]),
      prisma.request.findMany({
        where: { barId, employeeId: userId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, type: true, status: true, startsAt: true, endsAt: true, createdAt: true },
      }),
      prisma.task.findMany({
        where: {
          barId,
          dueDate: { lt: dayEnd },
          OR: [{ status: { not: TaskStatus.DONE } }, { completedAt: { gte: dayStart } }],
          ...(manage ? {} : { AND: [{ OR: [{ assignedToId: userId }, { assignedToAll: true }] }] }),
        },
        orderBy: [{ status: "asc" }, { isUrgent: "desc" }, { dueDate: "asc" }],
        take: 30,
        select: {
          id: true,
          title: true,
          dueDate: true,
          createdAt: true,
          status: true,
          isUrgent: true,
          requiresConfirmation: true,
          assignedToAll: true,
          assignedTo: { select: { firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true } },
          completedBy: { select: { firstName: true } },
        },
      }),
      prisma.course.findMany({
        where: {
          barId,
          expiresAt: { not: null, lte: soon },
          ...(manage ? {} : { OR: [{ assignedToId: userId }, { assignedToAll: true }] }),
        },
        orderBy: { expiresAt: "asc" },
        take: 6,
        select: { id: true, title: true, expiresAt: true, assignedToAll: true, assignedTo: { select: { firstName: true } } },
      }),
      prisma.employeeBar.findMany({
        where: { barId, isActive: true },
        select: { role: true, hourlyRate: true, user: userSelect },
      }),
      manage
        ? prisma.document.findMany({
            where: { barId, isActive: true, assignedToId: { not: null } },
            select: { assignedToId: true, title: true, createdAt: true },
          })
        : prisma.document.findMany({
            where: {
              barId,
              isActive: true,
              createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) },
              OR: [{ assignedToId: userId }, { assignedToAll: true }],
            },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { assignedToId: true, title: true, createdAt: true },
          }),
      manage
        ? prisma.request.findMany({
            where: {
              barId,
              type: RequestType.OVERTIME,
              status: RequestStatus.APPROVED,
              startsAt: { gte: monthStart },
            },
            select: { startsAt: true, endsAt: true },
          })
        : Promise.resolve([]),
    ]);

  // Who is in now: someone whose last mark today is an entry.
  const lastMark = new Map<string, (typeof todayLogs)[number]>();
  const firstIn = new Map<string, Date>();
  for (const log of todayLogs) {
    lastMark.set(log.userId, log);
    if (log.type === "IN" && !firstIn.has(log.userId)) firstIn.set(log.userId, log.timestamp);
  }
  const insideSince = (id: string) => {
    const last = lastMark.get(id);
    return last && last.type === "IN" ? last.timestamp : null;
  };
  // The owner never clocks in: during their own shift they count as in.
  const ownerIds = new Set(members.filter((m) => m.role === Role.OWNER).map((m) => m.user.id));

  const visible = (shift: (typeof weekShifts)[number]) => manage || Boolean(shift.confirmedAt) || shift.isOnCall;
  const todayShifts = weekShifts.filter(
    (shift) => visible(shift) && !shift.isOnCall && toDateInputValueInTimeZone(shift.startTime) === todayKey
  );

  type Row = { key: string; user: { id: string; firstName: string; lastName: string }; shift: (typeof todayShifts)[number] };
  const rows: Row[] = todayShifts.flatMap((shift) =>
    shift.assignments.map((assignment) => ({ key: `${shift.id}-${assignment.user.id}`, user: assignment.user, shift }))
  );
  const started = rows.filter((row) => row.shift.startTime <= now && row.shift.endTime > now);
  const insideNow = started.filter((row) => ownerIds.has(row.user.id) || insideSince(row.user.id));
  const lateNow = started.filter((row) => !ownerIds.has(row.user.id) && !lastMark.get(row.user.id));
  const ringShare = started.length ? Math.round((insideNow.length / started.length) * 100) : 0;

  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now);
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const coverageOf = (key: string) => {
    const list = weekShifts.filter(
      (shift) => visible(shift) && !shift.isOnCall && toDateInputValueInTimeZone(shift.startTime) === key
    );
    const people = (filter: (shift: (typeof list)[number]) => boolean) =>
      new Set(list.filter(filter).flatMap((shift) => shift.assignments.map((a) => a.user.id))).size;
    return {
      lunch: people((shift) => hourOf(shift.startTime) < LUNCH_BEFORE_HOUR),
      evening: people((shift) => hourOf(shift.startTime) >= LUNCH_BEFORE_HOUR),
      drafts: list.filter((shift) => !shift.confirmedAt).length,
    };
  };

  const plannedMs = weekShifts
    .filter((shift) => visible(shift) && !shift.isOnCall)
    .reduce((sum, shift) => sum + (shift.endTime.getTime() - shift.startTime.getTime()) * shift.assignments.length, 0);
  const rate = new Map(members.map((member) => [member.user.id, Number(member.hourlyRate ?? 0)]));
  const weekCost = weekShifts
    .filter((shift) => !shift.isOnCall)
    .reduce(
      (sum, shift) =>
        sum +
        shift.assignments.reduce(
          (inner, a) => inner + ((shift.endTime.getTime() - shift.startTime.getTime()) / 3_600_000) * (rate.get(a.user.id) ?? 0),
          0
        ),
      0
    );
  const overtimeMs = overtime.reduce(
    (sum, request) => sum + Math.max(0, (request.endsAt?.getTime() ?? 0) - (request.startsAt?.getTime() ?? 0)),
    0
  );
  const draftCount = weekShifts.filter((shift) => !shift.confirmedAt && !shift.isOnCall).length;

  const noteGroups = groupSharedTasks(tasks).slice(0, 6);

  // The day as bars on the hours, 9:00 to 3:00 the next morning.
  const axisStart = parseDateTimeLocal(`${todayKey}T09:00`).getTime();
  const axisSpan = 18 * 3_600_000;
  const pos = (value: Date) => Math.max(0, Math.min(100, ((value.getTime() - axisStart) / axisSpan) * 100));
  const people = [...new Map(rows.map((row) => [row.user.id, row.user])).values()];
  const curve = Array.from({ length: 37 }, (_, index) => {
    const at = axisStart + index * 1_800_000;
    const count = todayShifts
      .filter((shift) => shift.startTime.getTime() <= at && shift.endTime.getTime() > at)
      .reduce((sum, shift) => sum + shift.assignments.length, 0);
    return [(index / 36) * 1000, count] as const;
  });
  const peak = Math.max(1, ...curve.map(([, count]) => count));
  const curvePath = `M${curve.map(([x, count]) => `${x.toFixed(0)} ${(44 - (count / peak) * 38).toFixed(1)}`).join(" L")}`;

  const feed = [
    ...todayLogs.map((log) => ({
      at: log.timestamp,
      user: log.user,
      text: log.type === "IN" ? "è entrato" : "è uscito",
    })),
    ...pending
      .filter((request) => request.createdAt >= dayStart)
      .map((request) => ({ at: request.createdAt, user: request.employee, text: `ha chiesto: ${REQUEST_LABEL[request.type]?.toLowerCase() ?? "una richiesta"}` })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 7);

  const membersWithoutDocs = manage
    ? members.filter(
        (member) => member.role !== Role.OWNER && !documents.some((doc) => doc.assignedToId === member.user.id)
      )
    : [];

  // ---------- the employee's own day ----------
  const mine = weekShifts
    .filter((shift) => (shift.confirmedAt || shift.isOnCall) && shift.assignments.some((a) => a.user.id === userId))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const next = !manage
    ? await prisma.shift.findFirst({
        where: {
          barId,
          endTime: { gt: now },
          confirmedAt: { not: null },
          isOnCall: false,
          assignments: { some: { userId } },
        },
        orderBy: { startTime: "asc" },
        select: { id: true, title: true, startTime: true, endTime: true },
      })
    : null;
  const mates = next
    ? weekShifts
        .filter((shift) => shift.confirmedAt && shift.startTime < next.endTime && shift.endTime > next.startTime)
        .flatMap((shift) => shift.assignments.map((a) => a.user))
        .filter((user, index, all) => user.id !== userId && all.findIndex((u) => u.id === user.id) === index)
    : [];
  const monthTotals = !manage
    ? await buildMonthlyTotals(barId, userId, now.getMonth() + 1, now.getFullYear())
    : null;
  const myMonthPlannedMs = !manage
    ? (
        await prisma.shift.findMany({
          where: {
            barId,
            isOnCall: false,
            confirmedAt: { not: null },
            startTime: { gte: monthStart, lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
            assignments: { some: { userId } },
          },
          select: { startTime: true, endTime: true },
        })
      ).reduce((sum, shift) => sum + shift.endTime.getTime() - shift.startTime.getTime(), 0)
    : 0;

  const requestState = (status: RequestStatus) =>
    status === RequestStatus.PENDING ? (
      <span className="wbt-tag wbt-tag--next">In attesa</span>
    ) : status === RequestStatus.APPROVED ? (
      <span className="wbt-tag wbt-tag--in">Approvata</span>
    ) : (
      <span className="wbt-tag wbt-tag--bad">Rifiutata</span>
    );

  const dateRange = (from: Date | null, to: Date | null) => {
    if (!from) return "";
    if (!to || toDateInputValueInTimeZone(from) === toDateInputValueInTimeZone(to)) return shortDate.format(from);
    return `${shortDate.format(from)} – ${shortDate.format(to)}`;
  };

  const notesCard = (
    <section className="wbt-card">
      <h3>
        {manage ? "Note di oggi" : "Da fare"}
        <Link className="wbt-r" href="/dashboard/tasks">
          Tutte →
        </Link>
      </h3>
      {noteGroups.length === 0 ? <p className="wbt-empty">Niente in sospeso.</p> : null}
      {noteGroups.map((group) => {
        const task = group.lead;
        const done = group.members.every((member) => member.status === TaskStatus.DONE);
        const pendingIds = group.members.filter((m) => m.status !== TaskStatus.DONE).map((m) => m.id).join(",");
        const who = task.assignedToAll
          ? "tutto il team"
          : group.members.map((m) => m.assignedTo?.firstName ?? "").filter(Boolean).join(", ");
        return (
          <div key={group.ids} className={`wbt-todo${done ? " wbt-todo--done" : ""}`}>
            {done || !task.requiresConfirmation ? (
              <span className="wbt-box" aria-hidden="true">{done ? "✓" : ""}</span>
            ) : (
              <form action={completeTaskAction}>
                <input type="hidden" name="taskId" value={pendingIds} />
                <button type="submit" className="wbt-box" aria-label={`Segna fatta: ${task.title}`} />
              </form>
            )}
            <span className="wbt-todo-t">{task.title}</span>
            <small className={task.isUrgent && !done ? "wbt-urgent" : undefined}>
              {done ? `fatta${group.members[0]?.completedBy ? ` da ${group.members[0].completedBy.firstName}` : ""}` : `${task.isUrgent ? "urgente · " : ""}${who}`}
            </small>
          </div>
        );
      })}
    </section>
  );

  const weekCard = (
    <section className="wbt-card">
      <h3>
        {manage ? "La settimana" : "La mia settimana"}
        <Link className="wbt-r" href="/dashboard/calendar">
          Apri Turni →
        </Link>
      </h3>
      <div className="wbt-week">
        {weekKeys.map((key) => {
          const label = weekdayFmt.format(new Date(`${key}T12:00:00Z`)).toUpperCase();
          const dayNum = Number(key.slice(8, 10));
          const today = key === todayKey;
          if (manage) {
            const c = coverageOf(key);
            return (
              <div key={key} className={`wbt-day${today ? " wbt-day--today" : ""}`}>
                <h4>
                  {label} <b>{dayNum}</b>
                </h4>
                <span className="wbt-slot">
                  <span>Giorno</span>
                  <b>{c.lunch}</b>
                </span>
                <span className="wbt-slot">
                  <span>Sera</span>
                  <b>{c.evening}</b>
                </span>
                {c.lunch + c.evening === 0 ? <span className="wbt-alert">Nessuno in turno</span> : null}
                {c.drafts ? <span className="wbt-alert wbt-alert--violet">{c.drafts} in bozza</span> : null}
              </div>
            );
          }
          const own = mine.filter((shift) => toDateInputValueInTimeZone(shift.startTime) === key);
          return (
            <div key={key} className={`wbt-day${today ? " wbt-day--today" : ""}`}>
              <h4>
                {label} <b>{dayNum}</b>
              </h4>
              {own.length === 0 ? <span className="wbt-free">Libero</span> : null}
              {own.map((shift) => (
                <span
                  key={shift.id}
                  className={`wbt-tag ${shift.isOnCall ? "wbt-tag--call" : hourOf(shift.startTime) < LUNCH_BEFORE_HOUR ? "wbt-tag--late" : "wbt-tag--next"}`}
                >
                  {shift.isOnCall ? "Reperibile" : `${hm(shift.startTime)}–${hm(shift.endTime)}`}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="wbt">
      <div className="wbt-hello">
        <div>
          <small>
            {manage ? "Buongiorno" : "Ciao"} {firstName} · {longDate}
          </small>
          {manage ? (
            <h2>
              {started.length === 0 ? (
                <>
                  Adesso non c&apos;è <span>nessun turno.</span>
                </>
              ) : (
                <>
                  In questo momento <br />
                  <span>
                    {insideNow.length} su {started.length}
                  </span>{" "}
                  sono dentro.
                </>
              )}
            </h2>
          ) : (
            <h2>
              {next ? (
                <>
                  Il tuo prossimo turno <br />è{" "}
                  <span>
                    {toDateInputValueInTimeZone(next.startTime) === todayKey
                      ? "oggi"
                      : new Intl.DateTimeFormat(locale, { weekday: "long" }).format(next.startTime)}{" "}
                    alle {hm(next.startTime)}.
                  </span>
                </>
              ) : (
                <>
                  Nessun turno <span>in programma.</span>
                </>
              )}
            </h2>
          )}
        </div>
        <div className="wbt-meta">
          {manage ? (
            <>
              Turni di oggi <b>{todayShifts.length}</b>
              <br />
              {draftCount ? (
                <>
                  Questa settimana <b>{draftCount} in bozza</b>
                </>
              ) : (
                "Settimana pubblicata"
              )}
            </>
          ) : (
            <>
              Questa settimana <b>{mine.length} turni</b>
            </>
          )}
        </div>
      </div>

      <div className="wbt-cols">
        <div className="wbt-col">
          {manage ? (
            <section className="wbt-card">
              <h3>
                <span className="wbt-live" aria-hidden="true" />
                Adesso nel locale
                <Link className="wbt-r" href="/dashboard/timelogs">
                  Timbrature →
                </Link>
              </h3>
              <div className="wbt-now">
                <div
                  className="wbt-ring"
                  style={{
                    background: started.length
                      ? `conic-gradient(#6d3df0 0 ${ringShare}%, #e0b54a ${ringShare}% 100%)`
                      : "#ece6fb",
                  }}
                >
                  <div>
                    <b>
                      {insideNow.length}/{started.length}
                    </b>
                    <span>dentro</span>
                    {lateNow.length ? <em>{lateNow.length} in ritardo</em> : null}
                  </div>
                </div>
                <div className="wbt-people">
                  {rows.length === 0 ? <p className="wbt-empty">Nessun turno oggi.</p> : null}
                  {rows.map((row) => {
                    const since = insideSince(row.user.id);
                    const last = lastMark.get(row.user.id);
                    const isNow = row.shift.startTime <= now && row.shift.endTime > now;
                    const future = row.shift.startTime > now;
                    const span = `${row.shift.title ? `${row.shift.title} ` : ""}${hm(row.shift.startTime)}–${hm(row.shift.endTime)}`;
                    let tag = <span className="wbt-tag wbt-tag--gray">Finito</span>;
                    let sub = span;
                    let progress: number | null = null;
                    if (future) {
                      tag = <span className="wbt-tag wbt-tag--next">Arriva alle {hm(row.shift.startTime)}</span>;
                    } else if (isNow && ownerIds.has(row.user.id)) {
                      tag = <span className="wbt-tag wbt-tag--in">In turno</span>;
                    } else if (isNow && since) {
                      tag = <span className="wbt-tag wbt-tag--in">Dentro · {duration(now.getTime() - since.getTime())}</span>;
                      sub = `${span} · dentro dalle ${hm(since)}`;
                      progress = Math.min(
                        100,
                        Math.round(((now.getTime() - row.shift.startTime.getTime()) / (row.shift.endTime.getTime() - row.shift.startTime.getTime())) * 100)
                      );
                    } else if (isNow && !last) {
                      tag = (
                        <span className="wbt-tag wbt-tag--late">
                          In ritardo ·{" "}
                          {now.getTime() - row.shift.startTime.getTime() < 3_600_000
                            ? `${Math.round((now.getTime() - row.shift.startTime.getTime()) / 60_000)} min`
                            : duration(now.getTime() - row.shift.startTime.getTime())}
                        </span>
                      );
                      sub = `${span} · non ha ancora timbrato`;
                    } else if (isNow) {
                      tag = <span className="wbt-tag wbt-tag--gray">Uscito alle {hm(last!.timestamp)}</span>;
                    }
                    return (
                      <div key={row.key} className="wbt-person">
                        <Avatar user={row.user} />
                        <span>
                          <b>
                            {row.user.firstName} {row.user.lastName}
                          </b>
                          <small>{sub}</small>
                          {progress !== null ? (
                            <span className="wbt-pbar">
                              <i style={{ width: `${progress}%` }} />
                            </span>
                          ) : null}
                        </span>
                        {tag}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ) : (
            <div className="wbt-next">
              <div className="wbt-next-main">
                {next ? (
                  <>
                    <small>
                      Prossimo turno ·{" "}
                      {next.startTime > now ? `fra ${duration(next.startTime.getTime() - now.getTime())}` : "in corso"}
                    </small>
                    <h3>
                      {next.title ? `${next.title} · ` : ""}
                      {hm(next.startTime)} – {hm(next.endTime)}
                    </h3>
                    <p>{new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(next.startTime)}</p>
                    <span className="wbt-mates">
                      {mates.slice(0, 5).map((user) => (
                        <Avatar key={user.id} user={user} small />
                      ))}
                      {mates.length ? `con ${mates.map((user) => user.firstName).join(", ")}` : "da solo"}
                    </span>
                  </>
                ) : (
                  <>
                    <small>Prossimo turno</small>
                    <h3>Ancora da pubblicare</h3>
                    <p>Quando il titolare pubblica la settimana, lo trovi qui.</p>
                  </>
                )}
              </div>
              <div className="wbt-clockcard">
                <b aria-hidden="true">📱</b>
                <small>Le timbrature si fanno dal telefono, quando sei nel locale. Qui vedi le tue ore.</small>
                <Link className="wbt-btn" href="/dashboard/timelogs">
                  Le mie ore
                </Link>
              </div>
            </div>
          )}

          {manage && people.length ? (
            <section className="wbt-card">
              <h3>
                La giornata
                <Link className="wbt-r" href="/dashboard/calendar">
                  Apri in Turni →
                </Link>
              </h3>
              <div className="wbt-tl">
                <span />
                <div className="wbt-axis">
                  {[9, 11, 13, 15, 17, 19, 21, 23, 1, 3].map((h) => (
                    <span key={h}>{h}</span>
                  ))}
                </div>
                <span />
                <div className="wbt-curve">
                  <svg viewBox="0 0 1000 46" preserveAspectRatio="none" aria-hidden="true">
                    <path d={`${curvePath} L1000 46 L0 46 Z`} fill="rgba(139,92,255,.18)" />
                    <path d={curvePath} fill="none" stroke="#6d3df0" strokeWidth="2" />
                  </svg>
                </div>
                {people.map((user) => (
                  <div key={user.id} style={{ display: "contents" }}>
                    <span className="wbt-tl-name">
                      <Avatar user={user} small />
                      {user.firstName}
                    </span>
                    <div className="wbt-tl-row">
                      {todayShifts
                        .filter((shift) => shift.assignments.some((a) => a.user.id === user.id))
                        .map((shift) => {
                          const live =
                            (ownerIds.has(user.id) || insideSince(user.id)) && shift.startTime <= now && shift.endTime > now;
                          return (
                            <span
                              key={shift.id}
                              className={`wbt-bar ${hourOf(shift.startTime) < LUNCH_BEFORE_HOUR ? "wbt-bar--day" : "wbt-bar--eve"}${live ? " wbt-bar--live" : ""}`}
                              style={{ left: `${pos(shift.startTime)}%`, width: `${pos(shift.endTime) - pos(shift.startTime)}%` }}
                            >
                              {hm(shift.startTime)}–{hm(shift.endTime)}
                              {live ? " · dentro" : ""}
                            </span>
                          );
                        })}
                      <span className="wbt-nowline" style={{ left: `${pos(now)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {manage ? (
            <div className="wbt-figs">
              <div className="wbt-fig wbt-fig--hero">
                <span>Ore questa settimana</span>
                <b>{Math.round(plannedMs / 3_600_000)} h</b>
                <small>pianificate</small>
              </div>
              <div className="wbt-fig">
                <span>Straordinari mese</span>
                <b>{duration(overtimeMs)}</b>
                <small>approvati</small>
              </div>
              <div className="wbt-fig">
                <span>Personale</span>
                <b>{members.length}</b>
                <small>nel locale</small>
              </div>
              <div className="wbt-fig">
                <span>Costo personale</span>
                <b>{weekCost > 0 ? `${Math.round(weekCost).toLocaleString("it-IT")} €` : "—"}</b>
                <small>{weekCost > 0 ? "stima della settimana" : "imposta le paghe orarie"}</small>
              </div>
            </div>
          ) : (
            <section className="wbt-card">
              <h3>
                Le mie ore del mese
                <Link className="wbt-r" href="/dashboard/export">
                  Il mio PDF →
                </Link>
              </h3>
              <div className="wbt-hours">
                {(() => {
                  const worked = (monthTotals?.roundedHours ?? 0) * 3_600_000;
                  const share = myMonthPlannedMs ? Math.min(100, Math.round((worked / myMonthPlannedMs) * 100)) : 0;
                  return (
                    <div className="wbt-hring" style={{ background: `conic-gradient(#6d3df0 0 ${share}%, #ece6fb ${share}% 100%)` }}>
                      <div>
                        <b>{Math.round(monthTotals?.roundedHours ?? 0)} h</b>
                        <span>su {Math.round(myMonthPlannedMs / 3_600_000)} in turno</span>
                      </div>
                    </div>
                  );
                })()}
                <div className="wbt-hlist">
                  <div>
                    <span>Ore lavorate</span>
                    <b>{duration((monthTotals?.realHours ?? 0) * 3_600_000)}</b>
                  </div>
                  <div>
                    <span>Ore arrotondate</span>
                    <b>{duration((monthTotals?.roundedHours ?? 0) * 3_600_000)}</b>
                  </div>
                  <div>
                    <span>Turni questa settimana</span>
                    <b>{mine.length}</b>
                  </div>
                </div>
              </div>
            </section>
          )}

          {weekCard}

          {manage ? (
            <section className="wbt-card">
              <h3>Cosa è successo oggi</h3>
              {feed.length === 0 ? <p className="wbt-empty">Ancora niente oggi.</p> : null}
              {feed.map((event, index) => (
                <div key={index} className="wbt-ev">
                  <time>{hm(event.at)}</time>
                  <Avatar user={event.user} small />
                  <span>
                    <b>{event.user.firstName}</b> {event.text}
                  </span>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <div className="wbt-col">
          {manage ? (
            <section className="wbt-card">
              <h3>
                Da decidere <span className="wbt-count">{pending.length}</span>
              </h3>
              {pending.length === 0 ? <p className="wbt-empty">Niente da decidere.</p> : null}
              {pending.map((request) => {
                const waitsForPeer = request.type === RequestType.SHIFT_CHANGE && request.peerStatus !== RequestStatus.APPROVED;
                const own = request.employeeId === userId;
                return (
                  <div key={request.id} className="wbt-req">
                    <b>
                      {request.employee.firstName} {request.employee.lastName[0]}. · {REQUEST_LABEL[request.type] ?? "Richiesta"}
                    </b>
                    <small>
                      {dateRange(request.startsAt, request.endsAt)}
                      {request.reason ? ` · «${request.reason}»` : ""}
                    </small>
                    {waitsForPeer || own ? (
                      <Link className="wbt-r" href="/dashboard/requests">
                        {waitsForPeer ? "Aspetta il collega · apri →" : "Apri →"}
                      </Link>
                    ) : (
                      <span className="wbt-acts">
                        <form action={reviewRequestAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="APPROVED" />
                          <button type="submit" className="wbt-mini wbt-mini--yes">
                            Approva
                          </button>
                        </form>
                        <form action={reviewRequestAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <button type="submit" className="wbt-mini wbt-mini--no">
                            Rifiuta
                          </button>
                        </form>
                      </span>
                    )}
                  </div>
                );
              })}
            </section>
          ) : (
            <section className="wbt-card">
              <h3>
                Le mie richieste
                <Link className="wbt-r" href="/dashboard/requests">
                  + Nuova
                </Link>
              </h3>
              {myRequests.length === 0 ? <p className="wbt-empty">Nessuna richiesta.</p> : null}
              {myRequests.map((request) => (
                <div key={request.id} className="wbt-req">
                  <b>
                    {REQUEST_LABEL[request.type] ?? "Richiesta"} · {dateRange(request.startsAt, request.endsAt)}
                  </b>
                  <span>{requestState(request.status)}</span>
                </div>
              ))}
            </section>
          )}

          {notesCard}

          <section className="wbt-card">
            <h3>{manage ? "Da tenere d'occhio" : "Per te"}</h3>
            {courses.map((course) => {
              const expired = course.expiresAt! < now;
              const days = Math.round((course.expiresAt!.getTime() - now.getTime()) / DAY_MS);
              return (
                <div key={course.id} className="wbt-remind">
                  <i style={{ background: expired ? "#fde8ec" : "#fff3dc" }}>{expired ? "⚠️" : "⏳"}</i>
                  <span>
                    <b>
                      {course.title}
                      {manage ? ` · ${course.assignedToAll ? "tutto il team" : course.assignedTo?.firstName ?? ""}` : ""}
                    </b>
                    <small>{expired ? `scaduto il ${shortDate.format(course.expiresAt!)}` : `scade fra ${days} giorni`}</small>
                  </span>
                </div>
              );
            })}
            {manage && membersWithoutDocs.length ? (
              <div className="wbt-remind">
                <i style={{ background: "#f1ebff" }}>📄</i>
                <span>
                  <b>
                    {membersWithoutDocs.length} {membersWithoutDocs.length === 1 ? "persona" : "persone"} senza documenti
                  </b>
                  <small>{membersWithoutDocs.slice(0, 4).map((m) => m.user.firstName).join(", ")} · Documenti</small>
                </span>
              </div>
            ) : null}
            {manage && draftCount ? (
              <div className="wbt-remind">
                <i style={{ background: "#f1ebff" }}>📝</i>
                <span>
                  <b>{draftCount} turni in bozza</b>
                  <small>Pubblicali da Turni</small>
                </span>
              </div>
            ) : null}
            {!manage
              ? documents.map((doc) => (
                  <div key={doc.title + doc.createdAt.toISOString()} className="wbt-remind">
                    <i style={{ background: "#f1ebff" }}>📄</i>
                    <span>
                      <b>{doc.title}</b>
                      <small>caricato il {shortDate.format(doc.createdAt)} · Documenti</small>
                    </span>
                  </div>
                ))
              : null}
            {courses.length === 0 && (!manage || (!membersWithoutDocs.length && !draftCount)) && (manage || documents.length === 0) ? (
              <p className="wbt-empty">Tutto in regola.</p>
            ) : null}
          </section>
        </div>
      </div>

      <TodayStyles />
    </div>
  );
}

function TodayStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.wbt { display: grid; gap: 16px; color: #15132b; }
.wbt-hello { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.wbt-hello small { font-size: 12.5px; font-weight: 800; letter-spacing: .16em; color: #6d3df0; text-transform: uppercase; }
.wbt-hello h2 { margin: 6px 0 0; font-size: 40px; font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
.wbt-hello h2 span { color: #6d3df0; }
.wbt-meta { text-align: right; font-size: 13.5px; color: #4c4670; line-height: 1.55; }
.wbt-meta b { color: #15132b; }
.wbt-cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 16px; align-items: start; }
@media (max-width: 1279px) { .wbt-cols { grid-template-columns: minmax(0, 1fr) 290px; } }
.wbt-col { display: grid; gap: 16px; align-content: start; min-width: 0; }
.wbt-card { background: rgba(255,255,255,.88); border: 1px solid rgba(255,255,255,.95); border-radius: 24px; box-shadow: 0 16px 40px rgba(80,40,160,.07); padding: 18px; min-width: 0; }
.wbt-card h3 { margin: 0 0 12px; display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #847ea3; }
.wbt-r { margin-left: auto; font-size: 12.5px; font-weight: 750; letter-spacing: 0; text-transform: none; color: #6d3df0; text-decoration: none; }
.wbt-count { margin-left: auto; min-width: 22px; height: 22px; padding: 0 7px; border-radius: 999px; background: #6d3df0; color: #fff; display: grid; place-items: center; font-size: 11.5px; letter-spacing: 0; }
.wbt-live { width: 8px; height: 8px; border-radius: 50%; background: #1f9d63; box-shadow: 0 0 0 4px rgba(31,157,99,.15); }
.wbt-empty { margin: 0; padding: 6px 0; color: #847ea3; font-size: 13.5px; }
.wbt-av { width: 32px; height: 32px; border-radius: 50%; display: inline-grid; place-items: center; color: #fff; font-size: 11.5px; font-weight: 800; flex: 0 0 auto; }
.wbt-av--sm { width: 26px; height: 26px; font-size: 10px; }
.wbt-now { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 22px; align-items: center; }
.wbt-ring { width: 190px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; position: relative; }
.wbt-ring::after { content: ""; position: absolute; inset: 15px; border-radius: 50%; background: #fff; }
.wbt-ring div { position: relative; z-index: 1; text-align: center; }
.wbt-ring b { display: block; font-size: 50px; font-weight: 900; letter-spacing: -0.06em; line-height: .9; }
.wbt-ring span { display: block; margin-top: 6px; font-size: 11.5px; font-weight: 800; letter-spacing: .14em; color: #847ea3; text-transform: uppercase; }
.wbt-ring em { display: block; margin-top: 4px; font-style: normal; font-size: 12.5px; font-weight: 700; color: #b7791f; }
.wbt-people { display: grid; gap: 8px; }
.wbt-person { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 12px; border-radius: 16px; background: #fff; border: 1px solid #efe9fc; }
.wbt-person b { font-size: 14px; } .wbt-person small { display: block; font-size: 12px; color: #847ea3; font-weight: 600; }
.wbt-pbar { display: block; height: 6px; border-radius: 6px; background: #f1ebff; margin-top: 7px; overflow: hidden; }
.wbt-pbar i { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, #6d3df0, #9b5cff); }
.wbt-tag { display: inline-flex; align-items: center; padding: 4px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 800; white-space: nowrap; }
.wbt-tag--in { background: #e2f6ec; color: #1f9d63; } .wbt-tag--late { background: #fff3dc; color: #946010; } .wbt-tag--next { background: #f1ebff; color: #6d3df0; }
.wbt-tag--bad { background: #fde8ec; color: #c2334d; } .wbt-tag--gray { background: #f0eef6; color: #6f6a88; } .wbt-tag--call { background: #e7f8f5; color: #13806f; }
.wbt-tl { display: grid; grid-template-columns: 110px minmax(0, 1fr); row-gap: 8px; }
.wbt-axis { display: flex; justify-content: space-between; font-size: 11px; color: #847ea3; font-weight: 700; padding-bottom: 4px; border-bottom: 1px solid #efe9fc; }
.wbt-curve { height: 46px; position: relative; } .wbt-curve svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.wbt-tl-name { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 750; }
.wbt-tl-row { position: relative; height: 30px; border-radius: 9px; background: repeating-linear-gradient(90deg, transparent 0 calc(100%/18 - 1px), #f4f0fd calc(100%/18 - 1px) calc(100%/18)); }
.wbt-bar { position: absolute; top: 3px; bottom: 3px; border-radius: 8px; display: flex; align-items: center; padding: 0 9px; color: #fff; font-size: 11px; font-weight: 800; white-space: nowrap; overflow: hidden; }
.wbt-bar--day { background: linear-gradient(90deg, #f7b955, #ef8f3b); } .wbt-bar--eve { background: linear-gradient(90deg, #8b5cff, #5b2fd6); }
.wbt-bar--live { box-shadow: 0 0 0 3px rgba(31,157,99,.3); }
.wbt-nowline { position: absolute; top: -4px; bottom: -4px; width: 2px; background: #ef6fa4; border-radius: 2px; }
.wbt-figs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.wbt-fig { padding: 14px 16px; border-radius: 20px; background: #fff; box-shadow: 0 10px 26px rgba(80,40,160,.06); min-width: 0; }
.wbt-fig span { font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #847ea3; }
.wbt-fig b { display: block; margin-top: 6px; font-size: 26px; font-weight: 900; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
.wbt-fig small { display: block; margin-top: 2px; font-size: 12px; color: #4c4670; font-weight: 600; }
.wbt-fig--hero { background: linear-gradient(135deg, #6d3df0, #9b5cff); color: #fff; } .wbt-fig--hero span, .wbt-fig--hero small { color: rgba(255,255,255,.85); }
.wbt-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.wbt-day { padding: 10px; border-radius: 16px; background: #fff; border: 1px solid #efe9fc; display: grid; gap: 6px; align-content: start; min-width: 0; }
.wbt-day h4 { margin: 0; display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; font-weight: 800; color: #4c4670; }
.wbt-day h4 b { font-size: 18px; color: #15132b; }
.wbt-day--today { background: #15132b; border-color: #15132b; } .wbt-day--today h4, .wbt-day--today h4 b { color: #fff; } .wbt-day--today .wbt-slot, .wbt-day--today .wbt-free { color: #cfc9ea; } .wbt-day--today .wbt-slot b { color: #fff; }
.wbt-slot { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #4c4670; }
.wbt-free { font-size: 12px; color: #847ea3; font-weight: 650; }
.wbt-day .wbt-tag { white-space: normal; justify-content: center; text-align: center; line-height: 1.25; padding: 4px 6px; }
.wbt-alert { font-size: 11px; font-weight: 800; color: #c2334d; } .wbt-alert--violet { color: #8b5cff; }
.wbt-ev { display: grid; grid-template-columns: 50px 26px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px 0; border-top: 1px solid #efe9fc; font-size: 13.5px; }
.wbt-ev:first-of-type { border-top: 0; }
.wbt-ev time { font-size: 12px; font-weight: 700; color: #847ea3; font-variant-numeric: tabular-nums; }
.wbt-req { display: grid; gap: 7px; padding: 12px 0; border-top: 1px solid #efe9fc; }
.wbt-req:first-of-type { border-top: 0; padding-top: 0; }
.wbt-req b { font-size: 13.5px; } .wbt-req small { font-size: 12.5px; color: #847ea3; line-height: 1.45; }
.wbt-req .wbt-r { margin-left: 0; }
.wbt-acts { display: flex; gap: 6px; } .wbt-acts form { display: contents; }
.wbt-mini { height: 30px; padding: 0 13px; border-radius: 999px; border: 0; font: inherit; font-size: 12.5px; font-weight: 750; cursor: pointer; }
.wbt-mini--yes { background: #e2f6ec; color: #17784b; } .wbt-mini--no { background: #fde8ec; color: #b42a44; }
.wbt-todo { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid #efe9fc; font-size: 13.5px; font-weight: 650; }
.wbt-todo:first-of-type { border-top: 0; }
.wbt-todo form { display: contents; }
.wbt-box { width: 20px; height: 20px; border-radius: 7px; border: 2px solid #cfc3f3; flex: 0 0 auto; background: #fff; padding: 0; display: grid; place-items: center; color: #fff; font-size: 12px; cursor: pointer; }
.wbt-todo--done { color: #847ea3; } .wbt-todo--done .wbt-todo-t { text-decoration: line-through; } .wbt-todo--done .wbt-box { background: #1f9d63; border-color: #1f9d63; cursor: default; }
.wbt-todo small { margin-left: auto; font-size: 11.5px; color: #847ea3; white-space: nowrap; max-width: 45%; overflow: hidden; text-overflow: ellipsis; }
.wbt-urgent { color: #c2334d !important; font-weight: 800; }
.wbt-remind { display: flex; gap: 10px; align-items: flex-start; padding: 9px 0; border-top: 1px solid #efe9fc; font-size: 13px; }
.wbt-remind:first-of-type { border-top: 0; }
.wbt-remind i { width: 30px; height: 30px; border-radius: 10px; display: grid; place-items: center; font-style: normal; font-size: 14px; flex: 0 0 auto; }
.wbt-remind b { display: block; font-size: 13.5px; } .wbt-remind small { color: #847ea3; }
.wbt-next { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 16px; }
.wbt-next-main { border-radius: 24px; padding: 22px; color: #fff; background: radial-gradient(70% 90% at 90% 0%, rgba(255,255,255,.25), rgba(255,255,255,0) 60%), linear-gradient(135deg, #5b2fd6, #9b5cff); box-shadow: 0 20px 44px rgba(109,61,240,.35); display: grid; gap: 10px; }
.wbt-next-main small { font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; opacity: .85; }
.wbt-next-main h3 { margin: 0; color: #fff; font-size: clamp(26px, 2.6vw, 38px); font-weight: 900; letter-spacing: -0.05em; line-height: 1; }
.wbt-next-main p { margin: 0; font-size: 15px; color: rgba(255,255,255,.9) !important; }
.wbt-mates { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; }
.wbt-mates .wbt-av { border: 2px solid rgba(255,255,255,.7); margin-left: -8px; } .wbt-mates .wbt-av:first-child { margin-left: 0; }
.wbt-clockcard { border-radius: 24px; padding: 18px; background: #fff; display: grid; gap: 10px; align-content: center; justify-items: center; text-align: center; box-shadow: 0 16px 40px rgba(80,40,160,.07); }
.wbt-clockcard b { font-size: 30px; } .wbt-clockcard small { color: #847ea3; font-size: 12.5px; line-height: 1.45; }
.wbt-btn { display: inline-flex; align-items: center; height: 38px; padding: 0 16px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 1px #e3dcf7; color: #15132b; font-weight: 750; font-size: 13.5px; text-decoration: none; }
.wbt-hours { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 18px; align-items: center; }
.wbt-hring { width: 140px; aspect-ratio: 1; border-radius: 50%; display: grid; place-items: center; position: relative; }
.wbt-hring::after { content: ""; position: absolute; inset: 13px; border-radius: 50%; background: #fff; }
.wbt-hring div { position: relative; z-index: 1; text-align: center; }
.wbt-hring b { display: block; font-size: 28px; font-weight: 900; letter-spacing: -0.04em; } .wbt-hring span { font-size: 11px; font-weight: 700; color: #847ea3; }
.wbt-hlist { display: grid; gap: 8px; font-size: 13.5px; }
.wbt-hlist div { display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px solid #efe9fc; }
.wbt-hlist div:last-child { border-bottom: 0; }
@media (max-width: 1279px) {
  .wbt-next { grid-template-columns: minmax(0, 1fr); }
  .wbt-clockcard { display: none; }
  .wbt-hello h2 { font-size: 34px; }
  .wbt-day { padding: 8px; }
  .wbt-day h4 { flex-direction: column; align-items: flex-start; gap: 2px; }
  .wbt-day h4 b { font-size: 16px; }
  .wbt-figs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wbt-now { grid-template-columns: 160px minmax(0, 1fr); }
  .wbt-ring { width: 150px; }
  .wbt-ring b { font-size: 40px; }
}
        `,
      }}
    />
  );
}
