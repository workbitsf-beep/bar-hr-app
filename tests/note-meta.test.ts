import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNoteMeta, isOverdue, relativeDayLabel } from "../lib/note-list-format";

/**
 * Le regole di cosa dice una nota, e quando e in ritardo.
 *
 * Il 30 settembre 2026 un promemoria - una nota senza niente da confermare,
 * che si cancella da sola dopo 24 ore - veniva marcato "in ritardo" in rosso
 * la mattina dopo. Chiedeva di rimediare a una cosa a cui non c'e niente da
 * rimediare.
 */

const OGGI = new Date(2026, 9, 11, 12, 0, 0);
const IERI = new Date(2026, 9, 10, 12, 0, 0);
const DOMANI = new Date(2026, 9, 12, 12, 0, 0);

const base = {
  done: false,
  urgent: false,
  requiresConfirmation: true,
  repeatLabel: null,
  assignedLabel: null,
  authorLabel: null,
  completedBy: null,
  now: OGGI,
};

test("un promemoria non e mai in ritardo, per quanto vecchio sia", () => {
  const meta = buildNoteMeta({ ...base, dueDate: IERI, requiresConfirmation: false });

  assert.equal(meta.late, false);
  assert.equal(meta.accent, null, "e nemmeno la barra rossa");
  assert.ok(!meta.parts.some((p) => p.text === "in ritardo"));
});

test("una nota da confermare e scaduta invece si", () => {
  const meta = buildNoteMeta({ ...base, dueDate: IERI });

  assert.equal(meta.late, true);
  assert.equal(meta.accent, "#ef4444");
  assert.ok(meta.parts.some((p) => p.text === "in ritardo" && p.alarming));
});

test("una nota gia fatta non e in ritardo, anche se era di ieri", () => {
  const meta = buildNoteMeta({ ...base, dueDate: IERI, done: true });

  assert.equal(meta.late, false);
});

test("done viaggia nel meta, cosi chi disegna non deve indovinarlo", () => {
  // Prima si capiva se una nota era fatta leggendo il sottotitolo e cercando
  // le parole "fatta da": una nota che nessuno aveva firmato restava dritta.
  const senzaFirma = buildNoteMeta({ ...base, dueDate: OGGI, done: true, completedBy: null });

  assert.equal(senzaFirma.done, true);
});

test("i giorni si dicono come li dice una persona", () => {
  assert.equal(relativeDayLabel(OGGI, OGGI), "oggi");
  assert.equal(relativeDayLabel(IERI, OGGI), "ieri");
  assert.equal(relativeDayLabel(DOMANI, OGGI), "domani");
});

test("isOverdue guarda il giorno, non l'orario", () => {
  // Una nota per oggi non e in ritardo alle 23:59.
  assert.equal(isOverdue(new Date(2026, 9, 11, 8, 0), new Date(2026, 9, 11, 23, 59)), false);
  assert.equal(isOverdue(IERI, OGGI), true);
});

test("urgente e ritardo non si dicono su una nota gia fatta", () => {
  const meta = buildNoteMeta({ ...base, dueDate: IERI, urgent: true, done: true });

  assert.ok(!meta.parts.some((p) => p.text === "urgente"));
  assert.ok(!meta.parts.some((p) => p.text === "in ritardo"));
});
