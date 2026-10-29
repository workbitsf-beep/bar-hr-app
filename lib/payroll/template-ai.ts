import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { RuleError } from "@/lib/rule-error";
import { DATE_FORMATS, FIELD_LABELS, PAYROLL_CODE_LABELS, PAYROLL_KINDS, templateOf, type PayrollTemplate } from "./template";

/**
 * A file the consultant already uses - last month's sheet, their import
 * layout - read by Claude and turned into a template, so Workbit writes the
 * same file: same columns in the same order, same names, same codes, same
 * date and number formats. The owner checks the result before saving.
 */
// Haiku for now: cheap enough for every invoice line. COSTS_AI_MODEL switches it
// (for example to claude-opus-5-5) without a release.
const MODEL = process.env.COSTS_AI_MODEL?.trim() || "claude-haiku-5-5";

export function templateAiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

/** The first rows of every sheet, as text a model can read. */
async function sampleText(name: string, bytes: Buffer) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm")) {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    const parts: string[] = [];
    workbook.eachSheet((sheet) => {
      const rows: string[] = [];
      sheet.eachRow({ includeEmpty: false }, (row, number) => {
        if (number > 40) return;
        const cells = (row.values as unknown[]).slice(1).map((value) => {
          if (value instanceof Date) return `[data ${value.toISOString().slice(0, 10)}]`;
          if (value && typeof value === "object") {
            const rich = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
            if (rich.richText) return rich.richText.map((piece) => piece.text).join("");
            if (rich.result !== undefined) return String(rich.result);
            if (rich.text) return rich.text;
          }
          return value === undefined || value === null ? "" : String(value);
        });
        rows.push(`r${number}: ${cells.map((cell) => JSON.stringify(cell)).join(" | ")}`);
      });
      parts.push(`Foglio "${sheet.name}" (${sheet.rowCount} righe):\n${rows.join("\n")}`);
    });
    return { kind: "xlsx" as const, text: parts.join("\n\n").slice(0, 30_000), encoding: null };
  }
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    let text: string;
    let encoding: "utf8bom" | "utf8" | "latin1";
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      encoding = hasBom ? "utf8bom" : "utf8";
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
      encoding = "latin1";
    }
    return { kind: "csv" as const, text: text.replace(/^﻿/, "").split(/\r?\n/).slice(0, 40).join("\n").slice(0, 20_000), encoding };
  }
  throw new RuleError("Carica un file Excel (.xlsx) o CSV: gli altri formati non si leggono ancora.");
}

const FIELDS = Object.keys(FIELD_LABELS);

const SCHEMA = {
  type: "object",
  properties: {
    layout: { type: "string", enum: ["rows", "perCode", "perPerson", "calendar"] },
    columns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string", enum: FIELDS },
          header: { type: "string" },
          value: { type: "string" },
        },
        required: ["field", "header", "value"],
        additionalProperties: false,
      },
    },
    personKinds: { type: "array", items: { type: "string", enum: PAYROLL_KINDS } },
    personHeader: { type: "string", enum: ["code", "label"] },
    personDayUnit: { type: "string", enum: ["days", "hours"] },
    calendarCell: { type: "string", enum: ["hours", "codeHours"] },
    calendarTotals: { type: "boolean" },
    codes: {
      type: "object",
      properties: Object.fromEntries(PAYROLL_KINDS.map((kind) => [kind, { type: "string" }])),
      required: PAYROLL_KINDS,
      additionalProperties: false,
    },
    csvSeparator: { type: "string", enum: [";", ",", "\t", "|"] },
    headerRow: { type: "boolean" },
    dateFormat: { type: "string", enum: DATE_FORMATS },
    decimal: { type: "string", enum: ["comma", "dot"] },
    hoursFormat: { type: "string", enum: ["decimal", "hhmm"] },
    sheetName: { type: "string" },
    notes: { type: "array", items: { type: "string" } },
  },
  required: [
    "layout",
    "columns",
    "personKinds",
    "personHeader",
    "personDayUnit",
    "calendarCell",
    "calendarTotals",
    "codes",
    "csvSeparator",
    "headerRow",
    "dateFormat",
    "decimal",
    "hoursFormat",
    "sheetName",
    "notes",
  ],
  additionalProperties: false,
};

const SYSTEM = `Ricevi l'inizio di un file di presenze che un consulente del lavoro italiano usa per le paghe (un Excel o un CSV). Devi descriverlo come modello, perché Workbit possa scrivere ogni mese un file identico con i dati del locale.

Forme possibili (layout):
- "rows": una riga per persona, giorno e causale (tracciato giornaliero).
- "perCode": una riga per persona e causale, con i totali del mese.
- "perPerson": una riga per persona; le colonne fisse (columns) vengono prima, poi una colonna per causale (personKinds, nell'ordine del file). personHeader "code" se le intestazioni sono i codici (ORD, STR…), "label" se sono nomi. personDayUnit "days" se ferie e malattia sono in giorni, "hours" se in ore.
- "calendar": persone in riga e giorni del mese in colonna. columns sono solo le colonne prima dei giorni. calendarCell "hours" se le caselle hanno solo numeri, "codeHours" se hanno anche codici (FER, MAL…). calendarTotals se c'è una colonna di totale dopo i giorni.

Campi delle colonne (field): ${Object.entries(FIELD_LABELS)
  .map(([key, label]) => `"${key}" = ${label}`)
  .join("; ")}. Usa "fisso" per una colonna con lo stesso valore su ogni riga (codice azienda, codice sede…) e mettilo in value; per gli altri campi value è "". header è l'intestazione esatta del file, maiuscole comprese.

Causali (codes): il codice che il file usa per ${PAYROLL_KINDS.map((kind) => `${kind} (${PAYROLL_CODE_LABELS[kind]})`).join(", ")}. Se nel file non compare un codice, usa quello più comune in Italia (ORD, STR, FER, PER/ROL, MAL, CHI, FES, FOR). Una stringa vuota esclude quella causale dal file: usala solo se il file mostra chiaramente di non volerla.

Formati: dateFormat come appaiono le date (le date di Excel arrivano come [data aaaa-mm-gg]: in quel caso usa "dd/mm/yyyy"); decimal "comma" o "dot"; hoursFormat "hhmm" se le ore sono scritte 8:30, altrimenti "decimal"; csvSeparator del CSV (per un Excel ";"); headerRow se la prima riga utile è di intestazioni; sheetName il nome del foglio con i dati.

Se ci sono righe di titolo sopra le intestazioni, ignorale. In notes scrivi in italiano, brevi, le cose che il titolare deve sapere: colonne che Workbit non può riempire (le lascerai fuori), dubbi, codici indovinati.`;

export type TemplateGuess = { template: PayrollTemplate; notes: string[] };

export async function templateFromSample(name: string, bytes: Buffer): Promise<TemplateGuess> {
  if (!templateAiEnabled()) throw new RuleError("La lettura automatica del file non è ancora attiva: imposta il formato a mano.");
  const sample = await sampleText(name, bytes);
  if (!sample.text.trim()) throw new RuleError("Il file è vuoto.");

  const response = await anthropic().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: `File "${name}" (${sample.kind}):\n\n${sample.text}` }],
  });
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    throw new RuleError("Non sono riuscito a leggere il file: imposta il formato a mano.");
  }
  const text = response.content.filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text").at(-1)?.text ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new RuleError("Non sono riuscito a leggere il file: imposta il formato a mano.");
  }

  // The sample's own name, with its month made a placeholder; without a month in it, ours.
  const guessedName = name.replace(/\.[^.]+$/, "").replace(/\d{4}[-_ ]?\d{2}|\d{2}[-_ ]?\d{4}/, "{anno}-{mese}");
  const template = templateOf({
    ...parsed,
    fileType: sample.kind,
    encoding: sample.encoding ?? "utf8bom",
    summarySheet: false,
    skipEmpty: true,
    fileName: guessedName.includes("{anno}") ? guessedName : undefined,
  });
  const notes = Array.isArray(parsed.notes) ? parsed.notes.filter((note): note is string => typeof note === "string").slice(0, 8) : [];
  return { template, notes };
}
