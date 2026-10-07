import { INTERNAL_NOTIFICATION_TYPES } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  backfillMissingShiftClockReminders,
  cancelUserShiftClockReminders,
  getClockReminderActionUrl,
  runDueScheduledClockNotifications,
} from "@/lib/shift-clock-reminders";

const ACTION_URL = "/dashboard?clock=1";

function getLegacyClockReminderActionUrl(
  shiftId: string,
  barId: string,
  direction: "in" | "out"
) {
  return `${getClockReminderActionUrl(shiftId, barId)}&clockAction=${direction}`;
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
                actionUrl: getLegacyClockReminderActionUrl(input.shiftId, input.barId, "in"),
              },
              {
                actionUrl: getLegacyClockReminderActionUrl(input.shiftId, input.barId, "out"),
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

export async function runTimeLogReminders(now = new Date()) {
  // No automatic exit any more: a session stays open until the person clocks
  // out, or a manager corrects it.
  const backfillResult = await backfillMissingShiftClockReminders(now);
  const scheduledResult = await runDueScheduledClockNotifications(now);

  return {
    createdReminderCount: scheduledResult.sentScheduledNotificationCount,
    backfilledReminderShiftCount: backfillResult.checkedShiftCount,
    backfilledReminderCount: backfillResult.scheduledCount,
    checkedScheduledNotificationCount: scheduledResult.checkedScheduledNotificationCount,
    sentScheduledNotificationCount: scheduledResult.sentScheduledNotificationCount,
    skippedScheduledNotificationCount: scheduledResult.skippedScheduledNotificationCount,
  };
}

export async function runDueTimeLogReminderNotifications(now = new Date()) {
  const scheduledResult = await runDueScheduledClockNotifications(now);

  return {
    createdReminderCount: scheduledResult.sentScheduledNotificationCount,
    checkedScheduledNotificationCount: scheduledResult.checkedScheduledNotificationCount,
    sentScheduledNotificationCount: scheduledResult.sentScheduledNotificationCount,
    skippedScheduledNotificationCount: scheduledResult.skippedScheduledNotificationCount,
  };
}
