import "server-only";

import { gzipSync } from "node:zlib";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyLines, aiEnabled } from "./ai";
import {
  categorizeByRules,
  normalizeText,
  productKeyFromDescription,
  unitsFromDescription,
} from "./categories";
import { readInvoiceFile, type ParsedInvoice, type ParsedLine } from "./fattura";
import { savePayments } from "./payments";
import { isZip, readZip } from "./zip";

export type ImportSummary = {
  found: number;
  imported: number;
  duplicates: number;
  skipped: number;
  failed: number;
  notes: string[];
  /** Invoices dated in these months ("2026-10"), for the page to open on. */
  months: string[];
};

function digits(value: string | null | undefined) {
  return (value ?? "").replace(/^[A-Z]{2}/i, "").replace(/\D/g, "");
}

export function supplierKeyOf(invoice: { supplierVat: string | null; supplierTaxCode?: string | null; supplierName: string }) {
  return invoice.supplierVat || invoice.supplierTaxCode || normalizeText(invoice.supplierName);
}

/** The same line on the same supplier's invoices: its article code, or its words. */
export function lineKeyOf(supplierKey: string, line: { code: string | null; description: string }) {
  const what = line.code ? `#${line.code.trim().toUpperCase()}` : normalizeText(line.description).slice(0, 160);
  return `${supplierKey}|${what}`;
}

type Mapping = {
  category: string;
  categorySource: string;
  productKey: string | null;
  productLabel: string | null;
  baseUnit: string | null;
  unitsPerItem: number | null;
};

function baseQtyOf(line: { quantity: number | null }, mapping: Pick<Mapping, "baseUnit" | "unitsPerItem">) {
  if (!mapping.baseUnit || !mapping.unitsPerItem) return null;
  // A line with no quantity is one of them (a monthly fee, a single delivery).
  return (line.quantity ?? 1) * mapping.unitsPerItem;
}

async function mappingsFor(barId: string, invoices: ParsedInvoice[]) {
  const keys = new Set<string>();
  const suppliers = new Set<string>();
  for (const invoice of invoices) {
    const supplierKey = supplierKeyOf(invoice);
    suppliers.add(supplierKey);
    for (const line of invoice.lines) keys.add(lineKeyOf(supplierKey, line));
  }
  const [maps, supplierRules] = await Promise.all([
    prisma.supplierProductMap.findMany({ where: { scope: { in: ["", barId] }, key: { in: [...keys] } } }),
    prisma.supplierCategory.findMany({ where: { barId, supplierKey: { in: [...suppliers] } } }),
  ]);
  const own = new Map(maps.filter((map) => map.scope === barId).map((map) => [map.key, map]));
  const shared = new Map(maps.filter((map) => map.scope === "").map((map) => [map.key, map]));
  const bySupplier = new Map(supplierRules.map((rule) => [rule.supplierKey, rule.category]));

  return (invoice: ParsedInvoice, line: ParsedLine): Mapping => {
    const supplierKey = supplierKeyOf(invoice);
    const key = lineKeyOf(supplierKey, line);
    const guessed = unitsFromDescription(line.description, line.unit);
    const fallbackProduct = {
      productKey: productKeyFromDescription(line.description) || null,
      productLabel: line.description.slice(0, 120),
      baseUnit: guessed?.baseUnit ?? null,
      unitsPerItem: guessed?.unitsPerItem ?? null,
    };
    const mine = own.get(key);
    if (mine) return { ...mine, categorySource: "user" };
    const supplierCategory = bySupplier.get(supplierKey);
    const known = shared.get(key);
    if (supplierCategory) {
      return { ...(known ?? fallbackProduct), category: supplierCategory, categorySource: "supplier" };
    }
    if (known) return { ...known, categorySource: known.source };
    const ruled = categorizeByRules(line.description, invoice.supplierName, line.unit);
    return { ...fallbackProduct, category: ruled ?? "da_classificare", categorySource: ruled ? "rule" : "none" };
  };
}

/**
 * Supplier invoices into the venue's costs: a zip from the cassetto fiscale,
 * loose XML or P7M files, or one invoice received through Openapi. Invoices
 * the venue issued, invoices made out to someone else and ones already there
 * are counted and left out, so uploading the same month twice is harmless.
 */
export async function importInvoiceFiles(input: {
  barId: string;
  files: Array<{ name: string; data: Buffer }>;
  source: "upload" | "openapi";
  uploadId?: string | null;
  openapiUuid?: string | null;
  /** Super admin trying a customer's zip in a test venue: any recipient. */
  anyRecipient?: boolean;
}): Promise<ImportSummary> {
  const summary: ImportSummary = { found: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0, notes: [], months: [] };
  const months = new Set<string>();
  const bar = await prisma.bar.findUnique({
    where: { id: input.barId },
    select: { vatNumber: true, mainBar: { select: { vatNumber: true } } },
  });
  const ownVat = digits(bar?.vatNumber || bar?.mainBar?.vatNumber);
  const note = (text: string) => {
    if (summary.notes.length < 40) summary.notes.push(text);
  };

  const parsed: ParsedInvoice[] = [];
  const xmlOf = new Map<ParsedInvoice, string>();
  const files = input.files.flatMap((file) => {
    if (!isZip(file.data)) return [file];
    try {
      return readZip(file.data);
    } catch (error) {
      summary.failed += 1;
      note(`${file.name}: ${error instanceof Error ? error.message : "zip non leggibile"}`);
      return [];
    }
  });

  for (const file of files) {
    const result = readInvoiceFile(file.name, file.data);
    const shortName = file.name.split("/").at(-1) ?? file.name;
    if (result.kind === "skip") {
      // Receipts and metadata travel with the invoices: not worth a word each.
      if (!/metadati|ricevuta|notifica|non è una fattura elettronica/.test(result.reason)) {
        summary.failed += 1;
        note(`${shortName}: ${result.reason}`);
      }
      continue;
    }
    for (const invoice of result.invoices) {
      summary.found += 1;
      if (ownVat && digits(invoice.supplierVat) === ownVat) {
        summary.skipped += 1;
        note(`${invoice.supplierName} n. ${invoice.number}: emessa dal locale, non è un costo`);
        continue;
      }
      const recipient = [digits(invoice.recipientVat), digits(invoice.recipientTaxCode)].filter(Boolean);
      if (ownVat && recipient.length && !recipient.includes(ownVat) && !input.anyRecipient) {
        summary.skipped += 1;
        note(`${invoice.supplierName} n. ${invoice.number}: intestata a un'altra partita IVA (${invoice.recipientVat ?? invoice.recipientTaxCode})`);
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.date)) {
        summary.failed += 1;
        note(`${invoice.supplierName} n. ${invoice.number}: data mancante`);
        continue;
      }
      parsed.push(invoice);
      xmlOf.set(invoice, result.xml);
    }
  }

  if (!parsed.length) return summary;
  const mapFor = await mappingsFor(input.barId, parsed);

  for (const invoice of parsed) {
    const dedupeKey = [supplierKeyOf(invoice), invoice.number, invoice.date, invoice.docType].join("|");
    const existing = await prisma.supplierInvoice.findUnique({
      where: { barId_dedupeKey: { barId: input.barId, dedupeKey } },
      select: { id: true },
    });
    if (existing) {
      summary.duplicates += 1;
      continue;
    }
    try {
      const created = await prisma.supplierInvoice.create({
        data: {
          barId: input.barId,
          source: input.source,
          uploadId: input.uploadId ?? null,
          openapiUuid: input.openapiUuid ?? null,
          dedupeKey,
          docType: invoice.docType,
          supplierName: invoice.supplierName.slice(0, 200),
          supplierVat: invoice.supplierVat,
          supplierTaxCode: invoice.supplierTaxCode,
          number: invoice.number.slice(0, 60),
          issueDate: new Date(`${invoice.date}T00:00:00.000Z`),
          currency: invoice.currency,
          totalCents: invoice.totalCents,
          taxableCents: invoice.taxableCents,
          vatCents: invoice.vatCents,
          xmlGz: gzipSync(Buffer.from(xmlOf.get(invoice) ?? "", "utf8")),
          lines: {
            create: invoice.lines.map((line) => {
              const mapping = mapFor(invoice, line);
              return {
                barId: input.barId,
                lineNo: line.lineNo,
                description: line.description,
                code: line.code,
                quantity: line.quantity,
                unit: line.unit,
                unitPrice: line.unitPrice,
                totalCents: line.totalCents,
                vatRate: line.vatRate,
                category: mapping.category,
                categorySource: mapping.categorySource === "none" ? null : mapping.categorySource,
                productKey: mapping.productKey,
                productLabel: mapping.productLabel,
                baseUnit: mapping.baseUnit,
                baseQty: baseQtyOf(line, mapping),
              };
            }),
          },
        },
      });
      await savePayments(input.barId, created.id, invoice.payments).catch((error) =>
        console.error("[costs] payment terms not saved", error instanceof Error ? error.message : error),
      );
      summary.imported += 1;
      months.add(invoice.date.slice(0, 7));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        summary.duplicates += 1;
      } else {
        summary.failed += 1;
        note(`${invoice.supplierName} n. ${invoice.number}: non salvata`);
        console.error("[costs] invoice not saved", error);
      }
    }
  }

  summary.months = [...months].sort();
  return summary;
}

/**
 * Claude's pass over what the rules only guessed: category, product and size
 * for each distinct line, learnt once for every venue. Run after an import,
 * off the request; lines the owner corrected are never touched.
 */
export async function classifyPendingLines(barId: string) {
  if (!aiEnabled()) return 0;
  const lines = await prisma.supplierInvoiceLine.findMany({
    where: { barId, OR: [{ categorySource: null }, { categorySource: "rule" }] },
    select: {
      id: true,
      description: true,
      code: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      invoice: { select: { supplierName: true, supplierVat: true, supplierTaxCode: true } },
    },
    take: 3000,
  });
  if (!lines.length) return 0;

  const byKey = new Map<string, typeof lines>();
  for (const line of lines) {
    const key = lineKeyOf(supplierKeyOf(line.invoice), line);
    byKey.set(key, [...(byKey.get(key) ?? []), line]);
  }
  const keys = [...byKey.keys()].slice(0, 600);
  const known = new Map(
    (await prisma.supplierProductMap.findMany({ where: { scope: "", key: { in: keys }, source: "ai" } })).map((map) => [map.key, map]),
  );

  const toAsk = keys.filter((key) => !known.has(key));
  const answers = await classifyLines(
    toAsk.map((key, index) => {
      const sample = byKey.get(key)![0];
      return {
        id: String(index),
        supplier: sample.invoice.supplierName,
        description: sample.description,
        code: sample.code,
        unit: sample.unit,
        unitPrice: sample.unitPrice,
      };
    }),
  );
  for (const answer of answers) {
    const key = toAsk[Number(answer.id)];
    if (!key) continue;
    const fields = {
      category: answer.category,
      productKey: answer.productKey,
      productLabel: answer.productLabel,
      baseUnit: answer.baseUnit,
      unitsPerItem: answer.unitsPerItem,
      source: "ai",
    };
    const saved = await prisma.supplierProductMap.upsert({
      where: { scope_key: { scope: "", key } },
      create: { scope: "", key, ...fields },
      update: fields,
    });
    known.set(key, saved);
  }

  let updated = 0;
  for (const key of keys) {
    const map = known.get(key);
    if (!map) continue;
    for (const line of byKey.get(key)!) {
      await prisma.supplierInvoiceLine.update({
        where: { id: line.id },
        data: {
          category: map.category,
          categorySource: "ai",
          productKey: map.productKey,
          productLabel: map.productLabel,
          baseUnit: map.baseUnit,
          baseQty: baseQtyOf(line, map),
        },
      });
      updated += 1;
    }
  }
  return updated;
}

/** The owner's correction: this line, and the same line on every invoice of that supplier. */
export async function correctLineCategory(input: { barId: string; lineId: string; category: string; wholeSupplier: boolean }) {
  const line = await prisma.supplierInvoiceLine.findFirst({
    where: { id: input.lineId, barId: input.barId },
    select: {
      description: true,
      code: true,
      productKey: true,
      productLabel: true,
      baseUnit: true,
      quantity: true,
      baseQty: true,
      invoice: { select: { supplierName: true, supplierVat: true, supplierTaxCode: true } },
    },
  });
  if (!line) return 0;
  const supplierKey = supplierKeyOf(line.invoice);
  const supplierWhere = line.invoice.supplierVat
    ? { supplierVat: line.invoice.supplierVat }
    : { supplierName: line.invoice.supplierName };

  if (input.wholeSupplier) {
    await prisma.supplierCategory.upsert({
      where: { barId_supplierKey: { barId: input.barId, supplierKey } },
      create: { barId: input.barId, supplierKey, category: input.category },
      update: { category: input.category },
    });
    const result = await prisma.supplierInvoiceLine.updateMany({
      where: { barId: input.barId, invoice: supplierWhere, OR: [{ categorySource: null }, { categorySource: { not: "user" } }] },
      data: { category: input.category, categorySource: "supplier" },
    });
    return result.count;
  }

  const key = lineKeyOf(supplierKey, line);
  const unitsPerItem = line.baseQty && line.quantity ? line.baseQty / line.quantity : null;
  await prisma.supplierProductMap.upsert({
    where: { scope_key: { scope: input.barId, key } },
    create: {
      scope: input.barId,
      key,
      category: input.category,
      productKey: line.productKey,
      productLabel: line.productLabel,
      baseUnit: line.baseUnit,
      unitsPerItem,
      source: "user",
    },
    update: { category: input.category, source: "user" },
  });
  const result = await prisma.supplierInvoiceLine.updateMany({
    where: {
      barId: input.barId,
      invoice: supplierWhere,
      ...(line.code ? { code: line.code } : { description: line.description }),
    },
    data: { category: input.category, categorySource: "user" },
  });
  return result.count;
}
