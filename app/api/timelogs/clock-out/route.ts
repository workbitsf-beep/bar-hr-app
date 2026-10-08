import { ClockFixKind, ClockFixStatus, ClockType, Role } from "@prisma/client";
import { clockPlaceFor, isAtClockPlace } from "@/lib/clock-points";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { invalidateReportingCache } from "@/lib/reporting";
import { closeClockOutReminders } from "@/lib/timelog-reminders";
import { withBar } from "@/lib/withBar";

type ClockOutBody = {
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
        { ok: false, message: "Owner accounts cannot clock out" },
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
    });

    const existingClockOut = lastClockIn
      ? await prisma.timeLog.findFirst({
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
            autoClockOut: true,
          },
        })
      : null;
    const entryOpen = Boolean(lastClockIn) && !(existingClockOut && !existingClockOut.autoClockOut);

    // No entry stamped, but one declared as forgotten and waiting for
    // approval: the exit is stamped as usual, and the approved entry will
    // slot in before it.
    const declaredEntry = entryOpen
      ? null
      : await prisma.clockFix.findFirst({
          where: {
            userId: session.user.id,
            barId: session.activeBarId,
            kind: ClockFixKind.MISSED_IN,
            status: ClockFixStatus.PENDING,
            requestedOutAt: null,
            ...(lastClockIn ? { requestedInAt: { gt: lastClockIn.timestamp } } : {}),
          },
          orderBy: { createdAt: "desc" },
          select: { requestedInAt: true, shiftId: true },
        });
    const declaredStillOpen =
      declaredEntry?.requestedInAt &&
      (await prisma.timeLog.count({
        where: {
          userId: session.user.id,
          barId: session.activeBarId,
          type: ClockType.OUT,
          timestamp: { gt: declaredEntry.requestedInAt },
        },
      })) === 0;

    if (!entryOpen && !declaredStillOpen) {
      return Response.json(
        { ok: false, message: "No active clock-in" },
        { status: 400 }
      );
    }

    const sessionStart = entryOpen ? lastClockIn!.timestamp : declaredEntry!.requestedInAt!;
    const sessionShiftId = entryOpen ? lastClockIn!.shiftId : declaredEntry!.shiftId;
    const staleAutoClockOut = entryOpen ? existingClockOut : null;

    const body = (await req.json()) as ClockOutBody;
    const latitude =
      typeof body.latitude === "number" ? body.latitude : null;
    const longitude =
      typeof body.longitude === "number" ? body.longitude : null;
    if (latitude === null || longitude === null) {
      return Response.json(
        { ok: false, message: "Missing coordinates" },
        { status: 400 }
      );
    }

    const sessionShift = sessionShiftId
      ? await prisma.shift.findUnique({ where: { id: sessionShiftId }, select: { department: true } })
      : null;
    // Out where you went in: the venue's point, or the company site's.
    const place = await clockPlaceFor({
      barId: session.activeBarId,
      userId: session.user.id,
      shiftDepartment: sessionShift?.department ?? null,
    });

    if (place.points.length === 0 || place.radius === null) {
      return Response.json(
        { ok: false, message: "Missing coordinates" },
        { status: 400 }
      );
    }

    if (!isAtClockPlace(place, latitude, longitude)) {
      return Response.json(
        { ok: false, message: "Outside allowed radius" },
        { status: 403 }
      );
    }

    const outTimestamp = new Date();

    // The automatic exit is replaced only once the real one is sure to be
    // written. Deleting it before the position was checked meant a refused
    // exit - out of range, no coordinates - reopened a closed shift, and its
    // hours kept counting until someone noticed.
    await prisma.$transaction([
      ...(staleAutoClockOut
        ? [prisma.timeLog.delete({ where: { id: staleAutoClockOut.id } })]
        : []),
      prisma.timeLog.create({
        data: {
          type: ClockType.OUT,
          userId: session.user.id,
          barId: session.activeBarId,
          shiftId: sessionShiftId,
          latitude,
          longitude,
          timestamp: outTimestamp,
          note: null,
        },
      }),
    ]);

    invalidateReportingCache(session.activeBarId, session.user.id);
    await closeClockOutReminders({
      userId: session.user.id,
      barId: session.activeBarId,
      shiftId: sessionShiftId,
    });

    const duration = outTimestamp.getTime() - sessionStart.getTime();

    return Response.json({ ok: true, duration });
  }
);

