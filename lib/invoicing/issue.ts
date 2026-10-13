import "server-only";

import { FiscalState, InvoiceProvider, InvoiceStatus } from "@prisma/client";
import { fiscalIssuerOf, getCompanyProfile } from "@/lib/company-profile";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  buildFatturaXml,
  fatturaFileName,
  fatturaProgressive,
  missingIssuerFields,
  missingRecipientFields,
  type FiscalLine,
  type FiscalRecipient,
} from "./fattura-pa";
import { fiscalLinesOf } from "./stripe-sync";

export { fiscalLinesOf };

/**
 * From a paid Stripe invoice to the electronic invoice: numbered, written as
 * FatturaPA XML and kept on the Invoice row, ready for the SDI.
 *
 * Nothing is numbered while data is missing - the customer's or Workbit's
 * own: the row says what is missing (MISSING_DATA) and the console makes it
 * again once it is filled in. Sending is left to the provider, when there is
 * one; until then a READY invoice can be downloaded and uploaded by hand.
 */

function recipientOf(profile: {
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
  countryCode: string;
} | null): Partial<FiscalRecipient> | null {
  if (!profile) return null;
  return {
    businessName: profile.businessName ?? "",
    vatNumber: profile.vatNumber,
    taxCode: profile.taxCode,
    recipientCode: profile.recipientCode,
    certifiedEmail: profile.certifiedEmail,
    street: [profile.addressLine1, profile.addressLine2].filter(Boolean).join(", "),
    postalCode: profile.postalCode ?? "",
    city: profile.city ?? "",
    province: profile.province,
    countryCode: profile.countryCode || "IT",
  };
}

async function stripeLinesFor(externalId: string) {
  if (!stripe) throw new Error("Stripe non configurato");
  const invoice = await stripe.invoices.retrieve(externalId, { expand: ["lines"] });
  return fiscalLinesOf(invoice);
}

/**
 * Makes the e-invoice for one paid invoice. `lines` come with the webhook;
 * without them they are read from Stripe again.
 */
export async function prepareFiscalInvoice(invoiceId: string, lines?: FiscalLine[]) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      barId: true,
      provider: true,
      externalId: true,
      status: true,
      totalAmount: true,
      paidAt: true,
      issuedAt: true,
      fiscalState: true,
      fiscalSequence: true,
      fiscalLines: true,
      bar: { select: { billingProfile: true } },
    },
  });
  if (!invoice) return null;
  // Made once: a number is never given twice, nor taken back.
  if (invoice.fiscalSequence !== null) return invoice.fiscalState;
  if (invoice.status !== InvoiceStatus.PAID || invoice.totalAmount <= 0) return FiscalState.NONE;

  const profile = await getCompanyProfile();
  const issuer = fiscalIssuerOf(profile);
  const recipient = recipientOf(invoice.bar.billingProfile);
  const missing = [
    ...missingIssuerFields(issuer).map((field) => `Workbit: ${field}`),
    ...missingRecipientFields(recipient).map((field) => `cliente: ${field}`),
  ];
  if (missing.length) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { fiscalState: FiscalState.MISSING_DATA, fiscalError: `Mancano: ${missing.join(", ")}` },
    });
    return FiscalState.MISSING_DATA;
  }

  const stored = Array.isArray(invoice.fiscalLines) ? (invoice.fiscalLines as FiscalLine[]) : null;
  const fiscalLines =
    lines ??
    stored ??
    (invoice.provider === InvoiceProvider.STRIPE ? await stripeLinesFor(invoice.externalId) : []);
  if (!fiscalLines.length) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { fiscalState: FiscalState.MISSING_DATA, fiscalError: "Righe della fattura non trovate" },
    });
    return FiscalState.MISSING_DATA;
  }

  const date = invoice.paidAt ?? invoice.issuedAt ?? new Date();
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Rome", year: "numeric" }).format(date));

  // The next number of the year; the unique index settles two at once.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const last = await prisma.invoice.aggregate({ where: { fiscalYear: year }, _max: { fiscalSequence: true } });
    const sequence = (last._max.fiscalSequence ?? 0) + 1;
    const number = `${year}/${sequence}`;
    const progressive = fatturaProgressive(year, sequence);
    const xml = buildFatturaXml({
      issuer,
      recipient: recipient as FiscalRecipient,
      number,
      progressive,
      date,
      lines: fiscalLines,
    });
    try {
      await prisma.invoice.update({
        where: { id: invoice.id, fiscalSequence: null },
        data: {
          fiscalState: FiscalState.READY,
          fiscalYear: year,
          fiscalSequence: sequence,
          fiscalNumber: number,
          fiscalFileName: fatturaFileName(issuer, progressive),
          fiscalXml: xml,
          fiscalError: null,
        },
      });
      return FiscalState.READY;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  return null;
}

/** After data is filled in: every paid invoice still waiting gets made. */
export async function prepareWaitingFiscalInvoices(barId?: string) {
  const waiting = await prisma.invoice.findMany({
    where: { status: InvoiceStatus.PAID, fiscalSequence: null, totalAmount: { gt: 0 }, ...(barId ? { barId } : {}) },
    orderBy: { paidAt: "asc" },
    select: { id: true },
    take: 200,
  });
  let ready = 0;
  for (const invoice of waiting) {
    try {
      if ((await prepareFiscalInvoice(invoice.id)) === FiscalState.READY) ready += 1;
    } catch (error) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { fiscalError: error instanceof Error ? error.message.slice(0, 300) : "Errore" },
      });
    }
  }
  return { waiting: waiting.length, ready };
}
