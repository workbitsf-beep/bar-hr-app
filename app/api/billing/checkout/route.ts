import { BillingInterval, PlanType, Role, SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";
import { getSession } from "@/lib/auth";
import { invalidateBillingStatusCache } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { requireStripe } from "@/lib/stripe";
import { normalizeSelection, type PlanSelection } from "@/lib/stripe-catalog";
import {
  LIVE_STATUSES,
  MissingPriceError,
  SAME_VAT_DISCOUNT_PERCENT,
  applyPlanFromSubscription,
  ensureCustomerVat,
  ensureSameVatCoupon,
  hasPayingVatSibling,
  lineItemsFor,
} from "@/lib/stripe-plan-billing";
import { isValidItalianVat, normalizeItalianVat } from "@/lib/vat-number";

type CheckoutBody = {
  interval?: "MONTHLY" | "YEARLY";
  /** Base or Pro and the extras; checked against what the venue may buy. */
  selection?: Partial<Record<keyof PlanSelection, unknown>>;
  vatNumber?: string;
};

function getRequiredAppUrl() {
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");

  if (!appUrl) {
    throw new Error("Missing APP_URL environment variable.");
  }

  return appUrl;
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
    return Response.json({ ok: false, message: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (role !== Role.OWNER || !activeBar?.id) {
    return Response.json({ ok: false, message: "Sessione scaduta. Accedi di nuovo." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CheckoutBody | null;
  const interval =
    body?.interval === BillingInterval.YEARLY
      ? BillingInterval.YEARLY
      : body?.interval === BillingInterval.MONTHLY
        ? BillingInterval.MONTHLY
        : null;

  if (!interval) {
    return Response.json({ ok: false, message: "Periodo non valido." }, { status: 400 });
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
        ownerId: true,
        createdAt: true,
        activityType: true,
        restaurantSites: true,
        plan: true,
        vatNumber: true,
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
    return Response.json({ ok: false, message: "Locale non trovato." }, { status: 404 });
  }

  if (subscription?.planType === PlanType.FREE || subscription?.planType === PlanType.LIFETIME) {
    return Response.json(
      { ok: false, message: "Il piano di questo locale è gestito da Workbit: non c'è niente da pagare." },
      { status: 400 }
    );
  }

  if (bar.plan === "CUSTOM") {
    return Response.json(
      { ok: false, message: "Il piano su misura si gestisce con Workbit: scrivici per cambiarlo." },
      { status: 400 }
    );
  }

  const selection = normalizeSelection(body?.selection ?? {}, bar.activityType === "COMPANY", bar.restaurantSites);

  // The VAT number decides the invoice and the discount: asked here when the
  // venue does not have one yet, and kept on the venue.
  const vat = normalizeItalianVat(body?.vatNumber ?? bar.vatNumber);
  if (!vat || !isValidItalianVat(vat)) {
    return Response.json(
      { ok: false, message: "Scrivi la partita IVA dell'attività: 11 cifre, senza IT davanti." },
      { status: 400 }
    );
  }
  if (bar.vatNumber?.replace(/^IT/, "") !== vat) {
    await prisma.bar.update({ where: { id: bar.id }, data: { vatNumber: vat } });
  }

  let lineItems: Awaited<ReturnType<typeof lineItemsFor>>;
  try {
    lineItems = await lineItemsFor(stripe, selection, interval);
  } catch (error) {
    console.error("[billing] prices not found on Stripe", error);
    return Response.json(
      {
        ok: false,
        message:
          error instanceof MissingPriceError
            ? "Il pagamento non è ancora pronto: alcuni prezzi non sono su Stripe. Riprova più tardi o scrivici."
            : "Stripe non risponde in questo momento. Riprova tra poco.",
      },
      { status: 503 }
    );
  }

  const sameVatDiscount = await hasPayingVatSibling(bar.id, vat);

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

  await ensureCustomerVat(stripe, stripeCustomerId, vat);

  const monthlyDiscountPercent = normalizeDiscountPercent(subscription?.monthlyDiscountPercent);

  // Already paying: the subscription changes in place, with Stripe working
  // out the difference, instead of a second one being bought.
  if (subscription?.stripeSubscriptionId && LIVE_STATUSES.includes(subscription.status)) {
    const current = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const remaining = new Map(lineItems.map((item) => [item.kind, item]));
    const items: Stripe.SubscriptionUpdateParams.Item[] = [];
    for (const existing of current.items.data) {
      const kind = existing.price.lookup_key?.replace(/^workbit_/, "").replace(/_(monthly|yearly)$/, "");
      const wanted = kind ? remaining.get(kind as (typeof lineItems)[number]["kind"]) : undefined;
      if (wanted) {
        items.push({ id: existing.id, price: wanted.price, quantity: wanted.quantity });
        remaining.delete(wanted.kind);
      } else {
        items.push({ id: existing.id, deleted: true });
      }
    }
    for (const item of remaining.values()) items.push({ price: item.price, quantity: item.quantity });

    const couponForUpdate =
      sameVatDiscount && !current.discounts?.length && monthlyDiscountPercent <= 0 ? await ensureSameVatCoupon(stripe) : null;
    const updated = await stripe.subscriptions.update(current.id, {
      items,
      proration_behavior: "create_prorations",
      ...(couponForUpdate ? { discounts: [{ coupon: couponForUpdate }] } : {}),
      metadata: { ...current.metadata, barId: bar.id, interval },
    });
    await prisma.subscription.updateMany({ where: { barId: bar.id }, data: { billingInterval: interval } });
    await applyPlanFromSubscription(bar.id, updated);
    invalidateBillingStatusCache(bar.id);

    return Response.json({
      ok: true,
      updated: true,
      message: "Abbonamento aggiornato. La differenza la trovi nella prossima fattura.",
    });
  }
  const monthlyCouponId =
    interval === BillingInterval.MONTHLY
      ? await ensureMonthlyDiscountCoupon({
          stripe,
          barId: bar.id,
          currentCouponId: subscription?.stripeDiscountCouponId ?? null,
          monthlyDiscountPercent,
        })
      : null;
  // A discount set by hand in the console wins; otherwise a second business
  // on the same VAT number gets its 10%.
  const sameVatCouponId = !monthlyCouponId && sameVatDiscount ? await ensureSameVatCoupon(stripe) : null;
  const couponId = monthlyCouponId ?? sameVatCouponId;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    client_reference_id: bar.id,
    payment_method_collection: "always",
    billing_address_collection: "required",
    phone_number_collection: {
      enabled: true,
    },
    // Workbit invoices businesses, so the VAT number is not optional. It was:
    // someone could pay without one, and the webhook then held the venue as
    // inactive. "if_supported" makes Checkout ask for it wherever Stripe can.
    tax_id_collection: {
      enabled: true,
      required: "if_supported",
    },
    customer_update: {
      name: "auto",
      address: "auto",
    },
    // For the electronic invoice: where the SDI delivers it.
    custom_fields: [
      {
        key: "sdi",
        label: { type: "custom", custom: "Codice destinatario SDI o PEC" },
        type: "text",
        optional: true,
        text: { minimum_length: 7, maximum_length: 120 },
      },
    ],
    payment_method_types: ["card", "sepa_debit"],
    line_items: lineItems.map((item) => ({ price: item.price, quantity: item.quantity })),
    ...(couponId
      ? {
          discounts: [
            {
              coupon: couponId,
            },
          ],
        }
      : {}),
    metadata: {
      barId: bar.id,
      ownerId: bar.owner.id,
      interval,
      monthlyDiscountPercent: String(monthlyDiscountPercent),
      sameVatDiscount: sameVatCouponId ? String(SAME_VAT_DISCOUNT_PERCENT) : "0",
      selection: JSON.stringify(selection),
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
