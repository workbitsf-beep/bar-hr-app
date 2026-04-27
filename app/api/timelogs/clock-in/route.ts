import { ClockType } from "@prisma/client";
import { isWithinRadius } from "@/lib/gps";
import { prisma } from "@/lib/prisma";
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

    const log = await prisma.timeLog.create({
      data: {
        type: ClockType.IN,
        userId: session.user.id,
        barId: session.activeBarId,
        latitude,
        longitude,
      },
    });

    return Response.json(log);
  }
);
