import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

export const GET = withBar(
  async (_req: Request, session: SessionWithBar): Promise<Response> => {
    const shifts = await prisma.shift.findMany({
      where: {
        barId: session.activeBarId,
      },
      orderBy: {
        startTime: "asc",
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return Response.json({ ok: true, shifts });
  }
);

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const access = await getActiveBarAccess(session as never);

    if (!canManageOperations(access.role)) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = (await req.json()) as {
      title?: string;
      startTime?: string;
      endTime?: string;
      employeeIds?: string[];
    };
    const employeeIds = Array.from(new Set((body.employeeIds ?? []).filter(Boolean)));

    if (!body.startTime || !body.endTime || employeeIds.length === 0) {
      return Response.json(
        { ok: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    let startTime: Date;
    let endTime: Date;

    try {
      startTime = parseDateTimeLocal(body.startTime);
      endTime = parseDateTimeLocal(body.endTime);
    } catch {
      return Response.json({ ok: false, message: "Invalid shift range" }, { status: 400 });
    }

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
      return Response.json({ ok: false, message: "Invalid shift range" }, { status: 400 });
    }

    if (toDateInputValueInTimeZone(startTime) < toDateInputValueInTimeZone(new Date())) {
      return Response.json(
        { ok: false, message: "Non puoi inserire turni prima del giorno corrente" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        title: body.title?.trim() || null,
        startTime,
        endTime,
        assignedToId: employeeIds[0],
        barId: session.activeBarId,
        createdById: session.user.id,
        assignments: {
          createMany: {
            data: employeeIds.map((userId) => ({ userId })),
          },
        },
      },
    });

    return Response.json({ ok: true, shift });
  }
);
