import { ClockType, Role } from "@prisma/client";
import { invalidateReportingCache } from "@/lib/reporting";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const CLOCK_IN_REMINDER_LEAD_MS = 60 * 1000;
const CLOCK_OUT_REMINDER_DELAY_MS = 60 * 1000;
const AUTO_CLOCK_OUT_DELAY_MS = 2 * 60 * 60 * 1000;
const REMINDER_GRACE_MS = 10 * 60 * 1000;
const ACTION_URL = "/dashboard?clock=1";

function isDue(now: Date, triggerAt: Date) {
  return now.getTime() >= triggerAt.getTime();
}

function isWithinReminderWindow(now: Date, triggerAt: Date) {
  const nowTime = now.getTime();
  const triggerTime = triggerAt.getTime();

  return nowTime >= triggerTime && nowTime <= triggerTime + REMINDER_GRACE_MS;
}

async function hasClockReminder(input: {
  userId: string;
  barId: string;
  type: string;
  shiftId: string;
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      userId: input.userId,
      barId: input.barId,
      type: input.type,
      actionUrl: `${ACTION_URL}&shift=${input.shiftId}`,
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

async function notifyClockReminder(input: {
  userId: string;
  barId: string;
  shiftId: string;
  title: string;
  message: string;
  type: string;
}) {
  const exists = await hasClockReminder(input);

  if (exists) {
    return 0;
  }

  const result = await notifyUsers([input.userId], {
    barId: input.barId,
    title: input.title,
    message: input.message,
    type: input.type,
    actionUrl: `${ACTION_URL}&shift=${input.shiftId}`,
  });

  return result.createdCount;
}

async function markClockRemindersRead(input: {
  userId: string;
  barId: string;
  shiftId?: string;
  direction?: "in" | "out";
}) {
  const inTypes = [
    INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_BEFORE,
    INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_START,
  ];
  const outTypes = [
    INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_BEFORE,
    INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_END,
  ];

  const result = await prisma.notification.updateMany({
    where: {
      userId: input.userId,
      barId: input.barId,
      read: false,
      type: {
        in:
          input.direction === "in"
            ? inTypes
            : input.direction === "out"
              ? outTypes
              : [...inTypes, ...outTypes],
      },
      ...(input.shiftId
        ? {
            actionUrl: `${ACTION_URL}&shift=${input.shiftId}`,
          }
        : {}),
    },
    data: {
      read: true,
    },
  });

  return result.count;
}

export async function closeClockInReminders(input: {
  userId: string;
  barId: string;
  shiftId?: string | null;
}) {
  return markClockRemindersRead({
    userId: input.userId,
    barId: input.barId,
    shiftId: input.shiftId ?? undefined,
    direction: "in",
  });
}

export async function closeClockOutReminders(input: {
  userId: string;
  barId: string;
  shiftId?: string | null;
}) {
  return markClockRemindersRead({
    userId: input.userId,
    barId: input.barId,
    shiftId: input.shiftId ?? undefined,
    direction: "out",
  });
}

function getShiftClockStateFromLogs(
  logs: Array<{
    type: ClockType;
    timestamp: Date;
  }>
) {
  const orderedLogs = logs.slice().sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
  const lastIn = [...orderedLogs].reverse().find((log) => log.type === ClockType.IN) ?? null;
  const outAfterLastIn = lastIn
    ? orderedLogs.find((log) => log.type === ClockType.OUT && log.timestamp >= lastIn.timestamp) ?? null
    : null;

  return {
    hasClockIn: Boolean(lastIn),
    hasClockOut: Boolean(outAfterLastIn),
    lastClockIn: lastIn,
  };
}

export async function runTimeLogReminders(now = new Date()) {
  const windowStart = new Date(now.getTime() - AUTO_CLOCK_OUT_DELAY_MS - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + CLOCK_IN_REMINDER_LEAD_MS);

  const shifts = await prisma.shift.findMany({
    where: {
      confirmedAt: {
        not: null,
      },
      isOnCall: false,
      endTime: {
        gte: windowStart,
      },
      startTime: {
        lte: windowEnd,
      },
      bar: {
        settings: {
          timeTrackingEnabled: true,
        },
      },
    },
    select: {
      id: true,
      barId: true,
      startTime: true,
      endTime: true,
      assignments: {
        select: {
          userId: true,
          user: {
            select: {
              role: true,
            },
          },
        },
      },
    },
    take: 500,
  });

  let createdReminderCount = 0;
  let autoClockOutCount = 0;
  const shiftIds = shifts.map((shift) => shift.id);
  const userIds = Array.from(
    new Set(
      shifts.flatMap((shift) =>
        shift.assignments
          .filter((assignment) => assignment.user.role !== Role.OWNER)
          .map((assignment) => assignment.userId)
      )
    )
  );
  const logs =
    shiftIds.length > 0 && userIds.length > 0
      ? await prisma.timeLog.findMany({
          where: {
            shiftId: {
              in: shiftIds,
            },
            userId: {
              in: userIds,
            },
            type: {
              in: [ClockType.IN, ClockType.OUT],
            },
          },
          orderBy: {
            timestamp: "asc",
          },
          select: {
            type: true,
            timestamp: true,
            userId: true,
            shiftId: true,
          },
        })
      : [];
  const logsByUserAndShift = new Map<string, typeof logs>();

  for (const log of logs) {
    if (!log.shiftId) {
      continue;
    }

    const key = `${log.userId}:${log.shiftId}`;
    const current = logsByUserAndShift.get(key) ?? [];
    current.push(log);
    logsByUserAndShift.set(key, current);
  }

  for (const shift of shifts) {
    for (const assignment of shift.assignments) {
      if (assignment.user.role === Role.OWNER) {
        continue;
      }

      const state = getShiftClockStateFromLogs(logsByUserAndShift.get(`${assignment.userId}:${shift.id}`) ?? []);

      if (!state.hasClockIn) {
        const beforeStart = new Date(shift.startTime.getTime() - CLOCK_IN_REMINDER_LEAD_MS);

        if (isWithinReminderWindow(now, beforeStart)) {
          const hasStarted = now.getTime() >= shift.startTime.getTime();
          createdReminderCount += await notifyClockReminder({
            userId: assignment.userId,
            barId: shift.barId,
            shiftId: shift.id,
            title: "Ricorda entrata",
            message: hasStarted
              ? "Il tuo turno è iniziato. Ricordati di registrare l'entrata."
              : "Tra un minuto inizia il tuo turno. Ricordati di registrare l'entrata.",
            type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_BEFORE,
          });
        }

        continue;
      }

      await closeClockInReminders({
        userId: assignment.userId,
        barId: shift.barId,
        shiftId: shift.id,
      });

      if (state.hasClockOut) {
        await closeClockOutReminders({
          userId: assignment.userId,
          barId: shift.barId,
          shiftId: shift.id,
        });
        continue;
      }

      const afterEnd = new Date(shift.endTime.getTime() + CLOCK_OUT_REMINDER_DELAY_MS);

      if (isWithinReminderWindow(now, afterEnd)) {
        createdReminderCount += await notifyClockReminder({
          userId: assignment.userId,
          barId: shift.barId,
          shiftId: shift.id,
          title: "Uscita da registrare",
          message: "Il tuo turno e terminato da un minuto. Ricordati di registrare l'uscita.",
          type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_END,
        });
      }

      const autoClockOutAt = new Date(shift.endTime.getTime() + AUTO_CLOCK_OUT_DELAY_MS);

      if (isDue(now, autoClockOutAt)) {
        await prisma.timeLog.create({
          data: {
            type: ClockType.OUT,
            userId: assignment.userId,
            barId: shift.barId,
            shiftId: shift.id,
            timestamp: shift.endTime,
            isManual: false,
            autoClockOut: true,
            note: "Uscita automatica registrata all'orario previsto di fine turno.",
          },
        });

        await closeClockOutReminders({
          userId: assignment.userId,
          barId: shift.barId,
          shiftId: shift.id,
        });

        invalidateReportingCache(shift.barId, assignment.userId);
        autoClockOutCount += 1;
      }
    }
  }

  return {
    checkedShiftCount: shifts.length,
    createdReminderCount,
    autoClockOutCount,
  };
}
