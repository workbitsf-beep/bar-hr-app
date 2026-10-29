import type { TaskRepeatDraft } from "./task-repeat-field";

/**
 * What kind of note it is, instead of which fields to fill.
 *
 * A venue writes five kinds of note and no more: a check that comes back, a
 * job for right now, a job for a set day, something everyone needs to read,
 * and the odd one out. Those
 * exist in the venue; "requires confirmation" does not. Picking the kind sets
 * the flags, and each kind then asks only for what it genuinely needs.
 */
export type NoteKindId = "check" | "today" | "day" | "notice" | "free";

export type NoteKindAsk = "audience" | "date" | "repeat" | "urgent" | "confirmation";

export type NoteKind = {
  id: NoteKindId;
  emoji: string;
  label: string;
  hint: string;
  /** What the note looks like before anything else is touched. */
  defaults: {
    isUrgent: boolean;
    requiresConfirmation: boolean;
    repeat: TaskRepeatDraft;
  };
  /** Pins the date to today rather than asking for one. */
  dueToday: boolean;
  asks: NoteKindAsk[];
  /** The wording on the button that saves it. */
  saveLabel: string;
};

export const NOTE_KINDS: NoteKind[] = [
  {
    id: "today",
    emoji: "⚡",
    // Not "da fare oggi": the same kind is picked from the calendar, where the
    // day has already been tapped and may not be today.
    label: "Da fare subito",
    hint: "Urgente · in cima alla lista",
    defaults: {
      isUrgent: true,
      requiresConfirmation: true,
      repeat: null,
    },
    dueToday: true,
    asks: ["audience"],
    saveLabel: "Salva nota",
  },
  {
    id: "day",
    emoji: "📅",
    // "Mercoledì arriva il fornitore", "sabato si pulisce la macchina del caffè".
    label: "Per un giorno",
    hint: "Il giorno che scegli · da fare",
    defaults: {
      isUrgent: false,
      requiresConfirmation: true,
      repeat: null,
    },
    dueToday: false,
    asks: ["date", "audience"],
    saveLabel: "Salva nota",
  },
  {
    id: "check",
    emoji: "🔁",
    label: "Controllo periodico",
    hint: "Torna da sola · da confermare",
    defaults: {
      isUrgent: false,
      requiresConfirmation: true,
      repeat: { every: 1, unit: "MONTH" },
    },
    dueToday: false,
    asks: ["repeat", "date", "audience"],
    saveLabel: "Salva controllo",
  },
  {
    id: "notice",
    emoji: "📣",
    label: "Comunicazione",
    hint: "Per tutti · solo da leggere",
    defaults: {
      isUrgent: false,
      requiresConfirmation: false,
      repeat: null,
    },
    dueToday: false,
    asks: ["audience", "date"],
    saveLabel: "Salva comunicazione",
  },
  {
    id: "free",
    emoji: "✏️",
    label: "Libera",
    hint: "Decidi tu ogni cosa",
    defaults: {
      isUrgent: false,
      requiresConfirmation: true,
      repeat: null,
    },
    dueToday: false,
    asks: ["audience", "date", "repeat", "urgent", "confirmation"],
    saveLabel: "Salva nota",
  },
];

export function getNoteKind(id: NoteKindId): NoteKind {
  return NOTE_KINDS.find((kind) => kind.id === id) ?? NOTE_KINDS[NOTE_KINDS.length - 1];
}

/** The date box wants yyyy-mm-dd read off the phone's own calendar, not UTC. */
export function todayDateInputValue(offsetDays = 0): string {
  const now = new Date();
  now.setDate(now.getDate() + offsetDays);

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}
