import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { scheduleShiftClockReminders } from "@/lib/shift-clock-reminders";
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

function getRangeLabel(rangeStart: Date, rangeEnd: Date) {
  if (
    rangeStart.getMonth() === rangeEnd.getMonth() &&
    rangeStart.getFullYear() === rangeEnd.getFullYear()
  ) {
    return new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
    }).format(rangeStart);
  }

  const formatter = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
  });

  return `${formatter.format(rangeStart)} - ${formatter.format(rangeEnd)}`;
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
    const bar = await prisma.bar.findUnique({
      where: { id: session.activeBarId },
      select: { name: true },
    });

    if (!bar) {
      return Response.json({ ok: false, message: "Bar not found" }, { status: 404 });
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
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
              },
            },
          },
        },
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

    const recipientMap = new Map<
      string,
      {
        id: string;
        firstName: string;
      }
    >();

    for (const shift of shifts) {
      for (const assignment of shift.assignments) {
        if (assignment.user.id === session.user.id) {
          continue;
        }

        recipientMap.set(assignment.user.id, {
          id: assignment.user.id,
          firstName: assignment.user.firstName,
        });
      }
    }

    const weekLabel = getRangeLabel(rangeStart, rangeEnd);
    const recipients = Array.from(recipientMap.values());
    const notificationResults = await Promise.all(
      recipients.map((recipient) =>
        notifyUsers([recipient.id], {
          barId: session.activeBarId,
          title: "Turni pubblicati",
          message: `Ciao ${recipient.firstName},\nSono stati pubblicati o aggiornati i tuoi turni della settimana ${weekLabel} per ${bar.name}.`,
          type: INTERNAL_NOTIFICATION_TYPES.SHIFT_PUBLISHED,
          actionUrl: "/dashboard/calendar",
        })
      )
    );
    const sentCount = notificationResults.reduce(
      (total, result) => total + result.createdCount,
      0
    );

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
    await scheduleShiftClockReminders(shifts.map((shift) => shift.id));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendar");

    return Response.json({
      ok: true,
      sentCount,
      confirmedCount: shifts.length,
    });
  }
);
