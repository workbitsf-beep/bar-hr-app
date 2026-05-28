import { Role } from "@prisma/client";
import { getDashboardKpiData } from "@/lib/dashboard-kpi";
import { getActiveBarAccess } from "@/lib/permissions";
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

    if (access.role !== Role.OWNER && access.role !== Role.MANAGER) {
      return Response.json(
        { ok: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const data = await getDashboardKpiData(
      session.activeBarId,
      access.activeBar?.activityType ?? null
    );

    return Response.json({ ok: true, data });
  }
);
