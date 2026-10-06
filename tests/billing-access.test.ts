import { test } from "node:test";
import assert from "node:assert/strict";
import { PlanType, SubscriptionStatus } from "@prisma/client";
import { computeCanAccess } from "../lib/billing-access";

// Le regole decise il 6 ottobre: ogni addebito emesso e non ancora pagato da
// sette giorni di tempo, poi il locale si ferma finche il pagamento non arriva.
// Quando arriva, il mese e regolare. La prova di trenta giorni non c'entra.

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const daysAhead = (days: number) => new Date(Date.now() + days * DAY);

const paid = (paymentDueSince: Date | null, status: SubscriptionStatus = SubscriptionStatus.ACTIVE) => ({
  planType: PlanType.PAID,
  status,
  currentPeriodEnd: daysAhead(25),
  trialEndsAt: null,
  paymentDueSince,
});

test("un addebito in lavorazione da 3 giorni lascia lavorare", () => {
  assert.equal(computeCanAccess(paid(daysAgo(3))), true);
});

test("dopo 7 giorni senza pagamento il locale si ferma, anche col mese gia avanzato", () => {
  assert.equal(computeCanAccess(paid(daysAgo(8))), false);
  assert.equal(computeCanAccess(paid(daysAgo(8), SubscriptionStatus.PAST_DUE)), false);
});

test("un pagamento fallito da 2 giorni lascia ancora lavorare", () => {
  assert.equal(computeCanAccess(paid(daysAgo(2), SubscriptionStatus.PAST_DUE)), true);
});

test("pagato: nessuna attesa, il mese e regolare", () => {
  assert.equal(computeCanAccess(paid(null)), true);
});

test("un abbonamento cancellato non riapre per la finestra di 7 giorni", () => {
  assert.equal(computeCanAccess(paid(daysAgo(1), SubscriptionStatus.CANCELED)), false);
});

test("la prova gratuita resta valida fino alla scadenza", () => {
  const trial = {
    planType: PlanType.TRIAL,
    status: SubscriptionStatus.TRIALING,
    currentPeriodEnd: null,
    trialEndsAt: daysAhead(20),
    paymentDueSince: null,
  };
  assert.equal(computeCanAccess(trial), true);
});
