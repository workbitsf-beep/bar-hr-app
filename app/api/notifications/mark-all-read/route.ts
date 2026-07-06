import { getSession } from "@/lib/auth";
import { INTERNAL_NOTIFICATION_TYPES } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const persistentTimelogTypes = [
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_BEFORE,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_START,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_BEFORE,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_END,
];

export async function POST() {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      ...(session.activeBarId
        ? {
            barId: session.activeBarId,
          }
        : {
            barId: null,
          }),
      read: false,
      type: {
        notIn: persistentTimelogTypes,
      },
    },
    data: {
      read: true,
    },
  });

  return Response.json({
    ok: true,
    updatedCount: result.count,
  });
}
