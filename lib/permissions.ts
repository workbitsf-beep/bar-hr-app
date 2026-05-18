import "server-only";

import { Role } from "@prisma/client";
import { ownerNeedsBillingSetup } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import type { SessionWithUser } from "@/lib/auth";

export type AccessibleBar = {
  id: string;
  name: string;
  role: Role;
};

export type ActiveBarAccess = {
  activeBar: AccessibleBar | null;
  accessibleBars: AccessibleBar[];
  role: Role;
};

export async function getAccessibleBarsForUser(
  userId: string
): Promise<AccessibleBar[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (String(user?.role) === "SUPER_ADMIN") {
    return [];
  }

  const [ownedBars, memberships] = await Promise.all([
    prisma.bar.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.employeeBar.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        role: true,
        bar: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
      orderBy: {
        bar: {
          name: "asc",
        },
      },
    }),
  ]);

  const barMap = new Map<string, AccessibleBar>();

  for (const bar of ownedBars) {
    barMap.set(bar.id, {
      id: bar.id,
      name: bar.name,
      role: Role.OWNER,
    });
  }

  for (const membership of memberships) {
    const derivedRole =
      membership.bar.ownerId === userId ? Role.OWNER : membership.role;

    if (!barMap.has(membership.bar.id)) {
      barMap.set(membership.bar.id, {
        id: membership.bar.id,
        name: membership.bar.name,
        role: derivedRole,
      });
    }
  }

  return Array.from(barMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActiveBarAccess(
  session: SessionWithUser
): Promise<ActiveBarAccess> {
  const accessibleBars = await getAccessibleBarsForUser(session.user.id);
  const fallbackBar = accessibleBars[0] ?? null;
  const activeBar =
    accessibleBars.find((bar) => bar.id === session.activeBarId) ?? fallbackBar;

  return {
    activeBar,
    accessibleBars,
    role: activeBar?.role ?? session.user.role,
  };
}

export async function userCanAccessBar(
  userId: string,
  barId: string
): Promise<boolean> {
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: { ownerId: true },
  });

  if (!bar) {
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (String(user?.role) === "SUPER_ADMIN") {
    return true;
  }

  if (bar.ownerId === userId) {
    return true;
  }

  const membership = await prisma.employeeBar.findUnique({
    where: {
      userId_barId: {
        userId,
        barId,
      },
    },
    select: {
      isActive: true,
    },
  });

  return Boolean(membership?.isActive);
}

export function canManageOperations(role: Role): boolean {
  return role === Role.OWNER || role === Role.MANAGER;
}

export function canManagePeople(role: Role): boolean {
  return role === Role.OWNER;
}

export function canClock(role: Role): boolean {
  return role === Role.MANAGER || role === Role.EMPLOYEE;
}

export function canExportAll(role: Role): boolean {
  return role === Role.OWNER;
}

export async function ownerNeedsOnboarding(userId: string): Promise<boolean> {
  const ownedBar = await prisma.bar.findFirst({
    where: { ownerId: userId },
    include: {
      settings: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!ownedBar) {
    return true;
  }

  return Boolean(
    !ownedBar.settings ||
      ownedBar.settings.gpsLatitude === null ||
      ownedBar.settings.gpsLongitude === null ||
      ownedBar.settings.gpsRadius === null ||
      ownedBar.settings.roundingMinutes === null ||
      ownedBar.settings.roundingMode === null
  );
}

export async function getPostLoginDestination(input: {
  userId: string;
  role: Role;
  mustChangePwd: boolean;
}): Promise<string> {
  if (input.mustChangePwd) {
    return "/change-password";
  }

  if (String(input.role) === "SUPER_ADMIN") {
    return "/dashboard/super-admin";
  }

  if (input.role === Role.OWNER && (await ownerNeedsOnboarding(input.userId))) {
    return "/onboarding";
  }

  if (input.role === Role.OWNER && (await ownerNeedsBillingSetup(input.userId))) {
    return "/billing";
  }

  return "/dashboard/calendar";
}
