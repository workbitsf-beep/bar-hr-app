import { PlanType, Role, SubscriptionStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { invalidateBillingStatusCache } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { cancelStripeSubscriptionSafely } from "@/lib/stripe";

export async function POST() {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (role !== Role.OWNER || !activeBar?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { barId: activeBar.id },
    select: {
      id: true,
      planType: true,
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
      currentPeriodEnd: null,
      trialEndsAt: null,
    },
  });

  invalidateBillingStatusCache(activeBar.id);

  return Response.json({ ok: true });
}
