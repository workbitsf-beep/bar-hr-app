import "server-only";

import { ClockFixKind, ClockFixStatus, ClockType, Role } from "@prisma/client";
import { isStaleEntry } from "@/lib/clock-fixes";
import { notifyClocked } from "@/lib/clock-notifications";
import { clockPlaceFor } from "@/lib/clock-points";
import { findAssignedShiftForClockIn } from "@/lib/clockable-shift";
import { prisma } from "@/lib/prisma";
import { invalidateReportingCache } from "@/lib/reporting";
import { closeClockInReminders, closeClockOutReminders } from "@/lib/timelog-reminders";
import { TerminalError } from "./terminal";

/**
 * One button on the terminal: the PIN says who, and whether it is an entry or
 * an exit follows from what is open - the same rules as the phone's clock-in
 * and clock-out (app/api/timelogs), without the position check, because the
 * terminal stands in the venue. For the forgotten phone, the dead battery,
 * the phone with no signal.
 */
export async function clockOnTerminal(input: { barId: string; userId: string; role: Role }) {
  if (input.role === Role.OWNER) throw new TerminalError("Il titolare non timbra.");
  const { barId, userId } = input;
  const now = new Date();

  const lastIn = await prisma.timeLog.findFirst({
    where: { userId, barId, type: ClockType.IN },
    orderBy: { timestamp: "desc" },
    select: { id: true, timestamp: true, shiftId: true },
  });
  const outAfter = lastIn
    ? await prisma.timeLog.findFirst({
        where: { userId, barId, type: ClockType.OUT, timestamp: { gte: lastIn.timestamp } },
        select: { id: true, autoClockOut: true },
      })
    : null;

  // An entry with no real exit is closed now - unless its exit was already
  // declared as forgotten and waits for the owner.
  if (lastIn && (!outAfter || outAfter.autoClockOut)) {
    const awaiting = outAfter
      ? 0
      : await prisma.clockFix.count({ where: { clockInId: lastIn.id, kind: ClockFixKind.MISSED_OUT, status: ClockFixStatus.PENDING } });
    if (!awaiting) {
      const shift = lastIn.shiftId ? await prisma.shift.findUnique({ where: { id: lastIn.shiftId }, select: { endTime: true } }) : null;
      if (isStaleEntry({ timestamp: lastIn.timestamp, shift })) {
        throw new TerminalError("L'uscita del turno precedente non è stata timbrata: segnalala dall'app nella pagina Oggi, o chiedi al titolare.");
      }
      return clockOut({ barId, userId, start: lastIn.timestamp, shiftId: lastIn.shiftId, replace: outAfter?.autoClockOut ? outAfter.id : null, now });
    }
  }

  // An entry declared as forgotten, still without its exit: this is the exit.
  const declared = await prisma.clockFix.findFirst({
    where: {
      userId,
      barId,
      kind: ClockFixKind.MISSED_IN,
      status: ClockFixStatus.PENDING,
      requestedOutAt: null,
      ...(lastIn ? { requestedInAt: { gt: lastIn.timestamp } } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { requestedInAt: true, shiftId: true },
  });
  if (declared?.requestedInAt) {
    const closed = await prisma.timeLog.count({ where: { userId, barId, type: ClockType.OUT, timestamp: { gt: declared.requestedInAt } } });
    if (!closed) return clockOut({ barId, userId, start: declared.requestedInAt, shiftId: declared.shiftId, replace: null, now });
  }

  const shift = await findAssignedShiftForClockIn({ barId, userId, now });
  const place = await clockPlaceFor({ barId, userId, shiftDepartment: shift?.department ?? null });
  if (!shift && !place.shiftOptional) throw new TerminalError("Non hai un turno programmato per oggi.");

  await prisma.timeLog.create({
    data: {
      type: ClockType.IN,
      userId,
      barId,
      shiftId: shift?.id ?? null,
      timestamp: now,
      viaTerminal: true,
      note: shift ? `Turno previsto fino alle ${shift.endTime.toISOString()}` : null,
    },
  });
  invalidateReportingCache(barId, userId);
  await closeClockInReminders({ userId, barId, shiftId: shift?.id ?? null });
  notifyClocked({ barId, userId, kind: "in", at: now });
  return { kind: "in" as const, at: now };
}

async function clockOut(input: { barId: string; userId: string; start: Date; shiftId: string | null; replace: string | null; now: Date }) {
  const { barId, userId, now } = input;
  if (now <= input.start) throw new TerminalError("Hai appena timbrato l'entrata.");
  await prisma.$transaction([
    ...(input.replace ? [prisma.timeLog.delete({ where: { id: input.replace } })] : []),
    prisma.timeLog.create({
      data: { type: ClockType.OUT, userId, barId, shiftId: input.shiftId, timestamp: now, viaTerminal: true },
    }),
  ]);
  invalidateReportingCache(barId, userId);
  await closeClockOutReminders({ userId, barId, shiftId: input.shiftId });
  const workedMs = now.getTime() - input.start.getTime();
  notifyClocked({ barId, userId, kind: "out", at: now, workedMs });
  return { kind: "out" as const, at: now, workedMs };
}
