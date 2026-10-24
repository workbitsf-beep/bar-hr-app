import assert from "node:assert/strict";
import { test } from "node:test";
import { clockDirectionOf, decideOutsideStamp } from "../lib/clock-request";

const now = new Date("2026-10-24T17:55:00Z");

test("a shift reminder stamps its own way, a tap included", () => {
  assert.equal(clockDirectionOf("timelog.clock-in.before"), "in");
  assert.equal(clockDirectionOf("timelog.clock-in.start", "tap"), "in");
  assert.equal(clockDirectionOf("timelog.clock-out.end", "timbra"), "out");
});

test("other notices only open their page", () => {
  assert.equal(clockDirectionOf("timelog.clocked-in"), null);
  assert.equal(clockDirectionOf("timelog.auto-clock-out"), null);
  assert.equal(clockDirectionOf("shift.published", "tap"), null);
});

test("Esci on the Live Activity stamps whichever way is next", () => {
  assert.equal(clockDirectionOf("", "timbra"), "any");
});

test("an entry reminder stamps the entry", () => {
  assert.deepEqual(decideOutsideStamp({ direction: "in", isIn: false, shiftEndAt: null, now }), {
    kind: "stamp",
    endpoint: "clock-in",
  });
});

test("an entry reminder tapped once in never stamps the exit", () => {
  const decision = decideOutsideStamp({ direction: "in", isIn: true, shiftEndAt: "2026-10-24T22:00:00Z", now });
  assert.equal(decision.kind, "refuse");
});

test("an exit reminder before any entry stamps nothing", () => {
  assert.equal(decideOutsideStamp({ direction: "out", isIn: false, shiftEndAt: null, now }).kind, "refuse");
});

test("an exit well before the end of the shift asks first", () => {
  const decision = decideOutsideStamp({ direction: "any", isIn: true, shiftEndAt: "2026-10-24T22:00:00Z", now });
  assert.equal(decision.kind, "confirm");
});

test("an exit near the end of the shift goes straight through", () => {
  const decision = decideOutsideStamp({ direction: "out", isIn: true, shiftEndAt: "2026-10-24T18:05:00Z", now });
  assert.deepEqual(decision, { kind: "stamp", endpoint: "clock-out" });
});
