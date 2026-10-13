import assert from "node:assert/strict";
import { test } from "node:test";
import { can, hasWholeScope, parsePermissions, scopeOf } from "../lib/staff-permissions";

test("the owner may do everything, an employee none of it", () => {
  assert.equal(can({ role: "OWNER" }, "documents"), true);
  assert.equal(can({ role: "OWNER" }, "shifts", "SALA"), true);
  assert.equal(can({ role: "EMPLOYEE", permissions: ["shifts"] }, "shifts"), false);
  assert.equal(can(null, "shifts"), false);
});

test("a responsabile does only what was ticked", () => {
  const luca = { role: "MANAGER", permissions: ["shifts", "requests"] };
  assert.equal(can(luca, "shifts"), true);
  assert.equal(can(luca, "documents"), false);
  assert.equal(hasWholeScope(luca), true);
});

test("a responsabile di Sala acts in Sala and on Jolly, nowhere else", () => {
  const sala = { role: "MANAGER", permissions: ["shifts"], managesDepartments: ["SALA"] };
  assert.equal(can(sala, "shifts", "SALA"), true);
  assert.equal(can(sala, "shifts", "JOLLY"), true);
  assert.equal(can(sala, "shifts", "CUCINA"), false);
  assert.equal(can(sala, "shifts", null), false);
  // Somewhere at all: yes, so the calendar shows its tools.
  assert.equal(can(sala, "shifts"), true);
  assert.deepEqual(scopeOf(sala), ["SALA"]);
  assert.equal(hasWholeScope(sala), false);
});

test("amministrazione of two sites out of three", () => {
  const sara = { role: "AMMINISTRAZIONE", permissions: ["documents", "reports"], managesDepartments: ["SEDE_1", "SEDE_3"] };
  assert.equal(can(sara, "documents", "SEDE_1"), true);
  assert.equal(can(sara, "documents", "SEDE_3"), true);
  assert.equal(can(sara, "documents", "SEDE_2"), false);
  assert.equal(can(sara, "documents", null), false);
  assert.equal(can(sara, "shifts", "SEDE_1"), false);
});

test("only known permissions are kept", () => {
  assert.deepEqual(parsePermissions(["reports", "admin", "shifts", "shifts"]), ["shifts", "reports"]);
});
