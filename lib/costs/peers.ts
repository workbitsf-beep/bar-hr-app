import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * What the other clients of Workbit pay for the same product: never who, never
 * one client's price. A product shows only when at least PEERS_MIN other
 * venues bought it in the last three months; each venue counts once (its own
 * average), so a big buyer does not weigh more. Demo venues only ever meet
 * other demo venues.
 */

export type PeerStats = { venues: number; average: number; best: number; median: number };

export const PEERS_MIN = Math.max(2, Number(process.env.COSTS_PEERS_MIN) || 3);

function quantile(sorted: number[], q: number) {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/** "productKey|unit" → stats, for the products asked, in the three months up to `month`. */
export async function peerPrices(input: { barId: string; month: string; products: Array<{ productKey: string; unit: string }> }) {
  const result = new Map<string, PeerStats>();
  const keys = [...new Set(input.products.map((item) => item.productKey))];
  if (!keys.length) return result;

  const [year, mon] = input.month.split("-").map(Number);
  const from = new Date(Date.UTC(year, mon - 3, 1));
  const to = new Date(Date.UTC(year, mon, 1));
  const self = await prisma.bar.findUnique({ where: { id: input.barId }, select: { isDemo: true, mainBarId: true } });

  const groups = await prisma.supplierInvoiceLine.groupBy({
    by: ["barId", "productKey", "baseUnit"],
    where: {
      productKey: { in: keys },
      baseQty: { gt: 0 },
      totalCents: { gt: 0 },
      barId: { not: input.barId },
      // A venue's own branches are not its colleagues.
      ...(self?.mainBarId ? { NOT: { barId: self.mainBarId } } : {}),
      invoice: {
        issueDate: { gte: from, lt: to },
        bar: {
          isDemo: self?.isDemo ?? false,
          OR: [{ mainBarId: null }, { mainBarId: { notIn: [input.barId, ...(self?.mainBarId ? [self.mainBarId] : [])] } }],
        },
      },
    },
    _sum: { totalCents: true, baseQty: true },
  });

  const byProduct = new Map<string, number[]>();
  for (const group of groups) {
    const qty = group._sum?.baseQty;
    const cents = group._sum?.totalCents;
    if (!group.productKey || !group.baseUnit || !qty || !cents) continue;
    const id = `${group.productKey}|${group.baseUnit}`;
    byProduct.set(id, [...(byProduct.get(id) ?? []), cents / 100 / qty]);
  }
  for (const [id, prices] of byProduct) {
    if (prices.length < PEERS_MIN) continue;
    const sorted = [...prices].sort((a, b) => a - b);
    result.set(id, {
      venues: sorted.length,
      average: sorted.reduce((sum, price) => sum + price, 0) / sorted.length,
      // The best quarter, not the single cheapest: one venue's price is never shown.
      best: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
    });
  }
  return result;
}
