import "server-only";

import { buildEmailTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * Market references, one value a month, typed in by Workbit from free public
 * sources: what the market did, to set against what a supplier charged.
 * "Your supplier +4% in three months, the market +1%" is the line an owner
 * can take to the supplier. Only the change matters, so a value can be a
 * price or an index, in whatever unit the source gives.
 */

export type MarketIndex = {
  key: string;
  label: string;
  /** As the source gives it: €/kg, €/t, €/l, indice... */
  unit: string;
  sector: "company" | "restaurant" | "all";
  source: string;
  sourceUrl: string;
  /** Where in the source, for the monthly entry. */
  hint: string;
  matches: (text: string) => boolean;
};

const has = (...words: string[]) => (text: string) => words.some((word) => text.includes(word));
/** Screws, bolts and the like follow their own market, not the raw metal's. */
const FASTENER = /vit[ei]|bullon|dad[oi]|rondell|tassell|rivett/;

export const MARKET_INDEXES: MarketIndex[] = [
  {
    key: "inox-304",
    label: "Acciaio inox AISI 304",
    unit: "indice",
    sector: "company",
    source: "ANIE – Rilevazione prezzi materiali",
    sourceUrl: "https://anie.it/",
    hint: "Metalli ferrosi › Lamiere inox laminate a freddo X5 CrNi 18-10 (AISI 304) 2B sp. 2 mm, tabella di pag. 3.",
    matches: (text) => (text.includes("inox") || text.includes("aisi-304") || text.includes("x5crni")) && !FASTENER.test(text),
  },
  {
    key: "acciaio-carbonio",
    label: "Acciaio al carbonio (lamiere, travi, tubi)",
    unit: "indice",
    sector: "company",
    source: "ANIE – Rilevazione prezzi materiali",
    sourceUrl: "https://anie.it/",
    hint: "Metalli ferrosi › Lamiere laminate a caldo nere (tabella di pag. 3, posizione 4).",
    matches: (text) => !text.includes("inox") && !FASTENER.test(text) && /ferro|acciaio|zincat|trave|lamiera|tubolare|profilat/.test(text) && !text.includes("zincatura"),
  },
  {
    key: "rame",
    label: "Rame",
    unit: "€/t",
    sector: "company",
    source: "ANIE – Rilevazione prezzi materiali",
    sourceUrl: "https://anie.it/",
    hint: "Metalli non ferrosi grezzi › Rame grado A: il valore medio della forchetta.",
    matches: has("rame"),
  },
  {
    key: "alluminio",
    label: "Alluminio",
    unit: "€/t",
    sector: "company",
    source: "ANIE – Rilevazione prezzi materiali",
    sourceUrl: "https://anie.it/",
    hint: "Metalli non ferrosi grezzi › Al 99,70 in pani: il valore medio della forchetta.",
    matches: has("allumin"),
  },
  {
    key: "ottone",
    label: "Ottone",
    unit: "€/t",
    sector: "company",
    source: "ANIE – Rilevazione prezzi materiali",
    sourceUrl: "https://anie.it/",
    hint: "Metalli non ferrosi grezzi › Ottone Cu Zn35 Pb2 Al in pani: il valore medio.",
    matches: has("ottone"),
  },
  {
    key: "gasolio",
    label: "Gasolio",
    unit: "€/l",
    sector: "all",
    source: "Ministero dell'Ambiente – prezzi medi mensili dei carburanti",
    sourceUrl: "https://dgsaie.mise.gov.it/prezzi-carburanti",
    hint: "Prezzo medio mensile del gasolio auto, self service.",
    matches: has("gasolio", "diesel"),
  },
  {
    key: "energia-pun",
    label: "Energia elettrica (PUN)",
    unit: "€/MWh",
    sector: "all",
    source: "GME – Prezzo Unico Nazionale, media mensile",
    sourceUrl: "https://www.mercatoelettrico.org/",
    hint: "Esiti mercato elettrico › PUN medio del mese.",
    matches: has("energia-elettrica", "energia elettrica"),
  },
  {
    key: "caffe-verde",
    label: "Caffè verde (arabica)",
    unit: "US cent/lb",
    sector: "restaurant",
    source: "ICO – Indicatore composito del prezzo del caffè",
    sourceUrl: "https://ico.org/",
    hint: "Coffee Market Report del mese › ICO composite indicator, media mensile.",
    matches: (text) => /caff|espresso|miscela|grani/.test(text) && !text.includes("liquor"),
  },
  {
    key: "latte",
    label: "Latte alla stalla",
    unit: "€/100 l",
    sector: "restaurant",
    source: "ISMEA Mercati – latte bovino",
    sourceUrl: "https://www.ismeamercati.it/",
    hint: "Lattiero caseari › Latte spot nazionale crudo, media del mese.",
    matches: (text) => text.includes("latte") && !text.includes("lattin"),
  },
  {
    key: "burro",
    label: "Burro",
    unit: "€/kg",
    sector: "restaurant",
    source: "ISMEA Mercati – lattiero caseari",
    sourceUrl: "https://www.ismeamercati.it/",
    hint: "Lattiero caseari › Burro CEE, media del mese.",
    matches: has("burro"),
  },
  {
    key: "olio-evo",
    label: "Olio extravergine di oliva",
    unit: "€/kg",
    sector: "restaurant",
    source: "ISMEA Mercati – oli",
    sourceUrl: "https://www.ismeamercati.it/",
    hint: "Oli › Extravergine italiano, media del mese.",
    matches: (text) => text.includes("olio") && /evo|extra/.test(text),
  },
  {
    key: "farina",
    label: "Grano tenero e farine",
    unit: "€/t",
    sector: "restaurant",
    source: "ISMEA Mercati – cereali",
    sourceUrl: "https://www.ismeamercati.it/",
    hint: "Cereali › Frumento tenero panificabile, media del mese.",
    matches: has("farina", "frumento"),
  },
  {
    key: "zucchero",
    label: "Zucchero",
    unit: "€/kg",
    sector: "restaurant",
    source: "ISMEA Mercati – zucchero",
    sourceUrl: "https://www.ismeamercati.it/",
    hint: "Zucchero bianco, media del mese.",
    matches: has("zucchero"),
  },
];

export const INDEX_BY_KEY = new Map(MARKET_INDEXES.map((index) => [index.key, index]));

/** The index a product follows, from its key and name; null when none fits. */
export function indexFor(productKey: string, label: string | null) {
  const text = `${productKey} ${label ?? ""}`.toLowerCase();
  return MARKET_INDEXES.find((index) => index.matches(text)) ?? null;
}

/** Every index's months; a venue's demo values replace the general ones. */
export async function loadMarket(barId: string) {
  const rows = await prisma.marketPrice.findMany({
    where: { OR: [{ barId: null }, { barId }] },
    select: { indexKey: true, month: true, value: true, barId: true },
  });
  const series = new Map<string, Map<string, number>>();
  for (const row of [...rows.filter((item) => !item.barId), ...rows.filter((item) => item.barId)]) {
    const months = series.get(row.indexKey) ?? new Map<string, number>();
    months.set(row.month, row.value);
    series.set(row.indexKey, months);
  }
  return series;
}

/** Percent change between two months of a series, when both are there. */
export function changeBetween(months: Map<string, number> | undefined, from: string, to: string) {
  const start = months?.get(from);
  const end = months?.get(to);
  if (!start || !end) return null;
  return (end / start - 1) * 100;
}

/**
 * From the 3rd of the month, 9:00 in Italy: the super admins are asked once
 * to type in last month's market values.
 */
export async function runMarketReminder(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  if (Number(parts.day) < 3 || Number(parts.hour) < 9) return { sent: 0 };
  const monthStart = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, 1));
  const previous = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 2, 1));
  const key = `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;

  const already = await prisma.notification.count({ where: { type: INTERNAL_NOTIFICATION_TYPES.MARKET_PRICES, createdAt: { gte: monthStart } } });
  if (already) return { sent: 0 };
  const filled = await prisma.marketPrice.count({ where: { barId: null, month: key } });
  if (filled >= MARKET_INDEXES.length) return { sent: 0 };

  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true, email: true } });
  const label = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(previous);
  const url = `${(process.env.APP_URL?.trim() || "https://app.workbit.it").replace(/\/$/, "")}/dashboard/super-admin/mercato?mese=${key}`;
  await notifyUsers(admins.map((admin) => admin.id), {
    title: `Prezzi di mercato di ${label}`,
    message: `Da inserire: ${MARKET_INDEXES.length - filled} valori (metalli, gasolio, luce, caffè, latte…). Bastano cinque minuti.`,
    type: INTERNAL_NOTIFICATION_TYPES.MARKET_PRICES,
    actionUrl: `/dashboard/super-admin/mercato?mese=${key}`,
  });
  await sendEmail({
    to: admins.map((admin) => admin.email),
    subject: `Workbit: prezzi di mercato di ${label} da inserire`,
    html: buildEmailTemplate({
      title: `Prezzi di mercato di ${label}`,
      message: `È il momento di aggiornare i valori di mercato che i clienti vedono accanto ai prezzi dei fornitori:\n${MARKET_INDEXES.map((index) => `• ${index.label} (${index.unit}) – ${index.source}`).join("\n")}\n\nNella pagina c'è, per ognuno, dove trovarlo.`,
      ctaLabel: "Inserisci i prezzi",
      ctaUrl: url,
    }),
  }).catch((error) => console.error("[market] reminder email not sent", error instanceof Error ? error.message : error));
  return { sent: admins.length };
}
