import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withBar } from "@/lib/withBar";

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
  };
};

type RouteContext = {
  params?: {
    id?: string;
  };
};

export const PATCH = withBar(
  async (
    _req: Request,
    session: SessionWithBar,
    context?: RouteContext
  ): Promise<Response> => {
    const taskId = context?.params?.id;

    if (!taskId) {
      return Response.json(
        { ok: false, message: "Missing task id" },
        { status: 400 }
      );
    }

    const existingTask = await prisma.task.findFirst({
      where: {
        id: taskId,
        barId: session.activeBarId,
      },
      select: {
        id: true,
      },
    });

    if (!existingTask) {
      return Response.json(
        { ok: false, message: "Task not found" },
        { status: 404 }
      );
    }

    const task = await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        status: TaskStatus.DONE,
        completedAt: new Date(),
        completedById: session.user.id,
      },
    });

    return Response.json(task);
  }
);
