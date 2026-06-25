import { ClockType, Role } from "@prisma/client";
import { invalidateReportingCache } from "@/lib/reporting";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const REMINDER_LEAD_MS = 5 * 60 * 1000;
const AUTO_CLOCK_OUT_DELAY_MS = 2 * 60 * 60 * 1000;
const ACTION_URL = "/dashboard?clock=1";

function isDue(now: Date, triggerAt: Date) {
  return now.getTime() >= triggerAt.getTime();
}

async function hasUnreadClockReminder(input: {
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
      read: false,
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
  const exists = await hasUnreadClockReminder(input);

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

async function getShiftClockState(input: {
  userId: string;
  barId: string;
  shiftId: string;
}) {
  const logs = await prisma.timeLog.findMany({
    where: {
      userId: input.userId,
      barId: input.barId,
      shiftId: input.shiftId,
      type: {
        in: [ClockType.IN, ClockType.OUT],
      },
    },
    orderBy: {
      timestamp: "asc",
    },
    select: {
      id: true,
      type: true,
      timestamp: true,
    },
  });

  const lastIn = [...logs].reverse().find((log) => log.type === ClockType.IN) ?? null;
  const outAfterLastIn = lastIn
    ? logs.find((log) => log.type === ClockType.OUT && log.timestamp >= lastIn.timestamp) ?? null
    : null;

  return {
    hasClockIn: Boolean(lastIn),
    hasClockOut: Boolean(outAfterLastIn),
    lastClockIn: lastIn,
  };
}

export async function runTimeLogReminders(now = new Date()) {
  const windowStart = new Date(now.getTime() - AUTO_CLOCK_OUT_DELAY_MS - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + REMINDER_LEAD_MS);

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

  for (const shift of shifts) {
    for (const assignment of shift.assignments) {
      if (assignment.user.role === Role.OWNER) {
        continue;
      }

      const state = await getShiftClockState({
        userId: assignment.userId,
        barId: shift.barId,
        shiftId: shift.id,
      });

      if (!state.hasClockIn) {
        const beforeStart = new Date(shift.startTime.getTime() - REMINDER_LEAD_MS);

        if (isDue(now, beforeStart)) {
          createdReminderCount += await notifyClockReminder({
            userId: assignment.userId,
            barId: shift.barId,
            shiftId: shift.id,
            title: "Ricorda entrata",
            message: "Tra poco inizia il tuo turno. Ricordati di registrare l'entrata.",
            type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_BEFORE,
          });
        }

        if (isDue(now, shift.startTime)) {
          createdReminderCount += await notifyClockReminder({
            userId: assignment.userId,
            barId: shift.barId,
            shiftId: shift.id,
            title: "Entrata da registrare",
            message: "Il tuo turno e iniziato. Registra l'entrata.",
            type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_START,
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

      const beforeEnd = new Date(shift.endTime.getTime() - REMINDER_LEAD_MS);

      if (isDue(now, beforeEnd)) {
        createdReminderCount += await notifyClockReminder({
          userId: assignment.userId,
          barId: shift.barId,
          shiftId: shift.id,
          title: "Ricorda uscita",
          message: "Tra poco finisce il tuo turno. Ricordati di registrare l'uscita.",
          type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_BEFORE,
        });
      }

      if (isDue(now, shift.endTime)) {
        createdReminderCount += await notifyClockReminder({
          userId: assignment.userId,
          barId: shift.barId,
          shiftId: shift.id,
          title: "Uscita da registrare",
          message: "Il tuo turno e terminato. Registra l'uscita.",
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
