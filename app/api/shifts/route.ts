import { prisma } from "@/lib/prisma";
import { withBar } from "@/lib/withBar";

type CreateShiftBody = {
  title?: string;
  startTime?: string;
  endTime?: string;
  assignedToId?: string;
};

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
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
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return Response.json({ ok: true, shifts });
  }
);

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const body = (await req.json()) as CreateShiftBody;
    const { title, startTime, endTime, assignedToId } = body;

    if (!startTime || !endTime || !assignedToId) {
      return Response.json(
        { ok: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (
      Number.isNaN(parsedStartTime.getTime()) ||
      Number.isNaN(parsedEndTime.getTime())
    ) {
      return Response.json(
        { ok: false, message: "Invalid shift time" },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.create({
      data: {
        title: title ?? null,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        assignedToId,
        barId: session.activeBarId,
        createdById: session.user.id,
      },
    });

    return Response.json(shift);
  }
);
