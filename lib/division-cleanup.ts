import "server-only";

import { TaskStatus, type Department, type Prisma } from "@prisma/client";
import { dropFromStaffScopes } from "@/lib/staff-scope";

/**
 * Departments or sites that no longer exist for a venue - it moved between
 * restaurant and company, or a restaurant moved between Reparti and Sedi -
 * leave every place they were written: people, staff scopes, coming shifts,
 * open notes, the shopping list and the checklists. Past shifts keep theirs.
 */
export async function clearDivisions(tx: Prisma.TransactionClient, barId: string, stale: Department[]) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await tx.employeeBar.updateMany({
    where: { barId, department: { in: stale } },
    data: { department: null, isDepartmentLead: false },
  });
  const helping = await tx.employeeBar.findMany({
    where: { barId, helpsIn: { hasSome: stale } },
    select: { id: true, helpsIn: true },
  });
  for (const member of helping) {
    await tx.employeeBar.update({
      where: { id: member.id },
      data: { helpsIn: member.helpsIn.filter((entry) => !stale.includes(entry)) },
    });
  }
  await dropFromStaffScopes(tx, barId, stale);
  await tx.shift.updateMany({
    where: { barId, department: { in: stale }, startTime: { gte: startOfToday } },
    data: { department: null },
  });
  await tx.task.updateMany({
    where: { barId, department: { in: stale }, status: { not: TaskStatus.DONE } },
    data: { department: null },
  });
  await tx.shoppingListItem.updateMany({ where: { barId, department: { in: stale } }, data: { department: null } });
  await tx.checklist.deleteMany({ where: { barId, department: { in: stale } } });
}
