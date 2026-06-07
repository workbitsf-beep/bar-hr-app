import {
  BillingInterval,
  PlanType,
  Role,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EmptyState, Panel } from "../../ui";
import { getDashboardContext } from "../../context";
import { BarGroupsClient } from "../bar-groups-client";
import { SuperAdminForbidden, SuperAdminFrame } from "../super-admin-ui";

type BarAdminItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  subscription: {
    planType: PlanType;
    status: SubscriptionStatus;
    billingInterval: BillingInterval | null;
    monthlyDiscountPercent: number;
    currentPeriodEnd: Date | null;
    trialEndsAt: Date | null;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    stripePriceId: string | null;
  } | null;
};

export default async function SuperAdminBillingPage() {
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
      orderBy: {
        createdAt: "desc",
      },
      include: {
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
            stripeSubscriptionId: true,
            stripeCustomerId: true,
            stripePriceId: true,
          },
        },
      },
    }),
  ]);

  const adminBars = bars as BarAdminItem[];

  return (
    <SuperAdminFrame
      title="Abbonamenti"
      description="Controlla trial, stati, scadenze e sconti delle attività."
    >
      <Panel title="Abbonamenti" action={`${adminBars.length} strutture`}>
        {adminBars.length === 0 ? (
          <EmptyState message="Nessuna struttura creata al momento." />
        ) : (
          <BarGroupsClient
            owners={owners.map((owner) => ({
              id: owner.id,
              firstName: owner.firstName,
              lastName: owner.lastName,
              email: owner.email,
            }))}
            bars={adminBars.map((bar) => ({
              id: bar.id,
              name: bar.name,
              email: bar.email,
              phone: bar.phone,
              addressLine1: bar.addressLine1,
              city: bar.city,
              postalCode: bar.postalCode,
              owner: {
                id: bar.owner.id,
                firstName: bar.owner.firstName,
                lastName: bar.owner.lastName,
                email: bar.owner.email,
              },
              subscription: {
                planType: bar.subscription?.planType ?? PlanType.PAID,
                status: bar.subscription?.status ?? SubscriptionStatus.INACTIVE,
                billingInterval: bar.subscription?.billingInterval ?? null,
                monthlyDiscountPercent: bar.subscription?.monthlyDiscountPercent ?? 0,
                currentPeriodEnd: bar.subscription?.currentPeriodEnd?.toISOString() ?? null,
                trialEndsAt: bar.subscription?.trialEndsAt?.toISOString() ?? null,
                stripeSubscriptionId: bar.subscription?.stripeSubscriptionId ?? null,
                stripeCustomerId: bar.subscription?.stripeCustomerId ?? null,
                stripePriceId: bar.subscription?.stripePriceId ?? null,
              },
            }))}
          />
        )}
      </Panel>
    </SuperAdminFrame>
  );
}
