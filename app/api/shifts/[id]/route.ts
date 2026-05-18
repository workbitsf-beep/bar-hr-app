import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { deleteShiftWithCleanup } from "@/lib/shiftCleanup";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

type RouteContext = {
  params?: Promise<{
    id?: string;
  }>;
};

export const PATCH = withBar(
  async (
    req: Request,
    session: SessionWithBar,
    context?: RouteContext
  ): Promise<Response> => {
    const params = context?.params ? await context.params : undefined;
    const shiftId = params?.id;
    const access = await getActiveBarAccess(session as never);

    if (!canManageOperations(access.role)) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    if (!shiftId) {
      return Response.json({ ok: false, message: "Missing shift id" }, { status: 400 });
    }

    const body = (await req.json()) as {
      title?: string;
      startTime?: string;
      endTime?: string;
      employeeIds?: string[];
    };
    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        barId: session.activeBarId,
      },
    });

    if (!shift) {
      return Response.json({ ok: false, message: "Shift not found" }, { status: 404 });
    }

    const nextStartTime = body.startTime ? new Date(body.startTime) : shift.startTime;
    const nextEndTime = body.endTime ? new Date(body.endTime) : shift.endTime;
    const employeeIds =
      body.employeeIds && body.employeeIds.length > 0
        ? Array.from(new Set(body.employeeIds.filter(Boolean)))
        : [shift.assignedToId].filter(Boolean) as string[];

    if (
      Number.isNaN(nextStartTime.getTime()) ||
      Number.isNaN(nextEndTime.getTime()) ||
      nextEndTime <= nextStartTime ||
      employeeIds.length === 0
    ) {
      return Response.json({ ok: false, message: "Invalid shift update" }, { status: 400 });
    }

    const updatedShift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        title: body.title?.trim() || null,
        assignedToId: employeeIds[0],
        startTime: nextStartTime,
        endTime: nextEndTime,
        confirmedAt: null,
        confirmedById: null,
        assignments: {
          deleteMany: {},
          createMany: {
            data: employeeIds.map((userId) => ({ userId })),
          },
        },
      },
    });

    return Response.json({ ok: true, shift: updatedShift });
  }
);

export const DELETE = withBar(
  async (
    _req: Request,
    session: SessionWithBar,
    context?: RouteContext
  ): Promise<Response> => {
    const params = context?.params ? await context.params : undefined;
    const shiftId = params?.id;
    const access = await getActiveBarAccess(session as never);

    if (!canManageOperations(access.role)) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    if (!shiftId) {
      return Response.json({ ok: false, message: "Missing shift id" }, { status: 400 });
    }

    const result = await deleteShiftWithCleanup(shiftId, {
      barId: session.activeBarId,
    });

    if (!result.deleted) {
      return Response.json({ ok: false, message: "Shift not found" }, { status: 404 });
    }

    return Response.json({
      ok: true,
      deletedShiftCount: result.deletedShiftCount,
      deletedRequestCount: result.deletedRequestCount,
      detachedTimeLogCount: result.detachedTimeLogCount,
    });
  }
);
