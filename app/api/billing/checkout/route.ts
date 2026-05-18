import { BillingInterval, PlanType, Role, SubscriptionStatus } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { requireStripe } from "@/lib/stripe";

type CheckoutBody = {
  interval?: "MONTHLY" | "YEARLY";
};

function getPriceId(interval: BillingInterval) {
  if (interval === BillingInterval.MONTHLY) {
    return process.env.STRIPE_PRICE_MONTHLY || "";
  }

  return process.env.STRIPE_PRICE_YEARLY || "";
}

export async function POST(req: Request) {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (role !== Role.OWNER || !activeBar?.id) {
    return Response.json({ ok: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CheckoutBody | null;
  const interval =
    body?.interval === BillingInterval.YEARLY
      ? BillingInterval.YEARLY
      : body?.interval === BillingInterval.MONTHLY
        ? BillingInterval.MONTHLY
        : null;

  if (!interval) {
    return Response.json({ ok: false, message: "Invalid interval" }, { status: 400 });
  }

  const priceId = getPriceId(interval);

  if (!priceId) {
    return Response.json(
      { ok: false, message: "Missing Stripe price configuration" },
      { status: 500 }
    );
  }

  const stripe = requireStripe();
  const [bar, subscription] = await Promise.all([
    prisma.bar.findUnique({
      where: { id: activeBar.id },
      select: {
        id: true,
        name: true,
        email: true,
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.subscription.findUnique({
      where: { barId: activeBar.id },
      select: {
        planType: true,
        status: true,
        billingInterval: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        trialEndsAt: true,
      },
    }),
  ]);

  if (!bar) {
    return Response.json({ ok: false, message: "Bar not found" }, { status: 404 });
  }

  const pendingTrialSetup = Boolean(
    subscription?.planType === PlanType.TRIAL &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt.getTime() > Date.now() &&
      !subscription.stripeSubscriptionId
  );

  let stripeCustomerId = subscription?.stripeCustomerId ?? null;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: bar.owner.email,
      name: `${bar.owner.firstName} ${bar.owner.lastName}`.trim(),
      metadata: {
        barId: bar.id,
        ownerId: bar.owner.id,
      },
    });

    stripeCustomerId = customer.id;

    await prisma.subscription.upsert({
      where: { barId: bar.id },
      update: {
        stripeCustomerId,
        billingInterval: interval,
      },
      create: {
        barId: bar.id,
        stripeCustomerId,
        billingInterval: interval,
        planType: pendingTrialSetup ? PlanType.TRIAL : PlanType.PAID,
        status: pendingTrialSetup ? SubscriptionStatus.TRIALING : SubscriptionStatus.INACTIVE,
        trialEndsAt: pendingTrialSetup ? subscription?.trialEndsAt ?? null : null,
      },
    });
  } else {
    await prisma.subscription.updateMany({
      where: { barId: bar.id },
      data: {
        billingInterval: interval,
      },
    });
  }

  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: bar.id,
    payment_method_collection: "always",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      barId: bar.id,
      ownerId: bar.owner.id,
      interval,
      checkoutKind: pendingTrialSetup ? "TRIAL_SETUP" : "PAID_START",
    },
    subscription_data: {
      metadata: {
        barId: bar.id,
        ownerId: bar.owner.id,
        interval,
        checkoutKind: pendingTrialSetup ? "TRIAL_SETUP" : "PAID_START",
      },
      ...(pendingTrialSetup && subscription?.trialEndsAt
        ? {
            trial_end: Math.floor(subscription.trialEndsAt.getTime() / 1000),
            trial_settings: {
              end_behavior: {
                missing_payment_method: "cancel",
              },
            },
          }
        : {}),
    },
    success_url: `${baseUrl}/billing/success`,
    cancel_url: `${baseUrl}/billing`,
  });

  return Response.json({
    ok: true,
    url: checkoutSession.url,
  });
}
