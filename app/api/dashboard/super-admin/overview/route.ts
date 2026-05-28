import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { getSuperAdminOverviewData } from "@/lib/super-admin-overview";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return Response.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  if (session.user.role !== Role.SUPER_ADMIN) {
    return Response.json(
      { ok: false, message: "Forbidden" },
      { status: 403 }
    );
  }

  try {
    const data = await getSuperAdminOverviewData();
    return Response.json({ ok: true, data });
  } catch (error) {
    console.error("[super-admin-overview] failed", error);
    return Response.json(
      { ok: false, message: "Impossibile caricare la dashboard super admin." },
      { status: 500 }
    );
  }
}
