import { parseDateTimeLocal } from "@/lib/date-time-local";
import { prisma } from "@/lib/prisma";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";

function getShiftDistanceFromTime(startTime: Date, endTime: Date, now: Date) {
  if (now < startTime) {
    return startTime.getTime() - now.getTime();
  }

  if (now > endTime) {
    return now.getTime() - endTime.getTime();
  }

  return 0;
}

export async function findAssignedShiftForClockIn({
  barId,
  userId,
  now = new Date(),
}: {
  barId: string;
  userId: string;
  now?: Date;
}) {
  const dayKey = toDateInputValueInTimeZone(now);
  const dayStart = parseDateTimeLocal(`${dayKey}T00:00:00`);
  const dayEnd = parseDateTimeLocal(`${dayKey}T23:59:59.999`);
  const shifts = await prisma.shift.findMany({
    where: {
      barId,
      // On-call shifts are clockable too: being called in is exactly when
      // someone on call works, and the stamp is what puts it on the report.
      AND: [
        {
          // Today's shifts, and last night's that is still running: someone
          // arriving at ten past midnight for an 18:00-02:00 shift found no
          // shift "today" and could not clock in at all.
          OR: [
            { startTime: { gte: dayStart, lte: dayEnd } },
            { startTime: { lt: dayStart }, endTime: { gt: now } },
          ],
        },
        {
          OR: [
            { assignedToId: userId },
            {
              assignments: {
                some: {
                  userId,
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      startTime: "asc",
    },
    take: 24,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      isOnCall: true,
    },
  });

  return shifts.reduce<(typeof shifts)[number] | null>((closest, shift) => {
    if (!closest) {
      return shift;
    }

    const currentDistance = getShiftDistanceFromTime(shift.startTime, shift.endTime, now);
    const closestDistance = getShiftDistanceFromTime(closest.startTime, closest.endTime, now);

    if (currentDistance !== closestDistance) {
      return currentDistance < closestDistance ? shift : closest;
    }

    // Equally close: the planned shift wins over being on call.
    return closest.isOnCall && !shift.isOnCall ? shift : closest;
  }, null);
}
