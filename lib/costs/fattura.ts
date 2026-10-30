import "server-only";

import { unwrapP7m } from "./p7m";
import { child, childrenNamed, decodeXmlBytes, findFirst, parseXml, textAt, type XmlElement } from "./xml";

export type ParsedLine = {
  lineNo: number;
  description: string;
  code: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  totalCents: number;
  vatRate: number | null;
};

export type ParsedInvoice = {
  docType: string;
  supplierName: string;
  /** Country prefix included: "IT01234567890". */
  supplierVat: string | null;
  supplierTaxCode: string | null;
  recipientVat: string | null;
  recipientTaxCode: string | null;
  number: string;
  /** YYYY-MM-DD */
  date: string;
  currency: string;
  totalCents: number;
  taxableCents: number;
  vatCents: number;
  lines: ParsedLine[];
  /** DatiPagamento: one per instalment. Empty when the invoice does not say. */
  payments: ParsedPayment[];
};

export type ParsedPayment = {
  /** YYYY-MM-DD */
  dueDate: string;
  amountCents: number;
  /** MP01..MP23 */
  method: string | null;
  iban: string | null;
};

export type ReadResult =
  | { kind: "invoices"; invoices: ParsedInvoice[]; xml: string }
  | { kind: "skip"; reason: string };

/** Credit notes: their amounts reduce the month's costs. */
const NEGATIVE_TYPES = new Set(["TD04", "TD08"]);

const DOC_LABELS: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD06: "Parcella",
  TD07: "Fattura semplificata",
  TD08: "Nota di credito semplificata",
  TD16: "Integrazione reverse charge",
  TD17: "Autofattura servizi esteri",
  TD18: "Autofattura beni UE",
  TD19: "Autofattura beni esteri",
  TD24: "Fattura differita",
  TD25: "Fattura differita",
};

export function docTypeLabel(code: string) {
  return DOC_LABELS[code] ?? code;
}

function cents(value: string | null) {
  if (!value) return 0;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function decimal(value: string | null) {
  if (!value) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function partyName(anagrafica: XmlElement | undefined) {
  const company = textAt(anagrafica, "Denominazione");
  if (company) return company;
  return [textAt(anagrafica, "Nome"), textAt(anagrafica, "Cognome")].filter(Boolean).join(" ") || null;
}

function vatOf(party: XmlElement | undefined) {
  const id = child(child(party, "DatiAnagrafici"), "IdFiscaleIVA") ?? child(party, "IdFiscaleIVA");
  const country = textAt(id, "IdPaese");
  const code = textAt(id, "IdCodice");
  return code ? `${country ?? "IT"}${code}`.toUpperCase() : null;
}

function taxCodeOf(party: XmlElement | undefined) {
  return textAt(child(party, "DatiAnagrafici"), "CodiceFiscale") ?? textAt(party, "CodiceFiscale");
}

/**
 * One file from the cassetto fiscale or the SDI: a FatturaPA XML, signed or
 * not. A file can hold several invoices (a "lotto"); metadata files and the
 * SDI's receipts that travel in the same zip are recognised and skipped.
 */
export function readInvoiceFile(name: string, bytes: Buffer): ReadResult {
  const lower = name.toLowerCase();
  if (!lower.endsWith(".xml") && !lower.endsWith(".p7m")) return { kind: "skip", reason: "non è una fattura elettronica" };
  if (/_metadato|_md_\d|metadati/i.test(lower)) return { kind: "skip", reason: "file di metadati" };

  let xml: string;
  try {
    xml = decodeXmlBytes(lower.endsWith(".p7m") ? unwrapP7m(bytes) : bytes);
  } catch (error) {
    return { kind: "skip", reason: error instanceof Error ? error.message : "file non leggibile" };
  }

  // Attachments (a PDF copy, often megabytes of base64) are neither read nor kept.
  const stripped = xml.replace(/<([\w-]+:)?Allegati>[\s\S]*?<\/([\w-]+:)?Allegati>/g, "");
  const root = parseXml(stripped);
  const document = findFirst(root, "FatturaElettronica") ?? findFirst(root, "FatturaElettronicaSemplificata");
  if (!document) return { kind: "skip", reason: "non è una fattura (ricevuta o notifica SDI)" };
  const simplified = document.name === "FatturaElettronicaSemplificata";

  const header = child(document, "FatturaElettronicaHeader");
  const supplier = child(header, "CedentePrestatore");
  const recipient = child(header, "CessionarioCommittente");
  const supplierName =
    partyName(child(child(supplier, "DatiAnagrafici"), "Anagrafica")) ??
    textAt(supplier, "Denominazione") ??
    [textAt(supplier, "Nome"), textAt(supplier, "Cognome")].filter(Boolean).join(" ");

  const invoices: ParsedInvoice[] = [];
  for (const body of childrenNamed(document, "FatturaElettronicaBody")) {
    const general = child(child(body, "DatiGenerali"), "DatiGeneraliDocumento");
    const docType = textAt(general, "TipoDocumento") ?? "TD01";
    const sign = NEGATIVE_TYPES.has(docType) ? -1 : 1;
    const goods = child(body, "DatiBeniServizi");
    const lines: ParsedLine[] = [];

    if (simplified) {
      // A simplified invoice repeats DatiBeniServizi, one per line, VAT included.
      for (const [index, item] of childrenNamed(body, "DatiBeniServizi").entries()) {
        lines.push({
          lineNo: index + 1,
          description: textAt(item, "Descrizione") ?? "Riga",
          code: null,
          quantity: null,
          unit: null,
          unitPrice: null,
          totalCents: sign * cents(textAt(item, "Importo")),
          vatRate: decimal(textAt(item, "DatiIVA/Aliquota")),
        });
      }
    } else {
      for (const item of childrenNamed(goods, "DettaglioLinee")) {
        const codes = childrenNamed(item, "CodiceArticolo");
        lines.push({
          lineNo: Number(textAt(item, "NumeroLinea")) || lines.length + 1,
          description: (textAt(item, "Descrizione") ?? "Riga").replace(/\s+/g, " ").slice(0, 1000),
          code: codes.length ? textAt(codes[0], "CodiceValore") : null,
          quantity: decimal(textAt(item, "Quantita")),
          unit: textAt(item, "UnitaMisura"),
          unitPrice: decimal(textAt(item, "PrezzoUnitario")),
          totalCents: sign * cents(textAt(item, "PrezzoTotale")),
          vatRate: decimal(textAt(item, "AliquotaIVA")),
        });
      }
    }

    const summaries = childrenNamed(goods, "DatiRiepilogo");
    const taxable = summaries.length
      ? summaries.reduce((sum, item) => sum + cents(textAt(item, "ImponibileImporto")), 0)
      : lines.reduce((sum, line) => sum + Math.abs(line.totalCents), 0);
    const vat = summaries.reduce((sum, item) => sum + cents(textAt(item, "Imposta")), 0);
    const declaredTotal = textAt(general, "ImportoTotaleDocumento");
    const date = (textAt(general, "Data") ?? "").slice(0, 10);

    // When and how it is paid: the due date as written, or the reference
    // date plus the days of the terms, or the invoice's own date.
    const payments: ParsedPayment[] = [];
    for (const terms of childrenNamed(body, "DatiPagamento")) {
      for (const detail of childrenNamed(terms, "DettaglioPagamento")) {
        const amountCents = cents(textAt(detail, "ImportoPagamento"));
        if (amountCents <= 0) continue;
        let dueDate = (textAt(detail, "DataScadenzaPagamento") ?? "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
          const from = (textAt(detail, "DataRiferimentoTerminiPagamento") ?? date).slice(0, 10);
          const days = Number(textAt(detail, "GiorniTerminiPagamento") ?? 0) || 0;
          const base = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00Z`) : null;
          if (base) base.setUTCDate(base.getUTCDate() + days);
          dueDate = base ? base.toISOString().slice(0, 10) : date;
        }
        const iban = (textAt(detail, "IBAN") ?? "").replace(/\s+/g, "").toUpperCase();
        payments.push({ dueDate, amountCents, method: textAt(detail, "ModalitaPagamento"), iban: iban || null });
      }
    }

    invoices.push({
      docType,
      supplierName: supplierName || "Fornitore senza nome",
      supplierVat: vatOf(supplier),
      supplierTaxCode: taxCodeOf(supplier),
      recipientVat: vatOf(recipient),
      recipientTaxCode: taxCodeOf(recipient),
      number: textAt(general, "Numero") ?? "s.n.",
      date,
      currency: textAt(general, "Divisa") ?? "EUR",
      totalCents: sign * Math.abs(declaredTotal ? cents(declaredTotal) : taxable + vat),
      taxableCents: sign * Math.abs(taxable),
      vatCents: sign * Math.abs(vat),
      lines,
      // A credit note is money back, not a payment to make.
      payments: sign < 0 ? [] : payments,
    });
  }

  if (!invoices.length) return { kind: "skip", reason: "fattura senza corpo" };
  return { kind: "invoices", invoices, xml: stripped };
}
