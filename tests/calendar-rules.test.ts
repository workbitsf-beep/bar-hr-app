import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildShiftOverlaps,
  collectSharedFirstNames,
  hasTimeOverlap,
  shortNameFor,
  type RuleShift,
} from "../lib/calendar-rules";

/**
 * Le regole del calendario: come si chiama una persona su una riga stretta,
 * e chi sta in due posti nello stesso momento.
 *
 * Il controllo sulle sovrapposizioni non esisteva: un locale poteva mettere
 * la stessa persona su tre turni che passavano tutti dalla stessa mattina.
 */

const turno = (
  id: string,
  startTime: string,
  endTime: string,
  persone: Array<[string, string, string]>
): RuleShift => ({
  id,
  startTime,
  endTime,
  assignments: persone.map(([pid, firstName, lastName]) => ({ id: pid, firstName, lastName })),
});

// ── i nomi ────────────────────────────────────────────────────────────

test("chi guarda e sempre 'Tu', qualunque sia il suo nome", () => {
  const io = { id: "1", firstName: "Sergio", lastName: "Tipa", isCurrentUser: true };

  assert.equal(shortNameFor(io, new Set()), "Tu");
  assert.equal(shortNameFor(io, new Set(["sergio"])), "Tu");
});

test("un nome che nessun altro porta resta solo il nome", () => {
  const anna = { id: "2", firstName: "Anna", lastName: "Rossi" };

  assert.equal(shortNameFor(anna, new Set()), "Anna");
});

test("se in due si chiamano Anna, compare l'iniziale", () => {
  const anna = { id: "2", firstName: "Anna", lastName: "Rossi" };

  assert.equal(shortNameFor(anna, new Set(["anna"])), "Anna R.");
});

test("senza nome si ripiega sul cognome, e senza nemmeno quello su un trattino", () => {
  assert.equal(shortNameFor({ id: "3", firstName: "  ", lastName: "Bianchi" }, new Set()), "Bianchi");
  assert.equal(shortNameFor({ id: "4", firstName: "", lastName: "" }, new Set()), "—");
});

test("i nomi ripetuti si cercano su tutto il calendario, non sul singolo giorno", () => {
  // Lunedi c'e Anna Rossi, giovedi Anna Bianchi: gia lunedi deve dire "Anna R."
  const giorni = [
    { shifts: [turno("t1", "2026-10-05T07:00:00Z", "2026-10-05T14:00:00Z", [["a", "Anna", "Rossi"]])] },
    { shifts: [turno("t2", "2026-10-08T07:00:00Z", "2026-10-08T14:00:00Z", [["b", "Anna", "Bianchi"]])] },
  ];

  assert.deepEqual([...collectSharedFirstNames(giorni)], ["anna"]);
});

test("la stessa persona su piu giorni non e un nome ripetuto", () => {
  const giorni = [
    { shifts: [turno("t1", "2026-10-05T07:00:00Z", "2026-10-05T14:00:00Z", [["a", "Anna", "Rossi"]])] },
    { shifts: [turno("t2", "2026-10-06T07:00:00Z", "2026-10-06T14:00:00Z", [["a", "Anna", "Rossi"]])] },
  ];

  assert.equal(collectSharedFirstNames(giorni).size, 0);
});

// ── le sovrapposizioni ────────────────────────────────────────────────

test("due turni che si toccano con la stessa persona sono un conflitto", () => {
  const out = buildShiftOverlaps([
    turno("t1", "2026-10-05T07:00:00Z", "2026-10-05T14:00:00Z", [["a", "Anna", "Rossi"]]),
    turno("t2", "2026-10-05T12:00:00Z", "2026-10-05T18:00:00Z", [["a", "Anna", "Rossi"]]),
  ]);

  assert.deepEqual([...out.clashing].sort(), ["t1", "t2"]);
  assert.equal(out.message, "Anna Rossi è in 2 turni che si accavallano");
});

test("due turni che si toccano con persone diverse non sono un conflitto", () => {
  const out = buildShiftOverlaps([
    turno("t1", "2026-10-05T07:00:00Z", "2026-10-05T14:00:00Z", [["a", "Anna", "Rossi"]]),
    turno("t2", "2026-10-05T12:00:00Z", "2026-10-05T18:00:00Z", [["b", "Marco", "Bianchi"]]),
  ]);

  assert.equal(out.clashing.size, 0);
  assert.equal(out.message, null);
});

test("due turni attaccati ma non sovrapposti vanno benissimo", () => {
  const out = buildShiftOverlaps([
    turno("t1", "2026-10-05T07:00:00Z", "2026-10-05T14:00:00Z", [["a", "Anna", "Rossi"]]),
    turno("t2", "2026-10-05T14:00:00Z", "2026-10-05T22:00:00Z", [["a", "Anna", "Rossi"]]),
  ]);

  assert.equal(out.clashing.size, 0);
});

test("tre turni sulla stessa mattina si contano una volta sola, come tre", () => {
  const out = buildShiftOverlaps([
    turno("t1", "2026-10-05T07:00:00Z", "2026-10-05T14:00:00Z", [["a", "Anna", "Rossi"]]),
    turno("t2", "2026-10-05T08:00:00Z", "2026-10-05T12:00:00Z", [["a", "Anna", "Rossi"]]),
    turno("t3", "2026-10-05T09:00:00Z", "2026-10-05T11:00:00Z", [["a", "Anna", "Rossi"]]),
  ]);

  assert.equal(out.clashing.size, 3);
  assert.equal(out.message, "Anna Rossi è in 3 turni che si accavallano");
});

test("quando sono in due, la frase li nomina entrambi", () => {
  const out = buildShiftOverlaps([
    turno("t1", "2026-10-05T07:00:00Z", "2026-10-05T14:00:00Z", [
      ["a", "Anna", "Rossi"],
      ["b", "Marco", "Bianchi"],
    ]),
    turno("t2", "2026-10-05T12:00:00Z", "2026-10-05T18:00:00Z", [
      ["a", "Anna", "Rossi"],
      ["b", "Marco", "Bianchi"],
    ]),
  ]);

  assert.equal(out.message, "Anna Rossi, Marco Bianchi hanno turni che si accavallano");
});

test("un turno che scavalca la mezzanotte si confronta lo stesso", () => {
  // 19:00-01:00 del giorno dopo, contro un 23:00-03:00: si toccano.
  assert.equal(
    hasTimeOverlap(
      "2026-10-05T19:00:00Z",
      "2026-10-06T01:00:00Z",
      "2026-10-05T23:00:00Z",
      "2026-10-06T03:00:00Z"
    ),
    true
  );
});

test("una giornata senza turni non da nessun messaggio", () => {
  const out = buildShiftOverlaps([]);

  assert.equal(out.clashing.size, 0);
  assert.equal(out.message, null);
});
