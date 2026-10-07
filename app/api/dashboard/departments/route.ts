import { getVenueDepartments } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import { withBar } from "@/lib/withBar";

/**
 * The venue's departments and who works in each - their own department or one
 * they lend a hand in. The audience pickers ask for it, to offer "Solo cucina"
 * next to the names. Empty on a Base venue.
 */
export const GET = withBar(async (_req, session): Promise<Response> => {
  const departments = await getVenueDepartments(session.activeBarId, session.user.id);

  if (!departments.enabled) {
    return Response.json({ ok: true, enabled: false, list: [], members: {} });
  }

  const memberships = await prisma.employeeBar.findMany({
    where: { barId: session.activeBarId, isActive: true },
    select: { userId: true, department: true, helpsIn: true, isJolly: true },
  });
  const members: Record<string, string[]> = {};

  for (const department of departments.list) {
    members[department.id] = memberships
      .filter((entry) => entry.isJolly || entry.department === department.id || entry.helpsIn.includes(department.id))
      .map((entry) => entry.userId);
  }

  return Response.json(
    { ok: true, enabled: true, list: departments.list, members },
    { headers: { "Cache-Control": "no-store" } }
  );
});
