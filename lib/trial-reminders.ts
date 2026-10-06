import { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTrialEndingEmail } from "@/lib/email/notifications";

/**
 * L'avviso, tre giorni prima che la prova finisca.
 *
 * Alla scadenza l'abbonamento parte da solo. E la scelta giusta - chi si e
 * trovato bene non deve fare niente per continuare - ma ha un rovescio: chi
 * si e dimenticato scopre l'addebito dall'estratto conto, e allora non
 * disdice, contesta il pagamento. Una contestazione con Stripe costa piu di
 * un abbonamento, e arriva con un cliente arrabbiato in omaggio.
 *
 * Questo lavoro gira ogni notte insieme agli altri, guarda chi scade fra tre
 * giorni, e scrive una volta sola. Il "una volta sola" e la ragione del campo
 * trialEndingNoticeAt: senza quel segno, girando ogni giorno, riscriverebbe
 * alla stessa persona ogni mattina fino alla scadenza.
 */

const GIORNI_DI_PREAVVISO = 3;

export async function runTrialEndingReminders(now = new Date()) {
  // Chiunque scada entro i prossimi tre giorni e non sia ancora stato
  // avvisato. Prima la finestra era il solo giorno a tre giorni da oggi: se
  // quel giorno il lavoro non girava, o la prova era gia piu corta, l'avviso
  // non partiva mai e l'addebito arrivava senza preavviso.
  const from = now;
  const to = new Date(now);
  to.setDate(to.getDate() + GIORNI_DI_PREAVVISO);
  to.setHours(23, 59, 59, 999);

  const inScadenza = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: { gte: from, lt: to },
      trialEndingNoticeAt: null,
    },
    select: {
      id: true,
      trialEndsAt: true,
      bar: {
        select: {
          name: true,
          owner: { select: { email: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  let inviate = 0;
  let fallite = 0;

  for (const abbonamento of inScadenza) {
    const titolare = abbonamento.bar?.owner;

    if (!titolare?.email || !abbonamento.trialEndsAt) {
      continue;
    }

    try {
      const esito = await sendTrialEndingEmail(
        titolare.email,
        `${titolare.firstName} ${titolare.lastName}`.trim() || titolare.email,
        abbonamento.bar?.name ?? "il tuo locale",
        abbonamento.trialEndsAt
      );

      if (!esito.ok) {
        throw new Error("invio non riuscito");
      }

      // Il segno si mette solo dopo un invio riuscito: se l'email non parte,
      // domani si riprova, invece di perdere l'unico avviso.
      await prisma.subscription.update({
        where: { id: abbonamento.id },
        data: { trialEndingNoticeAt: new Date() },
      });

      inviate += 1;
    } catch (error) {
      fallite += 1;
      console.error("[prova-in-scadenza] avviso non partito", {
        subscriptionId: abbonamento.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { trovate: inScadenza.length, inviate, fallite };
}
