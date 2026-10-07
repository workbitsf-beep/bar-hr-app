import assert from "node:assert/strict";
import { test } from "node:test";
import { translateRuntimeValue } from "../lib/language";

test("in italiano le parole italiane restano come sono", () => {
  // "Note" is also the English for "Nota": it must not turn into "Nota".
  assert.equal(translateRuntimeValue("it", "Note"), "Note");
  assert.equal(translateRuntimeValue("it", "Impostazioni"), "Impostazioni");
});

test("le etichette di sistema diventano italiane", () => {
  assert.equal(translateRuntimeValue("it", "OWNER"), "Titolare");
});

test("nelle altre lingue la traduzione funziona ancora", () => {
  assert.equal(translateRuntimeValue("en", "Nota"), "Note");
  assert.equal(translateRuntimeValue("en", "Impostazioni"), "Settings");
  assert.equal(translateRuntimeValue("fr", "Settings"), "Parametres");
});
