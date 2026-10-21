import { ClockType } from "@prisma/client";
import { clockTime, formatDayLabel, isStaleEntry, reviewersOf, STALE_ENTRY_AFTER_SHIFT_MS } from "@/lib/clock-fixes";
import { shortName } from "@/lib/clock-notifications";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { invalidateReportingCache } from "@/lib/reporting";

/**
 * A forgotten exit stops the hours.
 *
 * An entry left open three hours past its shift (sixteen with no shift) gets
 * a provisional exit at the shift's end, marked autoClockOut. The hours stop
 * there instead of running on - a colleague found someone "in service for
 * 14 hours" - and the next entry is not held back. The person is asked to
 * say when they really left ("Uscita dimenticata" on the Oggi page) and the
 * owner is told; the approved time replaces the provisional one.
 *
 * Without a shift there is no end to assume: the exit goes a minute after
 * the entry, so nothing is counted until the real time is approved.
 *
 * Once only per entry: the provisional exit is itself the mark. Runs with the
 * maintenance job, every five minutes.
 */

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

export async function runForgottenExits(now = new Date()) {
  const entries = await prisma.timeLog.findMany({
    where: {
      type: ClockType.IN,
      timestamp: { gte: new Date(now.getTime() - LOOKBACK_MS), lte: new Date(now.getTime() - STALE_ENTRY_AFTER_SHIFT_MS) },
    },
    orderBy: { timestamp: "desc" },
    take: 500,
    select: {
      id: true,
      userId: true,
      barId: true,
      shiftId: true,
      timestamp: true,
      shift: { select: { endTime: true } },
      user: { select: { firstName: true, lastName: true } },
    },
  });

  let closed = 0;

  for (const entry of entries) {
    if (!isStaleEntry(entry, now)) continue;

    const [later, asked] = await Promise.all([
      prisma.timeLog.count({ where: { userId: entry.userId, barId: entry.barId, timestamp: { gt: entry.timestamp } } }),
      // Already said when they left: the owner has it to approve.
      prisma.clockFix.count({ where: { clockInId: entry.id } }),
    ]);
    if (later > 0 || asked > 0) continue;

    const minuteAfter = new Date(entry.timestamp.getTime() + 60 * 1000);
    const exitAt =
      entry.shift && entry.shift.endTime > entry.timestamp ? entry.shift.endTime : minuteAfter;

    try {
      await prisma.timeLog.create({
        data: {
          type: ClockType.OUT,
          timestamp: exitAt,
          userId: entry.userId,
          barId: entry.barId,
          shiftId: entry.shiftId,
          autoClockOut: true,
          note: "Uscita non timbrata: provvisoria a fine turno",
        },
      });
    } catch (error) {
      console.error("[forgotten-exits] provisional exit not written", {
        entryId: entry.id,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    closed += 1;
    invalidateReportingCache(entry.barId, entry.userId);

    const day = formatDayLabel(entry.timestamp);
    const name = shortName(entry.user);
    const provisional = entry.shift ? `Ore ferme alle ${clockTime(exitAt)}` : "Ore da confermare";

    try {
      await notifyUsers([entry.userId], {
        barId: entry.barId,
        title: "Uscita non timbrata",
        message: `${day} · ${provisional}. Indica l'ora di uscita.`,
        type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_AUTO_CLOCK_OUT,
        actionUrl: "/dashboard",
      });
      await notifyUsers(await reviewersOf(entry.barId, entry.userId), {
        barId: entry.barId,
        title: `${name} non ha timbrato l'uscita`,
        message: `${day} · ${provisional}`,
        type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_AUTO_CLOCK_OUT,
        actionUrl: "/dashboard",
      });
    } catch (error) {
      console.error("[forgotten-exits] notification not sent", {
        entryId: entry.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { checked: entries.length, closed };
}
