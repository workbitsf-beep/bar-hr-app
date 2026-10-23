import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { ClockFixKind, ClockFixStatus, ClockType, RequestStatus, RequestType } from "@prisma/client";
import { shortName } from "@/lib/clock-notifications";
import { getVenueDepartments } from "@/lib/departments";
import { daysRange, requestWhen } from "@/lib/notification-copy";
import { prisma } from "@/lib/prisma";
import { getAccessibleBarsForUser } from "@/lib/permissions";
import { buildMonthlyTotals } from "@/lib/reporting";
import { can, type StaffAccess } from "@/lib/staff-permissions";
import { userScopeWhere, shiftScopeWhere } from "@/lib/staff-scope";

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

export async function buildWidgetSnapshot(barId: string, userId: string, now = new Date()) {
  const [bar, person, accessible, shifts, last, departments, month] = await Promise.all([
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

  return {
    v: 1,
    venue: bar?.name ?? "",
    role: runsFloor ? "manager" : "staff",
    // "Ore di ottobre: 86 h, già contate": the closed stamps of the month,
    // as the payroll counts them.
    month: new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "Europe/Rome" }).format(now),
    monthHours: Math.round(month.roundedHours * 10) / 10,
    shifts: shifts.map((shift) => ({
      start: shift.startTime.getTime(),
      end: shift.endTime.getTime(),
      area: area(shift.department),
    })),
    open,
    team: runsFloor && staff ? await buildTeamSafely(barId, userId, staff, now) : null,
    updatedAt: now.getTime(),
  };
}

/**
 * The floor must never cost a person their own widgets: if it cannot be
 * worked out, the snapshot goes without it - and, for now, the "Da
 * approvare" widget names what went wrong.
 */
async function buildTeamSafely(barId: string, userId: string, staff: StaffAccess, now: Date) {
  try {
    return await buildTeam(barId, userId, staff, now);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[widgets] team not built", { barId, error: message });
    return {
      inService: [],
      expected: 0,
      pending: [{ icon: "⚠️", title: message.replace(/\s+/g, " ").slice(-120), when: "", attention: true }],
      pendingCount: 1,
    };
  }
}

async function buildTeam(barId: string, userId: string, staff: StaffAccess, now: Date) {
  const inScope = userScopeWhere(staff, barId);
  const dayStart = new Date(now.getTime() - 14 * 60 * 60 * 1000);
  const userSelect = { select: { id: true, firstName: true, lastName: true } } as const;

  const [logs, todayShifts, requests, fixes] = await Promise.all([
    prisma.timeLog.findMany({
      where: { barId, timestamp: { gte: new Date(now.getTime() - OPEN_ENTRY_MS) }, user: inScope },
      orderBy: { timestamp: "desc" },
      select: { userId: true, type: true, user: userSelect },
    }),
    prisma.shift.findMany({
      where: {
        barId,
        isOnCall: false,
        confirmedAt: { not: null },
        startTime: { lt: new Date(now.getTime() + 12 * 60 * 60 * 1000) },
        endTime: { gt: dayStart },
        ...shiftScopeWhere(staff, barId),
      },
      select: { startTime: true, assignments: { select: { userId: true } } },
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

  // Who is in: their latest stamp of the last hours is an entry.
  const latest = new Map<string, (typeof logs)[number]>();
  for (const log of logs) if (!latest.has(log.userId)) latest.set(log.userId, log);
  const inService = [...latest.values()]
    .filter((log) => log.type === ClockType.IN && log.userId !== userId)
    .map((log) => ({ name: shortName(log.user), initials: initialsOf(log.user) }));

  // On today: people on a shift that is running or starts within the day.
  const rosterToday = new Set<string>();
  for (const shift of todayShifts) {
    if (shift.startTime.toDateString() !== now.toDateString() && shift.startTime > now) continue;
    for (const assignment of shift.assignments) if (assignment.userId !== userId) rosterToday.add(assignment.userId);
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

  return {
    inService,
    // "4 di 6": everyone in, against those on today (or in, if more).
    expected: Math.max(rosterToday.size, inService.length),
    pending: pending.slice(0, 4),
    pendingCount: pending.length,
  };
}
