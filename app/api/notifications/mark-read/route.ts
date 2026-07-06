import { getSession } from "@/lib/auth";
import { INTERNAL_NOTIFICATION_TYPES } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const persistentTimelogTypes = [
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_BEFORE,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_IN_REMINDER_START,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_BEFORE,
  INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCK_OUT_REMINDER_END,
];

export async function POST(req: Request) {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    notificationId?: string;
  } | null;
  const notificationId = String(body?.notificationId ?? "").trim();

  if (!notificationId) {
    return Response.json({ ok: false, message: "Missing notification id" }, { status: 400 });
  }

  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
      ...(session.activeBarId
        ? {
            barId: session.activeBarId,
          }
        : {
            barId: null,
          }),
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
