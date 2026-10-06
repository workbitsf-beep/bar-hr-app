import { test } from "node:test";
import assert from "node:assert/strict";
import { TaskRepeatUnit } from "@prisma/client";
import { nextTaskDueDate } from "../lib/task-recurrence";

// Una verifica "ogni giorno alle 9" resta alle 9 anche quando cambia l'ora:
// il 25 ottobre 2026 l'Italia torna all'ora solare.
process.env.TZ = "Europe/Rome";

test("ogni giorno alle 9 resta alle 9 dopo il ritorno all'ora solare", () => {
  const sabato = new Date(2026, 9, 24, 9, 0);
  const prossima = nextTaskDueDate(sabato, { repeatEvery: 1, repeatUnit: TaskRepeatUnit.DAY }, sabato);

  assert.equal(prossima.getDate(), 25);
  assert.equal(prossima.getHours(), 9);
});

test("ogni settimana scavalca il cambio d'ora senza spostarsi", () => {
  const giovedi = new Date(2026, 9, 22, 18, 30);
  const prossima = nextTaskDueDate(giovedi, { repeatEvery: 1, repeatUnit: TaskRepeatUnit.WEEK }, giovedi);

  assert.equal(prossima.getDate(), 29);
  assert.equal(prossima.getHours(), 18);
  assert.equal(prossima.getMinutes(), 30);
});
