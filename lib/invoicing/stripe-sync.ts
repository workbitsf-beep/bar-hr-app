import "server-only";

import {
  InvoiceProvider,
  InvoiceStatus,
} from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";

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
    },
  });
}

export async function syncStripeBillingProfile(input: {
  barId: string;
  invoice: Stripe.Invoice;
}) {
  const taxId = input.invoice.customer_tax_ids?.[0]?.value?.trim() || null;
  const address = input.invoice.customer_address;

  await prisma.billingProfile.upsert({
    where: { barId: input.barId },
    create: {
      barId: input.barId,
      businessName: input.invoice.customer_name,
      vatNumber: taxId,
      billingEmail: input.invoice.customer_email,
      phone: input.invoice.customer_phone,
      addressLine1: address?.line1 ?? null,
      addressLine2: address?.line2 ?? null,
      city: address?.city ?? null,
      province: address?.state ?? null,
      postalCode: address?.postal_code ?? null,
      countryCode: address?.country?.toUpperCase() || "IT",
      stripeTaxId: taxId,
    },
    update: {
      businessName: input.invoice.customer_name ?? undefined,
      vatNumber: taxId ?? undefined,
      billingEmail: input.invoice.customer_email ?? undefined,
      phone: input.invoice.customer_phone ?? undefined,
      addressLine1: address?.line1 ?? undefined,
      addressLine2: address?.line2 ?? undefined,
      city: address?.city ?? undefined,
      province: address?.state ?? undefined,
      postalCode: address?.postal_code ?? undefined,
      countryCode: address?.country?.toUpperCase() || undefined,
      stripeTaxId: taxId ?? undefined,
    },
  });
}
