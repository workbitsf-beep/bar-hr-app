import "server-only";

import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RuleError } from "@/lib/rule-error";
import { hasWholeScope, type StaffAccess } from "@/lib/staff-permissions";

/**
 * A restaurant's sedi lend each other people (lib/restaurant branches:
 * linked venues under one main). Putting someone of another sede on a
 * shift adds them to this one too - same account, same hourly rate - and
 * they stay in their own: one person, counted once across the family.
 */

/** The main venue and its branches, this one included. */
export async function familyOf(barId: string) {
  const bar = await prisma.bar.findUnique({ where: { id: barId }, select: { id: true, mainBarId: true } });
  if (!bar) return [];
  const mainId = bar.mainBarId ?? bar.id;
  return prisma.bar.findMany({
    where: { OR: [{ id: mainId }, { mainBarId: mainId }] },
    select: { id: true, name: true, ownerId: true },
  });
}

/** People of the other sedi who are not here yet, for the shift pickers. */
export async function borrowableMembers(barId: string, staff: StaffAccess) {
  if (!hasWholeScope(staff)) return [];
  const family = await familyOf(barId);
  if (family.length < 2) return [];
  const here = await prisma.employeeBar.findMany({ where: { barId, isActive: true }, select: { userId: true } });
  const taken = new Set(here.map((member) => member.userId));
  const names = new Map(family.map((bar) => [bar.id, bar.name]));
  const others = await prisma.employeeBar.findMany({
    where: {
      barId: { in: family.filter((bar) => bar.id !== barId).map((bar) => bar.id) },
      isActive: true,
      role: { not: Role.OWNER },
      userId: { notIn: [...taken] },
    },
    orderBy: { user: { firstName: "asc" } },
    select: { barId: true, role: true, user: { select: { id: true, firstName: true, lastName: true } } },
  });
  const seen = new Set<string>();
  return others
    .filter((member) => (seen.has(member.user.id) ? false : (seen.add(member.user.id), true)))
    .map((member) => ({ ...member.user, role: member.role, branch: names.get(member.barId) ?? "" }));
}

/**
 * Before a shift is saved: whoever on it belongs to another sede of the
 * family, and not yet here, joins this one. Only the owner or staff over the
 * whole venue may lend people across sedi.
 */
export async function lendFromBranches(barId: string, userIds: string[], staff: StaffAccess) {
  if (userIds.length === 0) return;
  const here = await prisma.employeeBar.findMany({
    where: { barId, userId: { in: userIds }, isActive: true },
    select: { userId: true },
  });
  const missing = userIds.filter((id) => !here.some((member) => member.userId === id));
  if (missing.length === 0) return;

  const family = await familyOf(barId);
  const homes = await prisma.employeeBar.findMany({
    where: { barId: { in: family.map((bar) => bar.id) }, userId: { in: missing }, isActive: true },
    orderBy: { hiredAt: "asc" },
    select: { userId: true, hourlyRate: true },
  });
  const homeOf = new Map<string, (typeof homes)[number]>();
  for (const home of homes) if (!homeOf.has(home.userId)) homeOf.set(home.userId, home);

  // Not of this family at all: the usual refusal further on says so.
  const lent = missing.filter((id) => homeOf.has(id));
  if (lent.length === 0) return;
  if (!hasWholeScope(staff)) {
    throw new RuleError("Solo il titolare può mettere nei turni le persone di un'altra sede.");
  }

  for (const userId of lent) {
    const existing = await prisma.employeeBar.findFirst({ where: { barId, userId }, select: { id: true } });
    if (existing) {
      await prisma.employeeBar.update({ where: { id: existing.id }, data: { isActive: true, endedAt: null } });
    } else {
      await prisma.employeeBar.create({
        data: { barId, userId, role: Role.EMPLOYEE, hourlyRate: homeOf.get(userId)?.hourlyRate ?? null },
      });
    }
  }
}

/** One person cannot be in two sedi at once: a clash with another sede's shift is refused. */
export async function assertNoBranchClash(input: {
  barId: string;
  userIds: string[];
  startTime: Date;
  endTime: Date;
  isOnCall: boolean;
}) {
  if (input.isOnCall || input.userIds.length === 0) return;
  const others = (await familyOf(input.barId)).filter((bar) => bar.id !== input.barId);
  if (others.length === 0) return;
  const clash = await prisma.shift.findFirst({
    where: {
      barId: { in: others.map((bar) => bar.id) },
      isOnCall: false,
      startTime: { lt: input.endTime },
      endTime: { gt: input.startTime },
      assignments: { some: { userId: { in: input.userIds } } },
    },
    select: {
      barId: true,
      assignments: { where: { userId: { in: input.userIds } }, select: { user: { select: { firstName: true } } } },
    },
  });
  if (clash) {
    const where = others.find((bar) => bar.id === clash.barId)?.name ?? "un'altra sede";
    const who = clash.assignments[0]?.user.firstName ?? "Questa persona";
    throw new RuleError(`${who} ha già un turno a ${where} in quell'orario.`);
  }
}
