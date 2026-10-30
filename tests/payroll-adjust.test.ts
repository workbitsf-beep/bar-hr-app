import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMonthTargets, totalsOf } from "../lib/payroll/adjust";
import type { PayrollEntry } from "../lib/payroll/template";

const month = { year: 2026, month: 10, dailyHours: 6.67 };
const worked: PayrollEntry[] = [
  { date: "2026-10-01", kind: "ordinary", hours: 8, days: 0 },
  { date: "2026-10-02", kind: "ordinary", hours: 8, days: 0 },
  { date: "2026-10-03", kind: "ordinary", hours: 8, days: 0 },
  { date: "2026-10-03", kind: "overtime", hours: 2, days: 0 },
];

test("hours taken off come from the last days and the total is the one asked", () => {
  const result = applyMonthTargets(worked, { ordinary: { hours: 13 } }, month);
  assert.equal(totalsOf(result).ordinary.hours, 13);
  assert.deepEqual(
    result.filter((entry) => entry.kind === "ordinary").map((entry) => [entry.date, entry.hours]),
    [["2026-10-01", 8], ["2026-10-02", 5]],
  );
  assert.equal(totalsOf(result).overtime.hours, 2);
});

test("hours added spread over the days worked, a day at most 12", () => {
  const result = applyMonthTargets(worked, { overtime: { hours: 10 } }, month);
  assert.equal(totalsOf(result).overtime.hours, 10);
  for (const date of ["2026-10-01", "2026-10-02", "2026-10-03"]) {
    const day = result.filter((entry) => entry.date === date).reduce((sum, entry) => sum + entry.hours, 0);
    assert.ok(day <= 12, `${date}: ${day}`);
  }
});

test("an item taken to zero disappears from the file", () => {
  const result = applyMonthTargets(worked, { overtime: { hours: 0 } }, month);
  assert.equal(result.some((entry) => entry.kind === "overtime"), false);
});

test("whole days are added on free days and removed from the last ones", () => {
  const added = applyMonthTargets(worked, { holiday: { days: 2 } }, month);
  assert.deepEqual(
    added.filter((entry) => entry.kind === "holiday").map((entry) => entry.date),
    ["2026-10-30", "2026-10-31"],
  );
  const removed = applyMonthTargets(added, { holiday: { days: 1 } }, month);
  assert.deepEqual(removed.filter((entry) => entry.kind === "holiday").map((entry) => entry.date), ["2026-10-30"]);
});

test("nothing asked, nothing changed", () => {
  assert.deepEqual(applyMonthTargets(worked, {}, month), worked);
});
