import { PlanType, Role, SubscriptionStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { invalidateBillingStatusCache } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import type Stripe from "stripe";
import {
  cancelStripeSubscriptionSafely,
  isStripeMissingResourceError,
  setStripeCancelAtPeriodEnd,
} from "@/lib/stripe";

function periodEndOf(subscription: Stripe.Subscription) {
  const ends = subscription.items.data
    .map((item) => item.current_period_end)
    .filter((value): value is number => typeof value === "number");
  const end = subscription.trial_end ?? (ends.length ? Math.min(...ends) : null);
  return end ? new Date(end * 1000) : null;
}

export async function POST() {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (role !== Role.OWNER || !activeBar?.id) {
    return Response.json({ ok: false, message: "Sessione scaduta. Accedi di nuovo." }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { barId: activeBar.id },
    select: {
      id: true,
      planType: true,
      status: true,
      stripeSubscriptionId: true,
    },
  });

  if (!subscription) {
    return Response.json(
      { ok: false, message: "Abbonamento non trovato." },
      { status: 404 }
    );
  }

  if (
    subscription.planType === PlanType.FREE ||
    subscription.planType === PlanType.LIFETIME
  ) {
    return Response.json(
      { ok: false, message: "Questo piano viene gestito dal super admin." },
      { status: 400 }
    );
  }

  // Paid up (or on a trial): the renewal stops and the venue keeps working
  // until the end of what is already paid. Stripe ends the subscription then
  // and the webhook marks it canceled. It used to be canceled at once, which
  // locked a customer out of a month they had paid for.
  const paidUp =
    subscription.status === SubscriptionStatus.ACTIVE ||
    subscription.status === SubscriptionStatus.TRIALING;

  if (subscription.stripeSubscriptionId && paidUp) {
    try {
      const updated = await setStripeCancelAtPeriodEnd(subscription.stripeSubscriptionId, true);
      const endsAt = periodEndOf(updated);
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: true,
          ...(endsAt
            ? subscription.planType === PlanType.TRIAL
              ? { trialEndsAt: endsAt }
              : { currentPeriodEnd: endsAt }
            : {}),
        },
      });
      invalidateBillingStatusCache(activeBar.id);
      return Response.json({ ok: true, endsAt: endsAt?.toISOString() ?? null });
    } catch (error) {
      if (!isStripeMissingResourceError(error)) {
        return Response.json(
          {
            ok: false,
            message:
              error instanceof Error
                ? error.message
                : "Impossibile disattivare l'abbonamento Stripe.",
          },
          { status: 500 }
        );
      }
      // Gone on Stripe already: nothing left to run out, closed below.
    }
  }

  // Unpaid or without a Stripe subscription: nothing paid ahead, it ends now.
  if (subscription.stripeSubscriptionId) {
    try {
      await cancelStripeSubscriptionSafely(subscription.stripeSubscriptionId);
    } catch (error) {
      return Response.json(
        {
          ok: false,
          message:
            error instanceof Error
              ? error.message
              : "Impossibile disattivare l'abbonamento Stripe.",
        },
        { status: 500 }
      );
    }
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      planType: PlanType.PAID,
      status: SubscriptionStatus.CANCELED,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEndsAt: null,
    },
  });

  invalidateBillingStatusCache(activeBar.id);

  return Response.json({ ok: true, endsAt: null });
}
