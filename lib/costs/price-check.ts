import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { searchEnergyOffers, searchOnlinePrices } from "./ai";
import { buildCostReport } from "./analysis";

/**
 * One search of the web for a product the venue buys - or for electricity -
 * saved so the page and the savings list can show it without searching again.
 */
export async function runPriceCheck(barId: string, productKey: string, month: string | null) {
  const bar = await prisma.bar.findUnique({ where: { id: barId }, select: { city: true } });

  if (productKey === "energia-elettrica") {
    const report = await buildCostReport(barId, month);
    if (!report?.energy?.componentUnitCost) return null;
    const result = await searchEnergyOffers({
      componentUnitCost: report.energy.componentUnitCost,
      kwhPerMonth: report.energy.kwh,
      city: bar?.city ?? null,
    });
    if (!result) return null;
    return save(barId, productKey, "Energia elettrica", "kwh", report.energy.componentUnitCost, result);
  }

  const since = new Date(Date.now() - 120 * 86_400_000);
  const lines = await prisma.supplierInvoiceLine.findMany({
    where: { barId, productKey, invoice: { issueDate: { gte: since } } },
    select: { productLabel: true, baseUnit: true, baseQty: true, totalCents: true, description: true },
    take: 200,
  });
  if (!lines.length) return null;
  const unit = lines.find((line) => line.baseUnit)?.baseUnit ?? null;
  const measured = lines.filter((line) => line.baseUnit === unit && line.baseQty && line.baseQty > 0 && line.totalCents > 0);
  const qty = measured.reduce((total, line) => total + (line.baseQty ?? 0), 0);
  const ourUnitPrice = qty ? measured.reduce((total, line) => total + line.totalCents, 0) / 100 / qty : null;
  const label = lines.find((line) => line.productLabel)?.productLabel ?? lines[0].description;

  const result = await searchOnlinePrices({
    productLabel: label,
    baseUnit: unit,
    ourUnitPrice,
    examples: [...new Set(lines.map((line) => line.description))].slice(0, 4),
    city: bar?.city ?? null,
  });
  if (!result) return null;
  return save(barId, productKey, label, unit, ourUnitPrice, result);
}

async function save(
  barId: string,
  productKey: string,
  productLabel: string,
  baseUnit: string | null,
  ourUnitPrice: number | null,
  result: NonNullable<Awaited<ReturnType<typeof searchOnlinePrices>>>,
) {
  const comparable = result.offers.filter((offer) => offer.sameProduct);
  const bestUnitPrice = comparable.length ? Math.min(...comparable.map((offer) => offer.unitPrice)) : null;
  return prisma.priceCheck.create({
    data: {
      barId,
      productKey,
      productLabel,
      baseUnit,
      ourUnitPrice,
      offers: result.offers as unknown as Prisma.InputJsonValue,
      bestUnitPrice,
      summary: result.summary.slice(0, 1000),
    },
  });
}
