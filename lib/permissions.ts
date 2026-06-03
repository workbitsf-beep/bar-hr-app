import "server-only";

import { ActivityType, PlanType, Role } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { SessionWithUser } from "@/lib/auth";

export type AccessibleBar = {
  id: string;
  name: string;
  role: Role;
  activityType: ActivityType;
};

export type ActiveBarAccess = {
  activeBar: AccessibleBar | null;
  accessibleBars: AccessibleBar[];
  role: Role;
};

function barNeedsSetup(input: {
  activityType: ActivityType;
  settings: {
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsRadius: number | null;
    roundingMinutes: number | null;
    roundingMode: string | null;
  } | null;
}) {
  const needsGps =
    input.activityType === ActivityType.RESTAURANT &&
    (!input.settings ||
      input.settings.gpsLatitude === null ||
      input.settings.gpsLongitude === null ||
      input.settings.gpsRadius === null);

  return Boolean(
    !input.settings ||
      needsGps ||
      input.settings.roundingMinutes === null ||
      input.settings.roundingMode === null
  );
}

export const getAccessibleBarsForUser = cache(async function getAccessibleBarsForUser(
  userId: string,
  userRole?: Role
): Promise<AccessibleBar[]> {
  if (String(userRole) === "SUPER_ADMIN") {
    return [];
  }

  const [ownedBars, memberships] = await Promise.all([
    prisma.bar.findMany({
      where: { ownerId: userId },
      select: {
        id: true,
        name: true,
        activityType: true,
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
            activityType: true,
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
      activityType: bar.activityType,
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
        activityType: membership.bar.activityType,
      });
    }
  }

  return Array.from(barMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

export async function getActiveBarAccess(
  session: SessionWithUser
): Promise<ActiveBarAccess> {
  if (String(session.user.role) === "SUPER_ADMIN") {
    return {
      activeBar: null,
      accessibleBars: [],
      role: session.user.role,
    };
  }

  const accessibleBars = await getAccessibleBarsForUser(session.user.id, session.user.role);
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
  const ownedBar = await getOwnerPrimaryBarState(userId);

  if (!ownedBar) {
    return true;
  }

  return barNeedsSetup(ownedBar);
}

const getOwnerPrimaryBarState = cache(async function getOwnerPrimaryBarState(userId: string) {
  const ownedBars = await prisma.bar.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          memberships: {
            some: {
              userId,
              role: Role.OWNER,
              isActive: true,
            },
          },
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
      activityType: true,
      settings: {
        select: {
          gpsLatitude: true,
          gpsLongitude: true,
          gpsRadius: true,
          roundingMinutes: true,
          roundingMode: true,
        },
      },
      subscription: {
        select: {
          planType: true,
          trialEndsAt: true,
          stripeSubscriptionId: true,
        },
      },
    },
  });

  return ownedBars.find(barNeedsSetup) ?? ownedBars[0] ?? null;
});

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

  if (input.role === Role.OWNER) {
    const ownedBar = await getOwnerPrimaryBarState(input.userId);

    if (!ownedBar) {
      return "/onboarding";
    }

    if (barNeedsSetup(ownedBar)) {
      return "/onboarding";
    }

    const needsBilling = Boolean(
      ownedBar.subscription &&
        ownedBar.subscription.planType === PlanType.TRIAL &&
        ownedBar.subscription.trialEndsAt &&
        ownedBar.subscription.trialEndsAt.getTime() > Date.now() &&
        !ownedBar.subscription.stripeSubscriptionId
    );

    if (needsBilling) {
      return "/dashboard/settings";
    }
  }

  return "/dashboard/calendar";
}
