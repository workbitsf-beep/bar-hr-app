import { Role } from "@prisma/client";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { prisma } from "@/lib/prisma";
import { toDateInputValueInTimeZone, toTimeInputValueInTimeZone } from "@/lib/time-zone";

/**
 * The live line under the venue's name in the phone header.
 *
 * Whoever runs the venue reads how many people are working right now; everyone
 * else reads where they stand with their own shift. Owners never clock in:
 * during a shift of theirs they count as working, never as late.
 */
export type VenueStatus = {
  tone: "in" | "next" | "late" | "idle";
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfRomeDay(now: Date) {
  return parseDateTimeLocal(toDateInputValueInTimeZone(now));
}

export async function getVenueStatus({
  barId,
  userId,
  role,
  shiftsEnabled,
}: {
  barId: string;
  userId: string;
  role: Role | string;
  shiftsEnabled: boolean;
}): Promise<VenueStatus> {
  const now = new Date();
  const dayStart = startOfRomeDay(now);
  // Last night's shift may still be running: yesterday's entries count too.
  const since = new Date(dayStart.getTime() - DAY_MS);
  const runsTheVenue = role === Role.OWNER || role === Role.MANAGER || String(role) === "SUPER_ADMIN";

  if (runsTheVenue) {
    const [logs, bar, runningShifts] = await Promise.all([
      prisma.timeLog.findMany({
        where: { barId, timestamp: { gte: since, lte: now } },
        orderBy: { timestamp: "asc" },
        select: { userId: true, type: true },
      }),
      prisma.bar.findUnique({
        where: { id: barId },
        select: {
          ownerId: true,
          memberships: { where: { role: Role.OWNER, isActive: true }, select: { userId: true } },
        },
      }),
      prisma.shift.findMany({
        where: { barId, isOnCall: false, startTime: { lte: now }, endTime: { gt: now } },
        select: { assignedToId: true, assignments: { select: { userId: true } } },
      }),
    ]);

    const last = new Map<string, string>();
    for (const log of logs) last.set(log.userId, log.type);

    const working = new Set([...last].filter(([, type]) => type === "IN").map(([id]) => id));
    const owners = new Set(
      [bar?.ownerId, ...(bar?.memberships.map((entry) => entry.userId) ?? [])].filter(Boolean) as string[]
    );

    for (const shift of runningShifts) {
      for (const id of [shift.assignedToId, ...shift.assignments.map((entry) => entry.userId)]) {
        if (id && owners.has(id)) working.add(id);
      }
    }

    return working.size === 0
      ? { tone: "idle", label: "Nessuno in servizio" }
      : { tone: "in", label: `${working.size} in servizio` };
  }

  const [lastLog, shifts] = await Promise.all([
    prisma.timeLog.findFirst({
      where: { barId, userId, timestamp: { gte: since, lte: now } },
      orderBy: { timestamp: "desc" },
      select: { id: true, type: true, timestamp: true },
    }),
    shiftsEnabled
      ? prisma.shift.findMany({
          where: {
            barId,
            isOnCall: false,
            OR: [{ assignedToId: userId }, { assignments: { some: { userId } } }],
            AND: [
              {
                OR: [
                  { startTime: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) } },
                  { startTime: { lt: dayStart }, endTime: { gt: now } },
                ],
              },
            ],
          },
          orderBy: { startTime: "asc" },
          select: { startTime: true, endTime: true },
        })
      : Promise.resolve([]),
  ]);

  // A forgotten exit or entry waiting for approval counts as what was
  // declared: out after the exit, in from the entry.
  const pendingFixes = await prisma.clockFix.findMany({
    where: { barId, userId, status: "PENDING" },
    select: { kind: true, clockInId: true, requestedInAt: true, requestedOutAt: true },
  });
  const exitDeclared =
    lastLog?.type === "IN" && pendingFixes.some((fix) => fix.kind === "MISSED_OUT" && fix.clockInId === lastLog.id);
  const entryDeclared = pendingFixes.some(
    (fix) =>
      fix.kind === "MISSED_IN" &&
      !fix.requestedOutAt &&
      fix.requestedInAt &&
      !(lastLog && lastLog.timestamp > fix.requestedInAt)
  );

  if ((lastLog?.type === "IN" && !exitDeclared) || entryDeclared) {
    return { tone: "in", label: "Sei in turno" };
  }

  const running = shifts.find((shift) => shift.startTime <= now && shift.endTime > now);

  if (running) {
    return { tone: "late", label: `Turno dalle ${toTimeInputValueInTimeZone(running.startTime)}` };
  }

  const next = shifts.find((shift) => shift.startTime > now);

  if (next) {
    return { tone: "next", label: `Turno alle ${toTimeInputValueInTimeZone(next.startTime)}` };
  }

  return shifts.length > 0
    ? { tone: "idle", label: "Turno finito" }
    : { tone: "idle", label: "Oggi libero" };
}
