/**
 * Workbit's own books, worked out: what a month costs, what is still owed,
 * and the running account month by month. Pure - no database - so the
 * console page and the tests read the same numbers.
 *
 * Two views of the same entries:
 * - "al mese": a yearly cost spread over twelve months, for the summary;
 * - the monthly report: money as it really moves, a yearly cost in the
 *   month it renews, an expense in its month, a debt when a payment is made.
 */

export type LedgerKindValue = "COST" | "EXPENSE" | "DEBT" | "INCOME";
export type LedgerPeriodValue = "MONTHLY" | "YEARLY" | "ONCE";

export type LedgerEntryInput = {
  id: string;
  kind: LedgerKindValue;
  name: string;
  amountCents: number;
  period: LedgerPeriodValue;
  startsOn: Date;
  endsOn: Date | null;
  installmentCents: number | null;
  dueOn: Date | null;
  payments: Array<{ amountCents: number; paidOn: Date }>;
};

/** Stripe's fee on a European card: 1.5% plus 25 cents. An estimate. */
export function stripeFeeCents(paidCents: number) {
  return paidCents > 0 ? Math.round(paidCents * 0.015) + 25 : 0;
}

/** "2026-10" for a date, in Italian time. */
export function monthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: "Europe/Rome" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

export function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const index = year * 12 + (month - 1) + offset;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function activeIn(entry: LedgerEntryInput, key: string) {
  if (monthKey(entry.startsOn) > key) return false;
  if (entry.endsOn && monthKey(entry.endsOn) < key) return false;
  return true;
}

/** A running cost or income for one month: a yearly one spread over twelve. */
export function monthlyEquivalentCents(entry: LedgerEntryInput) {
  if (entry.kind !== "COST" && entry.kind !== "INCOME") return 0;
  if (entry.period === "YEARLY") return Math.round(entry.amountCents / 12);
  if (entry.period === "ONCE") return 0;
  return entry.amountCents;
}

export function paidCents(entry: LedgerEntryInput) {
  return entry.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
}

export function debtRemainingCents(entry: LedgerEntryInput) {
  return entry.kind === "DEBT" ? Math.max(0, entry.amountCents - paidCents(entry)) : 0;
}

/** The month a loan paid in installments ends, from what is left. */
export function debtEndsKey(entry: LedgerEntryInput, fromKey: string) {
  const remaining = debtRemainingCents(entry);
  if (!remaining || !entry.installmentCents) return null;
  return shiftMonth(fromKey, Math.ceil(remaining / entry.installmentCents) - 1);
}

/** Money out that comes from elsewhere, already dated: a Railway invoice. */
export type ExternalOut = { name: string; cents: number; at: Date };

/** What actually moves in one month: money in and money out. */
export function cashForMonth(
  entries: LedgerEntryInput[],
  invoicesPaid: Array<{ paidAmount: number; paidAt: Date }>,
  key: string,
  externalOut: ExternalOut[] = []
) {
  let income = 0;
  let out = 0;
  const lines: Array<{ name: string; cents: number; direction: "in" | "out" }> = [];

  const subscriptions = invoicesPaid.filter((invoice) => monthKey(invoice.paidAt) === key);
  const subscriptionCents = subscriptions.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
  if (subscriptionCents) {
    income += subscriptionCents;
    lines.push({ name: "Abbonamenti incassati", cents: subscriptionCents, direction: "in" });
  }
  const fees = subscriptions.reduce((sum, invoice) => sum + stripeFeeCents(invoice.paidAmount), 0);
  if (fees) {
    out += fees;
    lines.push({ name: "Commissioni Stripe (stima)", cents: fees, direction: "out" });
  }

  for (const entry of entries) {
    if (entry.kind === "DEBT") {
      const paid = entry.payments.filter((payment) => monthKey(payment.paidOn) === key).reduce((sum, payment) => sum + payment.amountCents, 0);
      if (paid) {
        out += paid;
        lines.push({ name: entry.name, cents: paid, direction: "out" });
      }
      continue;
    }

    let cents = 0;
    if (entry.kind === "EXPENSE" || entry.period === "ONCE") {
      cents = monthKey(entry.startsOn) === key ? entry.amountCents : 0;
    } else if (activeIn(entry, key)) {
      // A yearly cost is paid in the month it renews.
      cents = entry.period === "YEARLY" ? (monthKey(entry.startsOn).slice(5) === key.slice(5) ? entry.amountCents : 0) : entry.amountCents;
    }
    if (!cents) continue;
    if (entry.kind === "INCOME") income += cents;
    else out += cents;
    lines.push({ name: entry.name, cents, direction: entry.kind === "INCOME" ? "in" : "out" });
  }

  for (const external of externalOut) {
    if (monthKey(external.at) !== key || !external.cents) continue;
    out += external.cents;
    lines.push({ name: external.name, cents: external.cents, direction: "out" });
  }

  return { income, out, balance: income - out, lines };
}

/** The last months, newest first, each with its running balance since the first one shown. */
export function monthlyReport(
  entries: LedgerEntryInput[],
  invoicesPaid: Array<{ paidAmount: number; paidAt: Date }>,
  currentKey: string,
  months = 6,
  externalOut: ExternalOut[] = []
) {
  const keys = Array.from({ length: months }, (_, index) => shiftMonth(currentKey, index - (months - 1)));
  let running = 0;
  const rows = keys.map((key) => {
    const cash = cashForMonth(entries, invoicesPaid, key, externalOut);
    running += cash.balance;
    return { key, ...cash, running };
  });
  return rows.reverse();
}

/** The month at a glance: running costs and income spread per month, and the installments due. */
export function monthSummary(
  entries: LedgerEntryInput[],
  expectedSubscriptionCents: number,
  key: string,
  /** A cost measured elsewhere for this month, such as Railway's projection. */
  externalMonthlyCents = 0
) {
  const running = entries.filter((entry) => (entry.kind === "COST" || entry.kind === "INCOME") && activeIn(entry, key));
  const costs = running.filter((entry) => entry.kind === "COST").reduce((sum, entry) => sum + monthlyEquivalentCents(entry), 0);
  const extraIncome = running.filter((entry) => entry.kind === "INCOME").reduce((sum, entry) => sum + monthlyEquivalentCents(entry), 0);
  const expenses = entries
    .filter((entry) => entry.kind === "EXPENSE" && monthKey(entry.startsOn) === key)
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const debts = entries.filter((entry) => entry.kind === "DEBT" && debtRemainingCents(entry) > 0);
  const installments = debts.reduce((sum, entry) => sum + Math.min(entry.installmentCents ?? 0, debtRemainingCents(entry)), 0);
  const owed = debts.reduce((sum, entry) => sum + debtRemainingCents(entry), 0);
  const income = expectedSubscriptionCents + extraIncome;
  const fees = expectedSubscriptionCents ? stripeFeeCents(expectedSubscriptionCents) : 0;
  const out = costs + expenses + fees + externalMonthlyCents;
  return {
    income,
    out,
    left: income - out,
    afterInstallments: income - out - installments,
    installments,
    owed,
    fees,
  };
}

/** How many venues on one plan pay for a month's costs and installments. */
export function breakEvenVenues(monthlyNeedCents: number, planPriceCents: number) {
  return monthlyNeedCents > 0 ? Math.ceil(monthlyNeedCents / planPriceCents) : 0;
}

/** "1.250,50", "3.000", "1250.5" or "20" → cents; null when it is not an amount. */
export function parseEuroCents(value: unknown) {
  const raw = String(value ?? "").trim().replace(/\s|€/g, "");
  if (!raw) return null;
  // "3.000" is three thousand, as Italians write it; "8.25" is eight and a quarter.
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, "")
      : raw;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

export function formatCents(cents: number, withSign = false) {
  // Grouping always: Italian leaves 3000 ungrouped, which reads poorly next to 12.500.
  const text = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" } as Intl.NumberFormatOptions).format(Math.abs(cents) / 100);
  if (!withSign) return cents < 0 ? `−${text}` : text;
  return cents < 0 ? `−${text}` : `+${text}`;
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 15)));
}
