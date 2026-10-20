import "server-only";

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { fiscalIssuerOf, getCompanyProfile } from "@/lib/company-profile";
import { sendEmail } from "@/lib/email/resend";
import { prisma } from "@/lib/prisma";
import {
  FORFETTARIO_NOTES,
  FORFETTARIO_REFERENCE,
  STAMP_DUTY_CENTS,
  invoiceTotalCents,
  needsStampDuty,
  type FiscalLine,
} from "./fattura-pa";

/**
 * The courtesy copy of an e-invoice: a readable PDF, sent by email with the
 * XML when the invoice is made, and downloadable from Impostazioni. The legal
 * invoice is the XML that goes through the SDI; many owners never open their
 * cassetto fiscale, and without this they thought no invoice had come.
 */

const FONT = path.join(process.cwd(), "public", "fonts", "Workbit-Regular.ttf");
const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const day = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Rome" });

async function loadInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      barId: true,
      paidAt: true,
      issuedAt: true,
      fiscalNumber: true,
      fiscalFileName: true,
      fiscalXml: true,
      fiscalLines: true,
      bar: {
        select: {
          name: true,
          billingProfile: true,
          owner: { select: { email: true, firstName: true } },
        },
      },
    },
  });
  if (!invoice?.fiscalNumber || !invoice.fiscalXml) return null;
  return invoice;
}

export function courtesyFileName(fiscalNumber: string) {
  return `Workbit-fattura-${fiscalNumber.replace("/", "-")}.pdf`;
}

export async function renderCourtesyPdf(invoiceId: string) {
  const invoice = await loadInvoice(invoiceId);
  if (!invoice) return null;
  const pdf = await drawCourtesyPdf({
    number: invoice.fiscalNumber ?? "",
    date: invoice.paidAt ?? invoice.issuedAt ?? new Date(),
    issuer: fiscalIssuerOf(await getCompanyProfile()),
    customer: invoice.bar.billingProfile,
    barName: invoice.bar.name,
    lines: (Array.isArray(invoice.fiscalLines) ? invoice.fiscalLines : []) as FiscalLine[],
  });
  return { pdf, fileName: courtesyFileName(invoice.fiscalNumber ?? ""), invoice };
}

type CourtesyCustomer = {
  businessName: string | null;
  vatNumber: string | null;
  taxCode: string | null;
  recipientCode: string | null;
  certifiedEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
} | null;

/** The readable PDF from the invoice's own data (also used by the console's test invoice). */
export function drawCourtesyPdf(input: {
  number: string;
  date: Date;
  issuer: ReturnType<typeof fiscalIssuerOf>;
  customer: CourtesyCustomer;
  barName: string;
  lines: FiscalLine[];
  test?: boolean;
}) {
  const { issuer, customer, lines, date } = input;
  const invoice = { fiscalNumber: input.number, bar: { name: input.barName } };
  const total = invoiceTotalCents(lines);

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, ...(fs.existsSync(FONT) ? { font: FONT } : {}) });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const width = doc.page.width - 112;
    const ink = "#1d1b26";
    const muted = "#6b6880";

    doc.fillColor(input.test ? "#b4232a" : "#4c1d95").fontSize(9).text(input.test ? "WORKBIT · FATTURA DI PROVA, NON VALIDA" : "WORKBIT · COPIA DI CORTESIA", { characterSpacing: 1.5 });
    doc.moveDown(0.4);
    doc.fillColor(ink).fontSize(22).text(`Fattura n. ${invoice.fiscalNumber}`);
    doc.fillColor(muted).fontSize(10).text(`Data ${day.format(date)} · Fattura elettronica TD01`);
    doc.moveDown(1.2);

    const top = doc.y;
    const issuerName = [issuer.firstName, issuer.lastName].filter(Boolean).join(" ") || issuer.legalName;
    doc.fillColor(muted).fontSize(8.5).text("EMITTENTE", 56, top);
    doc.fillColor(ink).fontSize(10.5).text(issuerName, 56, top + 12, { width: width / 2 - 10 });
    doc.text(`${issuer.street}, ${issuer.postalCode} ${issuer.city} (${issuer.province})`, { width: width / 2 - 10 });
    doc.text(`P.IVA ${issuer.vatNumber} · CF ${issuer.taxCode}`, { width: width / 2 - 10 });
    doc.text("Regime forfettario (RF19)", { width: width / 2 - 10 });
    const left = doc.y;

    const x2 = 56 + width / 2 + 10;
    doc.fillColor(muted).fontSize(8.5).text("CLIENTE", x2, top);
    doc.fillColor(ink).fontSize(10.5).text(customer?.businessName || invoice.bar.name, x2, top + 12, { width: width / 2 - 10 });
    if (customer) {
      doc.text(
        `${[customer.addressLine1, customer.addressLine2].filter(Boolean).join(", ")}, ${customer.postalCode ?? ""} ${customer.city ?? ""}${customer.province ? ` (${customer.province})` : ""}`,
        { width: width / 2 - 10 }
      );
      if (customer.vatNumber) doc.text(`P.IVA ${customer.vatNumber}`, { width: width / 2 - 10 });
      if (customer.taxCode) doc.text(`CF ${customer.taxCode}`, { width: width / 2 - 10 });
      const destination = customer.recipientCode && customer.recipientCode !== "0000000" ? `Codice destinatario ${customer.recipientCode}` : customer.certifiedEmail ? `PEC ${customer.certifiedEmail}` : null;
      if (destination) doc.text(destination, { width: width / 2 - 10 });
    }
    doc.y = Math.max(left, doc.y) + 24;

    doc.x = 56;
    doc.fillColor(muted).fontSize(8.5).text("DESCRIZIONE", 56, doc.y, { continued: false });
    doc.moveUp();
    doc.text("IMPORTO", 56, doc.y, { width, align: "right" });
    doc.moveTo(56, doc.y + 4).lineTo(56 + width, doc.y + 4).strokeColor("#e3dfd6").stroke();
    doc.moveDown(0.8);
    for (const line of lines) {
      const y = doc.y;
      doc.fillColor(ink).fontSize(10.5).text(line.description, 56, y, { width: width - 110 });
      const after = doc.y;
      doc.text(euro.format(line.amountCents / 100), 56, y, { width, align: "right" });
      doc.y = after + 6;
    }
    doc.moveTo(56, doc.y).lineTo(56 + width, doc.y).strokeColor("#e3dfd6").stroke();
    doc.moveDown(0.8);

    const row = (label: string, value: string, strong = false) => {
      const y = doc.y;
      doc.fillColor(strong ? ink : muted).fontSize(strong ? 12.5 : 10).text(label, 56, y, { width: width - 120, align: "right" });
      doc.text(value, 56, y, { width, align: "right" });
      doc.moveDown(0.3);
    };
    row("Imponibile", euro.format(total / 100));
    row("IVA (0%, N2.2)", euro.format(0));
    if (needsStampDuty(lines)) row("Bollo virtuale, a carico dell'emittente", euro.format(STAMP_DUTY_CENTS / 100));
    row("Totale", euro.format(total / 100), true);
    doc.moveDown(1.2);

    doc.fillColor(muted).fontSize(9);
    for (const note of FORFETTARIO_NOTES) doc.text(note, 56, doc.y, { width });
    doc.text(FORFETTARIO_REFERENCE, { width });
    doc.moveDown(1);
    doc.text(
      "Questa è una copia di cortesia. La fattura elettronica vera e propria è il file XML trasmesso tramite il Sistema di Interscambio dell'Agenzia delle Entrate, che trovi anche nel tuo cassetto fiscale.",
      { width }
    );
    doc.end();
  });
}

/** Emails the courtesy copy, PDF and XML attached. Never throws: a failed email must not stop invoicing. */
export async function sendCourtesyCopy(invoiceId: string) {
  try {
    const rendered = await renderCourtesyPdf(invoiceId);
    if (!rendered) return false;
    const { pdf, fileName, invoice } = rendered;
    const to = invoice.bar.billingProfile?.billingEmail || invoice.bar.owner.email;
    if (!to) return false;
    const result = await sendEmail({
      to,
      subject: `Fattura Workbit n. ${invoice.fiscalNumber}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1d1b26">
<p>Ciao${invoice.bar.owner.firstName ? ` ${invoice.bar.owner.firstName}` : ""},</p>
<p>in allegato la fattura n. <strong>${invoice.fiscalNumber}</strong> per l'abbonamento Workbit di <strong>${invoice.bar.name}</strong>: il PDF da leggere e il file XML per il tuo commercialista.</p>
<p>La fattura elettronica arriva anche tramite il Sistema di Interscambio, al tuo codice destinatario o alla tua PEC, e la trovi nel tuo cassetto fiscale.</p>
<p><strong>Dove ritrovare le fatture:</strong> tutte le tue fatture Workbit le vedi accedendo dal sito, da browser, su <a href="${(process.env.APP_URL?.trim() || "https://app.workbit.it").replace(/\/$/, "")}/dashboard/settings" style="color:#4c1d95">app.workbit.it</a>, in Impostazioni › Fatture. Non sono visibili dall'applicazione installata su iPhone o Android: per motivi fiscali e per gli accordi con gli store (App Store e Google Play), abbonamento e fatture si gestiscono solo dal sito.</p>
<p style="color:#6b6880">Workbit</p></div>`,
      attachments: [
        { filename: fileName, content: pdf },
        { filename: invoice.fiscalFileName || fileName.replace(/\.pdf$/, ".xml"), content: Buffer.from(invoice.fiscalXml ?? "", "utf8") },
      ],
    });
    return result.ok;
  } catch (error) {
    console.error("[invoice] courtesy copy failed", error instanceof Error ? error.message : error);
    return false;
  }
}
