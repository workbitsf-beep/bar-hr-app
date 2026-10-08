import { ClockFixKind, ClockFixStatus, ClockType, Role } from "@prisma/client";
import { findAssignedShiftForClockIn } from "@/lib/clockable-shift";
import { clockPlaceFor, isAtClockPlace } from "@/lib/clock-points";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { invalidateReportingCache } from "@/lib/reporting";
import { closeClockInReminders } from "@/lib/timelog-reminders";
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
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return Response.json(
        { ok: false, message: "Missing coordinates" },
        { status: 400 }
      );
    }

    const now = new Date();
    const activeShift = await findAssignedShiftForClockIn({
      barId: session.activeBarId,
      userId: session.user.id,
      now,
    });

    // The venue's point, or - for a company with sites - the site of the
    // shift, else of the person, else any of them.
    const place = await clockPlaceFor({
      barId: session.activeBarId,
      userId: session.user.id,
      shiftDepartment: activeShift?.department ?? null,
    });

    if (place.points.length === 0 || place.radius === null) {
      return Response.json(
        { ok: false, message: "Bar GPS settings not configured" },
        { status: 400 }
      );
    }

    if (!isAtClockPlace(place, latitude, longitude)) {
      return Response.json(
        { ok: false, message: "Outside allowed radius" },
        { status: 403 }
      );
    }

    const lastClockIn = await prisma.timeLog.findFirst({
      where: {
        userId: session.user.id,
        barId: session.activeBarId,
        type: ClockType.IN,
      },
      orderBy: {
        timestamp: "desc",
      },
      select: {
        id: true,
        timestamp: true,
      },
    });

    // A forgotten entry already declared and waiting for approval: the person
    // is at work, and a second entry would cut the first one out.
    const declaredEntry = await prisma.clockFix.findFirst({
      where: {
        userId: session.user.id,
        barId: session.activeBarId,
        kind: ClockFixKind.MISSED_IN,
        status: ClockFixStatus.PENDING,
        requestedOutAt: null,
        ...(lastClockIn ? { requestedInAt: { gt: lastClockIn.timestamp } } : {}),
      },
      select: { requestedInAt: true },
    });

    if (declaredEntry?.requestedInAt) {
      const exitAfter = await prisma.timeLog.count({
        where: {
          userId: session.user.id,
          barId: session.activeBarId,
          type: ClockType.OUT,
          timestamp: { gt: declaredEntry.requestedInAt },
        },
      });

      if (exitAfter === 0) {
        return Response.json(
          { ok: false, message: "Hai già segnalato l'entrata: timbra l'uscita." },
          { status: 400 }
        );
      }
    }

    if (lastClockIn) {
      const closingClockOut = await prisma.timeLog.findFirst({
        where: {
          userId: session.user.id,
          barId: session.activeBarId,
          type: ClockType.OUT,
          timestamp: {
            gt: lastClockIn.timestamp,
          },
        },
        select: {
          id: true,
        },
      });

      // A forgotten exit sent for approval no longer holds the next entry back.
      const exitAwaitingApproval = closingClockOut
        ? 0
        : await prisma.clockFix.count({
            where: {
              clockInId: lastClockIn.id,
              kind: ClockFixKind.MISSED_OUT,
              status: ClockFixStatus.PENDING,
            },
          });

      if (!closingClockOut && exitAwaitingApproval === 0) {
        return Response.json(
          { ok: false, message: "Prima registra l'uscita." },
          { status: 400 }
        );
      }
    }

    // A company that does not plan shifts clocks in without one.
    if (!activeShift && !place.shiftOptional) {
      return Response.json(
        {
          ok: false,
          code: "SHIFT_REQUIRED",
          message: "Non hai un turno programmato per oggi.",
        },
        { status: 403 }
      );
    }

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

