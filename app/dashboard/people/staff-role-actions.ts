"use server";

import { ActivityType, Role, type Department } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { getVenueDepartments, parseDepartment, staffDepartments } from "@/lib/departments";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";
import { parsePermissions } from "@/lib/staff-permissions";
import { syncUserRole } from "@/lib/sync-user-role";

/**
 * Naming a responsabile or an amministrazione: the role, where it applies
 * (the whole venue, or some departments or sites) and what they may do there.
 * Owner only: staff never hand out permissions, their own or anyone's.
 */
export async function updateStaffRoleAction(formData: FormData) {
  try {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const { activeBar, role } = await getActiveBarAccess(session);
    if (!activeBar?.id) throw new Error("No active bar selected");
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") {
      throw new RuleError("Solo il titolare nomina i responsabili.");
    }
    const barId = activeBar.id;

    const membership = await prisma.employeeBar.findFirst({
      where: { id: String(formData.get("membershipId") ?? ""), barId, isActive: true },
      select: { id: true, userId: true, role: true, user: { select: { firstName: true } } },
    });
    if (!membership) throw new RuleError("Persona non trovata in questo locale.");
    if (membership.role === Role.OWNER) throw new RuleError("Il titolare può già fare tutto.");

    const requested = String(formData.get("role") ?? "");
    const nextRole =
      requested === Role.MANAGER
        ? Role.MANAGER
        : requested === Role.AMMINISTRAZIONE
          ? Role.AMMINISTRAZIONE
          : Role.EMPLOYEE;
    if (nextRole === Role.AMMINISTRAZIONE && activeBar.activityType !== ActivityType.COMPANY) {
      throw new RuleError("L'amministrazione c'è nelle aziende.");
    }

    const staffRole = nextRole !== Role.EMPLOYEE;
    const permissions = staffRole ? parsePermissions(formData.getAll("permissions")) : [];
    if (staffRole && permissions.length === 0) {
      throw new RuleError("Scegli almeno una cosa che può fare.");
    }

    // Where: everything, or the departments or sites ticked.
    const departments = await getVenueDepartments(barId, session.user.id);
    const known = new Set(staffDepartments(departments.list).map((entry) => entry.id));
    const wholeVenue = !departments.enabled || String(formData.get("scope") ?? "all") === "all";
    const scope = wholeVenue
      ? []
      : Array.from(
          new Set(
            formData
              .getAll("departments")
              .map((value) => parseDepartment(value))
              .filter((value): value is Department => Boolean(value) && known.has(value as Department))
          )
        );
    if (staffRole && !wholeVenue && scope.length === 0) {
      throw new RuleError(`Scegli almeno ${departments.kind === "sites" ? "una sede" : "un reparto"}.`);
    }
    if (staffRole && scope.length > 0 && scope.length === known.size) {
      // Every one ticked is the whole venue, also for the ones added later.
      scope.length = 0;
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeBar.update({
        where: { id: membership.id },
        data: {
          role: nextRole,
          permissions: staffRole ? permissions : [],
          managesDepartments: staffRole ? scope : [],
          isDepartmentLead: false,
        },
      });
      await syncUserRole(tx, membership.userId);
    });

    for (const path of ["/dashboard", "/dashboard/people", "/dashboard/calendar", "/dashboard/requests"]) {
      revalidatePath(path);
    }

    const name = membership.user.firstName;
    if (!staffRole) return { ok: true as const, message: `${name} ora è dipendente.` };
    const roleWord = nextRole === Role.MANAGER ? "responsabile" : "amministrazione";
    const where = scope.length
      ? scope
          .map((id) => departments.list.find((entry) => entry.id === id)?.name ?? id)
          .join(", ")
      : departments.kind === "sites"
        ? "tutte le sedi"
        : "tutto il locale";
    return { ok: true as const, message: `Salvato: ${name} è ${roleWord} · ${where}.` };
  } catch (error) {
    return ruleFailure(error);
  }
}
