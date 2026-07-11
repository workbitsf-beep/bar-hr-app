import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withBar } from "@/lib/withBar";

const DEFAULT_LIMIT = 120;
const MAX_LIMIT = 200;

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

function serializeTimeLog(log: {
  id: string;
  type: "IN" | "OUT";
  timestamp: Date;
  latitude: number | null;
  longitude: number | null;
  isManual: boolean;
  note: string | null;
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };
}) {
  return {
    id: log.id,
    type: log.type,
    timestamp: log.timestamp.toISOString(),
    latitude: log.latitude,
    longitude: log.longitude,
    isManual: log.isManual,
    note: log.note,
    user: {
      id: log.user.id,
      firstName: log.user.firstName,
      lastName: log.user.lastName,
    },
  };
}

export const GET = withBar(
  async (request: Request, session: SessionWithBar): Promise<Response> => {
    if (session.user.role === Role.OWNER) {
      return Response.json({ ok: false, message: "Unsupported" }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
      MAX_LIMIT
    );
    const before = url.searchParams.get("before");
    const now = new Date();
    const personalLogStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const beforeDate = before ? new Date(before) : null;

    if (before && (!beforeDate || Number.isNaN(beforeDate.getTime()))) {
      return Response.json({ ok: false, message: "Invalid cursor" }, { status: 400 });
    }

    const logs = await prisma.timeLog.findMany({
      where: {
        barId: session.activeBarId,
        userId: session.user.id,
        timestamp: {
          gte: personalLogStart,
          ...(beforeDate ? { lt: beforeDate } : {}),
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: limit + 1,
      select: {
        id: true,
        type: true,
        timestamp: true,
        latitude: true,
        longitude: true,
        isManual: true,
        note: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const pageLogs = logs.slice(0, limit);

    return Response.json({
      ok: true,
      hasMore: logs.length > limit,
      logs: pageLogs.map(serializeTimeLog),
    });
  }
);
