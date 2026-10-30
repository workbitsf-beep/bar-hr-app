import "server-only";

import { prisma } from "@/lib/prisma";
import { buildMonthlyTotals } from "@/lib/reporting";
import { BASE_UNIT_LABEL, CATEGORY_BY_KEY, COST_CATEGORIES, categoryOf, normalizeText } from "./categories";
import { supplierKeyOf } from "./import";
import { changeBetween, indexFor, loadMarket } from "./market";

export type SavingTip = {
  id: string;
  kind: "aumento" | "fornitore" | "online" | "energia";
  title: string;
  detail: string;
  /** What it is worth in a year, in cents; null when it cannot be said. */
  yearlyCents: number | null;
  /** "sicuro": read from the venue's own invoices. "da verificare": a price found elsewhere. */
  confidence: "sicuro" | "da verificare";
  productKey?: string;
  link?: { label: string; url: string };
};

export type CostReport = {
  month: string;
  availableMonths: string[];
  invoiceCount: number;
  suppliersCents: number;
  previousSuppliersCents: number | null;
  averageSuppliersCents: number | null;
  merceCents: number;
  speseCents: number;
  labor: { cents: number; hours: number; missingRates: number; previousCents: number | null } | null;
  revenueCents: number | null;
  categories: Array<{ key: string; label: string; color: string; kind: string; cents: number; previousCents: number; averageCents: number }>;
  suppliers: Array<{ key: string; name: string; cents: number; previousCents: number; invoices: number; category: string }>;
  priceChanges: Array<{
    productKey: string;
    label: string;
    supplier: string;
    unit: string;
    unitPrice: number;
    previousUnitPrice: number;
    changePct: number;
    yearlyImpactCents: number;
  }>;
  energy: { kwh: number; cents: number; unitCost: number; componentUnitCost: number | null; previousUnitCost: number | null } | null;
  topProducts: Array<{ productKey: string; label: string; unit: string; unitPrice: number | null; cents: number; quantity: number | null; checkedAt: Date | null }>;
  savings: SavingTip[];
  pendingLines: number;
  /** Every product of this month or the last: how much, at what price, against before. */
  productTrends: ProductTrend[];
  /** Why the month moved: bought more or less, or paid more or less for the same things. */
  monthStory: { deltaCents: number; quantityCents: number; priceCents: number; newCents: number; goneCents: number } | null;
};

export type ProductTrend = {
  productKey: string;
  label: string;
  unit: string;
  category: string;
  cents: number;
  previousCents: number;
  quantity: number | null;
  previousQuantity: number | null;
  unitPrice: number | null;
  previousUnitPrice: number | null;
  /** The unit price two months back and twelve months back, when bought then. */
  twoMonthsUnitPrice: number | null;
  lastYearUnitPrice: number | null;
  /** The change in spend split in two: quantity at last month's price, and price on this month's quantity. */
  quantityCents: number;
  priceCents: number;
  /** The same stretch of months for the product and its market index, when there is one. */
  market: { key: string; label: string; source: string; months: number; productPct: number; marketPct: number } | null;
};

export function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return monthKey(date);
}

function monthRange(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, mon - 1, 1)), end: new Date(Date.UTC(year, mon, 1)) };
}

type Line = {
  category: string;
  productKey: string | null;
  productLabel: string | null;
  baseUnit: string | null;
  baseQty: number | null;
  totalCents: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  month: string;
  supplierKey: string;
  supplierName: string;
  invoiceId: string;
};

const ENERGY_COMPONENT = /\b(F1|F2|F3|F0|FASCIA|ENERGIA ATTIVA|QUOTA ENERGIA|MATERIA ENERGIA|PREZZO ENERGIA|CORRISPETTIVO ENERGIA|COMPONENTE ENERGIA|SPREAD|PUN|PERDITE)\b/;
const NOT_ENERGY_COMPONENT = /\b(TRASPORTO|ONERI|ACCISA|ASOS|ARIM|DISPACCIAMENTO|MISURA|CONTATORE|POTENZA|IVA|CANONE)\b/;

function euros(cents: number) {
  return `${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;
}

function unitPriceText(value: number, unit: string) {
  return `${value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} €/${BASE_UNIT_LABEL[unit] ?? unit}`;
}

export function monthLabel(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, mon - 1, 1)));
}

async function laborCost(barId: string, month: string) {
  const [year, mon] = month.split("-").map(Number);
  const members = await prisma.employeeBar.findMany({
    where: { barId, OR: [{ isActive: true }, { endedAt: { gte: monthRange(month).start } }] },
    select: { userId: true, hourlyRate: true },
  });
  let cents = 0;
  let hours = 0;
  let missingRates = 0;
  for (const member of members) {
    const totals = await buildMonthlyTotals(barId, member.userId, mon, year);
    if (!totals.roundedHours) continue;
    hours += totals.roundedHours;
    if (member.hourlyRate === null) {
      missingRates += 1;
      continue;
    }
    cents += Math.round(totals.roundedHours * Number(member.hourlyRate) * 100);
  }
  return { cents, hours, missingRates };
}

/**
 * The month's costs, read against the months before it, and where money can
 * be saved. Everything is computed from the invoices on file: a tip that
 * names a figure can always be traced back to them.
 */
export async function buildCostReport(barId: string, requestedMonth: string | null): Promise<CostReport | null> {
  const monthsRaw = await prisma.$queryRaw<Array<{ month: string }>>`
    SELECT DISTINCT to_char("issueDate", 'YYYY-MM') AS month FROM "SupplierInvoice" WHERE "barId" = ${barId}::uuid ORDER BY month DESC`;
  const availableMonths = monthsRaw.map((row) => row.month);
  if (!availableMonths.length) return null;
  const month = requestedMonth && availableMonths.includes(requestedMonth) ? requestedMonth : availableMonths[0];

  const historyStart = monthRange(shiftMonth(month, -12)).start;
  const { end } = monthRange(month);
  const invoices = await prisma.supplierInvoice.findMany({
    where: { barId, issueDate: { gte: historyStart, lt: end } },
    select: {
      id: true,
      supplierName: true,
      supplierVat: true,
      supplierTaxCode: true,
      issueDate: true,
      taxableCents: true,
      lines: {
        select: {
          category: true,
          productKey: true,
          productLabel: true,
          baseUnit: true,
          baseQty: true,
          totalCents: true,
          description: true,
          quantity: true,
          unit: true,
        },
      },
    },
  });

  const lines: Line[] = [];
  for (const invoice of invoices) {
    const supplierKey = supplierKeyOf(invoice);
    for (const line of invoice.lines) {
      lines.push({ ...line, month: monthKey(invoice.issueDate), supplierKey, supplierName: invoice.supplierName, invoiceId: invoice.id });
    }
  }

  const previous = shiftMonth(month, -1);
  const priorMonths = [1, 2, 3].map((delta) => shiftMonth(month, -delta)).filter((key) => availableMonths.includes(key));
  const inMonth = (key: string) => lines.filter((line) => line.month === key);
  const current = inMonth(month);
  const sum = (list: Line[]) => list.reduce((total, line) => total + line.totalCents, 0);

  // Categories and suppliers, against the month before and the average of up to three.
  const categories = COST_CATEGORIES.map((category) => {
    const cents = sum(current.filter((line) => line.category === category.key));
    const previousCents = sum(inMonth(previous).filter((line) => line.category === category.key));
    const averageCents = priorMonths.length
      ? Math.round(priorMonths.reduce((total, key) => total + sum(inMonth(key).filter((line) => line.category === category.key)), 0) / priorMonths.length)
      : 0;
    return { key: category.key, label: category.label, color: category.color, kind: category.kind, cents, previousCents, averageCents };
  })
    .filter((category) => category.cents !== 0 || category.previousCents !== 0)
    .sort((a, b) => b.cents - a.cents);

  const supplierMap = new Map<string, { key: string; name: string; cents: number; previousCents: number; invoices: Set<string>; byCategory: Map<string, number> }>();
  for (const line of lines) {
    if (line.month !== month && line.month !== previous) continue;
    const entry = supplierMap.get(line.supplierKey) ?? {
      key: line.supplierKey,
      name: line.supplierName,
      cents: 0,
      previousCents: 0,
      invoices: new Set<string>(),
      byCategory: new Map<string, number>(),
    };
    if (line.month === month) {
      entry.cents += line.totalCents;
      entry.invoices.add(line.invoiceId);
      entry.byCategory.set(line.category, (entry.byCategory.get(line.category) ?? 0) + line.totalCents);
    } else {
      entry.previousCents += line.totalCents;
    }
    supplierMap.set(line.supplierKey, entry);
  }
  const suppliers = [...supplierMap.values()]
    .filter((entry) => entry.cents !== 0)
    .map((entry) => ({
      key: entry.key,
      name: entry.name,
      cents: entry.cents,
      previousCents: entry.previousCents,
      invoices: entry.invoices.size,
      category: [...entry.byCategory.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "altro",
    }))
    .sort((a, b) => b.cents - a.cents);

  const monthTotal = (key: string) => sum(inMonth(key));
  const suppliersCents = monthTotal(month);
  const merceCents = sum(current.filter((line) => CATEGORY_BY_KEY.get(line.category)?.kind === "merce"));

  // Unit prices per product and supplier, month by month.
  type Price = { cents: number; qty: number };
  const prices = new Map<string, Map<string, Price>>();
  for (const line of lines) {
    if (!line.productKey || !line.baseUnit || !line.baseQty || line.baseQty <= 0 || line.totalCents <= 0) continue;
    if (line.baseUnit === "kwh" || line.baseUnit === "smc") continue;
    const id = `${line.productKey}|${line.baseUnit}|${line.supplierKey}`;
    const byMonth = prices.get(id) ?? new Map<string, Price>();
    const entry = byMonth.get(line.month) ?? { cents: 0, qty: 0 };
    entry.cents += line.totalCents;
    entry.qty += line.baseQty;
    byMonth.set(line.month, entry);
    prices.set(id, byMonth);
  }
  const labelOf = new Map<string, string>();
  const supplierNameOf = new Map<string, string>();
  for (const line of lines) {
    if (line.productKey && line.productLabel && !labelOf.has(line.productKey)) labelOf.set(line.productKey, line.productLabel);
    supplierNameOf.set(line.supplierKey, line.supplierName);
  }

  const priceChanges: CostReport["priceChanges"] = [];
  for (const [id, byMonth] of prices) {
    const now = byMonth.get(month);
    if (!now || now.cents < 2000) continue;
    const before = [...byMonth.entries()]
      .filter(([key]) => key < month && key >= shiftMonth(month, -6))
      .reduce((total, [, price]) => ({ cents: total.cents + price.cents, qty: total.qty + price.qty }), { cents: 0, qty: 0 });
    if (!before.qty) continue;
    const unitPrice = now.cents / 100 / now.qty;
    const previousUnitPrice = before.cents / 100 / before.qty;
    const changePct = (unitPrice / previousUnitPrice - 1) * 100;
    if (Math.abs(changePct) < 4 || Math.abs(changePct) > 300) continue;
    const [productKey, unit, supplierKey] = id.split("|");
    // A year of the quantity bought lately, at the difference.
    const monthsSeen = [...byMonth.keys()].filter((key) => key <= month && key >= shiftMonth(month, -5)).length || 1;
    const qtyPerMonth = ([...byMonth.entries()].filter(([key]) => key <= month && key >= shiftMonth(month, -5)).reduce((total, [, price]) => total + price.qty, 0)) / monthsSeen;
    priceChanges.push({
      productKey,
      label: labelOf.get(productKey) ?? productKey,
      supplier: supplierNameOf.get(supplierKey) ?? supplierKey,
      unit,
      unitPrice,
      previousUnitPrice,
      changePct,
      yearlyImpactCents: Math.round((unitPrice - previousUnitPrice) * qtyPerMonth * 12 * 100),
    });
  }
  priceChanges.sort((a, b) => Math.abs(b.yearlyImpactCents) - Math.abs(a.yearlyImpactCents));

  // Energy: the bill's whole cost per kWh, and the part that depends on the offer.
  const electricityInvoices = new Set(current.filter((line) => line.baseUnit === "kwh").map((line) => line.invoiceId));
  const energyFor = (key: string, ids?: Set<string>) => {
    const monthLines = inMonth(key).filter((line) => (ids ? ids.has(line.invoiceId) : line.baseUnit === "kwh" || line.category === "energia"));
    const invoiceIds = new Set(monthLines.filter((line) => line.baseUnit === "kwh").map((line) => line.invoiceId));
    if (!invoiceIds.size) return null;
    let kwh = 0;
    let componentCents = 0;
    let cents = 0;
    for (const invoiceId of invoiceIds) {
      const own = monthLines.filter((line) => line.invoiceId === invoiceId);
      cents += sum(own);
      const component = own.filter(
        (line) => line.baseUnit === "kwh" && ENERGY_COMPONENT.test(normalizeText(line.description)) && !NOT_ENERGY_COMPONENT.test(normalizeText(line.description)),
      );
      // The same kWh are repeated on every regulated line: consumption is
      // read from the energy lines, or the largest single line.
      const consumption = component.length
        ? component.reduce((total, line) => total + (line.baseQty ?? 0), 0)
        : Math.max(0, ...own.filter((line) => line.baseUnit === "kwh").map((line) => line.baseQty ?? 0));
      kwh += consumption;
      componentCents += component.reduce((total, line) => total + line.totalCents, 0);
    }
    if (!kwh) return null;
    return { kwh, cents, unitCost: cents / 100 / kwh, componentUnitCost: componentCents ? componentCents / 100 / kwh : null };
  };
  const energyNow = electricityInvoices.size ? energyFor(month, electricityInvoices) : null;
  const energyBefore = priorMonths.map((key) => energyFor(key)).filter(Boolean) as Array<NonNullable<ReturnType<typeof energyFor>>>;
  const energy = energyNow
    ? {
        ...energyNow,
        previousUnitCost: energyBefore.length
          ? energyBefore.reduce((total, item) => total + item.cents, 0) / 100 / energyBefore.reduce((total, item) => total + item.kwh, 0)
          : null,
      }
    : null;

  // The products that weigh most this month, with the last web search on each.
  const productSpend = new Map<string, { productKey: string; label: string; unit: string; cents: number; qty: number }>();
  for (const line of current) {
    if (!line.productKey || line.totalCents <= 0) continue;
    const category = categoryOf(line.category);
    if (category.kind !== "merce" && line.category !== "monouso" && line.category !== "pulizia") continue;
    const id = `${line.productKey}|${line.baseUnit ?? ""}`;
    const entry = productSpend.get(id) ?? { productKey: line.productKey, label: line.productLabel ?? line.productKey, unit: line.baseUnit ?? "", cents: 0, qty: 0 };
    entry.cents += line.totalCents;
    entry.qty += line.baseQty ?? 0;
    productSpend.set(id, entry);
  }
  const top = [...productSpend.values()].sort((a, b) => b.cents - a.cents).slice(0, 12);
  const checks = await prisma.priceCheck.findMany({
    where: { barId, productKey: { in: top.map((item) => item.productKey) } },
    orderBy: { checkedAt: "desc" },
  });
  const lastCheck = new Map<string, (typeof checks)[number]>();
  for (const check of checks) if (!lastCheck.has(check.productKey)) lastCheck.set(check.productKey, check);
  const topProducts = top.map((item) => ({
    productKey: item.productKey,
    label: item.label,
    unit: item.unit,
    unitPrice: item.qty > 0 && item.unit ? item.cents / 100 / item.qty : null,
    cents: item.cents,
    quantity: item.qty || null,
    checkedAt: lastCheck.get(item.productKey)?.checkedAt ?? null,
  }));

  const savings: SavingTip[] = [];

  for (const change of priceChanges.filter((item) => item.changePct > 0 && item.yearlyImpactCents >= 3000).slice(0, 6)) {
    savings.push({
      id: `aumento:${change.productKey}:${change.supplier}`,
      kind: "aumento",
      title: `${change.label}: +${change.changePct.toFixed(0)}% da ${change.supplier}`,
      detail: `Lo paghi ${unitPriceText(change.unitPrice, change.unit)}, nei mesi prima ${unitPriceText(change.previousUnitPrice, change.unit)}. Se resta così sono ${euros(change.yearlyImpactCents)} in più all'anno: chiedi il motivo al fornitore o confrontalo.`,
      yearlyCents: change.yearlyImpactCents,
      confidence: "sicuro",
      productKey: change.productKey,
    });
  }

  // The same product from two suppliers, at two prices, in the last six months.
  const byProduct = new Map<string, Array<{ supplierKey: string; cents: number; qty: number; recentQty: number }>>();
  for (const [id, byMonth] of prices) {
    const [productKey, unit, supplierKey] = id.split("|");
    let cents = 0;
    let qty = 0;
    let recentQty = 0;
    for (const [key, price] of byMonth) {
      if (key > month || key < shiftMonth(month, -5)) continue;
      cents += price.cents;
      qty += price.qty;
      if (key >= shiftMonth(month, -2)) recentQty += price.qty;
    }
    if (!qty) continue;
    const productId = `${productKey}|${unit}`;
    byProduct.set(productId, [...(byProduct.get(productId) ?? []), { supplierKey, cents, qty, recentQty }]);
  }
  for (const [productId, offers] of byProduct) {
    if (offers.length < 2) continue;
    const [productKey, unit] = productId.split("|");
    const sorted = offers.map((offer) => ({ ...offer, unitPrice: offer.cents / 100 / offer.qty })).sort((a, b) => a.unitPrice - b.unitPrice);
    const cheapest = sorted[0];
    for (const dearer of sorted.slice(1)) {
      if (dearer.unitPrice < cheapest.unitPrice * 1.05 || !dearer.recentQty) continue;
      const yearlyCents = Math.round((dearer.unitPrice - cheapest.unitPrice) * (dearer.recentQty / 3) * 12 * 100);
      if (yearlyCents < 3000) continue;
      savings.push({
        id: `fornitore:${productKey}:${dearer.supplierKey}`,
        kind: "fornitore",
        title: `${labelOf.get(productKey) ?? productKey}: costa meno da ${supplierNameOf.get(cheapest.supplierKey)}`,
        detail: `Da ${supplierNameOf.get(dearer.supplierKey)} lo paghi ${unitPriceText(dearer.unitPrice, unit)}, da ${supplierNameOf.get(cheapest.supplierKey)} ${unitPriceText(cheapest.unitPrice, unit)}. Comprandolo tutto al prezzo più basso: circa ${euros(yearlyCents)} all'anno.`,
        yearlyCents,
        confidence: "sicuro",
        productKey,
      });
    }
  }

  // Prices found on the web, lower than ours.
  for (const product of topProducts) {
    const check = lastCheck.get(product.productKey);
    if (!check?.bestUnitPrice || !product.unitPrice || check.bestUnitPrice >= product.unitPrice * 0.95) continue;
    const offers = (Array.isArray(check.offers) ? check.offers : []) as Array<{ seller?: string; url?: string; unitPrice?: number; sameProduct?: boolean }>;
    const best = offers.filter((offer) => offer.sameProduct !== false).sort((a, b) => (a.unitPrice ?? 0) - (b.unitPrice ?? 0))[0];
    const monthlyQty = product.quantity ?? 0;
    const yearlyCents = Math.round((product.unitPrice - check.bestUnitPrice) * monthlyQty * 12 * 100);
    if (yearlyCents < 3000) continue;
    savings.push({
      id: `online:${product.productKey}`,
      kind: "online",
      title: `${product.label}: online a ${unitPriceText(check.bestUnitPrice, product.unit)}`,
      detail: `Tu lo paghi ${unitPriceText(product.unitPrice, product.unit)}. Con le quantità di questo mese sarebbero circa ${euros(yearlyCents)} all'anno, ma controlla consegna, minimi d'ordine e condizioni del fornitore attuale (comodato, sconti, assistenza).`,
      yearlyCents,
      confidence: "da verificare",
      productKey: product.productKey,
      link: best?.url ? { label: best.seller || "Vedi offerta", url: best.url } : undefined,
    });
  }

  if (energy?.componentUnitCost && energy.kwh > 0) {
    const check = (await prisma.priceCheck.findFirst({ where: { barId, productKey: "energia-elettrica" }, orderBy: { checkedAt: "desc" } })) ?? null;
    if (check?.bestUnitPrice && check.bestUnitPrice < energy.componentUnitCost * 0.95) {
      const yearlyCents = Math.round((energy.componentUnitCost - check.bestUnitPrice) * energy.kwh * 12 * 100);
      if (yearlyCents >= 3000) {
        const offers = (Array.isArray(check.offers) ? check.offers : []) as Array<{ seller?: string; url?: string }>;
        savings.push({
          id: "energia",
          kind: "energia",
          title: `Luce: offerta a ${unitPriceText(check.bestUnitPrice, "kwh")} per la sola energia`,
          detail: `Sulla tua bolletta la parte energia costa ${unitPriceText(energy.componentUnitCost, "kwh")}. Con i consumi di questo mese sono circa ${euros(yearlyCents)} all'anno. Trasporto, oneri e accise restano uguali con qualunque fornitore.`,
          yearlyCents,
          confidence: "da verificare",
          link: offers[0]?.url ? { label: offers[0].seller || "Vedi offerta", url: offers[0].url } : undefined,
        });
      }
    }
  }
  savings.sort((a, b) => (b.yearlyCents ?? 0) - (a.yearlyCents ?? 0));

  // Product by product, across suppliers: this month against the last.
  type Bucket = { cents: number; qty: number; qtyCents: number };
  const productMonths = new Map<string, { label: string; unit: string; category: string; byMonth: Map<string, Bucket> }>();
  for (const line of lines) {
    if (!line.productKey || line.baseUnit === "kwh" || line.baseUnit === "smc") continue;
    if (CATEGORY_BY_KEY.get(line.category)?.key === "energia") continue;
    const id = `${line.productKey}|${line.baseUnit ?? ""}`;
    const entry = productMonths.get(id) ?? { label: line.productLabel ?? line.productKey, unit: line.baseUnit ?? "", category: line.category, byMonth: new Map<string, Bucket>() };
    const bucket = entry.byMonth.get(line.month) ?? { cents: 0, qty: 0, qtyCents: 0 };
    bucket.cents += line.totalCents;
    if (line.baseQty && line.baseQty > 0 && line.totalCents > 0) {
      bucket.qty += line.baseQty;
      bucket.qtyCents += line.totalCents;
    }
    entry.byMonth.set(line.month, bucket);
    productMonths.set(id, entry);
  }
  const unitOf = (bucket: Bucket | undefined) => (bucket && bucket.qty > 0 ? bucket.qtyCents / 100 / bucket.qty : null);
  const market = await loadMarket(barId);
  // Against the market: the furthest month back, up to three, where both are known.
  const marketOf = (productKey: string, label: string, byMonth: Map<string, Bucket>) => {
    const index = indexFor(productKey, label);
    const series = index ? market.get(index.key) : undefined;
    const now = unitOf(byMonth.get(month));
    if (!index || !series || now === null || !series.has(month)) return null;
    for (const back of [3, 2, 1]) {
      const from = shiftMonth(month, -back);
      const then = unitOf(byMonth.get(from));
      const marketPct = changeBetween(series, from, month);
      if (then === null || marketPct === null) continue;
      return { key: index.key, label: index.label, source: index.source, months: back, productPct: (now / then - 1) * 100, marketPct };
    }
    return null;
  };
  const productTrends: ProductTrend[] = [];
  let quantityCents = 0;
  let priceCents = 0;
  let newCents = 0;
  let goneCents = 0;
  for (const [id, entry] of productMonths) {
    const now = entry.byMonth.get(month);
    const before = entry.byMonth.get(previous);
    if (!now && !before) continue;
    const unitPrice = unitOf(now);
    const previousUnitPrice = unitOf(before);
    let quantityPart = 0;
    let pricePart = 0;
    if (now && before && unitPrice !== null && previousUnitPrice !== null) {
      quantityPart = Math.round((now.qty - before.qty) * previousUnitPrice * 100);
      pricePart = Math.round((unitPrice - previousUnitPrice) * now.qty * 100);
      quantityCents += quantityPart;
      priceCents += pricePart;
    } else if (now && !before) {
      newCents += now.cents;
    } else if (!now && before) {
      goneCents += before.cents;
    }
    productTrends.push({
      productKey: id.split("|")[0],
      label: entry.label,
      unit: entry.unit,
      category: entry.category,
      cents: now?.cents ?? 0,
      previousCents: before?.cents ?? 0,
      quantity: now?.qty || null,
      previousQuantity: before?.qty || null,
      unitPrice,
      previousUnitPrice,
      twoMonthsUnitPrice: unitOf(entry.byMonth.get(shiftMonth(month, -2))),
      lastYearUnitPrice: unitOf(entry.byMonth.get(shiftMonth(month, -12))),
      quantityCents: quantityPart,
      priceCents: pricePart,
      market: marketOf(id.split("|")[0], entry.label, entry.byMonth),
    });
  }
  productTrends.sort((a, b) => b.cents - a.cents || b.previousCents - a.previousCents);
  // A supplier's price that rose well past its market's.
  for (const trend of productTrends) {
    const gap = trend.market ? trend.market.productPct - trend.market.marketPct : 0;
    if (!trend.market || gap < 3 || trend.unitPrice === null || !trend.quantity) continue;
    const fair = trend.unitPrice / (1 + trend.market.productPct / 100) * (1 + trend.market.marketPct / 100);
    const yearlyCents = Math.round((trend.unitPrice - fair) * trend.quantity * 12 * 100);
    if (yearlyCents < 3000) continue;
    const pct = (value: number) => `${value > 0 ? "+" : "−"}${Math.abs(value).toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`;
    savings.push({
      id: `mercato:${trend.productKey}`,
      kind: "aumento",
      title: `${trend.label}: ${pct(trend.market.productPct)} contro il mercato ${pct(trend.market.marketPct)}`,
      detail: `In ${trend.market.months === 1 ? "un mese" : `${trend.market.months} mesi`} il prezzo che paghi è cambiato del ${pct(trend.market.productPct)}, il mercato (${trend.market.label}, ${trend.market.source}) del ${pct(trend.market.marketPct)}. Se seguisse il mercato pagheresti circa ${euros(yearlyCents)} in meno all'anno: è un buon argomento con il fornitore.`,
      yearlyCents,
      confidence: "sicuro",
      productKey: trend.productKey,
    });
  }
  savings.sort((a, b) => (b.yearlyCents ?? 0) - (a.yearlyCents ?? 0));
  const monthStory = availableMonths.includes(previous)
    ? { deltaCents: monthTotal(month) - monthTotal(previous), quantityCents, priceCents, newCents, goneCents }
    : null;

  const [laborNow, laborPrevious, revenue, pendingLines] = await Promise.all([
    laborCost(barId, month),
    availableMonths.includes(previous) ? laborCost(barId, previous) : Promise.resolve(null),
    prisma.monthlyRevenue.findUnique({ where: { barId_month: { barId, month } } }),
    prisma.supplierInvoiceLine.count({ where: { barId, category: "da_classificare", invoice: { issueDate: { gte: monthRange(month).start, lt: end } } } }),
  ]);

  return {
    month,
    availableMonths,
    invoiceCount: new Set(current.map((line) => line.invoiceId)).size,
    suppliersCents,
    previousSuppliersCents: availableMonths.includes(previous) ? monthTotal(previous) : null,
    averageSuppliersCents: priorMonths.length ? Math.round(priorMonths.reduce((total, key) => total + monthTotal(key), 0) / priorMonths.length) : null,
    merceCents,
    speseCents: suppliersCents - merceCents,
    labor: laborNow.hours ? { ...laborNow, previousCents: laborPrevious?.cents ?? null } : null,
    revenueCents: revenue?.amountCents ?? null,
    categories,
    suppliers,
    priceChanges: priceChanges.slice(0, 12),
    energy,
    topProducts,
    savings,
    pendingLines,
    productTrends: productTrends.slice(0, 60),
    monthStory,
  };
}
