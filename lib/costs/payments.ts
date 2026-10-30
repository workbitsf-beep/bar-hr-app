import "server-only";

import { gunzipSync } from "node:zlib";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { readInvoiceFile, type ParsedPayment } from "./fattura";
import { supplierKeyOf } from "./import";

/**
 * The supplier payment schedule. Each instalment comes from the invoice's
 * DatiPagamento; whether it is paid is read, never guessed loudly:
 * - card, cash, cheque: paid when the invoice was made;
 * - RiBa and direct debits: the bank takes them on the day, paid from then;
 * - a supplier the owner always pays on the spot: paid;
 * - bonifico and the rest: the owner says. Past the day and not told yet it
 *   is "da confermare", never "scaduta": only "non ancora" makes it overdue.
 */

export type MethodKind = "paid" | "automatic" | "manual";

const PAID_METHODS = new Set(["MP01", "MP02", "MP03", "MP04", "MP08", "MP22", "MP23"]);
const AUTOMATIC_METHODS = new Set(["MP09", "MP10", "MP11", "MP12", "MP16", "MP17", "MP19", "MP20", "MP21"]);

export const METHOD_LABELS: Record<string, string> = {
  MP01: "contanti",
  MP02: "assegno",
  MP03: "assegno circolare",
  MP04: "contanti",
  MP05: "bonifico",
  MP06: "vaglia",
  MP07: "bollettino bancario",
  MP08: "carta",
  MP09: "RID",
  MP10: "RID utenze",
  MP11: "RID veloce",
  MP12: "RiBa",
  MP13: "MAV",
  MP14: "quietanza erario",
  MP15: "giroconto",
  MP16: "domiciliazione bancaria",
  MP17: "domiciliazione postale",
  MP18: "bollettino postale",
  MP19: "addebito SEPA",
  MP20: "addebito SEPA",
  MP21: "addebito SEPA",
  MP22: "trattenuta",
  MP23: "PagoPA",
};

export function methodKind(method: string | null): MethodKind {
  if (method && PAID_METHODS.has(method)) return "paid";
  if (method && AUTOMATIC_METHODS.has(method)) return "automatic";
  return "manual";
}

export type ScheduleStatus = "overdue" | "confirm" | "due" | "automatic" | "paid";

/** Where an instalment stands today (a day key, YYYY-MM-DD, in Italy). */
export function scheduleStatus(
  payment: { dueDate: Date; method: string | null; state: string | null },
  today: string,
  alwaysPaid: boolean,
): ScheduleStatus {
  if (payment.state === "PAID") return "paid";
  const kind = methodKind(payment.method);
  const due = payment.dueDate.toISOString().slice(0, 10);
  if (payment.state === "NOT_PAID") return "overdue";
  if (kind === "paid" || alwaysPaid) return "paid";
  if (kind === "automatic") return due < today ? "paid" : "automatic";
  return due < today ? "confirm" : "due";
}

export function todayInItaly(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
}

function rowsOf(barId: string, invoiceId: string, payments: ParsedPayment[]) {
  return payments
    .filter((payment) => /^\d{4}-\d{2}-\d{2}$/.test(payment.dueDate))
    .map((payment) => ({
      barId,
      invoiceId,
      dueDate: new Date(`${payment.dueDate}T00:00:00.000Z`),
      amountCents: payment.amountCents,
      method: payment.method,
      iban: payment.iban,
    }));
}

/** Called on import, with what the parser read. */
export async function savePayments(barId: string, invoiceId: string, payments: ParsedPayment[]) {
  const rows = rowsOf(barId, invoiceId, payments);
  if (rows.length) await prisma.supplierPayment.createMany({ data: rows });
  await prisma.supplierInvoice.update({ where: { id: invoiceId }, data: { paymentsReadAt: new Date() } });
}

/**
 * Invoices imported before the schedule existed: their terms are read from
 * the XML kept with them, a batch at a time.
 */
export async function readMissingPayments(barId: string, limit = 400) {
  const invoices = await prisma.supplierInvoice.findMany({
    where: { barId, paymentsReadAt: null },
    select: { id: true, number: true, issueDate: true, xmlGz: true },
    orderBy: { issueDate: "desc" },
    take: limit,
  });
  for (const invoice of invoices) {
    let payments: ParsedPayment[] = [];
    if (invoice.xmlGz) {
      try {
        const result = readInvoiceFile("fattura.xml", gunzipSync(Buffer.from(invoice.xmlGz)));
        if (result.kind === "invoices") {
          const date = invoice.issueDate.toISOString().slice(0, 10);
          const match = result.invoices.find((item) => item.number.slice(0, 60) === invoice.number && item.date === date) ?? result.invoices[0];
          payments = match?.payments ?? [];
        }
      } catch {
        payments = [];
      }
    }
    await savePayments(barId, invoice.id, payments);
  }
  return invoices.length;
}

export type ScheduleItem = {
  id: string;
  invoiceId: string;
  supplierKey: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  amountCents: number;
  method: string | null;
  iban: string | null;
  status: ScheduleStatus;
  paidAt: Date | null;
};

/** The schedule from 90 days back to 60 ahead, each instalment with where it stands. */
export async function buildSchedule(barId: string, now = new Date()) {
  await readMissingPayments(barId);
  const today = todayInItaly(now);
  const from = new Date(`${today}T00:00:00.000Z`);
  from.setUTCDate(from.getUTCDate() - 90);
  const until = new Date(`${today}T00:00:00.000Z`);
  until.setUTCDate(until.getUTCDate() + 60);

  const [payments, rules, withoutTerms] = await Promise.all([
    prisma.supplierPayment.findMany({
      where: { barId, dueDate: { gte: from, lte: until } },
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        dueDate: true,
        amountCents: true,
        method: true,
        iban: true,
        state: true,
        paidAt: true,
        invoice: { select: { id: true, number: true, issueDate: true, supplierName: true, supplierVat: true, supplierTaxCode: true } },
      },
    }),
    prisma.supplierPaymentRule.findMany({ where: { barId }, select: { supplierKey: true, supplierName: true } }),
    prisma.supplierInvoice.count({ where: { barId, issueDate: { gte: from }, docType: { notIn: ["TD04", "TD08"] }, payments: { none: {} } } }),
  ]);
  const always = new Set(rules.map((rule) => rule.supplierKey));

  const items: ScheduleItem[] = payments.map((payment) => {
    const supplierKey = supplierKeyOf(payment.invoice);
    return {
      id: payment.id,
      invoiceId: payment.invoice.id,
      supplierKey,
      supplierName: payment.invoice.supplierName,
      invoiceNumber: payment.invoice.number,
      invoiceDate: payment.invoice.issueDate,
      dueDate: payment.dueDate,
      amountCents: payment.amountCents,
      method: payment.method,
      iban: payment.iban,
      status: scheduleStatus(payment, today, always.has(supplierKey)),
      paidAt: payment.paidAt,
    };
  });

  // The next four weeks, Monday to Sunday: what leaves the account.
  const monday = new Date(`${today}T00:00:00.000Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const weeks = [0, 1, 2, 3].map((index) => {
    const start = new Date(monday);
    start.setUTCDate(start.getUTCDate() + index * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    const inWeek = items.filter((item) => item.dueDate >= start && item.dueDate < end && (item.status === "due" || item.status === "automatic" || item.status === "overdue"));
    return {
      start,
      manualCents: inWeek.filter((item) => item.status !== "automatic").reduce((sum, item) => sum + item.amountCents, 0),
      automaticCents: inWeek.filter((item) => item.status === "automatic").reduce((sum, item) => sum + item.amountCents, 0),
    };
  });

  return { today, items, weeks, rules, withoutTerms };
}

/**
 * Every night: three days before a bonifico is due, a reminder; the day after
 * one passed with no word, "did you pay it?". Once each, to the owner.
 */
export async function runPaymentReminders(now = new Date()) {
  const today = todayInItaly(now);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hour12: false }).format(now));
  if (hour < 8) return { reminded: 0, asked: 0 };
  const start = new Date(`${today}T00:00:00.000Z`);
  const soon = new Date(start);
  soon.setUTCDate(soon.getUTCDate() + 3);
  const weekAgo = new Date(start);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

  const candidates = await prisma.supplierPayment.findMany({
    where: {
      state: null,
      OR: [
        { remindedAt: null, dueDate: { gte: start, lte: soon } },
        { askedAt: null, dueDate: { gte: weekAgo, lt: start } },
      ],
    },
    select: {
      id: true,
      barId: true,
      dueDate: true,
      amountCents: true,
      method: true,
      remindedAt: true,
      bar: { select: { ownerId: true } },
      invoice: { select: { supplierName: true, supplierVat: true, supplierTaxCode: true, number: true } },
    },
    take: 300,
  });
  const rules = await prisma.supplierPaymentRule.findMany({
    where: { barId: { in: [...new Set(candidates.map((item) => item.barId))] } },
    select: { barId: true, supplierKey: true },
  });
  const always = new Set(rules.map((rule) => `${rule.barId}|${rule.supplierKey}`));
  const euro = (cents: number) => `${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" });

  let reminded = 0;
  let asked = 0;
  for (const payment of candidates) {
    if (methodKind(payment.method) !== "manual" || always.has(`${payment.barId}|${supplierKeyOf(payment.invoice)}`)) continue;
    const due = payment.dueDate.toISOString().slice(0, 10);
    const past = due < today;
    await prisma.supplierPayment.update({ where: { id: payment.id }, data: past ? { askedAt: now } : { remindedAt: now } });
    await notifyUsers([payment.bar.ownerId], {
      barId: payment.barId,
      title: past ? `Hai pagato ${payment.invoice.supplierName}?` : `Da pagare: ${payment.invoice.supplierName}`,
      message: past
        ? `Fattura ${payment.invoice.number}, ${euro(payment.amountCents)}, scadeva ${day.format(payment.dueDate)}. Segnala se l'hai pagata.`
        : `${euro(payment.amountCents)} entro ${day.format(payment.dueDate)}, fattura ${payment.invoice.number}.`,
      type: INTERNAL_NOTIFICATION_TYPES.SUPPLIER_PAYMENT,
      actionUrl: "/dashboard/costi/pagamenti",
    }).catch((error) => console.error("[payments] reminder not sent", error instanceof Error ? error.message : error));
    if (past) asked += 1;
    else reminded += 1;
  }
  return { reminded, asked };
}
