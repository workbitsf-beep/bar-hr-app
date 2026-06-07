import { ActivityType, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../../context";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";
import { BarsManager } from "./bars-manager";

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseActivityFilter(value: string) {
  if (value === "COMPANY" || value === "RESTAURANT") {
    return value;
  }

  return "ALL";
}

function getBarWhere(query: string, activityFilter: "ALL" | ActivityType): Prisma.BarWhereInput {
  const conditions: Prisma.BarWhereInput[] = [];

  if (activityFilter !== "ALL") {
    conditions.push({ activityType: activityFilter });
  }

  if (query) {
    conditions.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { legalName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { owner: { is: { firstName: { contains: query, mode: "insensitive" } } } },
        { owner: { is: { lastName: { contains: query, mode: "insensitive" } } } },
        { owner: { is: { email: { contains: query, mode: "insensitive" } } } },
      ],
    });
  }

  return conditions.length ? { AND: conditions } : {};
}

export default async function SuperAdminBarsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = normalizeParam(params.q).trim();
  const activity = parseActivityFilter(normalizeParam(params.activity));
  const error = normalizeParam(params.error);
  const success = normalizeParam(params.success);
  const { role } = await getDashboardContext();

  if (String(role) !== "SUPER_ADMIN") {
    return <SuperAdminForbidden />;
  }

  const [owners, bars] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: Role.OWNER,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    }),
    prisma.bar.findMany({
      where: getBarWhere(query, activity),
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
      select: {
        id: true,
        name: true,
        legalName: true,
        email: true,
        phone: true,
        addressLine1: true,
        city: true,
        postalCode: true,
        activityType: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        memberships: {
          where: {
            isActive: true,
            role: Role.OWNER,
          },
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
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
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripePriceId: true,
          },
        },
      },
    }),
  ]);

  return (
    <SuperAdminFrame
      title="Attività"
      description="Aziende e ristorazione con creazione e ricerca rapide."
    >
      <BarsManager
        bars={bars}
        owners={owners}
        activity={activity}
        query={query}
        error={error}
        success={success}
      />
    </SuperAdminFrame>
  );
}
