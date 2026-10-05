import { ClockType } from "@prisma/client";

// A session belongs to the day it started on. A bar closes after midnight, so
// the exit of the last shift of a period often falls just past its end: the
// logs are read a day further, and cut at the first entry of the next period.
// Reading only up to the end left the 31st's evening shift with an entry and
// no exit, and it counted in neither month.
const SESSION_LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

export function withSessionLookahead(periodEnd: Date): Date {
  return new Date(periodEnd.getTime() + SESSION_LOOKAHEAD_MS);
}

export function sessionsStartingBefore<T extends { type: ClockType; timestamp: Date }>(
  logs: T[],
  periodEnd: Date
): T[] {
  const cut = logs.findIndex(
    (log) => log.type === ClockType.IN && log.timestamp >= periodEnd
  );

  return cut === -1 ? logs : logs.slice(0, cut);
}
