import "server-only";

import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Closing an account without destroying the attendance register.
 *
 * Deleting the person outright took their clock-ins with them, and those are
 * the record an employer is obliged to keep and the worker may one day need to
 * prove the hours they worked. Erasure does not reach data a legal obligation
 * requires be kept (art. 17.3.b GDPR) — but everything else has to go.
 *
 * So the account is closed rather than removed: credentials, sessions,
 * passkeys, devices and the address are destroyed, the account can no longer
 * be used, and what stays is the name against the hours, which is what the
 * register is for.
 */
export type RetirementOutcome = "deleted" | "retired";

/** Records the employer must keep, and that therefore hold the person here. */
async function hasRecordsUnderLegalHold(tx: Prisma.TransactionClient, userId: string) {
  const [timeLogs, requests] = await Promise.all([
    tx.timeLog.count({ where: { userId } }),
    tx.request.count({ where: { employeeId: userId } }),
  ]);

  return timeLogs > 0 || requests > 0;
}

export async function closeUserAccount(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<RetirementOutcome> {
  if (!(await hasRecordsUnderLegalHold(tx, userId))) {
    // Nothing to preserve: the account can go in full.
    await tx.user.delete({ where: { id: userId } });

    return "deleted";
  }

  // Everything that identifies or lets in, destroyed.
  await tx.session.deleteMany({ where: { userId } });
  await tx.webAuthnCredential.deleteMany({ where: { userId } });
  await tx.webAuthnChallenge.deleteMany({ where: { userId } });
  await tx.pushToken.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });

  await tx.user.update({
    where: { id: userId },
    data: {
      // Unique and unusable: nobody can write to it and nobody can reuse it.
      email: `chiuso-${userId}@account.invalid`,
      // Not a hash of anything, so no password can ever match it.
      passwordHash: `closed:${randomBytes(24).toString("hex")}`,
      mustChangePwd: false,
      retiredAt: new Date(),
    },
  });

  return "retired";
}

export async function closeUserAccounts(userIds: string[]) {
  const outcomes: Record<RetirementOutcome, number> = { deleted: 0, retired: 0 };

  for (const userId of userIds) {
    const outcome = await prisma.$transaction((tx) => closeUserAccount(tx, userId));
    outcomes[outcome] += 1;
  }

  return outcomes;
}
