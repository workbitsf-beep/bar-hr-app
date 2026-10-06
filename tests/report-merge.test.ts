import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRestaurantDatasets } from "../lib/report-merge";
import type { MonthlyDataset } from "../lib/reporting";

// Il report di tutto il team di un bar usciva vuoto: l'unione accettava solo i
// report delle aziende. Qui due persone dello stesso locale, stesso giorno.

function shift(clockIn: string, clockOut: string, hours: number) {
  return {
    inLogId: `in-${clockIn}`,
    outLogId: `out-${clockOut}`,
    clockIn,
    clockOut,
    roundedClockIn: clockIn,
    roundedClockOut: clockOut,
    plannedStart: null,
    plannedEnd: null,
    realDurationMs: hours * 3_600_000,
    roundedDurationMs: hours * 3_600_000,
    realHours: hours,
    roundedHours: hours,
    onCall: false,
  };
}

function month(entry: ReturnType<typeof shift>, label?: string): MonthlyDataset {
  return {
    mode: "restaurant",
    groupedLogs: [
      {
        date: "2026-10-03",
        entries: [entry],
        totals: { realHours: entry.realHours, roundedHours: entry.roundedHours },
        labels: label ? [label] : [],
        items: [],
      },
    ],
    totals: { realHours: entry.realHours, roundedHours: entry.roundedHours },
  };
}

test("il report di squadra di un bar somma le ore di tutti", () => {
  const team = mergeRestaurantDatasets([
    { userLabel: "Marco Bianchi", dataset: month(shift("2026-10-03T16:00:00.000Z", "2026-10-03T21:30:00.000Z", 5.5)) },
    { userLabel: "Sara Colombo", dataset: month(shift("2026-10-03T10:00:00.000Z", "2026-10-03T14:00:00.000Z", 4)) },
  ]);

  assert.equal(team.mode, "restaurant");
  assert.equal(team.totals.roundedHours, 9.5);
  assert.equal(team.groupedLogs.length, 1);
  assert.equal(team.groupedLogs[0].entries.length, 2);
  assert.equal(team.groupedLogs[0].totals.roundedHours, 9.5);
});

test("ogni timbratura porta il nome di chi l'ha fatta, in ordine di orario", () => {
  const team = mergeRestaurantDatasets([
    { userLabel: "Marco Bianchi", dataset: month(shift("2026-10-03T16:00:00.000Z", "2026-10-03T21:30:00.000Z", 5.5)) },
    { userLabel: "Sara Colombo", dataset: month(shift("2026-10-03T10:00:00.000Z", "2026-10-03T14:00:00.000Z", 4)) },
  ]);

  assert.deepEqual(
    team.groupedLogs[0].entries.map((entry) => entry.personLabel),
    ["Sara Colombo", "Marco Bianchi"]
  );
});
