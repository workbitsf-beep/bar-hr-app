import { ClockType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyRounding } from "@/lib/rounding";
import { withBar } from "@/lib/withBar";

type ClockOutBody = {
  latitude?: number;
  longitude?: number;
};

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
  };
};

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const lastClockIn = await prisma.timeLog.findFirst({
      where: {
        userId: session.user.id,
        barId: session.activeBarId,
        type: ClockType.IN,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (!lastClockIn) {
      return Response.json(
        { ok: false, message: "No active clock-in" },
        { status: 400 }
      );
    }

    const existingClockOut = await prisma.timeLog.findFirst({
      where: {
        userId: session.user.id,
        barId: session.activeBarId,
        type: ClockType.OUT,
        timestamp: {
          gte: lastClockIn.timestamp,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingClockOut) {
      return Response.json(
        { ok: false, message: "No active clock-in" },
        { status: 400 }
      );
    }

    const settings = await prisma.barSettings.findUnique({
      where: {
        barId: session.activeBarId,
      },
    });

    const body = (await req.json()) as ClockOutBody;
    const latitude =
      typeof body.latitude === "number" ? body.latitude : null;
    const longitude =
      typeof body.longitude === "number" ? body.longitude : null;

    let outTimestamp = new Date();

    if (
      settings?.roundingEnabled &&
      settings.roundingMode &&
      settings.roundingMinutes
    ) {
      outTimestamp = applyRounding(
        outTimestamp,
        settings.roundingMode,
        settings.roundingMinutes
      );
    }

    await prisma.timeLog.create({
      data: {
        type: ClockType.OUT,
        userId: session.user.id,
        barId: session.activeBarId,
        shiftId: lastClockIn.shiftId,
        latitude,
        longitude,
        timestamp: outTimestamp,
      },
    });

    const duration = outTimestamp.getTime() - lastClockIn.timestamp.getTime();

    return Response.json({ ok: true, duration });
  }
);
