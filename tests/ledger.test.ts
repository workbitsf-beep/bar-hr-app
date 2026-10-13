import assert from "node:assert/strict";
import { test } from "node:test";
import {
  breakEvenVenues,
  cashForMonth,
  debtEndsKey,
  debtRemainingCents,
  monthlyReport,
  monthSummary,
  parseEuroCents,
  shiftMonth,
  type LedgerEntryInput,
} from "../lib/ledger";

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
const entry = (partial: Partial<LedgerEntryInput> & Pick<LedgerEntryInput, "kind" | "amountCents">): LedgerEntryInput => ({
  id: partial.name ?? "x",
  name: "Voce",
  period: "MONTHLY",
  startsOn: d("2026-01-01"),
  endsOn: null,
  installmentCents: null,
  dueOn: null,
  payments: [],
  ...partial,
});

const railway = entry({ name: "Railway", kind: "COST", amountCents: 2000 });
const apple = entry({ name: "Apple", kind: "COST", amountCents: 9900, period: "YEARLY", startsOn: d("2026-03-10") });
const loan = entry({
  name: "Prestito",
  kind: "DEBT",
  amountCents: 300000,
  installmentCents: 20000,
  payments: [
    { amountCents: 20000, paidOn: d("2026-08-05") },
    { amountCents: 20000, paidOn: d("2026-09-05") },
    { amountCents: 20000, paidOn: d("2026-10-05") },
  ],
});

test("amounts typed the Italian way become cents", () => {
  assert.equal(parseEuroCents("1.250,50"), 125050);
  assert.equal(parseEuroCents("20"), 2000);
  assert.equal(parseEuroCents("3.000"), 300000);
  assert.equal(parseEuroCents("1.200.000"), 120000000);
  assert.equal(parseEuroCents("8.25"), 825);
  assert.equal(parseEuroCents("8,25 €"), 825);
  assert.equal(parseEuroCents("abc"), null);
  assert.equal(parseEuroCents(""), null);
});

test("a loan knows what is left and when it ends", () => {
  assert.equal(debtRemainingCents(loan), 240000);
  assert.equal(debtEndsKey(loan, "2026-11"), "2027-10");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("the month at a glance spreads yearly costs and counts the installment", () => {
  const summary = monthSummary([railway, apple, loan], 12796, "2026-10");
  assert.equal(summary.out, 2000 + 825 + summary.fees);
  assert.equal(summary.installments, 20000);
  assert.equal(summary.owed, 240000);
  assert.equal(summary.afterInstallments, summary.left - 20000);
});

test("money moves when it really does: yearly in its month, debts when paid", () => {
  const march = cashForMonth([railway, apple, loan], [], "2027-03");
  assert.equal(march.out, 2000 + 9900);
  const october = cashForMonth([railway, apple, loan], [{ paidAmount: 2999, paidAt: d("2026-10-03") }], "2026-10");
  assert.equal(october.income, 2999);
  assert.equal(october.out, 2000 + 20000 + Math.round(2999 * 0.015) + 25);
});

test("the report runs a balance from the oldest month shown", () => {
  const rows = monthlyReport([railway], [], "2026-10", 3);
  assert.deepEqual(rows.map((row) => row.key), ["2026-10", "2026-09", "2026-08"]);
  assert.equal(rows[0].running, -6000);
  assert.equal(rows[2].running, -2000);
});

test("break-even counts whole venues", () => {
  assert.equal(breakEvenVenues(31224, 2999), 11);
  assert.equal(breakEvenVenues(0, 2999), 0);
});
