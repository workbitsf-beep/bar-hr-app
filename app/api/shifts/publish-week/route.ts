import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { scheduleShiftClockReminders } from "@/lib/shift-clock-reminders";
import { notifyPublishedShiftRecipients } from "@/lib/shift-publish-notifications";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

function parseStartDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }

  const parsed = parseDateTimeLocal(`${value.trim()}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function parseEndDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }

  const endOfDay = parseDateTimeLocal(`${value.trim()}T23:59:59.999`);
  return Number.isNaN(endOfDay.getTime()) ? null : endOfDay;
}

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const access = await getActiveBarAccess(session as never);

    if (!canManageOperations(access.role)) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as {
      weekStart?: string;
      rangeStart?: string;
      rangeEnd?: string;
    } | null;
    const rangeStart = parseStartDate(body?.rangeStart ?? body?.weekStart);
    const rangeEnd = body?.rangeEnd
      ? parseEndDate(body.rangeEnd)
      : rangeStart
        ? (() => {
            const weekEnd = new Date(rangeStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            return weekEnd;
          })()
        : null;

    if (!rangeStart || !rangeEnd || rangeEnd < rangeStart) {
      return Response.json({ ok: false, message: "Invalid date range" }, { status: 400 });
    }
    const shifts = await prisma.shift.findMany({
      where: {
        barId: session.activeBarId,
        confirmedAt: null,
        isOnCall: false,
        startTime: {
          lte: rangeEnd,
        },
        endTime: {
          gte: rangeStart,
        },
      },
      select: {
        id: true,
      },
    });

    if (shifts.length === 0) {
      return Response.json({
        ok: true,
        sentCount: 0,
        confirmedCount: 0,
        message: "Nessun turno da confermare.",
      });
    }

    const shiftIds = shifts.map((shift) => shift.id);
    const notificationResult = await notifyPublishedShiftRecipients({
      barId: session.activeBarId,
      rangeStart,
      rangeEnd,
      shiftIds,
    });

    await prisma.shift.updateMany({
      where: {
        id: {
          in: shifts.map((shift) => shift.id),
        },
        barId: session.activeBarId,
        confirmedAt: null,
      },
      data: {
        confirmedAt: new Date(),
        confirmedById: session.user.id,
      },
    });
    await scheduleShiftClockReminders(shiftIds);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendar");

    return Response.json({
      ok: true,
      sentCount: notificationResult.notificationCount,
      pushSentCount: notificationResult.pushSentCount,
      recipientCount: notificationResult.recipientCount,
      confirmedCount: shifts.length,
    });
  }
);
