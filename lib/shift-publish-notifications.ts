import "server-only";

import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

type ShiftPublishRecipient = {
  id: string;
  firstName: string;
};

function getRangeLabel(rangeStart: Date, rangeEnd: Date) {
  if (
    rangeStart.getMonth() === rangeEnd.getMonth() &&
    rangeStart.getFullYear() === rangeEnd.getFullYear()
  ) {
    return new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
    }).format(rangeStart);
  }

  const formatter = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
  });

  return `${formatter.format(rangeStart)} - ${formatter.format(rangeEnd)}`;
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
  const results = await Promise.all(
    recipients.map((recipient) =>
      notifyUsers([recipient.id], {
        barId: input.barId,
        title: "Turni pubblicati",
        message: `Ciao ${recipient.firstName},\nSono stati pubblicati o aggiornati i tuoi turni della settimana ${rangeLabel} per ${bar.name}.`,
        type: INTERNAL_NOTIFICATION_TYPES.SHIFT_PUBLISHED,
        actionUrl: "/dashboard/calendar",
      })
    )
  );

  return {
    recipientCount: recipients.length,
    notificationCount: results.reduce((total, result) => total + result.createdCount, 0),
    pushSentCount: results.reduce((total, result) => total + (result.pushResult?.sentCount ?? 0), 0),
  };
}
