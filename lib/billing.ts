import "server-only";

import {
  BillingInterval,
  PlanType,
  SubscriptionStatus,
} from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const DEFAULT_TRIAL_DAYS = 30;

export type BillingStatusResult = {
  planType: PlanType;
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  canAccess: boolean;
};

function computeCanAccess(input: {
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
}) {
  if (input.planType === PlanType.FREE || input.planType === PlanType.LIFETIME) {
    return true;
  }

  if (input.planType === PlanType.TRIAL) {
    return Boolean(input.trialEndsAt && input.trialEndsAt.getTime() > Date.now());
  }

  return (
    input.planType === PlanType.PAID &&
    (input.status === SubscriptionStatus.ACTIVE ||
      input.status === SubscriptionStatus.TRIALING)
  );
}

export const getBillingStatus = cache(async function getBillingStatus(
  barId: string
): Promise<BillingStatusResult> {
  const subscription = await prisma.subscription.findUnique({
    where: { barId },
    select: {
      planType: true,
      status: true,
      billingInterval: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
    },
  });

  const result: BillingStatusResult = {
    planType: subscription?.planType ?? PlanType.PAID,
    status: subscription?.status ?? SubscriptionStatus.INACTIVE,
    billingInterval: subscription?.billingInterval ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    stripeCustomerId: subscription?.stripeCustomerId ?? null,
    stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
    stripePriceId: subscription?.stripePriceId ?? null,
    canAccess: false,
  };

  result.canAccess = computeCanAccess(result);
  return result;
});

export async function canAccessBar(barId: string) {
  const status = await getBillingStatus(barId);
  return status.canAccess;
}

export function createDefaultTrialEndsAt() {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + DEFAULT_TRIAL_DAYS);
  return trialEndsAt;
}

export async function ownerNeedsBillingSetup(userId: string): Promise<boolean> {
  const ownedBar = await prisma.bar.findFirst({
    where: { ownerId: userId },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      subscription: {
        select: {
          planType: true,
          trialEndsAt: true,
          stripeSubscriptionId: true,
        },
      },
    },
  });

  if (!ownedBar?.subscription) {
    return false;
  }

  return Boolean(
    ownedBar.subscription.planType === PlanType.TRIAL &&
      ownedBar.subscription.trialEndsAt &&
      ownedBar.subscription.trialEndsAt.getTime() > Date.now() &&
      !ownedBar.subscription.stripeSubscriptionId
  );
}
