import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { ClockFixKind, ClockFixStatus, ClockType, RequestStatus, RequestType, TaskStatus } from "@prisma/client";
import { shortName } from "@/lib/clock-notifications";
import { getVenueDepartments } from "@/lib/departments";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { daysRange, requestWhen } from "@/lib/notification-copy";
import { prisma } from "@/lib/prisma";
import { getAccessibleBarsForUser } from "@/lib/permissions";
import { buildMonthlyTotals } from "@/lib/reporting";
import { can, type StaffAccess } from "@/lib/staff-permissions";
import { userScopeWhere, shiftScopeWhere } from "@/lib/staff-scope";
import { toDateInputValueInTimeZone, toTimeInputValueInTimeZone } from "@/lib/time-zone";

/**
 * What the phone's widgets and the Live Activity show (app/api/widgets).
 *
 * Everyone gets their own shifts, the entry they are working on and the
 * month's hours. The owner, and staff with "Timbrature" or "Turni", also get
 * the floor: who is in now, who is on today, and what waits for approval -
 * within the departments or sites they cover.
 *
 * The widgets refresh it by themselves every quarter of an hour with a
 * token handed over when the app opens (widgetToken): it opens this one
 * snapshot, of one person at one venue, and nothing else.
 */

const PAST_MS = 8 * 24 * 60 * 60 * 1000;
const AHEAD_MS = 15 * 24 * 60 * 60 * 1000;
// Past this an entry is a forgotten exit, not someone at work.
const OPEN_ENTRY_MS = 16 * 60 * 60 * 1000;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function secret() {
  return (
    process.env.WIDGET_TOKEN_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    process.env.STRIPE_WEBHOOK_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    "workbit-widgets"
  );
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(`widget:${payload}`).digest("base64url");
}

export function widgetToken(userId: string, barId: string) {
  const payload = `${userId}.${barId}.${Date.now() + TOKEN_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function readWidgetToken(token: string | null) {
  const parts = token?.split(".") ?? [];
  if (parts.length !== 4) return null;
  const [userId, barId, expiresRaw, signature] = parts;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  const expected = Buffer.from(sign(`${userId}.${barId}.${expiresRaw}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return { userId, barId };
}

const REQUEST_ICON: Record<RequestType, string> = {
  VACATION: "🏖️",
  PERMISSION: "🕐",
  SICKNESS: "🤒",
  OVERTIME: "⏱️",
  SHIFT_CHANGE: "🔄",
};

const REQUEST_WORD: Record<RequestType, string> = {
  VACATION: "ferie",
  PERMISSION: "permesso",
  SICKNESS: "malattia",
  OVERTIME: "straordinario",
  SHIFT_CHANGE: "cambio turno",
};

const initialsOf = (user: { firstName: string; lastName: string }) =>
  `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`.toUpperCase();

const HOUR_MS = 60 * 60 * 1000;
const hm = (value: Date) => toTimeInputValueInTimeZone(value);
const range = (start: Date, end: Date) => `${hm(start)}–${hm(end) === "00:00" ? "24:00" : hm(end)}`;

function addDaysKey(dayKey: string, days: number) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function mondayKey(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysKey(dayKey, -((weekday + 6) % 7));
}

/** Today, this week and this month, as the venue's clock (Rome) counts them. */
function calendarOf(now: Date) {
  const todayKey = toDateInputValueInTimeZone(now);
  const weekKey = mondayKey(todayKey);
  const [y, m] = todayKey.split("-").map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return {
    dayStart: parseDateTimeLocal(`${todayKey}T00:00`),
    dayEnd: parseDateTimeLocal(`${addDaysKey(todayKey, 1)}T00:00`),
    weekStart: parseDateTimeLocal(`${weekKey}T00:00`),
    weekEnd: parseDateTimeLocal(`${addDaysKey(weekKey, 7)}T00:00`),
    monthStart: parseDateTimeLocal(`${todayKey.slice(0, 8)}01T00:00`),
    monthEnd: parseDateTimeLocal(`${nextMonth}T00:00`),
  };
}

/** Hours worked from a list of stamps: each entry to the exit after it, an open one up to now. */
function workedMs(logs: Array<{ type: ClockType; timestamp: Date }>, now: Date) {
  let total = 0;
  let inAt: Date | null = null;
  for (const log of [...logs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
    if (log.type === ClockType.IN) inAt = log.timestamp;
    else if (inAt) {
      total += log.timestamp.getTime() - inAt.getTime();
      inAt = null;
    }
  }
  if (inAt && now.getTime() - inAt.getTime() < OPEN_ENTRY_MS) total += now.getTime() - inAt.getTime();
  return total;
}

export async function buildWidgetSnapshot(barId: string, userId: string, now = new Date()) {
  const when = calendarOf(now);
  const [bar, person, accessible, shifts, last, departments, month, monthShifts, tasks] = await Promise.all([
    prisma.bar.findUnique({ where: { id: barId }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    getAccessibleBarsForUser(userId),
    prisma.shift.findMany({
      where: {
        barId,
        isOnCall: false,
        confirmedAt: { not: null },
        startTime: { gte: new Date(now.getTime() - PAST_MS), lt: new Date(now.getTime() + AHEAD_MS) },
        assignments: { some: { userId } },
      },
      orderBy: { startTime: "asc" },
      take: 40,
      select: { startTime: true, endTime: true, department: true },
    }),
    prisma.timeLog.findFirst({
      where: { barId, userId },
      orderBy: { timestamp: "desc" },
      select: { type: true, timestamp: true, shift: { select: { endTime: true, department: true } } },
    }),
    getVenueDepartments(barId, userId),
    buildMonthlyTotals(barId, userId, now.getMonth() + 1, now.getFullYear()),
    prisma.shift.findMany({
      where: {
        barId,
        isOnCall: false,
        confirmedAt: { not: null },
        startTime: { gte: when.monthStart, lt: when.monthEnd },
        assignments: { some: { userId } },
      },
      select: { startTime: true, endTime: true },
    }),
    prisma.task.findMany({
      where: {
        barId,
        dueDate: { gte: when.dayStart, lt: when.dayEnd },
        OR: [{ assignedToId: userId }, { assignedToAll: true }],
      },
      orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
      take: 12,
      select: {
        title: true,
        status: true,
        isUrgent: true,
        assignedToAll: true,
        completions: { where: { userId }, select: { id: true } },
      },
    }),
  ]);

  const names = new Map<string, string>();
  if (departments.enabled) {
    for (const entry of [...departments.list, ...departments.sites]) names.set(entry.id, entry.name);
  }
  const area = (department: string | null | undefined) => (department ? names.get(department) ?? "" : "");

  const open =
    last && last.type === ClockType.IN && now.getTime() - last.timestamp.getTime() < OPEN_ENTRY_MS
      ? {
          since: last.timestamp.getTime(),
          end: last.shift && last.shift.endTime > last.timestamp ? last.shift.endTime.getTime() : null,
          area: area(last.shift?.department),
        }
      : null;

  // Who they are here, worked out exactly as the app does
  // (lib/permissions getActiveBarAccess): the owner, a manager with their
  // permissions, or - with no role of their own here - the account's role,
  // which makes a super admin a boss too.
  const here = accessible.find((entry) => entry.id === barId) ?? null;
  const role = here?.role ?? person?.role ?? null;
  const staff: StaffAccess | null = role
    ? { role: String(role), permissions: here?.permissions ?? [], managesDepartments: here?.managesDepartments ?? [] }
    : null;
  const runsFloor = Boolean(staff && (can(staff, "timelogs") || can(staff, "shifts")));

  // Who they work with on their next shift (or the one they are on).
  const next = shifts.find((shift) => shift.endTime > now) ?? null;
  const mates = next
    ? await prisma.shift.findMany({
        where: {
          barId,
          isOnCall: false,
          confirmedAt: { not: null },
          startTime: { lt: next.endTime },
          endTime: { gt: next.startTime },
        },
        select: { assignments: { select: { user: { select: { id: true, firstName: true, lastName: true } } } } },
      })
    : [];
  const matePeople = new Map<string, { name: string; initials: string }>();
  for (const shift of mates) {
    for (const { user } of shift.assignments) {
      if (user.id !== userId) matePeople.set(user.id, { name: shortName(user), initials: initialsOf(user) });
    }
  }

  const taskItems = tasks.map((task) => ({
    title: task.title,
    done: task.assignedToAll ? task.completions.length > 0 : task.status === TaskStatus.DONE,
    urgent: task.isUrgent,
  }));

  return {
    v: 1,
    venue: bar?.name ?? "",
    role: runsFloor ? "manager" : "staff",
    // "Ore di ottobre: 86 h, già contate": the closed stamps of the month,
    // as the payroll counts them; against the hours on the rota.
    month: new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(now),
    monthHours: Math.round(month.roundedHours * 10) / 10,
    monthPlannedHours:
      Math.round(monthShifts.reduce((sum, shift) => sum + shift.endTime.getTime() - shift.startTime.getTime(), 0) / HOUR_MS * 10) / 10,
    shifts: shifts.map((shift) => ({
      start: shift.startTime.getTime(),
      end: shift.endTime.getTime(),
      area: area(shift.department),
    })),
    open,
    mates: next
      ? { start: next.startTime.getTime(), end: next.endTime.getTime(), people: [...matePeople.values()].slice(0, 6) }
      : null,
    tasks: {
      total: taskItems.length,
      done: taskItems.filter((task) => task.done).length,
      items: [...taskItems.filter((task) => !task.done), ...taskItems.filter((task) => task.done)].slice(0, 5),
    },
    team: runsFloor && staff ? await buildTeamSafely(barId, userId, staff, now, area) : null,
    updatedAt: now.getTime(),
  };
}

/**
 * The floor must never cost a person their own widgets: if it cannot be
 * worked out, the snapshot goes without it.
 */
async function buildTeamSafely(
  barId: string,
  userId: string,
  staff: StaffAccess,
  now: Date,
  area: (department: string | null | undefined) => string
) {
  try {
    return await buildTeam(barId, userId, staff, now, area);
  } catch (error) {
    console.error("[widgets] team not built", { barId, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function buildTeam(
  barId: string,
  userId: string,
  staff: StaffAccess,
  now: Date,
  area: (department: string | null | undefined) => string
) {
  const when = calendarOf(now);
  const inScope = userScopeWhere(staff, barId);
  const userSelect = { select: { id: true, firstName: true, lastName: true } } as const;
  const showsCost = can(staff, "reports");

  const [logs, todayShifts, weekShifts, weekLogs, requests, fixes] = await Promise.all([
    prisma.timeLog.findMany({
      where: { barId, timestamp: { gte: new Date(now.getTime() - OPEN_ENTRY_MS) }, user: inScope },
      orderBy: { timestamp: "desc" },
      select: { userId: true, type: true, timestamp: true, user: userSelect },
    }),
    prisma.shift.findMany({
      where: {
        barId,
        isOnCall: false,
        confirmedAt: { not: null },
        startTime: { lt: when.dayEnd },
        endTime: { gt: when.dayStart },
        ...shiftScopeWhere(staff, barId),
      },
      orderBy: { startTime: "asc" },
      select: { startTime: true, endTime: true, department: true, assignments: { select: { user: userSelect } } },
    }),
    prisma.shift.findMany({
      where: {
        barId,
        isOnCall: false,
        confirmedAt: { not: null },
        startTime: { gte: when.weekStart, lt: when.weekEnd },
        ...shiftScopeWhere(staff, barId),
      },
      select: { startTime: true, endTime: true, assignments: { select: { userId: true } } },
    }),
    prisma.timeLog.findMany({
      where: { barId, timestamp: { gte: when.weekStart, lt: when.weekEnd }, user: inScope },
      select: { userId: true, type: true, timestamp: true },
    }),
    can(staff, "requests")
      ? prisma.request.findMany({
          where: {
            barId,
            status: RequestStatus.PENDING,
            type: { not: RequestType.SICKNESS },
            employee: inScope,
            employeeId: { not: userId },
          },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { type: true, startsAt: true, endsAt: true, employee: userSelect },
        })
      : Promise.resolve([]),
    can(staff, "timelogs")
      ? prisma.clockFix.findMany({
          where: { barId, status: ClockFixStatus.PENDING, user: inScope, userId: { not: userId } },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { kind: true, createdAt: true, user: userSelect },
        })
      : Promise.resolve([]),
  ]);

  // Where everyone stands: their latest stamp of the last hours.
  const latest = new Map<string, (typeof logs)[number]>();
  for (const log of logs) if (!latest.has(log.userId)) latest.set(log.userId, log);
  const isIn = (id: string) => latest.get(id)?.type === ClockType.IN;
  const inService = [...latest.values()]
    .filter((log) => log.type === ClockType.IN && log.userId !== userId)
    .map((log) => ({ name: shortName(log.user), initials: initialsOf(log.user) }));

  // Today's rota, one row a person and shift: in, late, on the way or done.
  type Row = { id: string; name: string; initials: string; start: number; end: number; detail: string; state: string };
  const rows: Row[] = [];
  for (const shift of todayShifts) {
    for (const { user } of shift.assignments) {
      const last = latest.get(user.id);
      const leftAfterStart = last?.type === ClockType.OUT && last.timestamp >= new Date(shift.startTime.getTime() - 2 * HOUR_MS);
      const state = isIn(user.id)
        ? "in"
        : shift.endTime <= now || leftAfterStart
          ? "done"
          : shift.startTime <= now
            ? "late"
            : "next";
      const place = area(shift.department);
      rows.push({
        id: user.id,
        name: shortName(user),
        initials: initialsOf(user),
        start: shift.startTime.getTime(),
        end: shift.endTime.getTime(),
        detail: `Turno ${range(shift.startTime, shift.endTime)}${place ? ` · ${place}` : ""}`,
        state,
      });
    }
  }

  const late = rows
    .filter((row) => row.state === "late" && now.getTime() - row.start >= 2 * 60 * 1000)
    .map((row) => ({ name: row.name, initials: row.initials, detail: row.detail, minutes: Math.floor((now.getTime() - row.start) / 60000) }))
    .sort((a, b) => b.minutes - a.minutes);
  const arriving = rows
    .filter((row) => row.state === "next" && row.start - now.getTime() <= HOUR_MS)
    .map((row) => ({ name: row.name, initials: row.initials, detail: row.detail, minutes: Math.ceil((row.start - now.getTime()) / 60000) }));

  // The day's window: from the first start to the last end, whole hours.
  const dayRows = rows.slice(0, 8);
  const from = dayRows.length ? Math.min(...dayRows.map((row) => row.start)) : when.dayStart.getTime() + 8 * HOUR_MS;
  const to = dayRows.length ? Math.max(...dayRows.map((row) => row.end)) : when.dayStart.getTime() + 24 * HOUR_MS;

  // The week: hours worked against hours on the rota, and what they cost.
  const plannedMs = weekShifts.reduce(
    (sum, shift) => sum + (shift.endTime.getTime() - shift.startTime.getTime()) * shift.assignments.length,
    0
  );
  const byPerson = new Map<string, Array<{ type: ClockType; timestamp: Date }>>();
  for (const log of weekLogs) byPerson.set(log.userId, [...(byPerson.get(log.userId) ?? []), log]);
  const workedByPerson = new Map([...byPerson].map(([id, list]) => [id, workedMs(list, now)]));
  const workedTotal = [...workedByPerson.values()].reduce((sum, ms) => sum + ms, 0);
  let cost: number | null = null;
  let missingRates = 0;
  if (showsCost && workedByPerson.size > 0) {
    const rates = await prisma.employeeBar.findMany({
      where: { barId, userId: { in: [...workedByPerson.keys()] } },
      select: { userId: true, hourlyRate: true },
    });
    const rateOf = new Map(rates.map((rate) => [rate.userId, rate.hourlyRate ? Number(rate.hourlyRate) : null]));
    cost = 0;
    for (const [id, ms] of workedByPerson) {
      const rate = rateOf.get(id);
      if (rate) cost += (ms / HOUR_MS) * rate;
      else if (ms > 0) missingRates += 1;
    }
    cost = Math.round(cost);
  }

  const pending = [
    ...fixes.map((fix) => ({
      icon: "⏱️",
      title: `${shortName(fix.user)} · ${fix.kind === ClockFixKind.MISSED_IN ? "entrata" : "uscita"}`,
      when: daysRange(fix.createdAt, fix.createdAt),
      attention: true,
    })),
    ...requests.map((request) => ({
      icon: REQUEST_ICON[request.type],
      title: `${shortName(request.employee)} · ${REQUEST_WORD[request.type]}`,
      when: requestWhen(request.type, request.startsAt, request.endsAt),
      attention: false,
    })),
  ];

  const onToday = new Set(rows.filter((row) => row.id !== userId && row.end > now.getTime() - HOUR_MS).map((row) => row.id));

  return {
    inService,
    // "4 di 6": everyone in, against those on today (or in, if more).
    expected: Math.max(onToday.size, inService.length),
    pending: pending.slice(0, 4),
    pendingCount: pending.length,
    late: late.slice(0, 5),
    arriving: arriving.slice(0, 3),
    day: {
      from,
      to,
      rows: dayRows.map((row) => ({ name: row.name, start: row.start, end: row.end, state: row.state })),
    },
    week: {
      worked: Math.round((workedTotal / HOUR_MS) * 10) / 10,
      planned: Math.round((plannedMs / HOUR_MS) * 10) / 10,
      cost,
      missingRates,
      label: daysRange(when.weekStart, new Date(when.weekEnd.getTime() - 1)),
    },
  };
}
