import "server-only";

import { reviewersOf } from "@/lib/clock-fixes";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { toTimeInputValueInTimeZone } from "@/lib/time-zone";

/** "Davide G.": short enough for a push title, still tells two Marcos apart. */
export function shortName(user: { firstName: string; lastName: string }) {
  const initial = user.lastName.trim().charAt(0);
  return initial ? `${user.firstName.trim()} ${initial.toUpperCase()}.` : user.firstName.trim();
}

function hoursLabel(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
}

/**
 * Who clocked in or out, told to the owner and to whoever holds "Timbrature"
 * over that person: "Davide G. ha timbrato l'entrata", "Alle 07:58". Never
 * throws and never holds up the clock-in itself.
 */
export function notifyClocked(input: {
  barId: string;
  userId: string;
  kind: "in" | "out";
  at: Date;
  offline?: boolean;
  workedMs?: number;
}) {
  void (async () => {
    const [user, reviewers] = await Promise.all([
      prisma.user.findUnique({ where: { id: input.userId }, select: { firstName: true, lastName: true } }),
      reviewersOf(input.barId, input.userId),
    ]);
    if (!user || reviewers.length === 0) return;
    const parts = [`Alle ${toTimeInputValueInTimeZone(input.at)}`];
    if (input.kind === "out" && input.workedMs) parts.push(hoursLabel(input.workedMs));
    if (input.offline) parts.push("senza rete");
    await notifyUsers(reviewers, {
      barId: input.barId,
      title: `${shortName(user)} ha timbrato ${input.kind === "in" ? "l'entrata" : "l'uscita"}`,
      message: parts.join(" · "),
      type: input.kind === "in" ? INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCKED_IN : INTERNAL_NOTIFICATION_TYPES.TIMELOG_CLOCKED_OUT,
      actionUrl: "/dashboard",
    });
  })().catch((error) => {
    console.error("[clock-notifications] not sent", error instanceof Error ? error.message : error);
  });
}
