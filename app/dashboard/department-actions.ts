"use server";

import { Department, DepartmentMode, Role, VenuePlan } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { parseDepartment } from "@/lib/departments";
import { getActiveBarAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RuleError, ruleFailure } from "@/lib/rule-error";

/**
 * Departments: the owner's settings, a person's department, and the switch
 * the super admin uses to put a venue on Pro while prices are being decided.
 */

async function ownerOfProVenue() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const { activeBar, role } = await getActiveBarAccess(session);
  if (!activeBar?.id) throw new Error("No active bar selected");
  if (role !== Role.OWNER && role !== Role.MANAGER && String(role) !== "SUPER_ADMIN") throw new Error("Unauthorized");

  const bar = await prisma.bar.findUnique({ where: { id: activeBar.id }, select: { plan: true } });
  if (bar?.plan !== VenuePlan.PRO) throw new RuleError("I reparti sono del piano Pro.");

  return { barId: activeBar.id, role };
}

function refresh() {
  for (const path of ["/dashboard", "/dashboard/calendar", "/dashboard/people", "/dashboard/settings"]) {
    revalidatePath(path);
  }
}

/** Calendar mode and the owner's own department. Owner only. */
export async function updateDepartmentSettingsAction(formData: FormData) {
  try {
    const { barId, role } = await ownerOfProVenue();
    if (role !== Role.OWNER && String(role) !== "SUPER_ADMIN") throw new RuleError("Solo il titolare cambia i reparti.");

    const mode = String(formData.get("mode")) === DepartmentMode.SEPARATE ? DepartmentMode.SEPARATE : DepartmentMode.UNIFIED;
    const customName = String(formData.get("customName") ?? "").trim().slice(0, 18) || null;

    if (customName && ["banco", "cucina", "sala"].includes(customName.toLowerCase())) {
      throw new RuleError(`${customName} c'è già.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.bar.update({ where: { id: barId }, data: { departmentMode: mode, customDepartmentName: customName } });

      // Taking the fourth department away leaves nobody and nothing in it.
      if (!customName) {
        await tx.employeeBar.updateMany({
          where: { barId, department: Department.CUSTOM },
          data: { department: null, isDepartmentLead: false },
        });
        const helping = await tx.employeeBar.findMany({
          where: { barId, helpsIn: { has: Department.CUSTOM } },
          select: { id: true, helpsIn: true },
        });
        for (const member of helping) {
          await tx.employeeBar.update({
            where: { id: member.id },
            data: { helpsIn: member.helpsIn.filter((entry) => entry !== Department.CUSTOM) },
          });
        }
        await tx.shift.updateMany({ where: { barId, department: Department.CUSTOM }, data: { department: null } });
      }
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Where a person works, where they can help, and whether they lead it. */
export async function updateMemberDepartmentAction(formData: FormData) {
  try {
    const { barId } = await ownerOfProVenue();
    const membershipId = String(formData.get("membershipId") ?? "");
    const department = parseDepartment(formData.get("department"));
    const helpsIn = formData
      .getAll("helpsIn")
      .map((value) => parseDepartment(value))
      .filter((value): value is Department => Boolean(value) && value !== department);
    const isLead = Boolean(department) && formData.get("isLead") === "on";

    const membership = await prisma.employeeBar.findFirst({
      where: { id: membershipId, barId, isActive: true },
      select: { id: true, role: true },
    });
    if (!membership) throw new RuleError("Persona non trovata in questo locale.");

    await prisma.$transaction(async (tx) => {
      // One lead per department: naming a new one hands the role over.
      if (isLead && department) {
        await tx.employeeBar.updateMany({
          where: { barId, department, isDepartmentLead: true, id: { not: membership.id } },
          data: { isDepartmentLead: false },
        });
      }
      await tx.employeeBar.update({
        where: { id: membership.id },
        data: {
          department,
          helpsIn: Array.from(new Set(helpsIn)),
          isDepartmentLead: membership.role === Role.OWNER ? false : isLead,
        },
      });
    });

    refresh();
    return { ok: true as const };
  } catch (error) {
    return ruleFailure(error);
  }
}

/** Puts a venue on Pro or back on Base. Super admin only, until plans are priced. */
export async function setVenuePlanAction(formData: FormData) {
  const session = await getSession();
  if (!session || String(session.user.role) !== "SUPER_ADMIN") throw new Error("Unauthorized");

  const barId = String(formData.get("barId") ?? "");
  const plan = String(formData.get("plan")) === VenuePlan.PRO ? VenuePlan.PRO : VenuePlan.BASE;

  await prisma.bar.update({ where: { id: barId }, data: { plan } });
  revalidatePath(`/dashboard/super-admin/bar/${barId}`);
  refresh();
}
