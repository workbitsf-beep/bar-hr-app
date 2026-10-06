import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmedTaskArchived, inConfirmationArchive, noteBoardCutoff, visibleOnBoard } from "../lib/note-visibility";

// La bacheca e di messaggi del giorno; cio che chiedeva una conferma esce dalla
// bacheca dopo 24 ore ma resta in archivio come prova.

const now = new Date("2026-10-06T12:00:00.000Z");
const dayBefore = new Date("2026-10-05T12:00:00.000Z");

test("la bacheca guarda indietro di 24 ore", () => {
  assert.equal(noteBoardCutoff(now).toISOString(), dayBefore.toISOString());
});

test("le note normali restano in bacheca finche esistono, quelle con conferma solo per un giorno", () => {
  assert.deepEqual(visibleOnBoard(now), {
    OR: [
      { requiresConfirmation: false },
      { createdAt: { gte: dayBefore } },
      { activityDate: { gte: dayBefore } },
    ],
  });
});

test("in archivio va solo cio che chiedeva una conferma ed e uscito dalla bacheca", () => {
  assert.equal(inConfirmationArchive(now).requiresConfirmation, true);
  assert.deepEqual(confirmedTaskArchived(now), {
    requiresConfirmation: true,
    status: "DONE",
    completedAt: { lt: dayBefore },
  });
});
