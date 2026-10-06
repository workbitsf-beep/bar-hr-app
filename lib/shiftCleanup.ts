import { ActivityType, Prisma, RequestType, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const RESTAURANT_CALENDAR_RETENTION_DAYS = 60;
export const COMPANY_CALENDAR_RETENTION_DAYS = 400;
export const AVAILABILITY_RETENTION_HOURS = 24;
export const TASK_REMINDER_RETENTION_HOURS = 24;
export const COMPLETED_TASK_RETENTION_HOURS = 24;
export const NOTE_RETENTION_HOURS = 24;
const SHIFT_RETENTION_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

let lastRetentionCleanupAt = 0;
let retentionCleanupPromise:
  | Promise<{
      restaurantCutoff: Date;
      companyCutoff: Date;
      deletedShiftCount: number;
      deletedRequestCount: number;
      detachedTimeLogCount: number;
      deletedAvailabilityCount: number;
      deletedCourseCount: number;
      deletedClosureCount: number;
      deletedTaskCount: number;
      deletedNoteCount: number;
    }>
  | null = null;

function getRetentionCutoff(days: number, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

function getAvailabilityRetentionCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setHours(cutoff.getHours() - AVAILABILITY_RETENTION_HOURS);
  return cutoff;
}

function getHoursRetentionCutoff(hours: number, now = new Date()) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function getExpiredTaskFilters(
  expiredByBarActivity: Array<{
    bar: { activityType: ActivityType };
    cutoff: Date;
  }>,
  reminderCutoff: Date,
  completedCutoff: Date
): Prisma.TaskWhereInput[] {
  // A confirmed task is proof of who confirmed it: it goes to the archive
  // (lib/note-visibility.ts) and data-retention.ts removes it after a year.
  const notConfirmedProof: Prisma.TaskWhereInput = {
    NOT: { requiresConfirmation: true, status: TaskStatus.DONE },
  };

  return [
    ...expiredByBarActivity.map((entry) => ({
      bar: entry.bar,
      dueDate: { lt: entry.cutoff },
      ...notConfirmedProof,
    })),
    {
      status: TaskStatus.TODO,
      requiresConfirmation: false,
      dueDate: { lte: reminderCutoff },
    },
    {
      status: TaskStatus.DONE,
      completedAt: { lte: completedCutoff },
      requiresConfirmation: false,
    },
  ];
}

export function getCalendarRetentionCutoffs(now = new Date()) {
  return {
    restaurantCutoff: getRetentionCutoff(RESTAURANT_CALENDAR_RETENTION_DAYS, now),
    companyCutoff: getRetentionCutoff(COMPANY_CALENDAR_RETENTION_DAYS, now),
  };
}

export function getShiftRetentionCutoff(now = new Date()) {
  return getRetentionCutoff(RESTAURANT_CALENDAR_RETENTION_DAYS, now);
}

export async function deleteShiftWithCleanup(
  shiftId: string,
  options?: {
    barId?: string;
  }
) {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      ...(options?.barId ? { barId: options.barId } : {}),
    },
    select: {
      id: true,
    },
  });

  if (!shift) {
    return {
      deleted: false,
      deletedShiftCount: 0,
      deletedRequestCount: 0,
      detachedTimeLogCount: 0,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedRequests = await tx.request.deleteMany({
      where: {
        shiftId: shift.id,
        type: RequestType.SHIFT_CHANGE,
      },
    });

    const detachedTimeLogs = await tx.timeLog.updateMany({
      where: {
        shiftId: shift.id,
      },
      data: {
        shiftId: null,
      },
    });

    const deletedShift = await tx.shift.deleteMany({
      where: {
        id: shift.id,
      },
    });

    return {
      deletedShiftCount: deletedShift.count,
      deletedRequestCount: deletedRequests.count,
      detachedTimeLogCount: detachedTimeLogs.count,
    };
  });

  return {
    deleted: result.deletedShiftCount > 0,
    ...result,
  };
}

/**
 * Clears what only matters for a day or a season: availabilities, closures,
 * expired courses, done or lapsed tasks, the board's day-old notes.
 *
 * Nothing here has archive value. Shifts, requests and confirmation notes are
 * records, and are kept and finally deleted by lib/data-retention.ts, on the
 * periods the legal documents state - one rule per record, in one place. Two
 * jobs deleting the same things on different clocks is how holidays and
 * courses were lost on 6 October 2026.
 */
export async function runShiftRetentionCleanup(now = new Date()) {
  const { restaurantCutoff, companyCutoff } = getCalendarRetentionCutoffs(now);
  const reminderCutoff = getHoursRetentionCutoff(TASK_REMINDER_RETENTION_HOURS, now);
  const completedTaskCutoff = getHoursRetentionCutoff(COMPLETED_TASK_RETENTION_HOURS, now);
  const noteCutoff = getHoursRetentionCutoff(NOTE_RETENTION_HOURS, now);
  const expiredByBarActivity = [
    {
      bar: { activityType: ActivityType.RESTAURANT },
      cutoff: restaurantCutoff,
    },
    {
      bar: { activityType: ActivityType.COMPANY },
      cutoff: companyCutoff,
    },
  ];
  const result = await deleteExpiredCalendarItems(
    expiredByBarActivity,
    getAvailabilityRetentionCutoff(now),
    reminderCutoff,
    completedTaskCutoff,
    noteCutoff
  );

  return {
    restaurantCutoff,
    companyCutoff,
    deletedShiftCount: 0,
    deletedRequestCount: 0,
    detachedTimeLogCount: 0,
    ...result,
  };
}

async function deleteExpiredCalendarItems(
  expiredByBarActivity: Array<{
    bar: { activityType: ActivityType };
    cutoff: Date;
  }>,
  availabilityCutoff = getAvailabilityRetentionCutoff(),
  reminderCutoff = getHoursRetentionCutoff(TASK_REMINDER_RETENTION_HOURS),
  completedTaskCutoff = getHoursRetentionCutoff(COMPLETED_TASK_RETENTION_HOURS),
  noteCutoff = getHoursRetentionCutoff(NOTE_RETENTION_HOURS)
) {
  return prisma.$transaction(async (tx) => {
    const deletedAvailabilities = await tx.availability.deleteMany({
      where: {
        // Kept as long as the rest of the calendar, because the month's report
        // counts them. Deleted a day after they ended, the report's
        // "Indisponibilita" read zero for everyone.
        endsAt: { lt: availabilityCutoff },
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          endsAt: { lt: entry.cutoff },
        })),
      },
    });

    const deletedCourses = await tx.course.deleteMany({
      where: {
        // A course is kept while what it certifies is still valid: HACCP lasts
        // years, and deleting it sixty days after the lesson made the person
        // look up to date when the expiry could no longer be tracked.
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          endsAt: { lt: entry.cutoff },
          OR: [{ expiresAt: null }, { expiresAt: { lt: entry.cutoff } }],
        })),
      },
    });

    const deletedClosures = await tx.calendarClosure.deleteMany({
      where: {
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          endsAt: { lt: entry.cutoff },
        })),
      },
    });

    const deletedTasks = await tx.task.deleteMany({
      where: {
        OR: getExpiredTaskFilters(
          expiredByBarActivity,
          reminderCutoff,
          completedTaskCutoff
        ),
      },
    });

    const deletedNotes = await tx.note.deleteMany({
      where: {
        createdAt: { lt: noteCutoff },
        // A note written for a day of the calendar waits for that day: it was
        // deleted a day after being written, often before the day came.
        OR: [{ activityDate: null }, { activityDate: { lt: noteCutoff } }],
        // A note that asked for confirmation is proof of who read it: it
        // leaves the board but is kept (lib/note-visibility.ts).
        requiresConfirmation: false,
      },
    });

    return {
      deletedAvailabilityCount: deletedAvailabilities.count,
      deletedCourseCount: deletedCourses.count,
      deletedClosureCount: deletedClosures.count,
      deletedTaskCount: deletedTasks.count,
      deletedNoteCount: deletedNotes.count,
    };
  });
}

export async function maybeRunShiftRetentionCleanup(now = new Date()) {
  if (now.getTime() - lastRetentionCleanupAt < SHIFT_RETENTION_CLEANUP_INTERVAL_MS) {
    return null;
  }

  if (!retentionCleanupPromise) {
    retentionCleanupPromise = runShiftRetentionCleanup(now).finally(() => {
      lastRetentionCleanupAt = Date.now();
      retentionCleanupPromise = null;
    });
  }

  return retentionCleanupPromise;
}
