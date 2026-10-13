/**
 * The Italian electronic invoice (FatturaPA, version FPR12) for a
 * subscription Workbit was paid for.
 *
 * Workbit is in the regime forfettario: no VAT is charged (RF19, every line
 * Natura N2.2 at 0%), and above 77,47 € the invoice carries the 2 € stamp
 * duty, paid virtually by Workbit (BolloVirtuale). A change of regime is a
 * change here.
 *
 * Pure: amounts in cents in, an XML string out. Sending it to the SDI is a
 * provider's job (lib/invoicing/provider.ts).
 */

/** The wording the forfettario requires, as Causale (200 characters each). */
export const FORFETTARIO_NOTES = [
  "Operazione in franchigia da IVA ai sensi dell'art. 1, commi 54-89, Legge 190/2014.",
  "Operazione senza applicazione della ritenuta alla fonte a titolo d'acconto ai sensi dell'art. 1, comma 67, Legge 190/2014.",
];
/** The short reference under the totals (100 characters at most). */
export const FORFETTARIO_REFERENCE = "Regime forfettario, art. 1, commi 54-89, L. 190/2014";

/** Above this total (in cents) the invoice carries the 2 € stamp duty. */
export const STAMP_DUTY_THRESHOLD_CENTS = 7747;
export const STAMP_DUTY_CENTS = 200;

export type FiscalIssuer = {
  /** A sole trader signs with name and surname; a company with its name. */
  firstName?: string;
  lastName?: string;
  legalName: string;
  vatNumber: string;
  taxCode: string;
  street: string;
  postalCode: string;
  city: string;
  province: string;
};

export type FiscalRecipient = {
  businessName: string;
  vatNumber: string | null;
  taxCode: string | null;
  /** The 7-character SDI code; "0000000" when the invoice goes by PEC. */
  recipientCode: string | null;
  certifiedEmail: string | null;
  street: string;
  postalCode: string;
  city: string;
  province: string | null;
  countryCode: string;
};

export type FiscalLine = { description: string; amountCents: number };

export type FatturaInput = {
  issuer: FiscalIssuer;
  recipient: FiscalRecipient;
  /** "2026/1". */
  number: string;
  /** Unique per issuer, up to 10 letters or digits: also in the file name. */
  progressive: string;
  date: Date;
  lines: FiscalLine[];
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The SDI takes Latin-1 text; anything else is folded or dropped. */
function text(value: string, max: number) {
  const folded = value
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\x7E -ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return escapeXml(folded.slice(0, max));
}

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function dateOnly(date: Date) {
  // The day in Italy, where the invoice is issued.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function invoiceTotalCents(lines: FiscalLine[]) {
  return lines.reduce((sum, line) => sum + line.amountCents, 0);
}

export function needsStampDuty(lines: FiscalLine[]) {
  return invoiceTotalCents(lines) > STAMP_DUTY_THRESHOLD_CENTS;
}

/** The file name the SDI expects: IT + the sender's tax code + _ + progressive. */
export function fatturaFileName(issuer: Pick<FiscalIssuer, "taxCode" | "vatNumber">, progressive: string) {
  const id = (issuer.taxCode || issuer.vatNumber).toUpperCase();
  return `IT${id}_${progressive}.xml`;
}

/** A short, unique progressive from the year and the invoice's sequence. */
export function fatturaProgressive(year: number, sequence: number) {
  return `${String(year % 100).padStart(2, "0")}${sequence.toString(36).toUpperCase().padStart(3, "0")}`;
}

function el(name: string, content: string | null | undefined) {
  return content === null || content === undefined || content === "" ? "" : `<${name}>${content}</${name}>`;
}

export function buildFatturaXml(input: FatturaInput) {
  const { issuer, recipient } = input;
  const total = invoiceTotalCents(input.lines);
  const foreign = recipient.countryCode.toUpperCase() !== "IT";
  const recipientCode = foreign
    ? "XXXXXXX"
    : (recipient.recipientCode?.trim().toUpperCase() || "0000000").padEnd(7, "0").slice(0, 7);
  const pec = !foreign && recipientCode === "0000000" ? recipient.certifiedEmail?.trim() : null;

  const issuerName =
    issuer.firstName && issuer.lastName
      ? el("Nome", text(issuer.firstName, 60)) + el("Cognome", text(issuer.lastName, 60))
      : el("Denominazione", text(issuer.legalName, 80));

  const recipientVat = recipient.vatNumber?.replace(/^IT/i, "").replace(/\s/g, "") || null;
  const recipientIds =
    (recipientVat
      ? `<IdFiscaleIVA>${el("IdPaese", recipient.countryCode.toUpperCase())}${el("IdCodice", text(recipientVat, 28))}</IdFiscaleIVA>`
      : "") + el("CodiceFiscale", recipient.taxCode ? text(recipient.taxCode.toUpperCase(), 16) : null);

  const lines = input.lines
    .map(
      (line, index) =>
        "<DettaglioLinee>" +
        el("NumeroLinea", String(index + 1)) +
        el("Descrizione", text(line.description, 1000)) +
        el("PrezzoUnitario", money(line.amountCents)) +
        el("PrezzoTotale", money(line.amountCents)) +
        el("AliquotaIVA", "0.00") +
        el("Natura", "N2.2") +
        "</DettaglioLinee>"
    )
    .join("");

  const stamp = needsStampDuty(input.lines)
    ? `<DatiBollo>${el("BolloVirtuale", "SI")}${el("ImportoBollo", money(STAMP_DUTY_CENTS))}</DatiBollo>`
    : "";

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" ' +
    'xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    "<FatturaElettronicaHeader>" +
    "<DatiTrasmissione>" +
    `<IdTrasmittente>${el("IdPaese", "IT")}${el("IdCodice", text((issuer.taxCode || issuer.vatNumber).toUpperCase(), 28))}</IdTrasmittente>` +
    el("ProgressivoInvio", text(input.progressive, 10)) +
    el("FormatoTrasmissione", "FPR12") +
    el("CodiceDestinatario", recipientCode) +
    el("PECDestinatario", pec ? text(pec, 256) : null) +
    "</DatiTrasmissione>" +
    "<CedentePrestatore>" +
    "<DatiAnagrafici>" +
    `<IdFiscaleIVA>${el("IdPaese", "IT")}${el("IdCodice", text(issuer.vatNumber, 28))}</IdFiscaleIVA>` +
    el("CodiceFiscale", issuer.taxCode ? text(issuer.taxCode.toUpperCase(), 16) : null) +
    `<Anagrafica>${issuerName}</Anagrafica>` +
    el("RegimeFiscale", "RF19") +
    "</DatiAnagrafici>" +
    "<Sede>" +
    el("Indirizzo", text(issuer.street, 60)) +
    el("CAP", text(issuer.postalCode, 5)) +
    el("Comune", text(issuer.city, 60)) +
    el("Provincia", text(issuer.province.toUpperCase(), 2)) +
    el("Nazione", "IT") +
    "</Sede>" +
    "</CedentePrestatore>" +
    "<CessionarioCommittente>" +
    `<DatiAnagrafici>${recipientIds}<Anagrafica>${el("Denominazione", text(recipient.businessName, 80))}</Anagrafica></DatiAnagrafici>` +
    "<Sede>" +
    el("Indirizzo", text(recipient.street, 60)) +
    el("CAP", foreign ? "00000" : text(recipient.postalCode, 5)) +
    el("Comune", text(recipient.city, 60)) +
    el("Provincia", !foreign && recipient.province ? text(recipient.province.toUpperCase(), 2) : null) +
    el("Nazione", recipient.countryCode.toUpperCase()) +
    "</Sede>" +
    "</CessionarioCommittente>" +
    "</FatturaElettronicaHeader>" +
    "<FatturaElettronicaBody>" +
    "<DatiGenerali><DatiGeneraliDocumento>" +
    el("TipoDocumento", "TD01") +
    el("Divisa", "EUR") +
    el("Data", dateOnly(input.date)) +
    el("Numero", text(input.number, 20)) +
    stamp +
    el("ImportoTotaleDocumento", money(total)) +
    FORFETTARIO_NOTES.map((note) => el("Causale", text(note, 200))).join("") +
    "</DatiGeneraliDocumento></DatiGenerali>" +
    "<DatiBeniServizi>" +
    lines +
    "<DatiRiepilogo>" +
    el("AliquotaIVA", "0.00") +
    el("Natura", "N2.2") +
    el("ImponibileImporto", money(total)) +
    el("Imposta", "0.00") +
    el("RiferimentoNormativo", text(FORFETTARIO_REFERENCE, 100)) +
    "</DatiRiepilogo>" +
    "</DatiBeniServizi>" +
    "</FatturaElettronicaBody>" +
    "</p:FatturaElettronica>"
  );
}

// ---------------------------------------------------------------- checks

export function isItalianVat(value: string) {
  const digits = value.replace(/^IT/i, "").replace(/\s/g, "");
  if (!/^\d{11}$/.test(digits)) return false;
  // The Luhn-like check digit every Italian VAT number carries.
  let sum = 0;
  for (let i = 0; i < 10; i += 1) {
    let n = Number(digits[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[10]);
}

export function isTaxCode(value: string) {
  const clean = value.replace(/\s/g, "").toUpperCase();
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(clean) || isItalianVat(clean);
}

/** What the recipient still lacks for an invoice the SDI accepts, in words. */
export function missingRecipientFields(recipient: Partial<FiscalRecipient> | null | undefined) {
  if (!recipient) return ["tutti i dati di fatturazione"];
  const missing: string[] = [];
  const country = (recipient.countryCode || "IT").toUpperCase();
  if (!recipient.businessName?.trim()) missing.push("ragione sociale");
  if (!recipient.vatNumber?.trim() && !recipient.taxCode?.trim()) missing.push("partita IVA o codice fiscale");
  if (country === "IT" && recipient.vatNumber?.trim() && !isItalianVat(recipient.vatNumber)) missing.push("partita IVA valida");
  if (!recipient.street?.trim()) missing.push("indirizzo");
  if (!recipient.city?.trim()) missing.push("comune");
  if (country === "IT") {
    if (!/^\d{5}$/.test(recipient.postalCode?.trim() ?? "")) missing.push("CAP");
    if (!/^[A-Za-z]{2}$/.test(recipient.province?.trim() ?? "")) missing.push("provincia");
    const code = recipient.recipientCode?.trim() ?? "";
    const hasCode = /^[A-Za-z0-9]{7}$/.test(code) && code !== "0000000";
    const hasPec = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient.certifiedEmail?.trim() ?? "");
    if (!hasCode && !hasPec) missing.push("codice destinatario SDI o PEC");
  }
  return missing;
}

export function missingIssuerFields(issuer: Partial<FiscalIssuer>) {
  const missing: string[] = [];
  if (!issuer.legalName?.trim() && !(issuer.firstName?.trim() && issuer.lastName?.trim())) missing.push("ragione sociale o nome e cognome");
  if (!issuer.vatNumber?.trim() || !isItalianVat(issuer.vatNumber)) missing.push("partita IVA");
  if (!issuer.taxCode?.trim() || !isTaxCode(issuer.taxCode)) missing.push("codice fiscale");
  if (!issuer.street?.trim()) missing.push("indirizzo");
  if (!/^\d{5}$/.test(issuer.postalCode?.trim() ?? "")) missing.push("CAP");
  if (!issuer.city?.trim()) missing.push("comune");
  if (!/^[A-Za-z]{2}$/.test(issuer.province?.trim() ?? "")) missing.push("provincia");
  return missing;
}
