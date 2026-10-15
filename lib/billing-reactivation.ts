import "server-only";

import { sendReactivationEmail } from "@/lib/email/notifications";
import { prisma } from "@/lib/prisma";
import { mainBarIdOf } from "@/lib/venue-branches";

const ONCE_A_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The owner opened a stopped venue inside the installed app, where nothing
 * may point at paying: the link to reactivate goes by email instead, once a
 * day at most. Returns the address it went to (now or earlier today), or null
 * when it could not be sent.
 */
export async function sendReactivationEmailOnce(barId: string, userId: string) {
  const mainId = await mainBarIdOf(barId);
  const [subscription, user, bar] = await Promise.all([
    prisma.subscription.findUnique({ where: { barId: mainId }, select: { id: true, reactivationEmailAt: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } }),
    prisma.bar.findUnique({ where: { id: mainId }, select: { name: true } }),
  ]);
  if (!subscription || !user?.email || !bar) return null;

  const last = subscription.reactivationEmailAt;
  if (last && Date.now() - last.getTime() < ONCE_A_DAY_MS) return user.email;

  // Claimed before sending, so two pages opened together send one email.
  const claimed = await prisma.subscription.updateMany({
    where: {
      id: subscription.id,
      OR: [{ reactivationEmailAt: null }, { reactivationEmailAt: { lt: new Date(Date.now() - ONCE_A_DAY_MS) } }],
    },
    data: { reactivationEmailAt: new Date() },
  });
  if (claimed.count === 0) return user.email;

  const result = await sendReactivationEmail(user.email, user.firstName || "titolare", bar.name);
  if (!result.ok) {
    await prisma.subscription.update({ where: { id: subscription.id }, data: { reactivationEmailAt: last } });
    return null;
  }
  return user.email;
}
