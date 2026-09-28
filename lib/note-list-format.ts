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

export type NoteMetaPart = { text: string; alarming: boolean };

export type NoteMeta = {
  parts: NoteMetaPart[];
  late: boolean;
  /** The strip of colour on the left edge, or nothing when there is no news. */
  accent: string | null;
};

/**
 * The one place that decides what a note's line says.
 *
 * The Note page and the calendar's day popup both show notes, and they used to
 * describe the same note differently - one said "Assegnata a tutto il team",
 * the other said nothing, and neither mentioned that it repeats. They ask here
 * now, so a note reads the same wherever it is met.
 */
export function buildNoteMeta(input: {
  dueDate: Date | string;
  done: boolean;
  urgent: boolean;
  requiresConfirmation: boolean;
  repeatLabel: string | null;
  /** The person it belongs to, or null when it is everyone's. */
  assignedLabel: string | null;
  /** Who wrote it, or null when that is you. */
  authorLabel: string | null;
  completedBy: { name: string; at: Date | string } | null;
  now?: Date;
}): NoteMeta {
  const now = input.now ?? new Date();
  const late = !input.done && isOverdue(input.dueDate, now);

  const parts: (NoteMetaPart | null)[] = [
    input.done && input.completedBy
      ? {
          text: `fatta da ${input.completedBy.name} · ${relativeDayLabel(input.completedBy.at, now)}`,
          alarming: false,
        }
      : { text: relativeDayLabel(input.dueDate, now), alarming: false },
    late ? { text: "in ritardo", alarming: true } : null,
    !input.done && input.urgent ? { text: "urgente", alarming: true } : null,
    input.assignedLabel ? { text: input.assignedLabel, alarming: false } : null,
    input.authorLabel ? { text: `da ${input.authorLabel}`, alarming: false } : null,
    input.repeatLabel ? { text: input.repeatLabel, alarming: false } : null,
    !input.requiresConfirmation && !input.done
      ? { text: "solo da leggere", alarming: false }
      : null,
  ];

  return {
    parts: parts.filter((part): part is NoteMetaPart => part !== null),
    late,
    accent: late ? "#ef4444" : input.repeatLabel ? "#7c3aed" : null,
  };
}
