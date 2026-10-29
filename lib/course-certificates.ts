import "server-only";

import { CourseKind } from "@prisma/client";
import { getCourseKind } from "@/lib/course-kinds";
import { INTERNAL_NOTIFICATION_TYPES, notifyUsers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

/**
 * Who has which course, until when. A person's latest certificate of a kind
 * (of a title, for "other" courses) is the one that counts; an older one is
 * history. The owner and the person are reminded well before it runs out,
 * so there is time to book the course again.
 */

export type CertificateState = "expired" | "expiring" | "valid" | "lasting";

const DAY = 86_400_000;

export function certificateKey(certificate: { userId: string; kind: CourseKind; title: string }) {
  return `${certificate.userId}:${certificate.kind}:${certificate.kind === CourseKind.OTHER ? certificate.title.trim().toLowerCase() : ""}`;
}

export function certificateState(expiresAt: Date | null, leadDays: number, now = new Date()): CertificateState {
  if (!expiresAt) return "lasting";
  const left = expiresAt.getTime() + DAY - now.getTime();
  if (left <= 0) return "expired";
  if (left <= leadDays * DAY) return "expiring";
  return "valid";
}

export function daysLeft(expiresAt: Date, now = new Date()) {
  return Math.ceil((expiresAt.getTime() + DAY - now.getTime()) / DAY);
}

/** The day a certificate earned on `completedAt` stops being valid, by its kind. */
export function defaultExpiry(kind: CourseKind, completedAt: Date) {
  const months = getCourseKind(kind).validForMonths;
  if (!months) return null;
  const expiry = new Date(completedAt);
  expiry.setUTCMonth(expiry.getUTCMonth() + months);
  expiry.setUTCDate(expiry.getUTCDate() - 1);
  return expiry;
}

/** Only the certificates that count: each person's latest of each course. */
export function latestOnly<T extends { userId: string; kind: CourseKind; title: string; completedAt: Date }>(certificates: T[]) {
  const latest = new Map<string, T>();
  for (const certificate of certificates) {
    const key = certificateKey(certificate);
    const current = latest.get(key);
    if (!current || certificate.completedAt > current.completedAt) latest.set(key, certificate);
  }
  return Array.from(latest.values());
}

const dateText = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The night's pass: a notice when the first reminder window opens (the
 * venue's days, 60 by default), again a month and a week before, and on the
 * day it lapses. Each stage once; a certificate replaced by a newer one is
 * left alone.
 */
export async function runCourseReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + 181 * DAY);
  const candidates = await prisma.courseCertificate.findMany({
    where: { expiresAt: { not: null, lte: horizon }, reminderStage: { lt: 4 } },
    select: {
      id: true,
      barId: true,
      userId: true,
      kind: true,
      title: true,
      completedAt: true,
      expiresAt: true,
      reminderStage: true,
      user: { select: { firstName: true } },
      bar: { select: { ownerId: true, settings: { select: { courseReminderDays: true, coursesEnabled: true } } } },
    },
    take: 500,
  });
  if (!candidates.length) return { reminded: 0 };

  // A newer certificate of the same course makes the old one's reminders moot.
  const holders = Array.from(new Set(candidates.map((item) => item.userId)));
  const newer = await prisma.courseCertificate.findMany({
    where: { userId: { in: holders } },
    select: { userId: true, kind: true, title: true, completedAt: true },
  });
  const latestAt = new Map<string, number>();
  for (const item of newer) {
    const key = certificateKey(item);
    latestAt.set(key, Math.max(latestAt.get(key) ?? 0, item.completedAt.getTime()));
  }

  let reminded = 0;
  for (const certificate of candidates) {
    if (certificate.bar.settings?.coursesEnabled === false || !certificate.expiresAt) continue;
    if ((latestAt.get(certificateKey(certificate)) ?? 0) > certificate.completedAt.getTime()) {
      await prisma.courseCertificate.update({ where: { id: certificate.id }, data: { reminderStage: 4 } });
      continue;
    }
    const lead = certificate.bar.settings?.courseReminderDays ?? 60;
    const left = daysLeft(certificate.expiresAt, now);
    const stage = left <= 0 ? 4 : left <= 7 ? 3 : left <= 30 ? 2 : left <= lead ? 1 : 0;
    if (stage <= certificate.reminderStage) continue;

    await prisma.courseCertificate.update({ where: { id: certificate.id }, data: { reminderStage: stage } });
    const name = certificate.kind === CourseKind.OTHER ? certificate.title : getCourseKind(certificate.kind).label;
    const when = dateText.format(certificate.expiresAt);
    const recipients = Array.from(new Set([certificate.bar.ownerId, certificate.userId]));
    await notifyUsers(recipients, {
      barId: certificate.barId,
      title: stage === 4 ? `${name} scaduto: ${certificate.user.firstName}` : `${name} di ${certificate.user.firstName} scade il ${when}`,
      message:
        stage === 4
          ? "Va rifatto il corso: finché manca l'attestato non è in regola."
          : `Mancano ${left} giorni: prenota il corso per tempo.`,
      type: INTERNAL_NOTIFICATION_TYPES.COURSE_EXPIRING,
      actionUrl: "/dashboard/courses",
    }).catch((error) => console.error("[courses] reminder not sent", certificate.id, error instanceof Error ? error.message : error));
    reminded += 1;
  }
  return { reminded };
}
