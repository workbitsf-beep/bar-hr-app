/**
 * What a venue buys on Stripe, and how Stripe's prices are found.
 *
 * Every price on Stripe carries a lookup key - workbit_base_monthly,
 * workbit_sede_yearly - so the code finds it by name and nobody copies
 * twelve price ids into Railway. A subscription is one plan item (Base or
 * Pro) plus the extras, each with a quantity: packs of five people and a
 * company's sites are counted, the rest are on or off. The webhook reads the
 * same keys back to set the venue's plan, so Stripe is what the venue has.
 *
 * Pure: no Stripe client, no database. The rules mirror lib/plans.ts.
 */

// The same limits as lib/plans.ts, which reads the database and so cannot
// reach the page where the owner picks a plan; tests/stripe-catalog keeps
// the two in step.
export const CATALOG_LIMITS = {
  maxSeatPacks: 2,
  paidSitesOnBase: 3,
  sitesIncludedInPro: 3,
  restaurantSitesIncludedInPro: 2,
  sitesOnPro: 6,
} as const;
const { maxSeatPacks: MAX_SEAT_PACKS, paidSitesOnBase: PAID_SITES_ON_BASE, sitesIncludedInPro: SITES_INCLUDED_IN_PRO, sitesOnPro: SITES_ON_PRO } =
  CATALOG_LIMITS;

export type CatalogInterval = "MONTHLY" | "YEARLY";
export type PriceKind = "base" | "pro" | "reparti" | "persone5" | "stile" | "sede";

export const PRICE_KINDS: PriceKind[] = ["base", "pro", "reparti", "persone5", "stile", "sede"];

/** Prices without VAT, in cents: what the summary adds up before Stripe. */
export const PRICE_CENTS: Record<PriceKind, Record<CatalogInterval, number>> = {
  base: { MONTHLY: 2999, YEARLY: 29900 },
  pro: { MONTHLY: 5999, YEARLY: 59900 },
  reparti: { MONTHLY: 799, YEARLY: 7900 },
  persone5: { MONTHLY: 699, YEARLY: 6900 },
  stile: { MONTHLY: 299, YEARLY: 2900 },
  sede: { MONTHLY: 799, YEARLY: 7900 },
};

export const PRICE_NAMES: Record<PriceKind, string> = {
  base: "Workbit Base",
  pro: "Workbit Pro",
  reparti: "Reparti",
  persone5: "+5 persone",
  stile: "Il tuo stile",
  sede: "Sede in più",
};

export function lookupKey(kind: PriceKind, interval: CatalogInterval) {
  return `workbit_${kind}_${interval === "MONTHLY" ? "monthly" : "yearly"}`;
}

export function parseLookupKey(key: string | null | undefined): { kind: PriceKind; interval: CatalogInterval } | null {
  const match = /^workbit_([a-z0-9]+)_(monthly|yearly)$/.exec(String(key ?? ""));
  if (!match || !(PRICE_KINDS as string[]).includes(match[1])) return null;
  return { kind: match[1] as PriceKind, interval: match[2] === "monthly" ? "MONTHLY" : "YEARLY" };
}

export type PlanSelection = {
  plan: "BASE" | "PRO";
  /** Reparti, for a restaurant on Base. */
  departments: boolean;
  /** Packs of five more people. */
  seatPacks: number;
  /** Logo and sign font, on Base. */
  branding: boolean;
  /** Paid sites on top of the main one (Base) or those the Pro includes: a company's, or a restaurant's branches. */
  extraSites: number;
};

const whole = (value: unknown, max: number) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.max(0, Math.min(max, number)) : 0;
};

/** Only what the venue's kind and plan can buy; everything else falls away. */
export function normalizeSelection(input: Partial<Record<keyof PlanSelection, unknown>>, company: boolean): PlanSelection {
  const plan = input.plan === "PRO" ? "PRO" : "BASE";
  const pro = plan === "PRO";
  return {
    plan,
    // A restaurant's Reparti, bought once, covers every branch.
    departments: !company && !pro && input.departments === true,
    // A restaurant's Pro has no limit on people.
    seatPacks: !company && pro ? 0 : whole(input.seatPacks, MAX_SEAT_PACKS),
    branding: !pro && input.branding === true,
    // Paid sites: a company's, or a restaurant's branches (2 in its Pro).
    extraSites: whole(
      input.extraSites,
      pro ? SITES_ON_PRO - (company ? SITES_INCLUDED_IN_PRO : CATALOG_LIMITS.restaurantSitesIncludedInPro) : PAID_SITES_ON_BASE
    ),
  };
}

/** The subscription's items for a selection: the plan, then each extra bought. */
export function selectionItems(selection: PlanSelection): Array<{ kind: PriceKind; quantity: number }> {
  const items: Array<{ kind: PriceKind; quantity: number }> = [{ kind: selection.plan === "PRO" ? "pro" : "base", quantity: 1 }];
  if (selection.departments) items.push({ kind: "reparti", quantity: 1 });
  if (selection.seatPacks > 0) items.push({ kind: "persone5", quantity: selection.seatPacks });
  if (selection.branding) items.push({ kind: "stile", quantity: 1 });
  if (selection.extraSites > 0) items.push({ kind: "sede", quantity: selection.extraSites });
  return items;
}

export function selectionTotalCents(selection: PlanSelection, interval: CatalogInterval) {
  return selectionItems(selection).reduce((sum, item) => sum + PRICE_CENTS[item.kind][interval] * item.quantity, 0);
}

/**
 * Back from Stripe: the items of a subscription, by lookup key, as the
 * venue's plan. Null when no Base or Pro item is there - a subscription from
 * before the catalog, which the venue keeps as it was set by hand.
 */
export function selectionFromItems(
  items: Array<{ lookupKey: string | null | undefined; quantity: number | null | undefined }>
): { selection: PlanSelection; interval: CatalogInterval } | null {
  let plan: PlanSelection["plan"] | null = null;
  let interval: CatalogInterval | null = null;
  const selection: PlanSelection = { plan: "BASE", departments: false, seatPacks: 0, branding: false, extraSites: 0 };

  for (const item of items) {
    const parsed = parseLookupKey(item.lookupKey);
    if (!parsed) continue;
    const quantity = Math.max(0, Math.round(item.quantity ?? 1));
    interval ??= parsed.interval;
    switch (parsed.kind) {
      case "base":
        plan ??= "BASE";
        break;
      case "pro":
        plan = "PRO";
        break;
      case "reparti":
        selection.departments = quantity > 0;
        break;
      case "persone5":
        selection.seatPacks += quantity;
        break;
      case "stile":
        selection.branding = quantity > 0;
        break;
      case "sede":
        selection.extraSites += quantity;
        break;
    }
  }

  if (!plan || !interval) return null;
  return { selection: { ...selection, plan }, interval };
}

export function formatEuro(cents: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
}
