import { RequestType } from "@prisma/client";
import { APP_TIME_ZONE } from "@/lib/time-zone";

/**
 * The words of the notifications, in one place. Short and read in a glance:
 * the title says what happened ("Ferie approvate", "Davide G. chiede un
 * permesso"), the message only the detail that matters (when, what).
 */

const day = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: APP_TIME_ZONE });
const dayOnly = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: APP_TIME_ZONE });
const dayNum = new Intl.DateTimeFormat("it-IT", { day: "numeric", timeZone: APP_TIME_ZONE });
const monthKey = new Intl.DateTimeFormat("it-IT", { month: "numeric", year: "numeric", timeZone: APP_TIME_ZONE });
const time = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE });
const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE });

const clean = (text: string) => text.replace(/\./g, "");

/** "gio 22 ott · 18:00–24:00" */
export function shiftWhen(start: Date, end: Date) {
  return `${clean(day.format(start))} · ${time.format(start)}–${time.format(end).replace("00:00", "24:00")}`;
}

/** "4–6 nov", "30 ott – 2 nov", "22 ott" */
export function daysRange(start: Date, end: Date) {
  if (dateKey.format(start) === dateKey.format(end)) return clean(dayOnly.format(start));
  if (monthKey.format(start) === monthKey.format(end)) return `${dayNum.format(start)}–${clean(dayOnly.format(end))}`;
  return `${clean(dayOnly.format(start))} – ${clean(dayOnly.format(end))}`;
}

/** Holidays and sickness are whole days; a permission or overtime has its hours. */
export function requestWhen(type: RequestType, start: Date | null, end: Date | null) {
  if (!start || !end) return "";
  return type === RequestType.PERMISSION || type === RequestType.OVERTIME ? shiftWhen(start, end) : daysRange(start, end);
}

/** "Davide G. chiede le ferie" */
export function requestCreatedTitle(name: string, type: RequestType) {
  switch (type) {
    case RequestType.PERMISSION: return `${name} chiede un permesso`;
    case RequestType.SICKNESS: return `${name} è in malattia`;
    case RequestType.OVERTIME: return `${name} segna uno straordinario`;
    default: return `${name} chiede le ferie`;
  }
}

/** "Ferie approvate", "Permesso rifiutato": the agreement follows the noun. */
export function requestReviewedTitle(type: RequestType, approved: boolean) {
  switch (type) {
    case RequestType.PERMISSION: return approved ? "Permesso approvato" : "Permesso rifiutato";
    case RequestType.SICKNESS: return approved ? "Malattia approvata" : "Malattia rifiutata";
    case RequestType.OVERTIME: return approved ? "Straordinario approvato" : "Straordinario rifiutato";
    default: return approved ? "Ferie approvate" : "Ferie rifiutate";
  }
}
