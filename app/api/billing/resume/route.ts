import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { invalidateBillingStatusCache } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { getActiveBarAccess } from "@/lib/permissions";
import { setStripeCancelAtPeriodEnd } from "@/lib/stripe";

/** Undoes "Disattiva abbonamento" while the paid period is still running. */
export async function POST() {
  const session = await getSession();

  if (!session) {
    return Response.json({ ok: false, message: "Sessione scaduta. Accedi di nuovo." }, { status: 401 });
  }

  const { activeBar, role } = await getActiveBarAccess(session);

  if (role !== Role.OWNER || !activeBar?.id) {
    return Response.json({ ok: false, message: "Sessione scaduta. Accedi di nuovo." }, { status: 403 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { barId: activeBar.id },
    select: { id: true, cancelAtPeriodEnd: true, stripeSubscriptionId: true },
  });

  if (!subscription?.cancelAtPeriodEnd || !subscription.stripeSubscriptionId) {
    return Response.json(
      { ok: false, message: "L'abbonamento è già terminato: scegli il piano per riattivarlo." },
      { status: 400 }
    );
  }

  try {
    await setStripeCancelAtPeriodEnd(subscription.stripeSubscriptionId, false);
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Impossibile riattivare l'abbonamento.",
      },
      { status: 500 }
    );
  }

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: false },
  });
  invalidateBillingStatusCache(activeBar.id);

  return Response.json({ ok: true });
}
