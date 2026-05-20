import { Role, TaskStatus } from "@prisma/client";
import { sendTaskAssignedEmail } from "@/lib/email/notifications";
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

    const dueDate = parseTaskDueDate(body.dueDate);

    if (!dueDate) {
      return Response.json({ ok: false, message: "Invalid due date" }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title: body.title.trim(),
        description: body.description?.trim() || null,
        dueDate,
        assignedToId: body.assignedToAll ? null : body.assignedToId || null,
        assignedToAll: Boolean(body.assignedToAll),
        barId: session.activeBarId,
        createdById: session.user.id,
        status: TaskStatus.TODO,
        isUrgent: Boolean(body.isUrgent),
      },
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
                email: true,
                firstName: true,
              },
            },
          },
        },
      },
    });

    if (bar) {
      const recipients = body.assignedToAll
        ? bar.memberships.filter((membership) => membership.role !== Role.OWNER)
        : bar.memberships.filter((membership) => membership.user.id === task.assignedToId);

      await Promise.all(
        recipients.map((recipient) =>
          sendTaskAssignedEmail(
            recipient.user.email,
            recipient.user.firstName,
            task.title,
            bar.name
          )
        )
      );
    }

    return Response.json({ ok: true, task });
  }
);
