import "server-only";

import { ActivityType, PlanType, Role } from "@prisma/client";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ownerNeedsLegalAcceptance } from "@/lib/legal-documents";
import type { SessionWithUser } from "@/lib/auth";
import type { Department } from "@prisma/client";
import type { StaffAccess } from "@/lib/staff-permissions";

export type AccessibleBar = {
  id: string;
  name: string;
  role: Role;
  activityType: ActivityType;
  /** Responsabile / Amministrazione: what they may do, and where (lib/staff-permissions). */
  permissions: string[];
  managesDepartments: Department[];
};

export type ActiveBarAccess = {
  activeBar: AccessibleBar | null;
  accessibleBars: AccessibleBar[];
  role: Role;
  /** Role, permissions and scope together, for `can` in lib/staff-permissions. */
  staff: StaffAccess;
};

function barNeedsSetup(input: {
  activityType: ActivityType;
  settings: {
    gpsLatitude: number | null;
    gpsLongitude: number | null;
    gpsRadius: number | null;
    gpsPostponedAt: Date | null;
    companyShiftsEnabled: boolean | null;
    roundingMinutes: number | null;
    roundingMode: string | null;
  } | null;
}) {
  if (!input.settings) {
    return true;
  }

  if (
    input.activityType === ActivityType.COMPANY &&
    input.settings.companyShiftsEnabled === null
  ) {
    return true;
  }

  const needsGps =
    input.activityType === ActivityType.RESTAURANT &&
    !input.settings.gpsPostponedAt &&
    (input.settings.gpsLatitude === null ||
      input.settings.gpsLongitude === null ||
      input.settings.gpsRadius === null);

  return Boolean(
    needsGps ||
      (input.activityType === ActivityType.RESTAURANT &&
        (input.settings.roundingMinutes === null ||
          input.settings.roundingMode === null))
  );
}

export const getAccessibleBarsForUser = cache(async function getAccessibleBarsForUser(
  userId: string,
  _userRole?: Role
): Promise<AccessibleBar[]> {
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
        permissions: true,
        managesDepartments: true,
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
      permissions: [],
      managesDepartments: [],
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
        permissions: derivedRole === Role.OWNER ? [] : membership.permissions,
        managesDepartments: derivedRole === Role.OWNER ? [] : membership.managesDepartments,
      });
    }
  }

  return Array.from(barMap.values()).sort((a, b) => a.name.localeCompare(b.name));
});

export async function getActiveBarAccess(
  session: SessionWithUser
): Promise<ActiveBarAccess> {
  const accessibleBars = await getAccessibleBarsForUser(session.user.id, session.user.role);

  if (String(session.user.role) === "SUPER_ADMIN") {
    // A super admin stays in console mode (no bar selected) until they
    // explicitly pick one of their own bars via the header switcher -
    // unlike other roles, they never fall back to "first bar" automatically.
    const activeBar = accessibleBars.find((bar) => bar.id === session.activeBarId) ?? null;

    const role = activeBar?.role ?? session.user.role;
    return {
      activeBar,
      accessibleBars,
      role,
      staff: staffAccessOf(role, activeBar),
    };
  }

  const fallbackBar = accessibleBars[0] ?? null;
  const activeBar =
    accessibleBars.find((bar) => bar.id === session.activeBarId) ?? fallbackBar;

  const role = activeBar?.role ?? session.user.role;
  return {
    activeBar,
    accessibleBars,
    role,
    staff: staffAccessOf(role, activeBar),
  };
}

function staffAccessOf(role: Role, bar: AccessibleBar | null): StaffAccess {
  return {
    role: String(role),
    permissions: bar?.permissions ?? [],
    managesDepartments: bar?.managesDepartments ?? [],
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

export function canReviewOperationalRequests(role: Role): boolean {
  return role === Role.OWNER || role === Role.MANAGER;
}

export function canManageTraining(role: Role): boolean {
  return role === Role.OWNER || role === Role.MANAGER || role === Role.AMMINISTRAZIONE;
}

// Contracts and payslips are private. A responsabile runs the floor but has
// no business reading a colleague's file - only the owner and the office do.
export function canManageDocuments(role: Role): boolean {
  return role === Role.OWNER || role === Role.AMMINISTRAZIONE;
}

export function canViewCompanyReports(role: Role): boolean {
  return role === Role.OWNER || role === Role.AMMINISTRAZIONE;
}

export function canClock(role: Role): boolean {
  return role === Role.MANAGER || role === Role.AMMINISTRAZIONE || role === Role.EMPLOYEE;
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

const ownerBarSelection = {
  activityType: true,
  settings: {
    select: {
      gpsLatitude: true,
      gpsLongitude: true,
      gpsRadius: true,
      gpsPostponedAt: true,
      companyShiftsEnabled: true,
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
} as const;

const getOwnerPrimaryBarState = cache(async function getOwnerPrimaryBarState(
  userId: string,
  preferredBarId?: string | null
) {
  if (preferredBarId) {
    const preferredBar = await prisma.bar.findFirst({
      where: {
        id: preferredBarId,
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
      select: ownerBarSelection,
    });

    if (preferredBar) {
      return preferredBar;
    }
  }

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
    select: ownerBarSelection,
  });

  return ownedBars[0] ?? null;
});

/** The request comes from the installed app (cookie set by app/layout.tsx). */
async function isInsideInstalledApp() {
  try {
    return (await cookies()).get("wb-native")?.value === "1";
  } catch {
    return false;
  }
}

export async function getPostLoginDestination(input: {
  userId: string;
  role: Role;
  mustChangePwd: boolean;
  activeBarId?: string | null;
}): Promise<string> {
  if (input.mustChangePwd) {
    return "/change-password";
  }

  if (String(input.role) === "SUPER_ADMIN") {
    return "/dashboard/super-admin";
  }

  if (input.role === Role.OWNER) {
    if (await ownerNeedsLegalAcceptance({ userId: input.userId, role: input.role })) {
      return "/legal/accept";
    }

    const ownedBar = await getOwnerPrimaryBarState(input.userId, input.activeBarId ?? null);

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

    // Inside the installed app the card is not asked (see dashboard/context.ts).
    if (needsBilling && !(await isInsideInstalledApp())) {
      return "/dashboard/settings?billing=1";
    }
  }

  return "/dashboard";
}
