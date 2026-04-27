import { prisma } from "@/lib/prisma";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
};

type RouteContext = {
  params?: {
    id?: string;
  };
};

type UpdateShiftBody = {
  assignedToId?: string;
  startTime?: string;
  endTime?: string;
};

export const PATCH = withBar(
  async (
    req: Request,
    session: SessionWithBar,
    context?: RouteContext
  ): Promise<Response> => {
    const shiftId = context?.params?.id;

    if (!shiftId) {
      return Response.json(
        { ok: false, message: "Missing shift id" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        barId: session.activeBarId,
      },
    });

    if (!shift) {
      return Response.json(
        { ok: false, message: "Shift not found" },
        { status: 404 }
      );
    }

    const body = (await req.json()) as UpdateShiftBody;
    const { assignedToId, startTime, endTime } = body;

    if (
      assignedToId === undefined &&
      startTime === undefined &&
      endTime === undefined
    ) {
      return Response.json(
        { ok: false, message: "No fields to update" },
        { status: 400 }
      );
    }

    const nextStartTime =
      startTime !== undefined ? new Date(startTime) : shift.startTime;
    const nextEndTime =
      endTime !== undefined ? new Date(endTime) : shift.endTime;

    if (
      Number.isNaN(nextStartTime.getTime()) ||
      Number.isNaN(nextEndTime.getTime())
    ) {
      return Response.json(
        { ok: false, message: "Invalid shift time" },
        { status: 400 }
      );
    }

    if (nextEndTime <= nextStartTime) {
      return Response.json(
        { ok: false, message: "endTime must be after startTime" },
        { status: 400 }
      );
    }

    const updatedShift = await prisma.shift.update({
      where: {
        id: shiftId,
      },
      data: {
        assignedToId: assignedToId ?? shift.assignedToId,
        startTime: nextStartTime,
        endTime: nextEndTime,
      },
    });

    return Response.json(updatedShift);
  }
);
