import { ClockType, Role } from "@prisma/client";
import { isWithinRadius } from "@/lib/gps";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { withBar } from "@/lib/withBar";

type ClockInBody = {
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
    const access = await getActiveBarAccess(session as never);

    if (access.role === Role.OWNER) {
      return Response.json(
        { ok: false, message: "Owner accounts cannot clock in" },
        { status: 403 }
      );
    }

    const body = (await req.json()) as ClockInBody;
    const { latitude, longitude } = body;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return Response.json(
        { ok: false, message: "Missing coordinates" },
        { status: 400 }
      );
    }

    const settings = await prisma.barSettings.findUnique({
      where: {
        barId: session.activeBarId,
      },
    });

    if (
      !settings ||
      settings.gpsLatitude === null ||
      settings.gpsLongitude === null ||
      settings.gpsRadius === null
    ) {
      return Response.json(
        { ok: false, message: "Bar GPS settings not configured" },
        { status: 400 }
      );
    }

    const allowed = isWithinRadius(
      latitude,
      longitude,
      settings.gpsLatitude,
      settings.gpsLongitude,
      settings.gpsRadius
    );

    if (!allowed) {
      return Response.json(
        { ok: false, message: "Outside allowed radius" },
        { status: 403 }
      );
    }

    const openClockIn = await prisma.timeLog.findFirst({
      where: {
        userId: session.user.id,
        barId: session.activeBarId,
        type: ClockType.IN,
      },
      orderBy: {
        timestamp: "desc",
      },
    });

    if (openClockIn) {
      const matchingClockOut = await prisma.timeLog.findFirst({
        where: {
          userId: session.user.id,
          barId: session.activeBarId,
          type: ClockType.OUT,
          timestamp: {
            gte: openClockIn.timestamp,
          },
        },
      });

      if (!matchingClockOut) {
        return Response.json(
          { ok: false, message: "A clock-in is already open" },
          { status: 400 }
        );
      }
    }

    const log = await prisma.timeLog.create({
      data: {
        type: ClockType.IN,
        userId: session.user.id,
        barId: session.activeBarId,
        latitude,
        longitude,
      },
    });

    return Response.json({ ok: true, log });
  }
);
