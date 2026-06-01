import "server-only";

import {
  BillingInterval,
  PlanType,
  Role,
  SubscriptionStatus,
} from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getOrSetRuntimeCache, invalidateRuntimeCache } from "@/lib/runtime-cache";

export const DEFAULT_TRIAL_DAYS = 30;
export const BILLING_GRACE_PERIOD_DAYS = 7;

export type BillingStatusResult = {
  planType: PlanType;
  status: SubscriptionStatus;
  billingInterval: BillingInterval | null;
  monthlyDiscountPercent: number;
  currentPeriodEnd: Date | null;
  gracePeriodEndsAt: Date | null;
  isInGracePeriod: boolean;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  requiresActivation: boolean;
  canAccess: boolean;
};

export function requiresSubscriptionActivation(input: {
  planType: PlanType;
  trialEndsAt: Date | null;
  stripeSubscriptionId: string | null;
}) {
  return Boolean(
    input.planType === PlanType.TRIAL &&
      input.trialEndsAt &&
      input.trialEndsAt.getTime() > Date.now() &&
      !input.stripeSubscriptionId
  );
}

export function getBillingGracePeriodEndsAt(currentPeriodEnd: Date | null) {
  if (!currentPeriodEnd) {
    return null;
  }

  return new Date(
    currentPeriodEnd.getTime() + BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  );
}

function computeCanAccess(input: {
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
}) {
  const now = Date.now();

  if (input.planType === PlanType.FREE || input.planType === PlanType.LIFETIME) {
    return true;
  }

  if (input.planType === PlanType.TRIAL) {
    return Boolean(input.trialEndsAt && input.trialEndsAt.getTime() > now);
  }

  const gracePeriodEndsAt = getBillingGracePeriodEndsAt(input.currentPeriodEnd);
  const isWithinGracePeriod = Boolean(
    gracePeriodEndsAt && gracePeriodEndsAt.getTime() >= now
  );

  if (isWithinGracePeriod) {
    return true;
  }

  return (
    input.planType === PlanType.PAID &&
    (input.status === SubscriptionStatus.ACTIVE ||
      input.status === SubscriptionStatus.TRIALING) &&
    (!input.currentPeriodEnd || input.currentPeriodEnd.getTime() >= now)
  );
}

export const getBillingStatus = cache(async function getBillingStatus(
  barId: string
): Promise<BillingStatusResult> {
  const subscription = await getOrSetRuntimeCache(
    `billing-status:${barId}`,
    30_000,
    async () =>
      prisma.subscription.findUnique({
        where: { barId },
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
      })
  );

  const result: BillingStatusResult = {
    planType: subscription?.planType ?? PlanType.PAID,
    status: subscription?.status ?? SubscriptionStatus.INACTIVE,
    billingInterval: subscription?.billingInterval ?? null,
    monthlyDiscountPercent: subscription?.monthlyDiscountPercent ?? 0,
    currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
    gracePeriodEndsAt: getBillingGracePeriodEndsAt(subscription?.currentPeriodEnd ?? null),
    isInGracePeriod: false,
    trialEndsAt: subscription?.trialEndsAt ?? null,
    stripeCustomerId: subscription?.stripeCustomerId ?? null,
    stripeSubscriptionId: subscription?.stripeSubscriptionId ?? null,
    stripePriceId: subscription?.stripePriceId ?? null,
    requiresActivation: false,
    canAccess: false,
  };

  result.requiresActivation = requiresSubscriptionActivation(result);
  result.canAccess = computeCanAccess(result);
  result.isInGracePeriod = Boolean(
    result.planType === PlanType.PAID &&
      result.currentPeriodEnd &&
      result.gracePeriodEndsAt &&
      Date.now() > result.currentPeriodEnd.getTime() &&
      Date.now() <= result.gracePeriodEndsAt.getTime()
  );
  return result;
});

export function invalidateBillingStatusCache(barId: string) {
  invalidateRuntimeCache(`billing-status:${barId}`);
}

export async function canAccessBar(barId: string) {
  const status = await getBillingStatus(barId);
  return status.canAccess;
}

export async function barNeedsSubscriptionActivation(barId: string) {
  const status = await getBillingStatus(barId);
  return status.requiresActivation;
}

export function createDefaultTrialEndsAt() {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + DEFAULT_TRIAL_DAYS);
  return trialEndsAt;
}

export async function ownerNeedsBillingSetup(userId: string): Promise<boolean> {
  const ownedBar = await prisma.bar.findFirst({
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
