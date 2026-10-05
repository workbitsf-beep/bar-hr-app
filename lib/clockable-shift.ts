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
      isOnCall: false,
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
    },
  });

  return shifts.reduce<(typeof shifts)[number] | null>((closest, shift) => {
    if (!closest) {
      return shift;
    }

    const currentDistance = getShiftDistanceFromTime(shift.startTime, shift.endTime, now);
    const closestDistance = getShiftDistanceFromTime(closest.startTime, closest.endTime, now);

    return currentDistance < closestDistance ? shift : closest;
  }, null);
}
