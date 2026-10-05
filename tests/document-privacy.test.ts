import { test } from "node:test";
import assert from "node:assert/strict";
import { Role } from "@prisma/client";
import { canViewDocument } from "../lib/documents";

// A colleague's contract is private. The owner and the office read it; a
// responsabile runs the floor and does not.
const colleagueContract = { assignedToAll: false, assignedToId: "colleague", isActive: true };

test("owner and amministrazione can open a colleague's document", () => {
  assert.equal(canViewDocument(colleagueContract, "me", Role.OWNER), true);
  assert.equal(canViewDocument(colleagueContract, "me", Role.AMMINISTRAZIONE), true);
});

test("a responsabile cannot open a colleague's document", () => {
  assert.equal(canViewDocument(colleagueContract, "me", Role.MANAGER), false);
});

test("a responsabile still sees their own and the team's documents", () => {
  assert.equal(canViewDocument({ ...colleagueContract, assignedToId: "me" }, "me", Role.MANAGER), true);
  assert.equal(
    canViewDocument({ assignedToAll: true, assignedToId: null, isActive: true }, "me", Role.MANAGER),
    true
  );
});
