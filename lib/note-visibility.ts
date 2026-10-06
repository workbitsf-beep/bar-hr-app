import type { Prisma } from "@prisma/client";

/**
 * Which notes the board shows.
 *
 * The board is the day's messages: a note is on it for 24 hours, or until the
 * day after the calendar day it was written for. Ordinary notes are then
 * deleted (lib/shiftCleanup.ts). A note that asked for confirmation is not:
 * who confirmed reading it, and when, is the proof that a procedure or a
 * change was communicated, so it leaves the board but stays in the archive
 * for twelve months (lib/data-retention.ts).
 */
export const NOTE_BOARD_HOURS = 24;
export const CONFIRMED_NOTE_ARCHIVE_MONTHS = 12;

export function noteBoardCutoff(now = new Date()) {
  return new Date(now.getTime() - NOTE_BOARD_HOURS * 60 * 60 * 1000);
}

/**
 * Tasks on the Note page work the same way: one that asked for confirmation
 * and was confirmed leaves the page a day later, and is kept with who
 * confirmed it and when.
 */
export function confirmedTaskArchived(now = new Date()): Prisma.TaskWhereInput {
  return {
    requiresConfirmation: true,
    status: "DONE",
    completedAt: { lt: noteBoardCutoff(now) },
  };
}

/** Notes still on the board; archived confirmation notes are left out. */
export function visibleOnBoard(now = new Date()): Prisma.NoteWhereInput {
  const cutoff = noteBoardCutoff(now);

  return {
    OR: [
      { requiresConfirmation: false },
      { createdAt: { gte: cutoff } },
      { activityDate: { gte: cutoff } },
    ],
  };
}

/** Confirmation notes that have left the board and are kept as proof. */
export function inConfirmationArchive(now = new Date()): Prisma.NoteWhereInput {
  const cutoff = noteBoardCutoff(now);

  return {
    requiresConfirmation: true,
    createdAt: { lt: cutoff },
    OR: [{ activityDate: null }, { activityDate: { lt: cutoff } }],
  };
}
