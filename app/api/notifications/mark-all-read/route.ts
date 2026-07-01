import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
