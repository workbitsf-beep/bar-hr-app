import assert from "node:assert/strict";
import { test } from "node:test";
import { isStaleEntry } from "../lib/clock-fixes";

const at = (iso: string) => new Date(iso);

test("an entry is closed with Esci until three hours after its shift", () => {
  const entry = { timestamp: at("2026-10-12T16:00:00Z"), shift: { endTime: at("2026-10-12T22:00:00Z") } };
  assert.equal(isStaleEntry(entry, at("2026-10-12T22:30:00Z")), false);
  assert.equal(isStaleEntry(entry, at("2026-10-13T00:59:00Z")), false);
  // The next morning, still open: it has to be reported.
  assert.equal(isStaleEntry(entry, at("2026-10-13T09:00:00Z")), true);
});

test("an entry with no shift goes stale after sixteen hours", () => {
  const entry = { timestamp: at("2026-10-12T08:00:00Z"), shift: null };
  assert.equal(isStaleEntry(entry, at("2026-10-12T20:00:00Z")), false);
  assert.equal(isStaleEntry(entry, at("2026-10-13T00:00:00Z")), true);
});
