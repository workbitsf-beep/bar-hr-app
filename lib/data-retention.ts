import "server-only";

import { getCompanyProfile } from "@/lib/company-profile";
import { prisma } from "@/lib/prisma";
import { CONFIRMED_NOTE_ARCHIVE_MONTHS } from "@/lib/note-visibility";

// Not personal records: delivery history and short-lived links.
const NOTIFICATION_RETENTION_DAYS = 90;

/**
 * Throwing away what there is no longer a reason to keep.
 *
 * The periods are declared in the legal documents and were kept nowhere else,
 * so the promise made to the reader had nothing enforcing it. Here it is
 * enforced.
 *
 * Two of these are not deletions but reductions, which is the point: a clock-in
 * older than the coordinate period keeps its date and time — the employer must
 * keep it — and loses the coordinates, which were only ever there to check the
 * person was on site. Same for the medical certificate code, which goes while
 * the absence itself stays.
 */
const RETENTION_RULES = [
  { key: "coordinates", months: 12 },
  { key: "certificateCode", months: 1 },
  { key: "accessLogs", months: 12 },
  { key: "timeLogs", months: 60 },
  { key: "requests", months: 60 },
] as const;

function monthsAgo(months: number) {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

/**
 * Reads a period out of a sentence such as "per 12 mesi dalla timbratura".
 *
 * The periods live in the documents as prose because that is how a lawyer
 * writes them; the number is taken from there so the text and the deletion can
 * never say different things. When no number can be read, the rule is skipped
 * rather than guessed — deleting on a guess is worse than not deleting.
 */
export function readMonths(sentence: string): number | null {
  const years = sentence.match(/(\d+)\s*ann/i);

  if (years) {
    return Number(years[1]) * 12;
  }

  const months = sentence.match(/(\d+)\s*mes/i);

  if (months) {
    return Number(months[1]);
  }

  const days = sentence.match(/(\d+)\s*giorn/i);

  if (days) {
    return Math.max(1, Math.round(Number(days[1]) / 30));
  }

  return null;
}

export async function runDataRetention() {
  const profile = await getCompanyProfile();

  const periods = {
    coordinates: readMonths(profile.retentionPosition),
    certificateCode: readMonths(profile.retentionCertificate),
    accessLogs: readMonths(profile.retentionAccessLogs),
    timeLogs: readMonths(profile.retentionTimelogs),
    requests: readMonths(profile.retentionRequests),
  };

  const result: Record<string, number | "non impostato"> = {};

  // Coordinates go, the clock-in stays: the hours are the record, the position
  // was only the check that it happened on site.
  if (periods.coordinates) {
    const cleared = await prisma.timeLog.updateMany({
      where: {
        timestamp: { lt: monthsAgo(periods.coordinates) },
        OR: [{ latitude: { not: null } }, { longitude: { not: null } }],
      },
      data: { latitude: null, longitude: null },
    });

    result.coordinatesCleared = cleared.count;
  } else {
    result.coordinatesCleared = "non impostato";
  }

  // Health data has the shortest life of anything here.
  if (periods.certificateCode) {
    const cleared = await prisma.request.updateMany({
      where: {
        certificateCode: { not: null },
        OR: [
          { endsAt: { lt: monthsAgo(periods.certificateCode) } },
          { endsAt: null, createdAt: { lt: monthsAgo(periods.certificateCode) } },
        ],
      },
      data: { certificateCode: null },
    });

    result.certificateCodesCleared = cleared.count;
  } else {
    result.certificateCodesCleared = "non impostato";
  }

  if (periods.accessLogs) {
    const removed = await prisma.session.deleteMany({
      where: { expiresAt: { lt: monthsAgo(periods.accessLogs) } },
    });

    result.sessionsDeleted = removed.count;
  } else {
    result.sessionsDeleted = "non impostato";
  }

  if (periods.requests) {
    const removed = await prisma.request.deleteMany({
      where: {
        status: { not: "PENDING" },
        createdAt: { lt: monthsAgo(periods.requests) },
      },
    });

    result.requestsDeleted = removed.count;
  } else {
    result.requestsDeleted = "non impostato";
  }

  // Planned shifts live as long as the clock-ins they explain: the planned
  // hours and the on-call mark are what an overtime question is settled on.
  // They used to go after sixty days, taking the on-call count of every older
  // report with them.
  if (periods.timeLogs) {
    const removed = await prisma.shift.deleteMany({
      where: { endTime: { lt: monthsAgo(periods.timeLogs) } },
    });
    result.shiftsDeleted = removed.count;
  } else {
    result.shiftsDeleted = "non impostato";
  }

  // The archive of confirmation notes: proof of who read what, for a year.
  const notesRemoved = await prisma.note.deleteMany({
    where: {
      requiresConfirmation: true,
      createdAt: { lt: monthsAgo(CONFIRMED_NOTE_ARCHIVE_MONTHS) },
    },
  });
  result.confirmationNotesDeleted = notesRemoved.count;

  const tasksRemoved = await prisma.task.deleteMany({
    where: {
      requiresConfirmation: true,
      status: "DONE",
      completedAt: { lt: monthsAgo(CONFIRMED_NOTE_ARCHIVE_MONTHS) },
    },
  });
  result.confirmedTasksDeleted = tasksRemoved.count;

  const notificationsRemoved = await prisma.notification.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 86_400_000) } },
  });
  result.notificationsDeleted = notificationsRemoved.count;

  const [ticketsRemoved, tokensRemoved] = await Promise.all([
    prisma.downloadTicket.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.documentAccessToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  ]);
  result.expiredLinksDeleted = ticketsRemoved.count + tokensRemoved.count;

  // Last, and only once the period the employer is held to has run out.
  if (periods.timeLogs) {
    const removed = await prisma.timeLog.deleteMany({
      where: { timestamp: { lt: monthsAgo(periods.timeLogs) } },
    });

    result.timeLogsDeleted = removed.count;
  } else {
    result.timeLogsDeleted = "non impostato";
  }

  return result;
}

/** What the retention job would use, for the console to show. */
export function describeRetentionPeriods(profile: {
  retentionPosition: string;
  retentionCertificate: string;
  retentionAccessLogs: string;
  retentionTimelogs: string;
  retentionRequests: string;
}) {
  return RETENTION_RULES.map((rule) => {
    const sentence =
      rule.key === "coordinates"
        ? profile.retentionPosition
        : rule.key === "certificateCode"
          ? profile.retentionCertificate
          : rule.key === "accessLogs"
            ? profile.retentionAccessLogs
            : rule.key === "timeLogs"
              ? profile.retentionTimelogs
              : profile.retentionRequests;

    return { key: rule.key, months: readMonths(sentence), sentence };
  });
}
