import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(url.searchParams.get("limit") ?? "25") || 25, 1),
    100
  );
  const barId = session.activeBarId ?? null;
  const where = {
    userId: session.user.id,
    barId,
  };

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        read: true,
        actionUrl: true,
        createdAt: true,
        barId: true,
        bar: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.notification.count({
      where: {
        ...where,
        read: false,
      },
    }),
  ]);

  return Response.json({
    ok: true,
    unreadCount,
    notifications,
  });
}
