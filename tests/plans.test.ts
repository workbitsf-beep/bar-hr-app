import assert from "node:assert/strict";
import { test } from "node:test";
import { entitlementsOf } from "../lib/plans";

const base = { plan: "BASE" as const, departmentsAddon: false, extraSeatPacks: 0, brandingAddon: false };

test("a venue's Base holds 12 people, two packs make 22", () => {
  assert.equal(entitlementsOf(base).seatLimit, 12);
  assert.equal(entitlementsOf({ ...base, extraSeatPacks: 2 }).seatLimit, 22);
  assert.equal(entitlementsOf({ ...base, extraSeatPacks: 9 }).seatLimit, 22);
});

test("a venue's Pro has every extra and no limit on people", () => {
  const pro = entitlementsOf({ ...base, plan: "PRO", extraSeatPacks: 2 });
  assert.equal(pro.seatLimit, null);
  assert.equal(pro.departments, true);
  assert.equal(pro.branding, true);
  // Its main venue and one branch (15 October 2026).
  assert.equal(pro.siteLimit, 2);
});

test("a company's main site is free; on Base it pays up to 3 more one by one", () => {
  const company = { ...base, activityType: "COMPANY" };
  assert.equal(entitlementsOf(company).departments, false);
  assert.equal(entitlementsOf(company).siteLimit, 1);
  assert.equal(entitlementsOf(company).paidSites, 0);
  assert.equal(entitlementsOf({ ...company, extraSites: 2 }).siteLimit, 3);
  assert.equal(entitlementsOf({ ...company, extraSites: 2 }).paidSites, 2);
  assert.equal(entitlementsOf({ ...company, extraSites: 2 }).departments, true);
  assert.equal(entitlementsOf({ ...company, extraSites: 5 }).siteLimit, 4);
  // The venue's Reparti switch does not give a company sites.
  assert.equal(entitlementsOf({ ...company, departmentsAddon: true }).departments, false);
});

test("a company's Pro includes 3 sites, the main one among them, and 45 people", () => {
  const pro = { ...base, plan: "PRO" as const, activityType: "COMPANY" };
  assert.equal(entitlementsOf(pro).siteLimit, 3);
  assert.equal(entitlementsOf(pro).paidSites, 0);
  assert.equal(entitlementsOf(pro).seatLimit, 45);
  assert.equal(entitlementsOf({ ...pro, extraSites: 3 }).siteLimit, 6);
  assert.equal(entitlementsOf({ ...pro, extraSites: 3 }).paidSites, 3);
  assert.equal(entitlementsOf({ ...pro, extraSeatPacks: 2 }).seatLimit, 55);
});

test("a Su misura plan has every feature with the limits agreed", () => {
  const custom = entitlementsOf({ ...base, plan: "CUSTOM", activityType: "COMPANY", customSeatLimit: 120, customSiteLimit: 9 });
  assert.equal(custom.custom, true);
  assert.equal(custom.pro, true);
  assert.equal(custom.seatLimit, 120);
  assert.equal(custom.siteLimit, 9);
  assert.equal(custom.branding, true);
  const venue = entitlementsOf({ ...base, plan: "CUSTOM", customSeatLimit: null });
  assert.equal(venue.seatLimit, null);
  assert.equal(venue.departments, true);
});
