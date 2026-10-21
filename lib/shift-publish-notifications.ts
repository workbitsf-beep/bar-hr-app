import "server-only";
import { daysRange } from "@/lib/notification-copy";

import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { getPushTokensForUsers } from "@/lib/push";
import { prisma } from "@/lib/prisma";

type ShiftPublishRecipient = {
  id: string;
  firstName: string;
};

/** "19–25 ott": the week, in the short form of the other notifications. */
function getRangeLabel(rangeStart: Date, rangeEnd: Date) {
  return daysRange(rangeStart, rangeEnd);
}

function collectShiftRecipients(
  shifts: Array<{
    assignments: Array<{
      user: ShiftPublishRecipient;
    }>;
  }>
) {
  const recipients = new Map<string, ShiftPublishRecipient>();

  for (const shift of shifts) {
    for (const assignment of shift.assignments) {
      recipients.set(assignment.user.id, assignment.user);
    }
  }

  return Array.from(recipients.values());
}

export async function notifyPublishedShiftRecipients(input: {
  barId: string;
  rangeStart: Date;
  rangeEnd: Date;
  shiftIds: string[];
}) {
  const shiftIds = Array.from(new Set(input.shiftIds.map((id) => id.trim()).filter(Boolean)));

  if (shiftIds.length === 0) {
    return {
      recipientCount: 0,
      notificationCount: 0,
      pushSentCount: 0,
    };
  }

  const [bar, shifts] = await Promise.all([
    prisma.bar.findUnique({
      where: { id: input.barId },
      select: { name: true },
    }),
    prisma.shift.findMany({
      where: {
        id: {
          in: shiftIds,
        },
        barId: input.barId,
      },
      select: {
        assignments: {
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const recipients = collectShiftRecipients(shifts);

  if (!bar || recipients.length === 0) {
    return {
      recipientCount: recipients.length,
      notificationCount: 0,
      pushSentCount: 0,
    };
  }

  const rangeLabel = getRangeLabel(input.rangeStart, input.rangeEnd);
  const preloadedTokens = await getPushTokensForUsers(recipients.map((recipient) => recipient.id));
  const results = await Promise.all(
    recipients.map((recipient) =>
      notifyUsers(
        [recipient.id],
        {
          barId: input.barId,
          title: "Turni pubblicati",
          message: `Settimana ${rangeLabel}`,
          type: INTERNAL_NOTIFICATION_TYPES.SHIFT_PUBLISHED,
          actionUrl: "/dashboard/calendar",
        },
        { preloadedTokens }
      )
    )
  );

  return {
    recipientCount: recipients.length,
    notificationCount: results.reduce((total, result) => total + result.createdCount, 0),
    pushSentCount: results.reduce((total, result) => total + (result.pushResult?.sentCount ?? 0), 0),
  };
}
