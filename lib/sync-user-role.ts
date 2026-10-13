import { Role, type Prisma } from "@prisma/client";

/**
 * A person's account role follows their memberships: owner anywhere wins,
 * then responsabile, amministrazione, employee.
 */
export async function syncUserRole(tx: Prisma.TransactionClient, userId: string) {
  const currentUser = await tx.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
    },
  });

  if (!currentUser || currentUser.role === Role.SUPER_ADMIN) {
    return;
  }

  const [
    primaryOwnedBars,
    ownerMemberships,
    managerMemberships,
    administrationMemberships,
    employeeMemberships,
  ] =
    await Promise.all([
      tx.bar.count({
        where: {
          ownerId: userId,
        },
      }),
      tx.employeeBar.count({
        where: {
          userId,
          isActive: true,
          role: Role.OWNER,
        },
      }),
      tx.employeeBar.count({
        where: {
          userId,
          isActive: true,
          role: Role.MANAGER,
        },
      }),
      tx.employeeBar.count({
        where: {
          userId,
          isActive: true,
          role: Role.AMMINISTRAZIONE,
        },
      }),
      tx.employeeBar.count({
        where: {
          userId,
          isActive: true,
          role: Role.EMPLOYEE,
        },
      }),
    ]);

  let nextRole: Role = currentUser.role;

  if (primaryOwnedBars > 0 || ownerMemberships > 0) {
    nextRole = Role.OWNER;
  } else if (managerMemberships > 0) {
    nextRole = Role.MANAGER;
  } else if (administrationMemberships > 0) {
    nextRole = Role.AMMINISTRAZIONE;
  } else if (employeeMemberships > 0) {
    nextRole = Role.EMPLOYEE;
  }

  if (nextRole !== currentUser.role) {
    await tx.user.update({
      where: { id: userId },
      data: {
        role: nextRole,
      },
    });
  }
}
