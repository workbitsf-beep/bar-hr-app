import { RequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SHIFT_RETENTION_DAYS = 45;
const SHIFT_RETENTION_CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

let lastRetentionCleanupAt = 0;
let retentionCleanupPromise:
  | Promise<{
      cutoff: Date;
      deletedShiftCount: number;
      deletedRequestCount: number;
      detachedTimeLogCount: number;
    }>
  | null = null;

export function getShiftRetentionCutoff(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - SHIFT_RETENTION_DAYS);
  return cutoff;
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
  const cutoff = getShiftRetentionCutoff(now);
  const expiredShifts = await prisma.shift.findMany({
    where: {
      endTime: {
        lt: cutoff,
      },
    },
    select: {
      id: true,
    },
  });

  if (expiredShifts.length === 0) {
    return {
      cutoff,
      deletedShiftCount: 0,
      deletedRequestCount: 0,
      detachedTimeLogCount: 0,
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

    const deletedShifts = await tx.shift.deleteMany({
      where: {
        id: {
          in: shiftIds,
        },
      },
    });

    return {
      deletedShiftCount: deletedShifts.count,
      deletedRequestCount: deletedRequests.count,
      detachedTimeLogCount: detachedTimeLogs.count,
    };
  });

  return {
    cutoff,
    ...result,
  };
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
