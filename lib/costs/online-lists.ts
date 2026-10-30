import "server-only";

import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { aiEnabled, searchOnlinePrices } from "./ai";

/**
 * Once a month, the products the clients spend most on are looked up on the
 * web: prices that anyone can see on a public page, each kept with its link,
 * and shown next to what the clients pay as "online". The previous month's
 * findings for a product are replaced, never piled up.
 */

const PRODUCTS_PER_MONTH = Math.max(5, Number(process.env.COSTS_ONLINE_SEARCH_PRODUCTS) || 25);
let running = false;

/** The products worth a search: most spent on across real clients, last three months. */
async function productsToSearch(now: Date) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1));
  const groups = await prisma.supplierInvoiceLine.groupBy({
    by: ["productKey", "productLabel", "baseUnit"],
    where: {
      productKey: { not: null },
      baseUnit: { in: ["kg", "l", "pz"] },
      totalCents: { gt: 0 },
      category: { notIn: ["energia", "utenze", "telefonia", "affitto", "servizi", "pos_banca", "assicurazioni", "da_classificare"] },
      invoice: { issueDate: { gte: from }, bar: { isDemo: false } },
    },
    _sum: { totalCents: true },
    orderBy: { _sum: { totalCents: "desc" } },
    take: PRODUCTS_PER_MONTH,
  });
  const result: Array<{ productKey: string; productLabel: string; baseUnit: string; buyer: "venue" | "company"; examples: string[] }> = [];
  for (const group of groups) {
    if (!group.productKey || !group.baseUnit) continue;
    const lines = await prisma.supplierInvoiceLine.findMany({
      where: { productKey: group.productKey, baseUnit: group.baseUnit },
      select: { description: true, invoice: { select: { bar: { select: { activityType: true } } } } },
      take: 20,
    });
    const companies = lines.filter((line) => line.invoice.bar.activityType === "COMPANY").length;
    result.push({
      productKey: group.productKey,
      productLabel: group.productLabel ?? group.productKey,
      baseUnit: group.baseUnit,
      buyer: companies * 2 >= lines.length ? "company" : "venue",
      examples: [...new Set(lines.map((line) => line.description))].slice(0, 3),
    });
  }
  return result;
}

export async function searchOnlineLists(now = new Date()) {
  if (!aiEnabled()) return { products: 0, prices: 0 };
  let prices = 0;
  const products = await productsToSearch(now);
  for (const product of products) {
    const found = await searchOnlinePrices({
      productLabel: product.productLabel,
      baseUnit: product.baseUnit,
      ourUnitPrice: null,
      examples: product.examples,
      city: null,
      buyer: product.buyer,
    }).catch((error) => {
      console.error("[online-lists] search failed", product.productKey, error instanceof Error ? error.message : error);
      return null;
    });
    if (!found) continue;
    const offers = found.offers.filter((offer) => offer.sameProduct !== false && offer.unitPrice > 0);
    await prisma.supplierListPrice.deleteMany({ where: { productKey: product.productKey, baseUnit: product.baseUnit, source: "online", barId: null } });
    if (!offers.length) continue;
    await prisma.supplierListPrice.createMany({
      data: offers.map((offer) => ({
        supplierName: (offer.seller || new URL(offer.url).host).slice(0, 120),
        productKey: product.productKey,
        productLabel: product.productLabel,
        baseUnit: product.baseUnit,
        unitPrice: offer.unitPrice,
        description: [offer.title, offer.conditions].filter(Boolean).join(" · ").slice(0, 300) || null,
        validFrom: now,
        source: "online",
        url: offer.url,
      })),
    });
    prices += offers.length;
  }
  return { products: products.length, prices };
}

/**
 * From the 5th of the month, 6:00 in Italy: the month's search, once, after
 * the cron has answered (it takes minutes); the super admins hear the result.
 */
export async function runOnlineListSearch(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  if (Number(parts.day) < 5 || Number(parts.hour) < 6 || running || !aiEnabled()) return { started: false };
  const monthStart = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, 1));
  const done = await prisma.notification.count({ where: { type: INTERNAL_NOTIFICATION_TYPES.ONLINE_LISTS, createdAt: { gte: monthStart } } });
  if (done) return { started: false };

  running = true;
  void searchOnlineLists(now)
    .then(async (result) => {
      const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
      await notifyUsers(admins.map((admin) => admin.id), {
        title: "Listini online aggiornati",
        message: `Cercati ${result.products} prodotti, trovati ${result.prices} prezzi su pagine pubbliche. Li vedi in Console › Listini fornitori.`,
        type: INTERNAL_NOTIFICATION_TYPES.ONLINE_LISTS,
        actionUrl: "/dashboard/super-admin/listini",
      });
    })
    .catch((error) => console.error("[online-lists] monthly search failed", error instanceof Error ? error.message : error))
    .finally(() => {
      running = false;
    });
  return { started: true };
}
