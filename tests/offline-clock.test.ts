import assert from "node:assert/strict";
import { test } from "node:test";
import { clockMomentOf } from "../lib/offline-clock";

const now = new Date("2026-10-14T18:00:00Z");

test("a normal stamp is now, not offline", () => {
  assert.deepEqual(clockMomentOf(undefined, now), { at: now, offline: false });
});

test("a stamp made two hours ago without network keeps its time", () => {
  const at = new Date("2026-10-14T16:00:00Z");
  assert.deepEqual(clockMomentOf(at.toISOString(), now), { at, offline: true });
});

test("too old or in the future is refused", () => {
  assert.ok("error" in clockMomentOf("2026-10-14T05:00:00Z", now));
  assert.ok("error" in clockMomentOf("2026-10-14T18:10:00Z", now));
  assert.ok("error" in clockMomentOf("ieri", now));
});
