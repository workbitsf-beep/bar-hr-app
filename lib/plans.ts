import { VenuePlan } from "@prisma/client";
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
 * Plans are bought outside the app. Until checkout sells the extras, the
 * super admin switches them on from the console.
 */

export const BASE_SEATS = 12;
/** A company's sites: three with the Sedi extra, six on Pro. */
export const SITES_WITH_EXTRA = 3;
export const SITES_ON_PRO = 6;
export const SEAT_PACK_SIZE = 5;
export const MAX_SEAT_PACKS = 2;

/** Prices without VAT, as the website shows them. */
export const PLAN_PRICES = {
  base: { monthly: "29,99 €", yearly: "299 €" },
  pro: { monthly: "59,99 €", yearly: "599 €" },
  departments: { monthly: "7,99 €", yearly: "79 €" },
  seatPack: { monthly: "6,99 €", yearly: "69 €" },
  branding: { monthly: "2,99 €", yearly: "29 €" },
} as const;

export type VenueEntitlements = {
  plan: VenuePlan;
  pro: boolean;
  departments: boolean;
  branding: boolean;
  /** Packs bought on Base; always 0 on Pro. */
  seatPacks: number;
  /** Null on Pro: no limit. */
  seatLimit: number | null;
};

export function entitlementsOf(bar: {
  plan: VenuePlan;
  departmentsAddon: boolean;
  extraSeatPacks: number;
  brandingAddon: boolean;
}): VenueEntitlements {
  const pro = bar.plan === VenuePlan.PRO;
  const seatPacks = pro ? 0 : Math.max(0, Math.min(MAX_SEAT_PACKS, bar.extraSeatPacks));
  return {
    plan: bar.plan,
    pro,
    departments: pro || bar.departmentsAddon,
    branding: pro || bar.brandingAddon,
    seatPacks,
    seatLimit: pro ? null : BASE_SEATS + seatPacks * SEAT_PACK_SIZE,
  };
}

/** How many sites a company may have; 0 without the extra. */
export function siteLimitOf(entitlements: VenueEntitlements) {
  if (entitlements.pro) return SITES_ON_PRO;
  return entitlements.departments ? SITES_WITH_EXTRA : 0;
}

const NONE: VenueEntitlements = {
  plan: VenuePlan.BASE,
  pro: false,
  departments: false,
  branding: false,
  seatPacks: 0,
  seatLimit: BASE_SEATS,
};

/** What a venue has, read once per request. */
export const getVenueEntitlements = cache(async function getVenueEntitlements(
  barId: string | null | undefined
): Promise<VenueEntitlements> {
  if (!barId) return NONE;
  const bar = await prisma.bar.findUnique({
    where: { id: barId },
    select: { plan: true, departmentsAddon: true, extraSeatPacks: true, brandingAddon: true },
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
  if (entitlements.pro) return "Pro";
  const extras = [
    entitlements.departments ? (company ? "Sedi" : "Reparti") : null,
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
