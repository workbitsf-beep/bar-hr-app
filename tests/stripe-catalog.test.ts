import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_SEAT_PACKS, PAID_SITES_ON_BASE, PLAN_PRICES, RESTAURANT_SITES_IN_PRO, SITES_INCLUDED_IN_PRO, SITES_ON_PRO, entitlementsOf } from "../lib/plans";
import {
  CATALOG_LIMITS,
  PRICE_CENTS,
  lookupKey,
  normalizeSelection,
  parseLookupKey,
  selectionFromItems,
  selectionItems,
  selectionTotalCents,
} from "../lib/stripe-catalog";

test("the catalog's limits and prices match the plans", () => {
  assert.deepEqual(CATALOG_LIMITS, {
    maxSeatPacks: MAX_SEAT_PACKS,
    paidSitesOnBase: PAID_SITES_ON_BASE,
    sitesIncludedInPro: SITES_INCLUDED_IN_PRO,
    restaurantSitesIncludedInPro: RESTAURANT_SITES_IN_PRO,
    sitesOnPro: SITES_ON_PRO,
  });
  const cents = (label: string) => Math.round(Number(label.replace(/[^\d,]/g, "").replace(",", ".")) * 100);
  assert.equal(PRICE_CENTS.base.MONTHLY, cents(PLAN_PRICES.base.monthly));
  assert.equal(PRICE_CENTS.pro.YEARLY, cents(PLAN_PRICES.pro.yearly));
  assert.equal(PRICE_CENTS.sede.MONTHLY, cents(PLAN_PRICES.site.monthly));
  assert.equal(PRICE_CENTS.persone5.YEARLY, cents(PLAN_PRICES.seatPack.yearly));
  assert.equal(PRICE_CENTS.stile.MONTHLY, cents(PLAN_PRICES.branding.monthly));
  assert.equal(PRICE_CENTS.reparti.YEARLY, cents(PLAN_PRICES.departments.yearly));
});

test("lookup keys go both ways", () => {
  assert.equal(lookupKey("sede", "YEARLY"), "workbit_sede_yearly");
  assert.deepEqual(parseLookupKey("workbit_persone5_monthly"), { kind: "persone5", interval: "MONTHLY" });
  assert.equal(parseLookupKey("workbit_altro_monthly"), null);
  assert.equal(parseLookupKey(null), null);
});

test("a restaurant on Base buys only what it ticks", () => {
  const selection = normalizeSelection({ plan: "BASE", departments: true, seatPacks: 5, branding: true, extraSites: 2 }, false);
  // Branches and one Reparti for all of them.
  assert.deepEqual(selection, { plan: "BASE", departments: true, seatPacks: 2, branding: true, extraSites: 2 });
  assert.deepEqual(selectionItems(selection), [
    { kind: "base", quantity: 1 },
    { kind: "reparti", quantity: 1 },
    { kind: "persone5", quantity: 2 },
    { kind: "stile", quantity: 1 },
    { kind: "sede", quantity: 2 },
  ]);
  assert.equal(selectionTotalCents(selection, "MONTHLY"), 2999 + 799 + 2 * 699 + 299 + 2 * 799);
});

test("a restaurant's Pro includes two sites and goes up to six", () => {
  assert.equal(normalizeSelection({ plan: "PRO", extraSites: 9 }, false).extraSites, 4);
  const pro = entitlementsOf({ plan: "PRO", departmentsAddon: false, extraSeatPacks: 0, brandingAddon: false, activityType: "RESTAURANT", extraSites: 1 });
  assert.equal(pro.siteLimit, 3);
  assert.equal(pro.paidSites, 1);
  const base = entitlementsOf({ plan: "BASE", departmentsAddon: true, extraSeatPacks: 0, brandingAddon: false, activityType: "RESTAURANT", extraSites: 2 });
  assert.equal(base.siteLimit, 3);
  assert.equal(base.departments, true);
});

test("a restaurant's Pro is the plan alone", () => {
  const selection = normalizeSelection({ plan: "PRO", departments: true, seatPacks: 2, branding: true }, false);
  assert.deepEqual(selectionItems(selection), [{ kind: "pro", quantity: 1 }]);
});

test("a company pays sites and packs, on Base and on Pro", () => {
  assert.equal(normalizeSelection({ plan: "BASE", extraSites: 9, departments: true }, true).extraSites, 3);
  assert.equal(normalizeSelection({ plan: "BASE", departments: true }, true).departments, false);
  const pro = normalizeSelection({ plan: "PRO", extraSites: 2, seatPacks: 1, branding: true }, true);
  assert.deepEqual(selectionItems(pro), [
    { kind: "pro", quantity: 1 },
    { kind: "persone5", quantity: 1 },
    { kind: "sede", quantity: 2 },
  ]);
});

test("what Stripe sends back is the plan the venue gets", () => {
  const back = selectionFromItems([
    { lookupKey: "workbit_pro_yearly", quantity: 1 },
    { lookupKey: "workbit_sede_yearly", quantity: 2 },
    { lookupKey: "workbit_persone5_yearly", quantity: 1 },
  ]);
  assert.deepEqual(back, {
    interval: "YEARLY",
    selection: { plan: "PRO", departments: false, seatPacks: 1, branding: false, extraSites: 2 },
  });
  const entitlements = entitlementsOf({
    plan: "PRO",
    activityType: "COMPANY",
    departmentsAddon: back!.selection.departments,
    extraSeatPacks: back!.selection.seatPacks,
    brandingAddon: back!.selection.branding,
    extraSites: back!.selection.extraSites,
  });
  assert.equal(entitlements.siteLimit, 5);
  assert.equal(entitlements.seatLimit, 50);
  // A subscription from before the catalog changes nothing.
  assert.equal(selectionFromItems([{ lookupKey: null, quantity: 1 }]), null);
});
