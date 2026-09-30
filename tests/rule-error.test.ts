import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTION_FAILURE_FALLBACK,
  RuleError,
  describeActionError,
  isActionFailure,
  ruleFailure,
} from "../lib/rule-error";

/**
 * Come una regola arriva in faccia a chi la infrange.
 *
 * In produzione Next.js sostituisce qualunque cosa un'azione server lanci, e
 * per un anno questo ha nascosto ogni messaggio di validazione dell'app: chi
 * provava a mettere due persone sullo stesso turno leggeva "Minified React
 * error #441" invece del motivo.
 */

test("una regola mantiene le sue parole", () => {
  const out = ruleFailure(new RuleError("Marco e in ferie"));

  assert.deepEqual(out, { ruleError: "Marco e in ferie" });
});

test("un guasto non sputa fuori i suoi dettagli interi", () => {
  const out = ruleFailure(new TypeError("cannot read property x of undefined"));

  assert.ok(out.ruleError.startsWith(ACTION_FAILURE_FALLBACK));
  assert.ok(out.ruleError.length < ACTION_FAILURE_FALLBACK.length + 160);
});

test("redirect() e notFound() passano, non vengono inghiottiti", () => {
  const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/x" });

  // se venisse catturato, un cambio pagina diventerebbe un silenzio
  assert.throws(() => ruleFailure(redirect), /NEXT_REDIRECT/);
});

test("il testo di React non arriva mai su uno schermo", () => {
  const mascherato = new Error(
    "Minified React error #441; visit https://react.dev/errors/441 for the full message"
  );

  assert.equal(describeActionError(mascherato), ACTION_FAILURE_FALLBACK);
});

test("un messaggio normale invece si legge", () => {
  assert.equal(describeActionError(new Error("Data non valida")), "Data non valida");
});

test("isActionFailure riconosce solo la forma giusta", () => {
  assert.equal(isActionFailure({ ruleError: "x" }), true);
  assert.equal(isActionFailure({ id: "x" }), false);
  assert.equal(isActionFailure(null), false);
  assert.equal(isActionFailure("ruleError"), false);
});

test("un errore senza parole ricade sulla frase pronta", () => {
  assert.equal(describeActionError(new Error("   ")), ACTION_FAILURE_FALLBACK);
  assert.equal(describeActionError(undefined), ACTION_FAILURE_FALLBACK);
});
