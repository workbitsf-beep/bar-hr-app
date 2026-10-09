import { ActivityType, VenuePlan } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

/**
 * Workbit's plans, as agreed on 8 October 2026.
 *
 * Base is the app as it is, for up to 12 people (the owner counts). On top of
 * it a venue adds only what it needs: departments, packs of five more people
 * (two at most, so up to 22), and its own style - logo and sign font. Pro
 * includes everything, with no limit on people for one venue.
 *
 * A company has sites instead of departments, paid one by one (7,99 each,
 * up to 3 on Base). Its Pro includes 3 sites, adds more up to 6, and holds up
 * to 45 people (9 October 2026).
 *
 * A Su misura plan (CUSTOM) is agreed with a customer with many sites and
 * people: everything Pro has, with the price, sites and people the super
 * admin sets.
 *
 * Plans are bought outside the app. Until checkout sells the extras, the
 * super admin switches them on from the console.
 */

export const BASE_SEATS = 12;
/** A company's sites: up to 3 paid on Base; 3 included on Pro, up to 6 in all. */
export const SITES_WITH_EXTRA = 3;
export const SITES_INCLUDED_IN_PRO = 3;
export const SITES_ON_PRO = 6;
/** A company's Pro holds up to 45 people; a venue's Pro has no limit. */
export const COMPANY_PRO_SEATS = 45;
export const SEAT_PACK_SIZE = 5;
export const MAX_SEAT_PACKS = 2;

/** Prices without VAT, as the website shows them. */
export const PLAN_PRICES = {
  base: { monthly: "29,99 €", yearly: "299 €" },
  pro: { monthly: "59,99 €", yearly: "599 €" },
  departments: { monthly: "7,99 €", yearly: "79 €" },
  site: { monthly: "7,99 €", yearly: "79 €" },
  seatPack: { monthly: "6,99 €", yearly: "69 €" },
  branding: { monthly: "2,99 €", yearly: "29 €" },
} as const;

export type VenueEntitlements = {
  plan: VenuePlan;
  /** Pro or Su misura: every feature. */
  pro: boolean;
  /** Su misura: limits agreed with the customer. */
  custom: boolean;
  departments: boolean;
  branding: boolean;
  /** Packs bought on Base; always 0 on Pro. */
  seatPacks: number;
  /** Null on a venue's Pro: no limit. */
  seatLimit: number | null;
  company: boolean;
  /** A company's sites paid on top (each 7,99). */
  paidSites: number;
  /** How many sites a company may have; 0 for a venue. */
  siteLimit: number;
};

export function entitlementsOf(bar: {
  plan: VenuePlan;
  departmentsAddon: boolean;
  extraSeatPacks: number;
  brandingAddon: boolean;
  activityType?: ActivityType | string | null;
  extraSites?: number | null;
  customSeatLimit?: number | null;
  customSiteLimit?: number | null;
}): VenueEntitlements {
  const custom = bar.plan === VenuePlan.CUSTOM;
  const pro = bar.plan === VenuePlan.PRO || custom;
  const company = bar.activityType === ActivityType.COMPANY;
  // Packs of five more people: on Base, and on a company's Pro on top of its 45.
  const seatPacks = pro && !company ? 0 : Math.max(0, Math.min(MAX_SEAT_PACKS, bar.extraSeatPacks));
  const paid = Math.max(0, Math.round(bar.extraSites ?? 0));
  const siteLimit = !company
    ? 0
    : custom
      ? Math.max(0, bar.customSiteLimit ?? SITES_INCLUDED_IN_PRO)
      : pro
      ? Math.min(SITES_ON_PRO, SITES_INCLUDED_IN_PRO + paid)
      : Math.min(SITES_WITH_EXTRA, paid);
  if (custom) {
    return {
      plan: bar.plan,
      pro,
      custom,
      departments: company ? siteLimit > 0 : true,
      branding: true,
      seatPacks: 0,
      seatLimit: bar.customSeatLimit ?? null,
      company,
      paidSites: 0,
      siteLimit,
    };
  }
  return {
    plan: bar.plan,
    pro,
    custom,
    departments: company ? siteLimit > 0 : pro || bar.departmentsAddon,
    branding: pro || bar.brandingAddon,
    seatPacks,
    seatLimit: pro
      ? company
        ? COMPANY_PRO_SEATS + seatPacks * SEAT_PACK_SIZE
        : null
      : BASE_SEATS + seatPacks * SEAT_PACK_SIZE,
    company,
    paidSites: pro ? siteLimit - SITES_INCLUDED_IN_PRO : siteLimit,
    siteLimit,
  };
}

/** How many sites a company may have; 0 without any. */
export function siteLimitOf(entitlements: VenueEntitlements) {
  return entitlements.siteLimit;
}

const NONE: VenueEntitlements = {
  plan: VenuePlan.BASE,
  pro: false,
  custom: false,
  departments: false,
  branding: false,
  seatPacks: 0,
  seatLimit: BASE_SEATS,
  company: false,
  paidSites: 0,
  siteLimit: 0,
};

/** What a venue has, read once per request. */
export const getVenueEntitlements = cache(async function getVenueEntitlements(
  barId: string | null | undefined
): Promise<VenueEntitlements> {
  if (!barId) return NONE;
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: { plan: true, departmentsAddon: true, extraSeatPacks: true, brandingAddon: true, activityType: true, extraSites: true, customSeatLimit: true, customSiteLimit: true },
  });
  return bar ? entitlementsOf(bar) : NONE;
});

/** Everyone active in the venue, the owner included. */
export async function countSeats(barId: string) {
  return prisma.employeeBar.count({ where: { barId, isActive: true } });
}

export type SeatUsage = { used: number; limit: number | null; full: boolean };

export async function getSeatUsage(barId: string): Promise<SeatUsage> {
  const [entitlements, used] = await Promise.all([getVenueEntitlements(barId), countSeats(barId)]);
  return {
    used,
    limit: entitlements.seatLimit,
    full: entitlements.seatLimit !== null && used >= entitlements.seatLimit,
  };
}

/** The plan in a few words, for the console and the settings. */
export function describePlan(entitlements: VenueEntitlements, company = false) {
  if (entitlements.custom) return "Su misura";
  if (entitlements.pro) {
    const extras = [
      entitlements.company && entitlements.paidSites > 0
        ? `${entitlements.paidSites} ${entitlements.paidSites === 1 ? "sede" : "sedi"}`
        : null,
      entitlements.seatPacks ? `+${entitlements.seatPacks * SEAT_PACK_SIZE} persone` : null,
    ].filter(Boolean);
    return extras.length ? `Pro + ${extras.join(" + ")}` : "Pro";
  }
  const extras = [
    entitlements.departments
      ? company || entitlements.company
        ? `${entitlements.siteLimit} ${entitlements.siteLimit === 1 ? "sede" : "sedi"}`
        : "Reparti"
      : null,
    entitlements.seatPacks ? `+${entitlements.seatPacks * SEAT_PACK_SIZE} persone` : null,
    entitlements.branding ? "Stile" : null,
  ].filter(Boolean);
  return extras.length ? `Base + ${extras.join(" + ")}` : "Base";
}

/**
 * The sign fonts a venue can pick: free Google fonts with Italian accents,
 * so there is no licence to check and nothing breaks on a phone. A venue's
 * own font is added here by hand once its licence has been checked.
 */
export const SIGN_FONTS = [
  { id: "classico", name: "Classico", family: "Playfair Display" },
  { id: "elegante", name: "Elegante", family: "Cormorant Garamond" },
  { id: "insegna", name: "Insegna", family: "Abril Fatface" },
  { id: "moderno", name: "Moderno", family: "Bebas Neue" },
  { id: "corsivo", name: "Corsivo", family: "Pacifico" },
  { id: "anni50", name: "Anni '50", family: "Lobster" },
  { id: "retro", name: "Retrò", family: "Righteous" },
  { id: "liberty", name: "Liberty", family: "Josefin Sans" },
] as const;

export type SignFontId = (typeof SIGN_FONTS)[number]["id"];

export function parseSignFont(value: unknown): SignFontId | null {
  const raw = String(value ?? "").trim();
  return (SIGN_FONTS.find((font) => font.id === raw)?.id as SignFontId | undefined) ?? null;
}
