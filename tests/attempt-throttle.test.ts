import { test } from "node:test";
import assert from "node:assert/strict";
import { createAttemptThrottle } from "../lib/attempt-throttle";

// Il freno sul login: dieci password sbagliate, poi una pausa. Una riuscita
// azzera il conto, e un indirizzo non paga per gli errori di un altro.

test("blocca dopo il numero massimo di tentativi", () => {
  const throttle = createAttemptThrottle(60_000, 3);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    assert.equal(throttle.isAllowed("mario@bar.it"), true);
    throttle.record("mario@bar.it");
  }

  assert.equal(throttle.isAllowed("mario@bar.it"), false);
  assert.equal(throttle.isAllowed("giulia@bar.it"), true);
});

test("un accesso riuscito azzera il conto", () => {
  const throttle = createAttemptThrottle(60_000, 2);
  throttle.record("mario@bar.it");
  throttle.record("mario@bar.it");
  throttle.reset("mario@bar.it");

  assert.equal(throttle.isAllowed("mario@bar.it"), true);
});

test("la pausa finisce allo scadere della finestra", () => {
  const throttle = createAttemptThrottle(-1, 1);
  throttle.record("mario@bar.it");

  assert.equal(throttle.isAllowed("mario@bar.it"), true);
});
