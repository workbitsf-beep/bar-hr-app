import { CourseKind } from "@prisma/client";

/**
 * The courses a venue is actually obliged to keep track of.
 *
 * Each one is a deadline as much as an event: HACCP lasts three years, fire
 * safety five. The kind carries how long it lasts, so nobody has to remember,
 * and the expiry date fills itself in.
 */
export type CourseKindDefinition = {
  id: CourseKind;
  emoji: string;
  label: string;
  /** How long the certificate stays valid, in months. */
  validForMonths: number | null;
};

export const COURSE_KINDS: CourseKindDefinition[] = [
  { id: CourseKind.HACCP, emoji: "🧼", label: "HACCP", validForMonths: 36 },
  { id: CourseKind.FIRE_SAFETY, emoji: "🔥", label: "Antincendio", validForMonths: 60 },
  { id: CourseKind.FIRST_AID, emoji: "🚑", label: "Primo soccorso", validForMonths: 36 },
  { id: CourseKind.OTHER, emoji: "📚", label: "Altro corso", validForMonths: null },
];

export function getCourseKind(id: CourseKind | string): CourseKindDefinition {
  return (
    COURSE_KINDS.find((kind) => kind.id === id) ?? COURSE_KINDS[COURSE_KINDS.length - 1]
  );
}

export function describeCourseValidity(kind: CourseKindDefinition): string {
  if (!kind.validForMonths) {
    return "Decidi tu durata e scadenza";
  }

  const years = kind.validForMonths / 12;

  return `Vale ${years === 1 ? "1 anno" : `${years} anni`} · con attestato`;
}

/** The expiry a certificate earned on this day would carry. */
export function expiryFromStart(start: Date, kind: CourseKindDefinition): Date | null {
  if (!kind.validForMonths) {
    return null;
  }

  const expiry = new Date(start);
  expiry.setMonth(expiry.getMonth() + kind.validForMonths);

  return expiry;
}

export type CourseUrgency = "expired" | "expiring" | "upcoming" | "valid" | "past";

/** Courses are read by how much trouble they are, so that is what sorts them. */
export function getCourseUrgency(
  course: { startsAt: Date | string; endsAt: Date | string; expiresAt: Date | string | null },
  now: Date = new Date()
): CourseUrgency {
  const nowMs = now.getTime();
  const endsAt = new Date(course.endsAt).getTime();
  const expiresAt = course.expiresAt ? new Date(course.expiresAt).getTime() : null;

  if (endsAt >= nowMs) {
    return "upcoming";
  }

  if (expiresAt === null) {
    return "past";
  }

  if (expiresAt < nowMs) {
    return "expired";
  }

  // Ninety days is enough notice to book a course and send someone on it.
  if (expiresAt - nowMs <= 90 * 86_400_000) {
    return "expiring";
  }

  return "valid";
}
