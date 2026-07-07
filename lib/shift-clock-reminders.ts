import "server-only";

import { ClockType, Role } from "@prisma/client";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const CLOCK_IN_REMINDER_LEAD_MS = 5 * 60 * 1000;
const CLOCK_OUT_REMINDER_LEAD_MS = 5 * 60 * 1000;
const ACTION_URL = "/dashboard?clock=1";

const CLOCK_IN_TYPES: string[] = [
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_BEFORE,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_START,
];
const CLOCK_OUT_TYPES: string[] = [
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_BEFORE,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_END,
];
const CLOCK_REMINDER_TYPES = [...CLOCK_IN_TYPES, ...CLOCK_OUT_TYPES];

type ShiftAssignmentForReminder = {
  userId: string;
  user: {
    role: Role;
    barMemberships: Array<{
      barId: string;
      role: Role;
      isActive: boolean;
    }>;
  };
};

type ShiftForReminder = {
  id: string;
  barId: string;
  startTime: Date;
  endTime: Date;
  assignments: ShiftAssignmentForReminder[];
};

function shouldReceiveClockReminder(assignment: ShiftAssignmentForReminder, barId: string) {
  const membership = assignment.user.barMemberships.find(
    (item) => item.barId === barId && item.isActive
  );

  if (membership) {
    return membership.role !== Role.OWNER;
  }

  return assignment.user.role !== Role.OWNER;
}

function getActionUrl(shiftId: string) {
  return `${ACTION_URL}&shift=${shiftId}`;
}

function getClockReminderSchedule(shift: Pick<ShiftForReminder, "startTime" | "endTime">) {
  return [
    {
      type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_BEFORE,
      sendAt: new Date(shift.startTime.getTime() - CLOCK_IN_REMINDER_LEAD_MS),
      title: "Workbit",
      message: "Tra 5 minuti inizia il tuo turno. Ricordati di timbrare.",
    },
    {
      type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_START,
      sendAt: shift.startTime,
      title: "Workbit",
      message: "Ei, sta iniziando il tuo turno. Ricordati di timbrare! Buon lavoro 💕",
    },
    {
      type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_BEFORE,
      sendAt: new Date(shift.endTime.getTime() - CLOCK_OUT_REMINDER_LEAD_MS),
      title: "Workbit",
      message: "Tra 5 minuti finisce il tuo turno. Ricordati di timbrare l'uscita.",
    },
    {
      type: INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_END,
      sendAt: shift.endTime,
      title: "Workbit",
      message: "Ei, il tuo turno è finito. Ricordati di timbrare l'uscita! Ottimo lavoro 💕",
    },
  ];
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

async function getReminderShifts(shiftIds: string[]) {
  const ids = Array.from(new Set(shiftIds.map((shiftId) => shiftId.trim()).filter(Boolean)));

  if (ids.length === 0) {
    return [];
  }

  return prisma.shift.findMany({
    where: {
      id: {
        in: ids,
      },
      confirmedAt: {
        not: null,
      },
      isOnCall: false,
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
  });
}

export async function scheduleShiftClockReminders(shiftIds: string[]) {
  const shifts = await getReminderShifts(shiftIds);
  let scheduledCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const shift of shifts) {
      const actionUrl = getActionUrl(shift.id);
      const schedule = getClockReminderSchedule(shift);

      for (const assignment of shift.assignments) {
        if (!shouldReceiveClockReminder(assignment, shift.barId)) {
          continue;
        }

        for (const item of schedule) {
          await tx.scheduledNotification.upsert({
            where: {
              userId_type_actionUrl: {
                userId: assignment.userId,
                type: item.type,
                actionUrl,
              },
            },
            update: {
              barId: shift.barId,
              shiftId: shift.id,
              title: item.title,
              message: item.message,
              sendAt: item.sendAt,
              sentAt: null,
              canceledAt: null,
            },
            create: {
              userId: assignment.userId,
              barId: shift.barId,
              shiftId: shift.id,
              type: item.type,
              title: item.title,
              message: item.message,
              actionUrl,
              sendAt: item.sendAt,
            },
          });
          scheduledCount += 1;
        }
      }
    }
  });

  return {
    scheduledCount,
  };
}

export async function cancelShiftClockReminders(shiftIds: string[]) {
  const ids = Array.from(new Set(shiftIds.map((shiftId) => shiftId.trim()).filter(Boolean)));

  if (ids.length === 0) {
    return 0;
  }

  const result = await prisma.scheduledNotification.updateMany({
    where: {
      shiftId: {
        in: ids,
      },
      type: {
        in: CLOCK_REMINDER_TYPES,
      },
      sentAt: null,
      canceledAt: null,
    },
    data: {
      canceledAt: new Date(),
    },
  });

  return result.count;
}

export async function cancelUserShiftClockReminders(input: {
  userId: string;
  barId: string;
  shiftId?: string | null;
  direction?: "in" | "out";
}) {
  const result = await prisma.scheduledNotification.updateMany({
    where: {
      userId: input.userId,
      barId: input.barId,
      sentAt: null,
      canceledAt: null,
      type: {
        in:
          input.direction === "in"
            ? CLOCK_IN_TYPES
            : input.direction === "out"
              ? CLOCK_OUT_TYPES
              : CLOCK_REMINDER_TYPES,
      },
      ...(input.shiftId
        ? {
            shiftId: input.shiftId,
          }
        : {}),
    },
    data: {
      canceledAt: new Date(),
    },
  });

  return result.count;
}

export async function runDueScheduledClockNotifications(now = new Date()) {
  const due = await prisma.scheduledNotification.findMany({
    where: {
      sendAt: {
        lte: now,
      },
      sentAt: null,
      canceledAt: null,
      type: {
        in: CLOCK_REMINDER_TYPES,
      },
    },
    orderBy: {
      sendAt: "asc",
    },
    select: {
      id: true,
      userId: true,
      barId: true,
      shiftId: true,
      type: true,
      title: true,
      message: true,
      actionUrl: true,
    },
    take: 200,
  });

  if (due.length === 0) {
    return {
      checkedScheduledNotificationCount: 0,
      sentScheduledNotificationCount: 0,
      skippedScheduledNotificationCount: 0,
    };
  }

  const shiftIds = Array.from(new Set(due.map((item) => item.shiftId).filter((id): id is string => Boolean(id))));
  const userIds = Array.from(new Set(due.map((item) => item.userId)));
  const logs =
    shiftIds.length > 0
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

  let sentScheduledNotificationCount = 0;
  let skippedScheduledNotificationCount = 0;

  for (const item of due) {
    const state = item.shiftId
      ? getShiftClockStateFromLogs(logsByUserAndShift.get(`${item.userId}:${item.shiftId}`) ?? [])
      : { hasClockIn: false, hasClockOut: false };
    const isClockInReminder = CLOCK_IN_TYPES.includes(item.type);
    const shouldSkip =
      (isClockInReminder && state.hasClockIn) ||
      (!isClockInReminder && (!state.hasClockIn || state.hasClockOut));

    if (shouldSkip) {
      await prisma.scheduledNotification.update({
        where: {
          id: item.id,
        },
        data: {
          canceledAt: now,
        },
      });
      skippedScheduledNotificationCount += 1;
      continue;
    }

    await notifyUsers([item.userId], {
      barId: item.barId,
      title: item.title,
      message: item.message,
      type: item.type,
      actionUrl: item.actionUrl,
    });
    await prisma.scheduledNotification.update({
      where: {
        id: item.id,
      },
      data: {
        sentAt: now,
      },
    });
    sentScheduledNotificationCount += 1;
  }

  return {
    checkedScheduledNotificationCount: due.length,
    sentScheduledNotificationCount,
    skippedScheduledNotificationCount,
  };
}
