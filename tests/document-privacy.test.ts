import { test } from "node:test";
import assert from "node:assert/strict";
import { canViewDocument } from "../lib/documents";

// A colleague's contract is private. The owner and whoever holds "Documenti"
// over that person read it; a responsabile without it does not.
const colleagueContract = { assignedToAll: false, assignedToId: "colleague", isActive: true };
const office = { role: "AMMINISTRAZIONE", permissions: ["documents"] };
const floor = { role: "MANAGER", permissions: ["shifts", "requests"] };

test("owner and staff with Documenti can open a colleague's document", () => {
  assert.equal(canViewDocument(colleagueContract, "me", { role: "OWNER" }, "SEDE_1"), true);
  assert.equal(canViewDocument(colleagueContract, "me", office, "SEDE_1"), true);
});

test("staff over some sites open only their people's documents", () => {
  const monza = { ...office, managesDepartments: ["SEDE_2"] };
  assert.equal(canViewDocument(colleagueContract, "me", monza, "SEDE_2"), true);
  assert.equal(canViewDocument(colleagueContract, "me", monza, "SEDE_1"), false);
});

test("a responsabile without Documenti cannot open a colleague's document", () => {
  assert.equal(canViewDocument(colleagueContract, "me", floor, null), false);
});

test("a responsabile still sees their own and the team's documents", () => {
  assert.equal(canViewDocument({ ...colleagueContract, assignedToId: "me" }, "me", floor, null), true);
  assert.equal(canViewDocument({ assignedToAll: true, assignedToId: null, isActive: true }, "me", floor, null), true);
});
