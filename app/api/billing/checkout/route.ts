import { BillingInterval, PlanType, Role, SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";
import { getSession } from "@/lib/auth";
import { invalidateBillingStatusCache } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { requireStripe } from "@/lib/stripe";

type CheckoutBody = {
  interval?: "MONTHLY" | "YEARLY";
};

function getRequiredAppUrl() {
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");

  if (!appUrl) {
    throw new Error("Missing APP_URL environment variable.");
  }

  return appUrl;
}

function getPriceId(interval: BillingInterval) {
  if (interval === BillingInterval.MONTHLY) {
    const priceId = process.env.STRIPE_PRICE_MONTHLY?.trim();

    if (!priceId) {
      throw new Error("Missing STRIPE_PRICE_MONTHLY environment variable.");
    }

    return priceId;
  }

  const priceId = process.env.STRIPE_PRICE_YEARLY?.trim();

  if (!priceId) {
    throw new Error("Missing STRIPE_PRICE_YEARLY environment variable.");
  }

  return priceId;
}

function normalizeDiscountPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

async function ensureMonthlyDiscountCoupon(input: {
  stripe: Stripe;
  barId: string;
  currentCouponId: string | null;
  monthlyDiscountPercent: number;
}) {
  const percent = normalizeDiscountPercent(input.monthlyDiscountPercent);

  if (percent <= 0) {
    return null;
  }

  if (input.currentCouponId) {
    return input.currentCouponId;
  }

  const coupon = await input.stripe.coupons.create({
    percent_off: percent,
    duration: "forever",
    name: `Workbit sconto mensile ${percent}%`,
    metadata: {
      barId: input.barId,
      kind: "MONTHLY_DISCOUNT",
    },
  });

  await prisma.subscription.updateMany({
    where: {
      barId: input.barId,
    },
    data: {
      stripeDiscountCouponId: coupon.id,
    },
  });
  invalidateBillingStatusCache(input.barId);

  return coupon.id;
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

  let stripe;

  try {
    stripe = requireStripe();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Missing STRIPE_SECRET_KEY environment variable.",
      },
      { status: 500 }
    );
  }

  let priceId: string;

  try {
    priceId = getPriceId(interval);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Missing Stripe price configuration.",
      },
      { status: 500 }
    );
  }

  let baseUrl: string;

  try {
    baseUrl = getRequiredAppUrl();
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Missing APP_URL environment variable.",
      },
      { status: 500 }
    );
  }

  const [bar, subscription] = await Promise.all([
    prisma.bar.findUnique({
      where: { id: activeBar.id },
      select: {
        id: true,
        name: true,
        email: true,
        legalName: true,
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
        monthlyDiscountPercent: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        stripeDiscountCouponId: true,
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
      email: bar.email || bar.owner.email,
      name: bar.legalName?.trim() || bar.name,
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
        monthlyDiscountPercent: subscription?.monthlyDiscountPercent ?? 0,
        stripeDiscountCouponId: subscription?.stripeDiscountCouponId ?? null,
        planType: pendingTrialSetup ? PlanType.TRIAL : PlanType.PAID,
        status: pendingTrialSetup ? SubscriptionStatus.TRIALING : SubscriptionStatus.INACTIVE,
        trialEndsAt: pendingTrialSetup ? subscription?.trialEndsAt ?? null : null,
      },
    });
    invalidateBillingStatusCache(bar.id);
  } else {
    await prisma.subscription.updateMany({
      where: { barId: bar.id },
      data: {
        billingInterval: interval,
      },
    });
    invalidateBillingStatusCache(bar.id);
  }

  const monthlyDiscountPercent = normalizeDiscountPercent(subscription?.monthlyDiscountPercent);
  const monthlyCouponId =
    interval === BillingInterval.MONTHLY
      ? await ensureMonthlyDiscountCoupon({
          stripe,
          barId: bar.id,
          currentCouponId: subscription?.stripeDiscountCouponId ?? null,
          monthlyDiscountPercent,
        })
      : null;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: bar.id,
    payment_method_collection: "always",
    billing_address_collection: "required",
    phone_number_collection: {
      enabled: true,
    },
    tax_id_collection: {
      enabled: true,
    },
    customer_update: {
      name: "auto",
      address: "auto",
    },
    payment_method_types: ["card", "sepa_debit"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    ...(monthlyCouponId
      ? {
          discounts: [
            {
              coupon: monthlyCouponId,
            },
          ],
        }
      : {}),
    metadata: {
      barId: bar.id,
      ownerId: bar.owner.id,
      interval,
      monthlyDiscountPercent: String(monthlyDiscountPercent),
      checkoutKind: pendingTrialSetup ? "TRIAL_SETUP" : "PAID_START",
    },
    subscription_data: {
      metadata: {
        barId: bar.id,
        ownerId: bar.owner.id,
        interval,
        monthlyDiscountPercent: String(monthlyDiscountPercent),
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
    success_url: `${baseUrl}/dashboard/settings?billing=1`,
    cancel_url: `${baseUrl}/dashboard/settings?billing=1`,
  });

  return Response.json({
    ok: true,
    url: checkoutSession.url,
  });
}
