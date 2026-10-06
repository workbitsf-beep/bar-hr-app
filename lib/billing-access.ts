import { PlanType, SubscriptionStatus } from "@prisma/client";

/**
 * Whether a venue may use the app, from its subscription alone.
 *
 * Kept apart from lib/billing.ts, which reads the database, so the rule that
 * decides who is locked out can be tested on its own.
 */
export const BILLING_GRACE_PERIOD_DAYS = 7;
// From the moment a charge is issued: a card confirms in seconds, a SEPA debit
// in up to five working days. Past seven days without the payment, the venue
// stops until it arrives.
export const PAYMENT_DUE_WINDOW_DAYS = 7;

export function getBillingGracePeriodEndsAt(currentPeriodEnd: Date | null) {
  if (!currentPeriodEnd) {
    return null;
  }

  return new Date(
    currentPeriodEnd.getTime() + BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
  );
}

export function getPaymentDueUntil(paymentDueSince: Date | null) {
  if (!paymentDueSince) {
    return null;
  }

  return new Date(paymentDueSince.getTime() + PAYMENT_DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

export function computeCanAccess(input: {
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  paymentDueSince: Date | null;
}) {
  const now = Date.now();

  if (input.planType === PlanType.FREE || input.planType === PlanType.LIFETIME) {
    return true;
  }

  if (input.planType === PlanType.TRIAL) {
    return Boolean(input.trialEndsAt && input.trialEndsAt.getTime() > now);
  }

  // A charge issued and not yet paid: seven days, whether the payment is still
  // processing (SEPA) or has failed, then the venue stops. This comes before
  // the period grace below, which on its own let an unpaid renewal run for the
  // whole new month, because the period moves forward the moment it renews.
  const paymentDueUntil = getPaymentDueUntil(input.paymentDueSince);

  if (paymentDueUntil) {
    return (
      paymentDueUntil.getTime() >= now &&
      input.status !== SubscriptionStatus.CANCELED &&
      input.status !== SubscriptionStatus.INACTIVE
    );
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
