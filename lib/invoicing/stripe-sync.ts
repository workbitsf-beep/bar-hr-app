import "server-only";

import {
  InvoiceProvider,
  InvoiceStatus,
} from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { invoiceTotalCents, type FiscalLine } from "./fattura-pa";

/** The lines as Stripe billed them; a discount closes the gap to the total. */
export function fiscalLinesOf(invoice: Pick<Stripe.Invoice, "total" | "lines">): FiscalLine[] {
  const lines: FiscalLine[] = (invoice.lines?.data ?? [])
    .filter((line) => line.amount !== 0)
    .map((line) => ({ description: line.description || "Abbonamento Workbit", amountCents: line.amount }));
  const gap = invoice.total - invoiceTotalCents(lines);
  if (gap !== 0) {
    lines.push({ description: gap < 0 ? "Sconto" : "Altri importi", amountCents: gap });
  }
  return lines;
}

function toDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

function mapInvoiceStatus(
  status: Stripe.Invoice.Status | null,
  fallback?: InvoiceStatus
) {
  switch (status) {
    case "draft":
      return InvoiceStatus.DRAFT;
    case "open":
      return fallback ?? InvoiceStatus.OPEN;
    case "paid":
      return InvoiceStatus.PAID;
    case "void":
      return InvoiceStatus.VOID;
    case "uncollectible":
      return InvoiceStatus.UNCOLLECTIBLE;
    default:
      return fallback ?? InvoiceStatus.DRAFT;
  }
}

export async function syncStripeInvoice(input: {
  barId: string;
  invoice: Stripe.Invoice;
  fallbackStatus?: InvoiceStatus;
}) {
  const subscription = await prisma.subscription.findUnique({
    where: { barId: input.barId },
    select: { id: true },
  });
  const taxAmount =
    input.invoice.total_taxes?.reduce((total, tax) => total + tax.amount, 0) ?? 0;

  await prisma.invoice.upsert({
    where: {
      provider_externalId: {
        provider: InvoiceProvider.STRIPE,
        externalId: input.invoice.id,
      },
    },
    create: {
      barId: input.barId,
      subscriptionId: subscription?.id ?? null,
      provider: InvoiceProvider.STRIPE,
      externalId: input.invoice.id,
      externalNumber: input.invoice.number,
      status: mapInvoiceStatus(input.invoice.status, input.fallbackStatus),
      currency: input.invoice.currency,
      subtotalAmount: input.invoice.subtotal,
      taxAmount,
      totalAmount: input.invoice.total,
      paidAmount: input.invoice.amount_paid,
      periodStart: toDate(input.invoice.period_start),
      periodEnd: toDate(input.invoice.period_end),
      issuedAt: toDate(
        input.invoice.effective_at ??
          input.invoice.status_transitions.finalized_at ??
          input.invoice.created
      ),
      dueAt: toDate(input.invoice.due_date),
      paidAt: toDate(input.invoice.status_transitions.paid_at),
      hostedUrl: input.invoice.hosted_invoice_url ?? null,
      pdfUrl: input.invoice.invoice_pdf ?? null,
      fiscalLines: fiscalLinesOf(input.invoice),
    },
    update: {
      barId: input.barId,
      subscriptionId: subscription?.id ?? null,
      externalNumber: input.invoice.number,
      status: mapInvoiceStatus(input.invoice.status, input.fallbackStatus),
      currency: input.invoice.currency,
      subtotalAmount: input.invoice.subtotal,
      taxAmount,
      totalAmount: input.invoice.total,
      paidAmount: input.invoice.amount_paid,
      periodStart: toDate(input.invoice.period_start),
      periodEnd: toDate(input.invoice.period_end),
      issuedAt: toDate(
        input.invoice.effective_at ??
          input.invoice.status_transitions.finalized_at ??
          input.invoice.created
      ),
      dueAt: toDate(input.invoice.due_date),
      paidAt: toDate(input.invoice.status_transitions.paid_at),
      hostedUrl: input.invoice.hosted_invoice_url ?? null,
      pdfUrl: input.invoice.invoice_pdf ?? null,
      fiscalLines: fiscalLinesOf(input.invoice),
    },
  });
}

/**
 * What Stripe knows of the customer fills the billing profile where it is
 * empty. What the owner wrote in the app wins: Stripe never overwrites it.
 */
export async function syncStripeBillingProfile(input: {
  barId: string;
  invoice: Stripe.Invoice;
}) {
  const taxId = input.invoice.customer_tax_ids?.[0]?.value?.trim() || null;
  const address = input.invoice.customer_address;
  const fromStripe = {
    businessName: input.invoice.customer_name ?? null,
    vatNumber: taxId,
    billingEmail: input.invoice.customer_email ?? null,
    phone: input.invoice.customer_phone ?? null,
    addressLine1: address?.line1 ?? null,
    addressLine2: address?.line2 ?? null,
    city: address?.city ?? null,
    province: address?.state ?? null,
    postalCode: address?.postal_code ?? null,
  };

  const current = await prisma.billingProfile.findUnique({ where: { barId: input.barId } });
  if (!current) {
    await prisma.billingProfile.create({
      data: {
        barId: input.barId,
        ...fromStripe,
        countryCode: address?.country?.toUpperCase() || "IT",
        stripeTaxId: taxId,
      },
    });
    return;
  }

  const fill: Record<string, string> = {};
  for (const [key, value] of Object.entries(fromStripe)) {
    if (value && !current[key as keyof typeof fromStripe]?.trim()) fill[key] = value;
  }
  await prisma.billingProfile.update({
    where: { barId: input.barId },
    data: { ...fill, stripeTaxId: taxId ?? undefined },
  });
}

/** The checkout's own field: a 7-character SDI code, or a PEC address. */
export function parseRecipientField(value: string | null | undefined) {
  const clean = (value ?? "").trim();
  if (/^[A-Za-z0-9]{7}$/.test(clean)) return { recipientCode: clean.toUpperCase() };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { certifiedEmail: clean.toLowerCase() };
  return null;
}

export async function saveRecipientFromCheckout(barId: string, session: Stripe.Checkout.Session) {
  const field = session.custom_fields?.find((entry) => entry.key === "sdi");
  const parsed = parseRecipientField(field?.text?.value);
  if (!parsed) return;
  await prisma.billingProfile.upsert({
    where: { barId },
    create: { barId, ...parsed },
    update: parsed,
  });
}
