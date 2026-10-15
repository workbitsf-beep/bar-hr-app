import "server-only";

import { FiscalState } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeNotification, invoiceNotifications, sdiConfig, sendInvoiceXml } from "@/lib/invoicing/openapi-sdi";

/**
 * Sending Workbit's e-invoices to the SDI through Openapi, and keeping their
 * state in step with what the SDI answers. Without OPENAPI_SDI_TOKEN nothing
 * here runs and the console works as before: download, upload by hand, mark
 * as sent.
 */

export function sdiSendingEnabled() {
  return sdiConfig() !== null;
}

/** Sends one invoice that is ready (or was rejected and is sent again). */
export async function sendFiscalInvoice(invoiceId: string) {
  if (!sdiSendingEnabled()) return { sent: false as const, reason: "manual" as const };
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, fiscalState: true, fiscalXml: true },
  });
  if (!invoice?.fiscalXml) return { sent: false as const, reason: "missing" as const };
  if (invoice.fiscalState !== FiscalState.READY && invoice.fiscalState !== FiscalState.REJECTED) {
    return { sent: false as const, reason: "state" as const };
  }

  // Claimed first, so two runs at once send it once.
  const claimed = await prisma.invoice.updateMany({
    where: { id: invoice.id, fiscalState: invoice.fiscalState },
    data: { fiscalState: FiscalState.SENT, fiscalSentAt: new Date(), fiscalError: null },
  });
  if (claimed.count === 0) return { sent: false as const, reason: "state" as const };

  try {
    const uuid = await sendInvoiceXml(invoice.fiscalXml);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { fiscalDocumentId: uuid } });
    return { sent: true as const, uuid };
  } catch (error) {
    // Not sent: back to where it was, with the reason for the console.
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        fiscalState: invoice.fiscalState,
        fiscalSentAt: null,
        fiscalError: `Invio non riuscito: ${error instanceof Error ? error.message : "errore"}`.slice(0, 500),
      },
    });
    return { sent: false as const, reason: "error" as const };
  }
}

/**
 * The state from the SDI's latest word. Asked to Openapi rather than taken
 * from the callback's body, so a forged callback can only make us look.
 */
export async function syncFiscalInvoice(invoiceId: string) {
  if (!sdiSendingEnabled()) return null;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, fiscalDocumentId: true, fiscalState: true },
  });
  if (!invoice?.fiscalDocumentId) return null;

  const notifications = await invoiceNotifications(invoice.fiscalDocumentId);
  const outcome = [...notifications].reverse().find((item) => ["RC", "MC", "NS"].includes(item.type));
  if (!outcome) return invoice.fiscalState;

  const next =
    outcome.type === "NS"
      ? { fiscalState: FiscalState.REJECTED, fiscalError: `Scartata dallo SDI: ${describeNotification(outcome) ?? "motivo non indicato"}` }
      : outcome.type === "MC"
        ? {
            // Not delivered is still issued: the customer finds it in their
            // own area on the Agenzia delle Entrate site.
            fiscalState: FiscalState.DELIVERED,
            fiscalError: "Non recapitata al cliente: è comunque emessa e la trova nel suo cassetto fiscale.",
          }
        : { fiscalState: FiscalState.DELIVERED, fiscalError: null };
  await prisma.invoice.update({ where: { id: invoice.id }, data: next });
  return next.fiscalState;
}

/** The nightly pass: sends what is ready, and asks about what is waiting. */
export async function runFiscalSending() {
  if (!sdiSendingEnabled()) return { enabled: false, sent: 0, synced: 0 };
  const ready = await prisma.invoice.findMany({
    where: { fiscalState: FiscalState.READY, fiscalXml: { not: null } },
    orderBy: { fiscalSequence: "asc" },
    select: { id: true },
    take: 100,
  });
  let sent = 0;
  for (const invoice of ready) if ((await sendFiscalInvoice(invoice.id)).sent) sent += 1;

  // A callback can get lost; anything still waiting after an hour is asked about.
  const waiting = await prisma.invoice.findMany({
    where: {
      fiscalState: FiscalState.SENT,
      fiscalDocumentId: { not: null },
      fiscalSentAt: { lt: new Date(Date.now() - 60 * 60 * 1000) },
    },
    select: { id: true },
    take: 200,
  });
  let synced = 0;
  for (const invoice of waiting) {
    try {
      if ((await syncFiscalInvoice(invoice.id)) !== FiscalState.SENT) synced += 1;
    } catch {
      // Asked again tomorrow.
    }
  }
  return { enabled: true, sent, synced };
}
