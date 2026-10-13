import type { Department, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RuleError } from "@/lib/rule-error";
import { can, scopeOf, type Permission, type StaffAccess } from "@/lib/staff-permissions";

/**
 * The database side of lib/staff-permissions: what a Responsabile di Sala or
 * an Amministrazione of some sites may see and touch. The owner and staff over
 * the whole venue get no filter at all.
 */

export const NOT_ALLOWED = "Non hai questo permesso: chiedilo al titolare.";

export function ensureCan(staff: StaffAccess, permission: Permission, department?: Department | null) {
  if (!can(staff, permission, department)) {
    throw new RuleError(NOT_ALLOWED);
  }
}

/** The people a scoped person works with: their department or site, and the Jolly. */
export function memberScopeWhere(staff: StaffAccess): Prisma.EmployeeBarWhereInput {
  const scope = scopeOf(staff) as Department[] | null;
  return scope ? { department: { in: [...scope, "JOLLY"] } } : {};
}

/** Users of the venue within the scope, for lists filtered by `userId`. */
export function userScopeWhere(staff: StaffAccess, barId: string): Prisma.UserWhereInput {
  const scope = scopeOf(staff);
  return scope ? { barMemberships: { some: { barId, isActive: true, ...memberScopeWhere(staff) } } } : {};
}

/**
 * Shifts within the scope: filed under their department, or - made without
 * one - with someone of theirs on it.
 */
export function shiftScopeWhere(staff: StaffAccess, barId: string): Prisma.ShiftWhereInput {
  const scope = scopeOf(staff) as Department[] | null;
  if (!scope) return {};
  return {
    OR: [
      { department: { in: [...scope, "JOLLY"] } },
      { department: null, assignments: { some: { user: userScopeWhere(staff, barId) } } },
    ],
  };
}

export async function memberDepartmentOf(barId: string, userId: string) {
  const member = await prisma.employeeBar.findFirst({
    where: { barId, userId, isActive: true },
    select: { department: true },
  });
  return member?.department ?? null;
}

/** Every one of these people is within the scope, for `permission`. */
export async function ensureMembersInScope(
  staff: StaffAccess,
  permission: Permission,
  barId: string,
  userIds: string[]
) {
  ensureCan(staff, permission);
  if (!scopeOf(staff) || userIds.length === 0) return;
  const members = await prisma.employeeBar.findMany({
    where: { barId, userId: { in: userIds }, isActive: true },
    select: { department: true },
  });
  if (members.length !== new Set(userIds).size || members.some((member) => !can(staff, permission, member.department))) {
    throw new RuleError("Puoi gestire solo le persone che segui.");
  }
}

/**
 * Shifts: allowed when the shift's department is within the scope; a shift
 * without one, when everyone on it is.
 */
export async function ensureShiftManager(
  staff: StaffAccess,
  barId: string,
  department: Department | null | undefined,
  userIds: string[] = []
) {
  ensureCan(staff, "shifts");
  if (!scopeOf(staff)) return;
  if (department) {
    ensureCan(staff, "shifts", department);
    return;
  }
  if (userIds.length === 0) throw new RuleError(NOT_ALLOWED);
  await ensureMembersInScope(staff, "shifts", barId, userIds);
}

/**
 * Where something made by a scoped person is filed: the department they
 * asked for when it is theirs, else the first they cover. Unscoped: as asked.
 */
export function departmentWithin(staff: StaffAccess, requested: Department | null | undefined): Department | null {
  const scope = scopeOf(staff) as Department[] | null;
  if (!scope) return requested ?? null;
  return requested && (requested === "JOLLY" || scope.includes(requested)) ? requested : scope[0];
}

/** Where the person a document is for works; null for a document to all. */
export async function documentAssigneeDepartment(barId: string, document: { assignedToId: string | null }) {
  return document.assignedToId ? memberDepartmentOf(barId, document.assignedToId) : null;
}

/**
 * Departments or sites that are gone leave the scopes of staff: they keep the
 * rest, and with none left they keep nothing - never the whole venue.
 */
export async function dropFromStaffScopes(tx: Prisma.TransactionClient, barId: string, gone: Department[]) {
  const scoped = await tx.employeeBar.findMany({
    where: { barId, managesDepartments: { hasSome: gone } },
    select: { id: true, managesDepartments: true },
  });
  for (const member of scoped) {
    const remaining = member.managesDepartments.filter((entry) => !gone.includes(entry));
    await tx.employeeBar.update({
      where: { id: member.id },
      data: remaining.length ? { managesDepartments: remaining } : { managesDepartments: [], permissions: [] },
    });
  }
}
