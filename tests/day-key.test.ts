import { test } from "node:test";
import assert from "node:assert/strict";
import { serializeDay, toDayKey } from "../lib/day-key";

/**
 * Il test che sarebbe servito il 30 settembre 2026.
 *
 * Quel giorno un turno inserito su domenica veniva scritto su sabato, e
 * scoprirlo e costato due ore, un messaggio d'errore illeggibile e 23 turni
 * veri da rimettere a posto. La causa stava tutta in una riga: la giornata
 * veniva mandata al client come mezzanotte **del server**, e il client ne
 * prende i primi dieci caratteri, che leggono la data in UTC.
 *
 * Con il server in UTC tornava per caso. Con il server in Europe/Rome no.
 */

/** Come fa il client, in una ventina di punti: taglia e usa. */
const clientLegge = (iso: string) => iso.slice(0, 10);

test("la chiave e la giornata come la legge una persona, non l'UTC", () => {
  // 11 ottobre 2026 a mezzanotte in Italia = 10 ottobre alle 22:00 in UTC.
  const mezzanotteARoma = new Date(2026, 9, 11, 0, 0, 0, 0);

  assert.equal(toDayKey(mezzanotteARoma), "2026-10-11");
});

test("quello che il client taglia e la giornata giusta, non quella prima", () => {
  const domenica = new Date(2026, 9, 11, 0, 0, 0, 0);

  assert.equal(clientLegge(serializeDay(domenica)), "2026-10-11");
});

test("vale a qualsiasi ora del giorno, non solo a mezzanotte", () => {
  for (const ora of [0, 1, 6, 12, 18, 23]) {
    const giorno = new Date(2026, 9, 11, ora, 30, 0, 0);

    assert.equal(
      clientLegge(serializeDay(giorno)),
      "2026-10-11",
      `alle ${ora}:30 la chiave e cambiata`
    );
  }
});

test("il passaggio all'ora solare non sposta la giornata", () => {
  // In Italia l'ora legale finisce la notte fra sabato 24 e domenica 25
  // ottobre 2026: quella domenica dura 25 ore.
  for (const giorno of [24, 25, 26]) {
    const d = new Date(2026, 9, giorno, 0, 0, 0, 0);

    assert.equal(clientLegge(serializeDay(d)), `2026-10-${giorno}`);
  }
});

test("una settimana intera resta una settimana intera", () => {
  const chiavi = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 9, 5);
    d.setDate(d.getDate() + i);
    return clientLegge(serializeDay(d));
  });

  assert.deepEqual(chiavi, [
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
  ]);
});

test("la stringa mandata al client e sempre ancorata a mezzanotte UTC", () => {
  const d = new Date(2026, 9, 11, 14, 22, 33, 444);

  assert.equal(serializeDay(d), "2026-10-11T00:00:00.000Z");
  // e deve restare una data valida, non solo una stringa che sembra giusta
  assert.equal(new Date(serializeDay(d)).toISOString(), "2026-10-11T00:00:00.000Z");
});
