import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { sendWeeklyShiftsPublishedEmail } from "@/lib/email/notifications";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

function parseWeekStart(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return null;
  }

  const parsed = new Date(`${value.trim()}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const day = parsed.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  parsed.setDate(parsed.getDate() + offset);
  parsed.setHours(0, 0, 0, 0);

  return parsed;
}

function getWeekEnd(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

function getWeekLabel(weekStart: Date, weekEnd: Date) {
  const formatter = new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "long",
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
}

function buildDeliveryMessage(failedCount: number, errorMessages: string[]) {
  if (failedCount === 0) {
    return null;
  }

  const normalizedMessages = Array.from(
    new Set(errorMessages.map((message) => message.trim()).filter(Boolean))
  );

  if (normalizedMessages.some((message) => message.toLowerCase().includes("api key is invalid"))) {
    return "Email non inviate: RESEND_API_KEY non valida.";
  }

  if (
    normalizedMessages.some(
      (message) =>
        message.toLowerCase().includes("you can only send testing emails") ||
        message.toLowerCase().includes("resend.dev")
    )
  ) {
    return "Email non inviate: la configurazione del mittente non e ancora pronta per questo account.";
  }

  return failedCount === 1
    ? "1 email non inviata."
    : `${failedCount} email non inviate.`;
}

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const access = await getActiveBarAccess(session as never);

    if (!canManageOperations(access.role)) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { weekStart?: string } | null;
    const weekStart = parseWeekStart(body?.weekStart);

    if (!weekStart) {
      return Response.json({ ok: false, message: "Invalid week start" }, { status: 400 });
    }

    const weekEnd = getWeekEnd(weekStart);
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
        startTime: {
          lte: weekEnd,
        },
        endTime: {
          gte: weekStart,
        },
      },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (shifts.length === 0) {
      return Response.json({ ok: true, sentCount: 0 });
    }

    const recipientMap = new Map<
      string,
      {
        email: string;
        firstName: string;
        lastName: string;
      }
    >();

    for (const shift of shifts) {
      for (const assignment of shift.assignments) {
        const email = assignment.user.email.trim().toLowerCase();

        if (!email) {
          continue;
        }

        recipientMap.set(email, {
          email,
          firstName: assignment.user.firstName,
          lastName: assignment.user.lastName,
        });
      }
    }

    const weekLabel = getWeekLabel(weekStart, weekEnd);
    const results = await Promise.all(
      Array.from(recipientMap.values()).map((recipient) =>
        sendWeeklyShiftsPublishedEmail(
          recipient.email,
          `${recipient.firstName} ${recipient.lastName}`.trim(),
          bar.name,
          weekLabel
        )
      )
    );
    const sentCount = results.filter((result) => result.success).length;
    const failedCount = results.length - sentCount;
    const message = buildDeliveryMessage(
      failedCount,
      results
        .map((result) => result.errorMessage)
        .filter((value): value is string => Boolean(value))
    );

    if (failedCount === 0 && recipientMap.size > 0) {
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
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard/shifts");

    return Response.json({
      ok: true,
      sentCount,
      failedCount,
      message,
    });
  }
);
