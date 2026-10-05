import { test } from "node:test";
import assert from "node:assert/strict";
import { ClockType } from "@prisma/client";
import { sessionsStartingBefore } from "../lib/session-window";

// The 31st's evening shift closes on the 1st. It belongs to the month it
// started in, and the 1st's own shift does not.
const monthEnd = new Date("2026-11-01T00:00:00+01:00");
const log = (type: ClockType, at: string) => ({ type, timestamp: new Date(at) });

test("an exit past the end of the month closes the shift that started in it", () => {
  const logs = [
    log(ClockType.IN, "2026-10-31T19:00:00+01:00"),
    log(ClockType.OUT, "2026-11-01T01:30:00+01:00"),
  ];

  assert.deepEqual(sessionsStartingBefore(logs, monthEnd), logs);
});

test("the next month's shifts are left to the next month", () => {
  const logs = [
    log(ClockType.IN, "2026-10-31T19:00:00+01:00"),
    log(ClockType.OUT, "2026-11-01T01:30:00+01:00"),
    log(ClockType.IN, "2026-11-01T18:00:00+01:00"),
    log(ClockType.OUT, "2026-11-01T23:00:00+01:00"),
  ];

  assert.deepEqual(sessionsStartingBefore(logs, monthEnd), logs.slice(0, 2));
});

test("a forgotten exit is not closed by the next month's exit", () => {
  const logs = [
    log(ClockType.IN, "2026-10-31T19:00:00+01:00"),
    log(ClockType.IN, "2026-11-01T18:00:00+01:00"),
    log(ClockType.OUT, "2026-11-01T23:00:00+01:00"),
  ];

  assert.deepEqual(sessionsStartingBefore(logs, monthEnd), logs.slice(0, 1));
});
