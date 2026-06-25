import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const notification = await prisma.notification.findFirst({
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
    },
    select: {
      type: true,
    },
  });

  if (notification?.type.startsWith("timelog.clock-")) {
    return Response.json({
      ok: true,
      updatedCount: 0,
    });
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
