import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withBar } from "@/lib/withBar";

type CreateTaskBody = {
  title?: string;
  description?: string;
  dueDate?: string;
  assignedToId?: string;
};

type SessionWithBar = {
  activeBarId: string;
  user: {
    id: string;
  };
};

export const GET = withBar(
  async (_req: Request, session: SessionWithBar): Promise<Response> => {
    const tasks = await prisma.task.findMany({
      where: {
        barId: session.activeBarId,
      },
      orderBy: [
        { isUrgent: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
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
    const body = (await req.json()) as CreateTaskBody;
    const { title, description, dueDate, assignedToId } = body;

    if (!title || !dueDate) {
      return Response.json(
        { ok: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    const parsedDueDate = new Date(dueDate);

    if (Number.isNaN(parsedDueDate.getTime())) {
      return Response.json(
        { ok: false, message: "Invalid dueDate" },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description ?? null,
        dueDate: parsedDueDate,
        assignedToId: assignedToId ?? null,
        barId: session.activeBarId,
        createdById: session.user.id,
        status: TaskStatus.TODO,
        isUrgent: false,
      },
    });

    return Response.json(task);
  }
);
