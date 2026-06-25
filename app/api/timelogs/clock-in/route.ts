import { ClockType, Role } from "@prisma/client";
import { isWithinRadiusWithAccuracy } from "@/lib/gps";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { invalidateReportingCache } from "@/lib/reporting";
import { closeClockInReminders } from "@/lib/timelog-reminders";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { withBar } from "@/lib/withBar";

type ClockInBody = {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
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
    const accuracy =
      typeof body.accuracy === "number" && Number.isFinite(body.accuracy)
        ? Math.max(0, body.accuracy)
        : 0;

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

    const allowed = isWithinRadiusWithAccuracy(
      latitude,
      longitude,
      settings.gpsLatitude,
      settings.gpsLongitude,
      settings.gpsRadius,
      accuracy
    );

    if (!allowed) {
      return Response.json(
        { ok: false, message: "Outside allowed radius" },
        { status: 403 }
      );
    }

    const now = new Date();
    const latestLog = await prisma.timeLog.findFirst({
      where: {
        userId: session.user.id,
        barId: session.activeBarId,
      },
      orderBy: {
        timestamp: "desc",
      },
      select: {
        type: true,
        timestamp: true,
      },
    });

    if (latestLog?.type === ClockType.IN) {
      return Response.json(
        { ok: false, message: "Prima registra l'uscita." },
        { status: 400 }
      );
    }

    if (
      latestLog?.type === ClockType.OUT &&
      toDateInputValueInTimeZone(latestLog.timestamp) === toDateInputValueInTimeZone(now)
    ) {
      return Response.json(
        { ok: false, message: "Turno gia completato." },
        { status: 400 }
      );
    }

    const shiftWindowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const activeShift = await prisma.shift.findFirst({
      where: {
        barId: session.activeBarId,
        startTime: {
          lte: shiftWindowEnd,
        },
        endTime: {
          gte: now,
        },
        assignments: {
          some: {
            userId: session.user.id,
          },
        },
      },
      orderBy: {
        startTime: "asc",
      },
      select: {
        id: true,
        endTime: true,
      },
    });

    const log = await prisma.timeLog.create({
      data: {
        type: ClockType.IN,
        userId: session.user.id,
        barId: session.activeBarId,
        shiftId: activeShift?.id ?? null,
        latitude,
        longitude,
        note: activeShift ? `Turno previsto fino alle ${activeShift.endTime.toISOString()}` : null,
      },
    });

    invalidateReportingCache(session.activeBarId, session.user.id);
    await closeClockInReminders({
      userId: session.user.id,
      barId: session.activeBarId,
      shiftId: activeShift?.id ?? null,
    });

    return Response.json({ ok: true, log });
  }
);

