import { prisma } from "@/lib/prisma";
import { userCanAccessBar } from "@/lib/permissions";
import { withAuth } from "@/lib/withAuth";

type SelectBarBody = {
  barId?: string;
};

type SessionWithUser = {
  id: string;
  user: {
    id: string;
  };
};

export const POST = withAuth(
  async (req: Request, session: SessionWithUser): Promise<Response> => {
    const body = (await req.json()) as SelectBarBody;
    const { barId } = body;

    if (!barId) {
      return Response.json(
        { ok: false, message: "Missing barId" },
        { status: 400 }
      );
    }

    if (!(await userCanAccessBar(session.user.id, barId))) {
      return Response.json(
        { ok: false, message: "Bar not allowed" },
        { status: 403 }
      );
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { activeBarId: barId },
    });

    return Response.json({ ok: true });
  }
);
