/**
 * Creates Workbit's products and prices on Stripe, from lib/stripe-catalog.ts,
 * so what Stripe sells is exactly what the app shows. Safe to run again: a
 * price whose lookup key already exists with the same amount is left alone.
 *
 *   npx tsx scripts/stripe-catalog-setup.ts            (test mode key only)
 *   npx tsx scripts/stripe-catalog-setup.ts --live     (allows an sk_live_ key)
 *
 * The key comes from STRIPE_SECRET_KEY. See docs/stripe-setup.md.
 */
import Stripe from "stripe";
import { lookupKey, PRICE_CENTS, PRICE_NAMES, type CatalogInterval, type PriceKind } from "../lib/stripe-catalog";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) throw new Error("STRIPE_SECRET_KEY non impostata.");
const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
if (live && !process.argv.includes("--live")) {
  throw new Error("È una chiave live: rilancia con --live se è voluto.");
}

const stripe = new Stripe(key);
const intervals: CatalogInterval[] = ["MONTHLY", "YEARLY"];

async function productFor(kind: PriceKind) {
  // The product of a price already there: Stripe's product search lags behind
  // by a minute or so, and would make a second product on a quick re-run.
  const priced = (await stripe.prices.list({ lookup_keys: intervals.map((interval) => lookupKey(kind, interval)), limit: 2 })).data[0];
  if (priced) return stripe.products.retrieve(String(priced.product));
  const found = await stripe.products.search({ query: `metadata['workbit_kind']:'${kind}'` });
  const existing = found.data.find((product) => product.active) ?? found.data[0];
  if (existing) {
    if (!existing.active || existing.name !== PRICE_NAMES[kind]) {
      return stripe.products.update(existing.id, { active: true, name: PRICE_NAMES[kind] });
    }
    return existing;
  }
  return stripe.products.create({ name: PRICE_NAMES[kind], metadata: { workbit_kind: kind } });
}

async function main() {
  console.log(`Stripe ${live ? "LIVE" : "test"}`);
  for (const kind of Object.keys(PRICE_CENTS) as PriceKind[]) {
    const product = await productFor(kind);
    for (const interval of intervals) {
      const lookup = lookupKey(kind, interval);
      const amount = PRICE_CENTS[kind][interval];
      const existing = (await stripe.prices.list({ lookup_keys: [lookup], limit: 1 })).data[0];
      if (existing && existing.unit_amount === amount && existing.currency === "eur" && existing.product === product.id) {
        console.log(`  = ${lookup} ${(amount / 100).toFixed(2)} € (già presente)`);
        continue;
      }
      // A new amount is a new price: the lookup key moves to it, and
      // subscriptions already on the old price keep paying the old amount.
      await stripe.prices.create({
        product: product.id,
        currency: "eur",
        unit_amount: amount,
        recurring: { interval: interval === "MONTHLY" ? "month" : "year" },
        tax_behavior: "unspecified",
        lookup_key: lookup,
        transfer_lookup_key: true,
        nickname: `${PRICE_NAMES[kind]} · ${interval === "MONTHLY" ? "mensile" : "annuale"}`,
      });
      if (existing) await stripe.prices.update(existing.id, { active: false });
      console.log(`  + ${lookup} ${(amount / 100).toFixed(2)} €${existing ? " (sostituito)" : ""}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
