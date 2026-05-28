import "server-only";

import { RequestStatus, Role, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  ActivityItem,
  OwnerDirectoryItem,
  StaffDirectoryItem,
  SuperAdminOverviewPayload,
  SuperAdminOverviewSummary,
} from "@/lib/super-admin-overview-types";

type ActivityMembership = {
  barId: string;
  barName: string;
  barCity: string | null;
  role: Role;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
};

const MONTHLY_PRICE = 29.99;
const YEARLY_PRICE = 299;

function getDiscountMultiplier(discountPercent: number) {
  const normalizedDiscount = Math.max(0, Math.min(100, discountPercent));
  return 1 - normalizedDiscount / 100;
}

function getEstimatedMonthlyRevenue(activity: ActivityItem) {
  if (
    activity.subscription.planType !== "PAID" ||
    (activity.subscription.status !== "ACTIVE" &&
      activity.subscription.status !== "TRIALING")
  ) {
    return 0;
  }

  const multiplier = getDiscountMultiplier(
    activity.subscription.monthlyDiscountPercent
  );

  if (activity.subscription.billingInterval === "YEARLY") {
    return (YEARLY_PRICE * multiplier) / 12;
  }

  return MONTHLY_PRICE * multiplier;
}

function buildOwnerDirectory(activities: ActivityItem[]) {
  const ownerMap = new Map<string, OwnerDirectoryItem>();

  for (const activity of activities) {
    const key = activity.owner.id;
    const current =
      ownerMap.get(key) ??
      ({
        id: activity.owner.id,
        firstName: activity.owner.firstName,
        lastName: activity.owner.lastName,
        email: activity.owner.email,
        activityCount: 0,
        restaurantCount: 0,
        companyCount: 0,
        estimatedMonthlyRevenue: 0,
        searchText: `${activity.owner.firstName} ${activity.owner.lastName} ${activity.owner.email}`,
        activityPreview: [],
      } satisfies OwnerDirectoryItem);

    current.activityCount += 1;
    current.estimatedMonthlyRevenue += getEstimatedMonthlyRevenue(activity);
    current.searchText = `${current.searchText} ${activity.name} ${activity.city ?? ""} ${activity.activityType}`;

    if (current.activityPreview.length < 3) {
      current.activityPreview.push(activity.name);
    }

    if (activity.activityType === "COMPANY") {
      current.companyCount += 1;
    } else {
      current.restaurantCount += 1;
    }

    ownerMap.set(key, current);
  }

  return [...ownerMap.values()].sort((left, right) => {
    if (right.activityCount !== left.activityCount) {
      return right.activityCount - left.activityCount;
    }

    return (
      right.estimatedMonthlyRevenue - left.estimatedMonthlyRevenue ||
      left.lastName.localeCompare(right.lastName)
    );
  });
}

function buildStaffDirectory(memberships: ActivityMembership[]) {
  const staffMap = new Map<string, StaffDirectoryItem>();

  for (const membership of memberships) {
    if (membership.role === Role.OWNER || membership.role === Role.SUPER_ADMIN) {
      continue;
    }

    const membershipRole =
      membership.role === Role.MANAGER ? "MANAGER" : "EMPLOYEE";

    const current =
      staffMap.get(membership.user.id) ??
      ({
        id: membership.user.id,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email,
        roles: [],
        activityCount: 0,
        searchText: `${membership.user.firstName} ${membership.user.lastName} ${membership.user.email}`,
        activityPreview: [],
      } satisfies StaffDirectoryItem);

    if (!current.roles.includes(membershipRole)) {
      current.roles.push(membershipRole);
    }

    current.activityCount += 1;
    current.searchText = `${current.searchText} ${membership.barName} ${membership.barCity ?? ""} ${membershipRole}`;

    if (current.activityPreview.length < 3) {
      current.activityPreview.push(
        `${membership.barName} (${membershipRole === "MANAGER" ? "Manager" : "Dipendente"})`
      );
    }

    staffMap.set(membership.user.id, current);
  }

  return [...staffMap.values()].sort((left, right) => {
    if (right.activityCount !== left.activityCount) {
      return right.activityCount - left.activityCount;
    }

    return left.lastName.localeCompare(right.lastName);
  });
}

function buildSummary(
  activities: ActivityItem[],
  owners: OwnerDirectoryItem[],
  staff: StaffDirectoryItem[],
  extra: {
    last30Timelogs: number;
    pendingRequests: number;
    openTasks: number;
  }
) {
  const summary = {
    totalActivities: activities.length,
    restaurantCount: 0,
    companyCount: 0,
    ownerCount: owners.length,
    staffCount: staff.length,
    activeCount: 0,
    trialCount: 0,
    atRiskCount: 0,
    inactiveCount: 0,
    freeLifetimeCount: 0,
    last30Timelogs: extra.last30Timelogs,
    pendingRequests: extra.pendingRequests,
    openTasks: extra.openTasks,
  } satisfies SuperAdminOverviewSummary;

  for (const activity of activities) {
    if (activity.activityType === "COMPANY") {
      summary.companyCount += 1;
    } else {
      summary.restaurantCount += 1;
    }

    if (
      activity.subscription.planType === "FREE" ||
      activity.subscription.planType === "LIFETIME"
    ) {
      summary.freeLifetimeCount += 1;
      continue;
    }

    if (activity.subscription.planType === "TRIAL") {
      summary.trialCount += 1;
      continue;
    }

    if (
      activity.subscription.status === "PAST_DUE" ||
      activity.subscription.status === "UNPAID"
    ) {
      summary.atRiskCount += 1;
      continue;
    }

    if (
      activity.subscription.status === "INACTIVE" ||
      activity.subscription.status === "CANCELED"
    ) {
      summary.inactiveCount += 1;
      continue;
    }

    summary.activeCount += 1;
  }

  return summary;
}

export async function getSuperAdminOverviewData(): Promise<SuperAdminOverviewPayload> {
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const [bars, memberships, pendingRequests, openTasks, last30Timelogs] = await Promise.all([
    prisma.bar.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        activityType: true,
        city: true,
        email: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        subscription: {
          select: {
            planType: true,
            status: true,
            billingInterval: true,
            monthlyDiscountPercent: true,
            currentPeriodEnd: true,
            trialEndsAt: true,
          },
        },
        _count: {
          select: {
            shifts: true,
            timeLogs: true,
            requests: true,
            tasks: true,
          },
        },
      },
    }),
    prisma.employeeBar.findMany({
      where: {
        isActive: true,
        role: {
          in: [Role.OWNER, Role.MANAGER, Role.EMPLOYEE],
        },
      },
      select: {
        barId: true,
        role: true,
        bar: {
          select: {
            name: true,
            city: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.request.count({
      where: {
        status: RequestStatus.PENDING,
      },
    }),
    prisma.task.count({
      where: {
        status: {
          in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS],
        },
      },
    }),
    prisma.timeLog.count({
      where: {
        timestamp: {
          gte: last30Days,
        },
      },
    }),
  ]);

  const membershipsByBarId = new Map<string, ActivityMembership[]>();
  const staffCountsByBarId = new Map<
    string,
    {
      owners: number;
      managers: number;
      employees: number;
      total: number;
    }
  >();

  for (const membership of memberships) {
    const currentMemberships = membershipsByBarId.get(membership.barId) ?? [];
    currentMemberships.push({
      barId: membership.barId,
      barName: membership.bar.name,
      barCity: membership.bar.city,
      role: membership.role,
      user: {
        id: membership.user.id,
        firstName: membership.user.firstName,
        lastName: membership.user.lastName,
        email: membership.user.email,
      },
    });
    membershipsByBarId.set(membership.barId, currentMemberships);

    const currentCounts =
      staffCountsByBarId.get(membership.barId) ?? {
        owners: 0,
        managers: 0,
        employees: 0,
        total: 0,
      };

    currentCounts.total += 1;

    if (membership.role === Role.OWNER) {
      currentCounts.owners += 1;
    } else if (membership.role === Role.MANAGER) {
      currentCounts.managers += 1;
    } else if (membership.role === Role.EMPLOYEE) {
      currentCounts.employees += 1;
    }

    staffCountsByBarId.set(membership.barId, currentCounts);
  }

  const activities: ActivityItem[] = bars.map((bar) => {
    const staffCounts =
      staffCountsByBarId.get(bar.id) ?? {
        owners: 0,
        managers: 0,
        employees: 0,
        total: 0,
      };

    return {
      id: bar.id,
      name: bar.name,
      activityType: bar.activityType,
      city: bar.city,
      email: bar.email,
      createdAt: bar.createdAt.toISOString(),
      owner: {
        id: bar.owner.id,
        firstName: bar.owner.firstName,
        lastName: bar.owner.lastName,
        email: bar.owner.email,
      },
      staffCounts,
      operations: {
        shifts: bar._count.shifts,
        timeLogs: bar._count.timeLogs,
        requests: bar._count.requests,
        tasks: bar._count.tasks,
      },
      subscription: {
        planType: bar.subscription?.planType ?? "PAID",
        status: bar.subscription?.status ?? "INACTIVE",
        billingInterval: bar.subscription?.billingInterval ?? null,
        monthlyDiscountPercent: bar.subscription?.monthlyDiscountPercent ?? 0,
        currentPeriodEnd: bar.subscription?.currentPeriodEnd?.toISOString() ?? null,
        trialEndsAt: bar.subscription?.trialEndsAt?.toISOString() ?? null,
      },
    } satisfies ActivityItem;
  });

  const owners = buildOwnerDirectory(activities);
  const flattenedMemberships = Array.from(membershipsByBarId.values()).flatMap(
    (value) => value
  );
  const staff = buildStaffDirectory(flattenedMemberships);
  const summary = buildSummary(activities, owners, staff, {
    last30Timelogs,
    pendingRequests,
    openTasks,
  });

  return {
    summary,
    activities,
    owners,
    staff,
  };
}
