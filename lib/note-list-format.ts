import { APP_TIME_ZONE, toDateInputValueInTimeZone } from "@/lib/time-zone";

/**
 * What a note's line still has to say once the obvious is taken out.
 *
 * The old card repeated "Data", the year, "Tutto il team" and "creata da
 * <you>" on every note in the list. None of that was news. What is left here
 * is only what differs from the ordinary: a day said the way people say it, a
 * name when it is not everyone, an author when it is not you.
 */

export function relativeDayLabel(value: Date | string, now: Date = new Date()): string {
  const day = toDateInputValueInTimeZone(value);
  const today = toDateInputValueInTimeZone(now);

  if (day === today) {
    return "oggi";
  }

  if (day === shiftDayKey(now, 1)) {
    return "domani";
  }

  if (day === shiftDayKey(now, -1)) {
    return "ieri";
  }

  const date = new Date(value);
  const sameYear = date.getFullYear() === now.getFullYear();

  return new Intl.DateTimeFormat("it-IT", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  })
    .format(date)
    .replace(/\.$/, "");
}

function shiftDayKey(now: Date, days: number): string {
  const shifted = new Date(now);
  shifted.setDate(shifted.getDate() + days);

  return toDateInputValueInTimeZone(shifted);
}

export function isOverdue(dueDate: Date | string, now: Date = new Date()): boolean {
  return toDateInputValueInTimeZone(dueDate) < toDateInputValueInTimeZone(now);
}
