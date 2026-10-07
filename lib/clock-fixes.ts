import { ClockFixKind, ClockFixStatus, ClockType } from "@prisma/client";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { prisma } from "@/lib/prisma";
import { toDateInputValueInTimeZone, toTimeInputValueInTimeZone, APP_TIME_ZONE } from "@/lib/time-zone";

/**
 * Forgotten clock-ins and clock-outs.
 *
 * Nobody's hours are stamped on their word alone. The person says when they
 * really came in or left; the owner or a manager approves it, at that time or
 * at one they choose, and only then is the stamp written. Until then a
 * forgotten exit stops blocking the next entry, and a forgotten entry lets the
 * person clock out as usual.
 */

/** The exit can be reported five minutes after the shift's end. */
export const MISSED_OUT_AFTER_MS = 5 * 60 * 1000;
/** An entry without a planned shift is asked about after twelve hours. */
const MISSED_OUT_UNPLANNED_AFTER_MS = 12 * 60 * 60 * 1000;
/** The entry can be reported five minutes into the shift. */
export const MISSED_IN_AFTER_MS = 5 * 60 * 1000;
/** How far back a forgotten entry is still offered. */
const MISSED_IN_LOOKBACK_MS = 36 * 60 * 60 * 1000;

export type ClockFixOffer = {
  kind: ClockFixKind;
  shiftId: string | null;
  clockInId: string | null;
  dayLabel: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  /** The entry already stamped, for a forgotten exit. */
  inAt: string | null;
  /** A forgotten entry on a shift that is over asks for the exit too. */
  needsOut: boolean;
};

export type PendingClockFixView = {
  id: string;
  kind: ClockFixKind;
  requestedInAt: string | null;
  requestedOutAt: string | null;
  inAt: string | null;
};

export type EmployeeClockFixState = {
  offer: ClockFixOffer | null;
  pending: PendingClockFixView | null;
  /** A forgotten exit is waiting for approval: the entry no longer counts as open. */
  openEntryHandedOver: boolean;
  /** A forgotten entry is waiting for approval and the person is still at work. */
  declaredInAt: Date | null;
};

export function formatDayLabel(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE,
  }).format(value);
}

/**
 * "15:45" as a moment: on the day of the reference, the one before or the one
 * after, whichever lands closest to it. A bar's exit at 01:10 belongs to the
 * night after the shift, not to the morning of its start.
 */
export function timeNear(reference: Date, hhmm: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const time = `${String(hours).padStart(2, "0")}:${match[2]}`;
  const day = toDateInputValueInTimeZone(reference);
  const candidates = [-1, 0, 1].map((offset) => {
    const anchor = new Date(`${day}T12:00:00.000Z`);
    anchor.setUTCDate(anchor.getUTCDate() + offset);
    return parseDateTimeLocal(`${anchor.toISOString().slice(0, 10)}T${time}:00`);
  });
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate.getTime() - reference.getTime()) < Math.abs(best.getTime() - reference.getTime())
      ? candidate
      : best
  );
}

export function clockTime(value: Date | string | null | undefined) {
  return value ? toTimeInputValueInTimeZone(value) : null;
}

export async function getEmployeeClockFixState(
  barId: string,
  userId: string,
  now = new Date()
): Promise<EmployeeClockFixState> {
  const [latestLog, pendingFixes] = await Promise.all([
    prisma.timeLog.findFirst({
      where: { barId, userId },
      orderBy: { timestamp: "desc" },
      select: {
        id: true,
        type: true,
        timestamp: true,
        shift: { select: { id: true, startTime: true, endTime: true } },
      },
    }),
    prisma.clockFix.findMany({
      where: { barId, userId, status: ClockFixStatus.PENDING },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, clockInId: true, shiftId: true, requestedInAt: true, requestedOutAt: true },
    }),
  ]);

  const pendingOut =
    latestLog?.type === ClockType.IN
      ? pendingFixes.find((fix) => fix.kind === ClockFixKind.MISSED_OUT && fix.clockInId === latestLog.id) ?? null
      : null;

  // A forgotten entry still being worked: no exit stamped after it yet.
  const pendingInAtWork =
    pendingFixes.find(
      (fix) =>
        fix.kind === ClockFixKind.MISSED_IN &&
        !fix.requestedOutAt &&
        fix.requestedInAt &&
        !(latestLog && latestLog.timestamp > fix.requestedInAt)
    ) ?? null;

  const latestPending = pendingFixes[0] ?? null;
  const pending: PendingClockFixView | null = latestPending
    ? {
        id: latestPending.id,
        kind: latestPending.kind,
        requestedInAt: latestPending.requestedInAt?.toISOString() ?? null,
        requestedOutAt: latestPending.requestedOutAt?.toISOString() ?? null,
        inAt:
          latestPending.kind === ClockFixKind.MISSED_OUT && latestLog?.id === latestPending.clockInId
            ? latestLog.timestamp.toISOString()
            : null,
      }
    : null;

  const state: EmployeeClockFixState = {
    offer: null,
    pending,
    openEntryHandedOver: Boolean(pendingOut),
    declaredInAt: pendingInAtWork?.requestedInAt ?? null,
  };

  // A forgotten exit: the last stamp is an entry, long past its shift.
  if (latestLog?.type === ClockType.IN && !pendingOut) {
    const due = latestLog.shift
      ? latestLog.shift.endTime.getTime() + MISSED_OUT_AFTER_MS
      : latestLog.timestamp.getTime() + MISSED_OUT_UNPLANNED_AFTER_MS;
    if (now.getTime() >= due) {
      // Asked once only: a refused exit is the owner's to sort out by hand.
      const asked = await prisma.clockFix.count({ where: { clockInId: latestLog.id } });
      if (asked === 0) {
        state.offer = {
          kind: ClockFixKind.MISSED_OUT,
          shiftId: latestLog.shift?.id ?? null,
          clockInId: latestLog.id,
          dayLabel: formatDayLabel(latestLog.timestamp),
          shiftStart: latestLog.shift?.startTime.toISOString() ?? null,
          shiftEnd: latestLog.shift?.endTime.toISOString() ?? null,
          inAt: latestLog.timestamp.toISOString(),
          needsOut: true,
        };
      }
    }
    return state;
  }

  // Someone clocked in, or already declared an entry they are working: no
  // forgotten entry to ask about.
  if (latestLog?.type === ClockType.IN || pendingInAtWork) return state;

  const shifts = await prisma.shift.findMany({
    where: {
      barId,
      isOnCall: false,
      startTime: { gte: new Date(now.getTime() - MISSED_IN_LOOKBACK_MS), lte: new Date(now.getTime() - MISSED_IN_AFTER_MS) },
      OR: [{ assignedToId: userId }, { assignments: { some: { userId } } }],
    },
    orderBy: { startTime: "desc" },
    take: 4,
    select: { id: true, startTime: true, endTime: true },
  });

  for (const shift of shifts) {
    const windowStart = new Date(shift.startTime.getTime() - 3 * 60 * 60 * 1000);
    const [entries, exits, fixes] = await Promise.all([
      prisma.timeLog.count({
        where: {
          barId,
          userId,
          type: ClockType.IN,
          OR: [{ shiftId: shift.id }, { timestamp: { gte: windowStart, lte: shift.endTime } }],
        },
      }),
      prisma.timeLog.count({ where: { barId, userId, type: ClockType.OUT, shiftId: shift.id } }),
      prisma.clockFix.count({ where: { shiftId: shift.id, userId } }),
    ]);
    if (entries > 0 || fixes > 0) continue;
    state.offer = {
      kind: ClockFixKind.MISSED_IN,
      shiftId: shift.id,
      clockInId: null,
      dayLabel: formatDayLabel(shift.startTime),
      shiftStart: shift.startTime.toISOString(),
      shiftEnd: shift.endTime.toISOString(),
      inAt: null,
      needsOut: shift.endTime <= now && exits === 0,
    };
    break;
  }

  return state;
}

export type ClockFixForReview = {
  id: string;
  userId: string;
  kind: ClockFixKind;
  name: string;
  initials: string;
  dayLabel: string;
  shiftLabel: string | null;
  inAt: string | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  requestedInAt: string | null;
  requestedOutAt: string | null;
};

/** What waits for the owner's or a manager's approval in a venue. */
export async function getClockFixesForReview(barId: string): Promise<ClockFixForReview[]> {
  const fixes = await prisma.clockFix.findMany({
    where: { barId, status: ClockFixStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: 30,
    select: {
      id: true,
      userId: true,
      kind: true,
      clockInId: true,
      requestedInAt: true,
      requestedOutAt: true,
      user: { select: { firstName: true, lastName: true } },
      shift: { select: { startTime: true, endTime: true } },
    },
  });
  const entryIds = fixes.map((fix) => fix.clockInId).filter((id): id is string => Boolean(id));
  const entries = entryIds.length
    ? await prisma.timeLog.findMany({ where: { id: { in: entryIds } }, select: { id: true, timestamp: true } })
    : [];
  const entryAt = new Map(entries.map((entry) => [entry.id, entry.timestamp]));

  return fixes.map((fix) => {
    const inAt = fix.clockInId ? entryAt.get(fix.clockInId) ?? null : null;
    const day = fix.shift?.startTime ?? inAt ?? fix.requestedInAt ?? new Date();
    return {
      id: fix.id,
      userId: fix.userId,
      kind: fix.kind,
      name: `${fix.user.firstName} ${fix.user.lastName}`.trim(),
      initials: `${fix.user.firstName.charAt(0)}${fix.user.lastName.charAt(0)}`.toUpperCase(),
      dayLabel: formatDayLabel(day),
      shiftLabel: fix.shift ? `${clockTime(fix.shift.startTime)}–${clockTime(fix.shift.endTime)}` : null,
      inAt: inAt?.toISOString() ?? null,
      shiftStart: fix.shift?.startTime.toISOString() ?? null,
      shiftEnd: fix.shift?.endTime.toISOString() ?? null,
      requestedInAt: fix.requestedInAt?.toISOString() ?? null,
      requestedOutAt: fix.requestedOutAt?.toISOString() ?? null,
    };
  });
}
