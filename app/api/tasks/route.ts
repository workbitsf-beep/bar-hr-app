import { Role, TaskStatus } from "@prisma/client";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { canManageOperations, getActiveBarAccess } from "@/lib/permissions";
import { parseTaskDueDate } from "@/lib/task-dates";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

function splitBulkTextEntries(value: string) {
  return value
    .split(/\r?\n+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export const GET = withBar(
  async (_req: Request, session: SessionWithBar): Promise<Response> => {
    const access = await getActiveBarAccess(session as never);
    const tasks = await prisma.task.findMany({
      where: {
        barId: session.activeBarId,
        ...(access.role === Role.EMPLOYEE
          ? {
              OR: [
                { assignedToId: session.user.id },
                { assignedToAll: true },
              ],
            }
          : {}),
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return Response.json({ ok: true, tasks });
  }
);

export const POST = withBar(
  async (req: Request, session: SessionWithBar): Promise<Response> => {
    const access = await getActiveBarAccess(session as never);

    if (!canManageOperations(access.role)) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = (await req.json()) as {
      title?: string;
      description?: string;
      dueDate?: string;
      assignedToId?: string;
      assignedToAll?: boolean;
      isUrgent?: boolean;
    };

    if (!body.title || !body.dueDate) {
      return Response.json(
        { ok: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const taskTitles = splitBulkTextEntries(body.title);

    if (taskTitles.length === 0) {
      return Response.json(
        { ok: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const dueDate = parseTaskDueDate(body.dueDate);

    if (!dueDate) {
      return Response.json({ ok: false, message: "Invalid due date" }, { status: 400 });
    }

    await prisma.task.createMany({
      data: taskTitles.map((taskTitle) => ({
        title: taskTitle,
        description: body.description?.trim() || null,
        dueDate,
        assignedToId: body.assignedToAll ? null : body.assignedToId || null,
        assignedToAll: Boolean(body.assignedToAll),
        barId: session.activeBarId,
        createdById: session.user.id,
        status: TaskStatus.TODO,
        isUrgent: Boolean(body.isUrgent),
      })),
    });

    const bar = await prisma.bar.findUnique({
      where: { id: session.activeBarId },
      select: {
        name: true,
        memberships: {
          where: {
            isActive: true,
          },
          select: {
            role: true,
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

    if (bar) {
      const recipients = body.assignedToAll
        ? bar.memberships.filter(
            (membership) =>
              membership.role !== Role.OWNER && membership.user.id !== session.user.id
          )
        : bar.memberships.filter(
            (membership) =>
              membership.user.id === body.assignedToId &&
              membership.user.id !== session.user.id
          );

      await Promise.all(
        recipients.map((recipient) => {
          const preview = taskTitles.slice(0, 4).map((taskTitle) => `• ${taskTitle}`).join("\n");
          const extraCount = Math.max(0, taskTitles.length - 4);
          const extraLine = extraCount > 0 ? `\n+ altre ${extraCount} mansioni` : "";

          return notifyUsers([recipient.user.id], {
            barId: session.activeBarId,
            title:
              taskTitles.length === 1 ? "Nuova mansione assegnata" : "Nuove mansioni assegnate",
            message:
              taskTitles.length === 1
                ? `Ti è stata assegnata una nuova mansione: ${taskTitles[0]}.\nLocale: ${bar.name}.`
                : `Ti sono state assegnate ${taskTitles.length} nuove mansioni per ${bar.name}.\n${preview}${extraLine}`,
            type: INTERNAL_NOTIFICATION_TYPES.TASK_ASSIGNED,
            actionUrl: "/dashboard/tasks",
          });
        })
      );
    }

    return Response.json({ ok: true, count: taskTitles.length });
  }
);
