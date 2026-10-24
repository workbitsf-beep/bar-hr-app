/**
 * What a stamp asked for from outside the page does: "Entra" / "Esci" or a
 * tap on a shift reminder, "Timbra" on the app icon, ESCI on the Live
 * Activity (app/dashboard/native-widgets-sync.tsx, timelogs-client.tsx).
 *
 * Kept free of the browser so the rules can be tested on their own.
 */

/** "in" or "out" from a shift reminder; "any" from the icon or the Live Activity. */
export type ClockDirection = "in" | "out" | "any";

/** An exit asked for more than this before the shift ends asks first. */
export const EARLY_EXIT_ASK_MS = 15 * 60 * 1000;

/** The reminders that stamp when opened, and which way. Other notices just open their page. */
export function clockDirectionOf(type: string, actionId?: string): ClockDirection | null {
  if (type.startsWith("timelog.clock-in.")) return "in";
  if (type.startsWith("timelog.clock-out.")) return "out";
  return actionId === "timbra" ? "any" : null;
}

export type OutsideStamp =
  | { kind: "stamp"; endpoint: "clock-in" | "clock-out" }
  | { kind: "confirm"; endpoint: "clock-out"; endsAt: Date }
  | { kind: "refuse"; message: string };

/**
 * A reminder to enter, tapped once already in, must not stamp the exit (and
 * the other way round); an exit well before the end of the shift asks first.
 */
export function decideOutsideStamp(input: {
  direction: ClockDirection;
  isIn: boolean;
  shiftEndAt: string | null;
  now: Date;
}): OutsideStamp {
  const { direction, isIn, shiftEndAt, now } = input;
  if (direction === "in" && isIn) return { kind: "refuse", message: "Hai già timbrato l'entrata." };
  if (direction === "out" && !isIn) return { kind: "refuse", message: "Non risulti entrato: timbra prima l'entrata." };
  if (!isIn) return { kind: "stamp", endpoint: "clock-in" };
  if (shiftEndAt) {
    const endsAt = new Date(shiftEndAt);
    if (endsAt.getTime() - now.getTime() > EARLY_EXIT_ASK_MS) return { kind: "confirm", endpoint: "clock-out", endsAt };
  }
  return { kind: "stamp", endpoint: "clock-out" };
}
