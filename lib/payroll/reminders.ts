import "server-only";

import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { monthKeyOf } from "./access";
import { monthName } from "./template";

/**
 * On the day the owner chose, from nine in the morning in Italy: last
 * month's attendance is ready to check and send. Once per recipient and
 * month, and not at all once that month went out to them.
 */
export async function runPayrollReminders(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  if (hour < 9) return { reminded: 0 };
  const previous = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 2, 1));
  const year = previous.getUTCFullYear();
  const month = previous.getUTCMonth() + 1;
  const key = monthKeyOf(year, month);

  const due = await prisma.payrollRecipient.findMany({
    where: { sendDay: { not: null, lte: day }, OR: [{ remindedMonth: null }, { remindedMonth: { not: key } }] },
    select: { id: true, name: true, barId: true, bar: { select: { ownerId: true, name: true } }, sends: { where: { month: key }, select: { id: true }, take: 1 } },
    take: 200,
  });

  let reminded = 0;
  for (const recipient of due) {
    await prisma.payrollRecipient.update({ where: { id: recipient.id }, data: { remindedMonth: key } });
    if (recipient.sends.length) continue;
    await notifyUsers([recipient.bar.ownerId], {
      barId: recipient.barId,
      title: `Presenze di ${monthName(month, year)} pronte`,
      message: `Controllale e mandale a ${recipient.name}: è un tasto.`,
      type: INTERNAL_NOTIFICATION_TYPES.PAYROLL_READY,
      actionUrl: `/dashboard/presenze?mese=${key}`,
    }).catch((error) => console.error("[payroll] reminder not sent", recipient.id, error instanceof Error ? error.message : error));
    reminded += 1;
  }
  return { reminded };
}
