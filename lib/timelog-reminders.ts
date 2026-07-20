import { ClockType, Role } from "@prisma/client";
import { invalidateReportingCache } from "@/lib/reporting";
import { INTERNAL_NOTIFICATION_TYPES } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  backfillMissingShiftClockReminders,
  cancelUserShiftClockReminders,
  getClockReminderActionUrl,
  runDueScheduledClockNotifications,
} from "@/lib/shift-clock-reminders";

const AUTO_CLOCK_OUT_DELAY_MS = 2 * 60 * 60 * 1000;
const AUTO_CLOCK_OUT_LOOKBACK_MS = 36 * 60 * 60 * 1000;
const ACTION_URL = "/dashboard?clock=1";

function isDue(now: Date, triggerAt: Date) {
  return now.getTime() >= triggerAt.getTime();
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
            OR: [
              {
                actionUrl: `${ACTION_URL}&shift=${input.shiftId}`,
              },
              {
                actionUrl: getClockReminderActionUrl(input.shiftId, input.barId),
              },
              {
                actionUrl: getClockReminderActionUrl(
                  input.shiftId,
                  input.barId,
                  input.direction === "in" || input.direction === "out" ? input.direction : undefined
                ),
              },
            ],
          }
        : {}),
    },
    data: {
      read: true,
    },
  });

  await cancelUserShiftClockReminders({
    userId: input.userId,
    barId: input.barId,
    shiftId: input.shiftId,
    direction: input.direction,
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
  };
}

function shouldReceiveClockReminder(assignment: {
  user: {
    role: Role;
    barMemberships: Array<{
      barId: string;
      role: Role;
      isActive: boolean;
    }>;
  };
}, barId: string) {
  const membership = assignment.user.barMemberships.find(
    (item) => item.barId === barId && item.isActive
  );

  if (membership) {
    return membership.role !== Role.OWNER;
  }

  return assignment.user.role !== Role.OWNER;
}

async function runAutoClockOut(now: Date) {
  const cutoff = new Date(now.getTime() - AUTO_CLOCK_OUT_DELAY_MS);
  const windowStart = new Date(now.getTime() - AUTO_CLOCK_OUT_DELAY_MS - AUTO_CLOCK_OUT_LOOKBACK_MS);
  const shifts = await prisma.shift.findMany({
    where: {
      confirmedAt: {
        not: null,
      },
      isOnCall: false,
      endTime: {
        gte: windowStart,
        lte: cutoff,
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
      endTime: true,
      assignments: {
        select: {
          userId: true,
          user: {
            select: {
              role: true,
              barMemberships: {
                select: {
                  barId: true,
                  role: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
    },
    take: 500,
  });
  const userIds = Array.from(
    new Set(
      shifts.flatMap((shift) =>
        shift.assignments
          .filter((assignment) => shouldReceiveClockReminder(assignment, shift.barId))
          .map((assignment) => assignment.userId)
      )
    )
  );
  const shiftIds = shifts.map((shift) => shift.id);
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

  let autoClockOutCount = 0;

  for (const shift of shifts) {
    for (const assignment of shift.assignments) {
      if (!shouldReceiveClockReminder(assignment, shift.barId)) {
        continue;
      }

      const state = getShiftClockStateFromLogs(logsByUserAndShift.get(`${assignment.userId}:${shift.id}`) ?? []);

      if (!state.hasClockIn || state.hasClockOut) {
        continue;
      }

      const autoClockOutAt = new Date(shift.endTime.getTime() + AUTO_CLOCK_OUT_DELAY_MS);

      if (!isDue(now, autoClockOutAt)) {
        continue;
      }

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

  return {
    checkedShiftCount: shifts.length,
    autoClockOutCount,
  };
}

export async function runTimeLogReminders(now = new Date()) {
  const backfillResult = await backfillMissingShiftClockReminders(now);
  const [scheduledResult, autoClockOutResult] = await Promise.all([
    runDueScheduledClockNotifications(now),
    runAutoClockOut(now),
  ]);

  return {
    checkedShiftCount: autoClockOutResult.checkedShiftCount,
    createdReminderCount: scheduledResult.sentScheduledNotificationCount,
    autoClockOutCount: autoClockOutResult.autoClockOutCount,
    backfilledReminderShiftCount: backfillResult.checkedShiftCount,
    backfilledReminderCount: backfillResult.scheduledCount,
    checkedScheduledNotificationCount: scheduledResult.checkedScheduledNotificationCount,
    sentScheduledNotificationCount: scheduledResult.sentScheduledNotificationCount,
    skippedScheduledNotificationCount: scheduledResult.skippedScheduledNotificationCount,
  };
}
