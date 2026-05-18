import { Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
    role: Role;
  };
};

type RouteContext = {
  params?: Promise<{
    id?: string;
  }>;
};

export const PATCH = withBar(
  async (
    _req: Request,
    session: SessionWithBar,
    context?: RouteContext
  ): Promise<Response> => {
    const params = context?.params ? await context.params : undefined;
    const taskId = params?.id;
    const access = await getActiveBarAccess(session as never);

    if (!taskId) {
      return Response.json({ ok: false, message: "Missing task id" }, { status: 400 });
    }

    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        barId: session.activeBarId,
      },
      select: {
        id: true,
        assignedToId: true,
        assignedToAll: true,
      },
    });

    if (!task) {
      return Response.json({ ok: false, message: "Task not found" }, { status: 404 });
    }

    if (
      access.role === Role.EMPLOYEE &&
      !task.assignedToAll &&
      task.assignedToId !== session.user.id
    ) {
      return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
    }

    const [, updatedTask] = await prisma.$transaction([
      prisma.taskCompletion.upsert({
        where: {
          taskId_userId: {
            taskId: task.id,
            userId: session.user.id,
          },
        },
        update: {
          completedAt: new Date(),
        },
        create: {
          taskId: task.id,
          userId: session.user.id,
        },
      }),
      prisma.task.update({
        where: { id: task.id },
        data: {
          status: TaskStatus.DONE,
          completedAt: new Date(),
          completedById: session.user.id,
        },
      }),
    ]);

    return Response.json({ ok: true, task: updatedTask });
  }
);
