import { ActivityType, RequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const RESTAURANT_CALENDAR_RETENTION_DAYS = 60;
export const COMPANY_CALENDAR_RETENTION_DAYS = 400;
export const AVAILABILITY_RETENTION_HOURS = 24;
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

export async function runShiftRetentionCleanup(now = new Date()) {
  const { restaurantCutoff, companyCutoff } = getCalendarRetentionCutoffs(now);
  const availabilityCutoff = getAvailabilityRetentionCutoff(now);
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
  const expiredShifts = await prisma.shift.findMany({
    where: {
      OR: expiredByBarActivity.map((entry) => ({
        bar: entry.bar,
        endTime: { lt: entry.cutoff },
      })),
    },
    select: {
      id: true,
    },
  });

  if (expiredShifts.length === 0) {
    const standaloneResult = await deleteExpiredCalendarItems(expiredByBarActivity, availabilityCutoff);

    return {
      restaurantCutoff,
      companyCutoff,
      deletedShiftCount: 0,
      deletedRequestCount: standaloneResult.deletedRequestCount,
      detachedTimeLogCount: 0,
      deletedAvailabilityCount: standaloneResult.deletedAvailabilityCount,
      deletedCourseCount: standaloneResult.deletedCourseCount,
      deletedClosureCount: standaloneResult.deletedClosureCount,
      deletedTaskCount: standaloneResult.deletedTaskCount,
      deletedNoteCount: standaloneResult.deletedNoteCount,
    };
  }

  const shiftIds = expiredShifts.map((shift) => shift.id);
  const result = await prisma.$transaction(async (tx) => {
    const deletedRequests = await tx.request.deleteMany({
      where: {
        shiftId: {
          in: shiftIds,
        },
        type: RequestType.SHIFT_CHANGE,
      },
    });

    const deletedOldRequests = await tx.request.deleteMany({
      where: {
        OR: expiredByBarActivity.flatMap((entry) => [
          {
            bar: entry.bar,
            endsAt: { lt: entry.cutoff },
          },
          {
            bar: entry.bar,
            endsAt: null,
            startsAt: { lt: entry.cutoff },
          },
          {
            bar: entry.bar,
            endsAt: null,
            startsAt: null,
            createdAt: { lt: entry.cutoff },
          },
        ]),
      },
    });

    const detachedTimeLogs = await tx.timeLog.updateMany({
      where: {
        shiftId: {
          in: shiftIds,
        },
      },
      data: {
        shiftId: null,
      },
    });

    const deletedAvailabilities = await tx.availability.deleteMany({
      where: {
        endsAt: { lt: availabilityCutoff },
      },
    });

    const deletedCourses = await tx.course.deleteMany({
      where: {
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          endsAt: { lt: entry.cutoff },
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
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          dueDate: { lt: entry.cutoff },
        })),
      },
    });

    const deletedNotes = await tx.note.deleteMany({
      where: {
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          createdAt: { lt: entry.cutoff },
        })),
      },
    });

    const deletedShifts = await tx.shift.deleteMany({
      where: {
        id: {
          in: shiftIds,
        },
      },
    });

    return {
      deletedShiftCount: deletedShifts.count,
      deletedRequestCount: deletedRequests.count + deletedOldRequests.count,
      detachedTimeLogCount: detachedTimeLogs.count,
      deletedAvailabilityCount: deletedAvailabilities.count,
      deletedCourseCount: deletedCourses.count,
      deletedClosureCount: deletedClosures.count,
      deletedTaskCount: deletedTasks.count,
      deletedNoteCount: deletedNotes.count,
    };
  });

  return {
    restaurantCutoff,
    companyCutoff,
    ...result,
  };
}

async function deleteExpiredCalendarItems(
  expiredByBarActivity: Array<{
    bar: { activityType: ActivityType };
    cutoff: Date;
  }>,
  availabilityCutoff = getAvailabilityRetentionCutoff()
) {
  return prisma.$transaction(async (tx) => {
    const deletedRequests = await tx.request.deleteMany({
      where: {
        OR: expiredByBarActivity.flatMap((entry) => [
          {
            bar: entry.bar,
            endsAt: { lt: entry.cutoff },
          },
          {
            bar: entry.bar,
            endsAt: null,
            startsAt: { lt: entry.cutoff },
          },
          {
            bar: entry.bar,
            endsAt: null,
            startsAt: null,
            createdAt: { lt: entry.cutoff },
          },
        ]),
      },
    });

    const deletedAvailabilities = await tx.availability.deleteMany({
      where: {
        endsAt: { lt: availabilityCutoff },
      },
    });

    const deletedCourses = await tx.course.deleteMany({
      where: {
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          endsAt: { lt: entry.cutoff },
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
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          dueDate: { lt: entry.cutoff },
        })),
      },
    });

    const deletedNotes = await tx.note.deleteMany({
      where: {
        OR: expiredByBarActivity.map((entry) => ({
          bar: entry.bar,
          createdAt: { lt: entry.cutoff },
        })),
      },
    });

    return {
      deletedRequestCount: deletedRequests.count,
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
