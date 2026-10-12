import "server-only";

import { SubscriptionStatus, VenuePlan } from "@prisma/client";
import type Stripe from "stripe";
import { invalidateBillingStatusCache } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import {
  lookupKey,
  selectionFromItems,
  selectionItems,
  type CatalogInterval,
  type PlanSelection,
  type PriceKind,
} from "@/lib/stripe-catalog";

/**
 * The server half of the catalog: Stripe's prices by lookup key, the discount
 * for a second business on the same VAT number, and the venue's plan set from
 * what its subscription holds.
 */

/** A subscription that is still being paid for: changed in place, never bought twice. */
export const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
  SubscriptionStatus.PAST_DUE,
];

export class MissingPriceError extends Error {
  constructor(public keys: string[]) {
    super(`Su Stripe manca il prezzo con codice ${keys.join(", ")}.`);
    this.name = "MissingPriceError";
  }
}

/** Stripe price ids for the selection's items, found by lookup key. */
export async function resolvePriceIds(stripe: Stripe, interval: CatalogInterval, kinds: PriceKind[]) {
  const keys = Array.from(new Set(kinds.map((kind) => lookupKey(kind, interval))));
  const prices = await stripe.prices.list({ lookup_keys: keys, active: true, limit: 100 });
  const byKey = new Map(prices.data.map((price) => [price.lookup_key, price.id]));
  const missing = keys.filter((key) => !byKey.has(key));
  if (missing.length) throw new MissingPriceError(missing);
  return new Map(kinds.map((kind) => [kind, byKey.get(lookupKey(kind, interval)) as string]));
}

export async function lineItemsFor(stripe: Stripe, selection: PlanSelection, interval: CatalogInterval) {
  const items = selectionItems(selection);
  const ids = await resolvePriceIds(stripe, interval, items.map((item) => item.kind));
  return items.map((item) => ({ kind: item.kind, price: ids.get(item.kind) as string, quantity: item.quantity }));
}

/**
 * 10% off, for good, from the second business on the same VAT number: the
 * first one to subscribe pays in full, every other one with that VAT number
 * gets the coupon by itself. Tied to the VAT number, not to the owner's
 * account, because one person may run two separate companies.
 */
export const SAME_VAT_DISCOUNT_PERCENT = 10;
const SAME_VAT_COUPON_ID = "workbit-stessa-piva-10";

export function vatVariants(vat: string) {
  return [vat, `IT${vat}`];
}

/** Another venue with this VAT number already paying a subscription. */
export async function hasPayingVatSibling(barId: string, vat: string | null) {
  if (!vat) return false;
  const sibling = await prisma.bar.findFirst({
    where: {
      id: { not: barId },
      vatNumber: { in: vatVariants(vat) },
      subscription: { stripeSubscriptionId: { not: null }, status: { in: LIVE_STATUSES } },
    },
    select: { id: true },
  });
  return Boolean(sibling);
}

export async function ensureSameVatCoupon(stripe: Stripe) {
  try {
    return (await stripe.coupons.retrieve(SAME_VAT_COUPON_ID)).id;
  } catch {
    const coupon = await stripe.coupons.create({
      id: SAME_VAT_COUPON_ID,
      percent_off: SAME_VAT_DISCOUNT_PERCENT,
      duration: "forever",
      name: `Workbit stessa partita IVA ${SAME_VAT_DISCOUNT_PERCENT}%`,
      metadata: { kind: "SAME_VAT_DISCOUNT" },
    });
    return coupon.id;
  }
}

/** Puts the VAT number on the Stripe customer, so invoices carry it and Checkout does not ask again. */
export async function ensureCustomerVat(stripe: Stripe, customerId: string, vat: string) {
  try {
    const existing = await stripe.customers.listTaxIds(customerId, { limit: 10 });
    if (existing.data.some((taxId) => taxId.value.replace(/^IT/, "") === vat)) return;
    await stripe.customers.createTaxId(customerId, { type: "eu_vat", value: `IT${vat}` });
  } catch (error) {
    // Not a reason to stop a purchase: Checkout still asks for it.
    console.warn("[billing] could not attach VAT number to customer", { customerId, error });
  }
}

/**
 * The venue's plan from its subscription. Stripe is what the venue paid for,
 * so it wins over what was set by hand - except a Su misura plan, agreed
 * outside the catalog, and a subscription from before it, which carries no
 * lookup keys and leaves the venue as it was.
 */
export async function applyPlanFromSubscription(barId: string, subscription: Stripe.Subscription | null | undefined) {
  if (!subscription) return null;
  const parsed = selectionFromItems(
    subscription.items.data.map((item) => ({ lookupKey: item.price.lookup_key, quantity: item.quantity }))
  );
  if (!parsed) return null;

  const bar = await prisma.bar.findUnique({ where: { id: barId }, select: { plan: true } });
  if (!bar || bar.plan === VenuePlan.CUSTOM) return null;

  const { selection } = parsed;
  await prisma.bar.update({
    where: { id: barId },
    data: {
      plan: selection.plan === "PRO" ? VenuePlan.PRO : VenuePlan.BASE,
      departmentsAddon: selection.departments,
      extraSeatPacks: selection.seatPacks,
      brandingAddon: selection.branding,
      extraSites: selection.extraSites,
    },
  });
  invalidateBillingStatusCache(barId);
  return parsed;
}

/** What the owner's purchase page starts from. */
export async function getPurchaseContext(barId: string) {
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: {
      activityType: true,
      plan: true,
      departmentsAddon: true,
      extraSeatPacks: true,
      brandingAddon: true,
      extraSites: true,
      vatNumber: true,
      subscription: { select: { stripeSubscriptionId: true, status: true, billingInterval: true } },
    },
  });
  if (!bar) return null;

  const vat = bar.vatNumber?.replace(/^IT/, "") ?? null;
  return {
    company: bar.activityType === "COMPANY",
    custom: bar.plan === VenuePlan.CUSTOM,
    current: {
      plan: bar.plan === VenuePlan.PRO ? ("PRO" as const) : ("BASE" as const),
      departments: bar.departmentsAddon,
      seatPacks: bar.extraSeatPacks,
      branding: bar.brandingAddon,
      extraSites: bar.extraSites,
    },
    interval: (bar.subscription?.billingInterval ?? "MONTHLY") as CatalogInterval,
    live: Boolean(bar.subscription?.stripeSubscriptionId && LIVE_STATUSES.includes(bar.subscription.status)),
    vatNumber: vat,
    sameVatDiscount: await hasPayingVatSibling(barId, vat),
  };
}

export type PurchaseContext = NonNullable<Awaited<ReturnType<typeof getPurchaseContext>>>;
