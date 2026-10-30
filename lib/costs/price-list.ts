import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

/**
 * A supplier's price list - PDF, Excel or CSV - read by Claude into rows
 * Workbit can compare: each product under the same name the invoices use
 * ("lamiera-inox-aisi-304"), at its price per kg, litre or piece, VAT
 * excluded. Nobody types a list in.
 */

const MODEL = process.env.COSTS_AI_MODEL?.trim() || "claude-haiku-5-5";
let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          productKey: { type: "string" },
          productLabel: { type: "string" },
          baseUnit: { type: "string", enum: ["kg", "l", "pz"] },
          unitPrice: { type: "number" },
        },
        required: ["description", "productKey", "productLabel", "baseUnit", "unitPrice"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

export type ListRow = { description: string; productKey: string; productLabel: string; baseUnit: string; unitPrice: number };

async function sheetText(bytes: Buffer) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  const parts: string[] = [];
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row, number) => {
      if (number > 3000) return;
      parts.push((row.values as unknown[]).slice(1).map((value) => (value === null || value === undefined ? "" : String(typeof value === "object" && "result" in (value as object) ? (value as { result: unknown }).result : value))).join(" | "));
    });
  });
  return parts.join("\n").slice(0, 180_000);
}

export async function readPriceList(input: { fileName: string; bytes: Buffer; supplierName: string }): Promise<ListRow[]> {
  // The names the invoices already use, so a list price lands on the same product.
  const known = await prisma.supplierInvoiceLine.groupBy({
    by: ["productKey", "productLabel", "baseUnit"],
    where: { productKey: { not: null }, baseUnit: { in: ["kg", "l", "pz"] } },
    _count: { _all: true },
    orderBy: { _count: { productKey: "desc" } },
    take: 400,
  });
  const names = known.map((item) => `${item.productKey} (${item.productLabel}, ${item.baseUnit})`).join("\n");
  const instructions = `Questo è il listino prezzi del fornitore "${input.supplierName}". Estrai ogni prodotto con il suo prezzo.
Per ogni riga:
- description: come è scritto nel listino.
- productKey: identità del prodotto indipendente dal fornitore, minuscolo con trattini. Se corrisponde a uno di questi già usati nelle fatture, usa ESATTAMENTE quello:
${names || "(nessuno ancora)"}
Altrimenti costruiscilo così: marca-prodotto-formato per i beni di consumo ("lavazza-crema-aroma-grani-1kg"), materiale-qualità-forma senza misure variabili per i materiali ("lamiera-inox-aisi-304").
- productLabel: nome breve e leggibile in italiano.
- baseUnit: "kg", "l" o "pz".
- unitPrice: il prezzo per UNA unità base (un kg, un litro, un pezzo), IVA esclusa, già scontato se il listino indica lo sconto. Se il prezzo è per confezione, dividilo per il contenuto; se è a tonnellata, dividi per 1000; a quintale per 100.
Salta le righe senza prezzo, i titoli e le note. Non inventare prezzi.`;

  const lower = input.fileName.toLowerCase();
  const content: Anthropic.Beta.BetaContentBlockParam[] = lower.endsWith(".pdf")
    ? [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.bytes.toString("base64") } },
        { type: "text", text: instructions },
      ]
    : [
        {
          type: "text",
          text: `${instructions}\n\nIl listino:\n${lower.endsWith(".xlsx") || lower.endsWith(".xlsm") ? await sheetText(input.bytes) : input.bytes.toString("utf8").slice(0, 180_000)}`,
        },
      ];

  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 32000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") return [];
  const text = response.content.find((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text) as { items: ListRow[] };
    return parsed.items
      .filter((item) => item.unitPrice > 0 && item.unitPrice < 100_000 && /^[a-z0-9-]{3,120}$/.test(item.productKey))
      .slice(0, 3000);
  } catch {
    console.error("[price-list] answer not readable", response.stop_reason);
    return [];
  }
}

/** Reads and saves a list, replacing the same supplier's earlier one. */
export async function importPriceList(input: { fileName: string; bytes: Buffer; supplierName: string; zone: string | null; validFrom: Date; barId: string | null }) {
  const rows = await readPriceList(input);
  if (!rows.length) return 0;
  await prisma.supplierListPrice.deleteMany({ where: { supplierName: input.supplierName, barId: input.barId, source: "listino" } });
  await prisma.supplierListPrice.createMany({
    data: rows.map((row) => ({
      supplierName: input.supplierName,
      zone: input.zone,
      productKey: row.productKey,
      productLabel: row.productLabel.slice(0, 200),
      baseUnit: row.baseUnit,
      unitPrice: row.unitPrice,
      description: row.description.slice(0, 300),
      validFrom: input.validFrom,
      source: "listino",
      barId: input.barId,
    })),
  });
  return rows.length;
}
