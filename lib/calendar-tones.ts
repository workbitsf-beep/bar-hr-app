/**
 * I colori delle categorie del calendario, in un posto solo.
 *
 * Erano scritti due volte, uguali, uno per calendario: ogni volta che si
 * cambiava un colore o si aggiungeva una categoria bisognava ricordarsi
 * dell'altro file, e per un giorno intero li ho modificati a coppie.
 *
 * Sono la lingua visiva dell'app: un pallino colorato sta al posto del nome
 * di una categoria dove non c'e spazio per scriverlo, quindi il colore deve
 * voler dire la stessa cosa nel calendario del titolare e in quello del
 * dipendente. Averli in due copie voleva dire poterli far divergere.
 */

import { RequestType } from "@prisma/client";

export type WeekBadgeTone = "note" | "vacation" | "permission" | "course" | "availability" | "onCall" | "overtime" | "closure";

export type WeekBadge = {
  key: string;
  label: string;
  count: number;
  tone: WeekBadgeTone;
};

export const WEEK_BADGE_STYLES: Record<WeekBadgeTone, { background: string; border: string; color: string }> = {
  note: { background: "#f8fafc", border: "#e2e8f0", color: "#334155" },
  vacation: { background: "#ede9fe", border: "#ddd6fe", color: "#5b21b6" },
  permission: { background: "#fff7ed", border: "#fed7aa", color: "#9a3412" },
  course: { background: "#eef2ff", border: "#c7d2fe", color: "#3730a3" },
  availability: { background: "#fef2f2", border: "#fecaca", color: "#991b1b" },
  onCall: { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
  overtime: { background: "#fef3c7", border: "#fde68a", color: "#92400e" },
  closure: { background: "#f1f5f9", border: "#cbd5e1", color: "#475569" },
};

/** The dot that stands in for a category while the day is closed up. */
export const WEEK_TONE_DOTS: Record<WeekBadgeTone, string> = {
  note: "#f59e0b",
  vacation: "#10b981",
  permission: "#f97316",
  course: "#0ea5e9",
  availability: "#94a3b8",
  onCall: "#f6b73c",
  overtime: "#a855f7",
  closure: "#e0868f",
};

/** The same colour, dark enough to read as a word. */
export const WEEK_TONE_LABELS: Record<WeekBadgeTone, string> = {
  note: "#b45309",
  vacation: "#047857",
  permission: "#c2410c",
  course: "#0284c7",
  availability: "#64748b",
  onCall: "#a15c07",
  overtime: "#7e22ce",
  closure: "#a8424f",
};

export function getRequestBadge(type: string): { key: string; label: string; tone: WeekBadgeTone } {
  if (type === RequestType.OVERTIME) {
    return { key: "overtime", label: "Straordinari", tone: "overtime" };
  }

  if (type === RequestType.PERMISSION) {
    return { key: "permission", label: "Permessi", tone: "permission" };
  }

  if (type === RequestType.SICKNESS) {
    return { key: "sickness", label: "Malattia", tone: "availability" };
  }

  return { key: "vacation", label: "Ferie", tone: "vacation" };
}
