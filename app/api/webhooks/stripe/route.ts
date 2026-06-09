import {
  BillingInterval,
  PlanType,
  SubscriptionStatus,
} from "@prisma/client";
import type Stripe from "stripe";
import { invalidateBillingStatusCache } from "@/lib/billing";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireStripe } from "@/lib/stripe";

function mapStripeStatus(status: string | null | undefined) {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    default:
      return SubscriptionStatus.INACTIVE;
  }
}

function mapInterval(interval: string | null | undefined) {
  if (interval === "year" || interval === BillingInterval.YEARLY) {
    return BillingInterval.YEARLY;
  }

  if (interval === "month" || interval === BillingInterval.MONTHLY) {
    return BillingInterval.MONTHLY;
  }

  return null;
}

function toDateFromUnix(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription | null | undefined) {
  const timestamps =
    subscription?.items.data
      .map((item) => item.current_period_end)
      .filter((value): value is number => typeof value === "number") ?? [];

  if (timestamps.length === 0) {
    return null;
  }

  return toDateFromUnix(Math.min(...timestamps));
}

async function sendOwnerBillingEmail(input: {
  barId: string;
  kind: "failed" | "activated" | "canceled";
}) {
  try {
    const bar = await prisma.bar.findUnique({
      where: { id: input.barId },
      select: {
        name: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!bar) {
      return;
    }

    const ownerName = `${bar.owner.firstName} ${bar.owner.lastName}`.trim();
    const notification =
      input.kind === "failed"
        ? {
            title: "Pagamento fallito",
            message: `Ciao ${ownerName},\nIl pagamento dell'abbonamento per ${bar.name} non è andato a buon fine. Controlla il metodo di pagamento o rinnova l'abbonamento.`,
            type: INTERNAL_NOTIFICATION_TYPES.BILLING_PAST_DUE,
          }
        : input.kind === "canceled"
          ? {
              title: "Abbonamento cancellato",
              message: `Ciao ${ownerName},\nL'abbonamento del locale ${bar.name} è stato cancellato o disattivato.`,
              type: INTERNAL_NOTIFICATION_TYPES.BILLING_CANCELED,
            }
          : {
              title: "Abbonamento attivo",
              message: `Ciao ${ownerName},\nL'abbonamento del locale ${bar.name} è ora attivo.`,
              type: INTERNAL_NOTIFICATION_TYPES.BILLING_ACTIVE,
            };

    await notifyUsers([bar.owner.id], {
      barId: input.barId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      actionUrl: "/billing",
    });
  } catch (error) {
    console.error("[stripe-webhook] Failed to send billing notification.", error);
  }
}

async function upsertSubscriptionFromStripe(input: {
  barId: string;
  planType?: PlanType;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  status?: SubscriptionStatus;
  billingInterval?: BillingInterval | null;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
}) {
  await prisma.subscription.upsert({
    where: { barId: input.barId },
    update: {
      planType: input.planType ?? PlanType.PAID,
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
      stripePriceId: input.stripePriceId ?? undefined,
      status: input.status ?? undefined,
      billingInterval:
        input.billingInterval === undefined ? undefined : input.billingInterval,
      currentPeriodEnd:
        input.currentPeriodEnd === undefined ? undefined : input.currentPeriodEnd,
      trialEndsAt: input.trialEndsAt === undefined ? undefined : input.trialEndsAt,
    },
    create: {
      barId: input.barId,
      planType: input.planType ?? PlanType.PAID,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
      stripePriceId: input.stripePriceId ?? null,
      status: input.status ?? SubscriptionStatus.INACTIVE,
      billingInterval:
        input.billingInterval === undefined ? null : input.billingInterval,
      currentPeriodEnd:
        input.currentPeriodEnd === undefined ? null : input.currentPeriodEnd,
      trialEndsAt: input.trialEndsAt === undefined ? null : input.trialEndsAt,
    },
  });

  invalidateBillingStatusCache(input.barId);
}

async function getLocalSubscriptionStatus(barId: string) {
  return prisma.subscription.findUnique({
    where: { barId },
    select: {
      planType: true,
      status: true,
    },
  });
}

async function customerHasTaxId(stripe: Stripe, customerId: string | null) {
  if (!customerId) {
    return false;
  }

  try {
    const taxIds = await stripe.customers.listTaxIds(customerId, { limit: 1 });
    return taxIds.data.length > 0;
  } catch (error) {
    console.error("[stripe-webhook] Failed to inspect customer tax IDs.", {
      customerId,
      error,
    });
    return false;
  }
}

async function findBarIdForSubscription(input: {
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  metadataBarId?: string | null;
}) {
  if (input.metadataBarId) {
    return input.metadataBarId;
  }

  const conditions = [
    input.stripeSubscriptionId
      ? { stripeSubscriptionId: input.stripeSubscriptionId }
      : null,
    input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : null,
  ].filter(Boolean) as Array<{ stripeSubscriptionId?: string; stripeCustomerId?: string }>;

  if (conditions.length === 0) {
    return null;
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      OR: conditions,
    },
    select: {
      barId: true,
    },
  });

  return subscription?.barId ?? null;
}

export async function POST(req: Request) {
  const stripe = requireStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return Response.json(
      { ok: false, message: "Missing STRIPE_WEBHOOK_SECRET" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ ok: false, message: "Missing signature" }, { status: 400 });
  }

  const payload = await req.text();

  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Invalid signature",
      },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadataBarId = session.metadata?.barId ?? null;
        const stripeSubscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const interval = mapInterval(session.metadata?.interval);

        if (!metadataBarId) {
          break;
        }

        let subscriptionDetails = null;

        if (stripeSubscriptionId) {
          subscriptionDetails =
            (await stripe.subscriptions.retrieve(
              stripeSubscriptionId
            )) as unknown as Stripe.Subscription;
        }

        const previous = await getLocalSubscriptionStatus(metadataBarId);
        const nextStatus = subscriptionDetails
          ? mapStripeStatus(subscriptionDetails.status)
          : SubscriptionStatus.ACTIVE;
        const hasTaxId = await customerHasTaxId(stripe, stripeCustomerId);

        if (!hasTaxId) {
          console.warn("[stripe-webhook] Missing tax id after checkout.", {
            barId: metadataBarId,
            stripeCustomerId,
            stripeSubscriptionId,
          });
        }

        await upsertSubscriptionFromStripe({
          barId: metadataBarId,
          planType:
            nextStatus === SubscriptionStatus.TRIALING &&
            previous?.planType === PlanType.TRIAL
              ? PlanType.TRIAL
              : PlanType.PAID,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId:
            subscriptionDetails?.items.data[0]?.price.id ??
            (typeof session.line_items === "object"
              ? session.line_items?.data?.[0]?.price?.id ?? null
              : null),
          status: hasTaxId ? nextStatus : SubscriptionStatus.INACTIVE,
          billingInterval:
            interval ?? mapInterval(subscriptionDetails?.items.data[0]?.price.recurring?.interval),
          currentPeriodEnd: getSubscriptionPeriodEnd(subscriptionDetails),
          trialEndsAt: toDateFromUnix(subscriptionDetails?.trial_end),
        });

        if (hasTaxId && previous?.status !== SubscriptionStatus.ACTIVE) {
          await sendOwnerBillingEmail({
            barId: metadataBarId,
            kind: "activated",
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const barId = await findBarIdForSubscription({
          stripeSubscriptionId: subscription.id,
          stripeCustomerId:
            typeof subscription.customer === "string" ? subscription.customer : null,
          metadataBarId: subscription.metadata?.barId ?? null,
        });

        if (!barId) {
          break;
        }

        const previous = await getLocalSubscriptionStatus(barId);
        const nextStatus = mapStripeStatus(subscription.status);
        const stripeCustomerId =
          typeof subscription.customer === "string" ? subscription.customer : null;
        const hasTaxId = await customerHasTaxId(stripe, stripeCustomerId);

        if (!hasTaxId) {
          console.warn("[stripe-webhook] Missing tax id on subscription update.", {
            barId,
            stripeCustomerId,
            stripeSubscriptionId: subscription.id,
          });
        }

        await upsertSubscriptionFromStripe({
          barId,
          planType:
            nextStatus === SubscriptionStatus.TRIALING &&
            previous?.planType === PlanType.TRIAL
              ? PlanType.TRIAL
              : PlanType.PAID,
          stripeCustomerId,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price.id ?? null,
          status: hasTaxId ? nextStatus : SubscriptionStatus.INACTIVE,
          billingInterval: mapInterval(subscription.items.data[0]?.price.recurring?.interval),
          currentPeriodEnd: getSubscriptionPeriodEnd(subscription),
          trialEndsAt: toDateFromUnix(subscription.trial_end),
        });
        if (
          event.type === "customer.subscription.created" &&
          hasTaxId &&
          previous?.status !== SubscriptionStatus.ACTIVE &&
          mapStripeStatus(subscription.status) === SubscriptionStatus.ACTIVE
        ) {
          await sendOwnerBillingEmail({
            barId,
            kind: "activated",
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const barId = await findBarIdForSubscription({
          stripeSubscriptionId: subscription.id,
          stripeCustomerId:
            typeof subscription.customer === "string" ? subscription.customer : null,
          metadataBarId: subscription.metadata?.barId ?? null,
        });

        if (!barId) {
          break;
        }

        const previous = await getLocalSubscriptionStatus(barId);
        await upsertSubscriptionFromStripe({
          barId,
          planType: previous?.planType ?? PlanType.PAID,
          stripeCustomerId:
            typeof subscription.customer === "string" ? subscription.customer : null,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price.id ?? null,
          status: SubscriptionStatus.CANCELED,
          billingInterval: mapInterval(subscription.items.data[0]?.price.recurring?.interval),
          currentPeriodEnd: null,
          trialEndsAt: null,
        });

        if (previous?.status !== SubscriptionStatus.CANCELED) {
          await sendOwnerBillingEmail({
            barId,
            kind: "canceled",
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : invoice.parent?.subscription_details?.subscription?.id ?? null;
        const stripeCustomerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        const barId = await findBarIdForSubscription({
          stripeSubscriptionId,
          stripeCustomerId,
          metadataBarId: null,
        });

        if (!barId) {
          break;
        }

        const stripeSubscription = stripeSubscriptionId
          ? ((await stripe.subscriptions.retrieve(
              stripeSubscriptionId
            )) as unknown as Stripe.Subscription)
          : null;

        const previous = await getLocalSubscriptionStatus(barId);
        const hasTaxId = await customerHasTaxId(stripe, stripeCustomerId);

        if (!hasTaxId) {
          console.warn("[stripe-webhook] Missing tax id on paid invoice.", {
            barId,
            stripeCustomerId,
            stripeSubscriptionId,
          });
        }

        await upsertSubscriptionFromStripe({
          barId,
          planType: PlanType.PAID,
          stripeCustomerId,
          stripeSubscriptionId,
          stripePriceId: stripeSubscription?.items.data[0]?.price.id ?? null,
          status: hasTaxId ? SubscriptionStatus.ACTIVE : SubscriptionStatus.INACTIVE,
          billingInterval: mapInterval(
            stripeSubscription?.items.data[0]?.price.recurring?.interval
          ),
          currentPeriodEnd: getSubscriptionPeriodEnd(stripeSubscription),
          trialEndsAt: toDateFromUnix(stripeSubscription?.trial_end),
        });

        if (hasTaxId && previous?.status !== SubscriptionStatus.ACTIVE) {
          await sendOwnerBillingEmail({
            barId,
            kind: "activated",
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : invoice.parent?.subscription_details?.subscription?.id ?? null;
        const stripeCustomerId =
          typeof invoice.customer === "string" ? invoice.customer : null;
        const barId = await findBarIdForSubscription({
          stripeSubscriptionId,
          stripeCustomerId,
          metadataBarId: null,
        });

        if (!barId) {
          break;
        }

        const previous = await getLocalSubscriptionStatus(barId);
        await prisma.subscription.updateMany({
          where: {
            barId,
          },
          data: {
            planType: PlanType.PAID,
            status: SubscriptionStatus.PAST_DUE,
          },
        });
        invalidateBillingStatusCache(barId);

        if (previous?.status !== SubscriptionStatus.PAST_DUE) {
          await sendOwnerBillingEmail({
            barId,
            kind: "failed",
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[stripe-webhook] Processing error", error);
    return Response.json({ ok: false }, { status: 500 });
  }

  return Response.json({ ok: true });
}
