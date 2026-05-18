import "server-only";

import { ClockType, type Prisma, RequestStatus, RequestType, RoundingMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyRounding } from "@/lib/rounding";

export type ExportEntry = {
  inLogId: string;
  outLogId: string;
  clockIn: string;
  clockOut: string;
  realDurationMs: number;
  roundedDurationMs: number;
  realHours: number;
  roundedHours: number;
};

export type GroupedDay = {
  date: string;
  entries: ExportEntry[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
  labels: string[];
};

export type MonthlyDataset = {
  groupedLogs: GroupedDay[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
};

export type MonthlyTotals = {
  realHours: number;
  roundedHours: number;
};

function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toHours(durationMs: number): number {
  return Math.round((durationMs / 3600000) * 100) / 100;
}

function getRoundedTimestamp(
  timestamp: Date,
  roundingEnabled: boolean,
  roundingMode: RoundingMode | null,
  roundingMinutes: number | null
): Date {
  if (!roundingEnabled || !roundingMode || !roundingMinutes) {
    return timestamp;
  }

  return applyRounding(timestamp, roundingMode, roundingMinutes);
}

function requestLabel(type: RequestType): string {
  if (type === RequestType.VACATION) {
    return "Ferie";
  }

  if (type === RequestType.PERMISSION) {
    return "Permesso";
  }

  return "Richiesta";
}

type MinimalTimeLog = {
  id: string;
  type: ClockType;
  timestamp: Date;
};

type MinimalRoundingSettings = {
  roundingEnabled: boolean;
  roundingMode: RoundingMode | null;
  roundingMinutes: number | null;
} | null;

function calculateMonthlyTotals(
  timeLogs: MinimalTimeLog[],
  settings: MinimalRoundingSettings
): {
  totalRealMs: number;
  totalRoundedMs: number;
} {
  let pendingIn: MinimalTimeLog | null = null;
  let totalRealMs = 0;
  let totalRoundedMs = 0;

  for (const log of timeLogs) {
    if (log.type === ClockType.IN) {
      pendingIn = log;
      continue;
    }

    if (!pendingIn) {
      continue;
    }

    const realDurationMs = Math.max(0, log.timestamp.getTime() - pendingIn.timestamp.getTime());
    const roundedIn = getRoundedTimestamp(
      pendingIn.timestamp,
      settings?.roundingEnabled ?? false,
      settings?.roundingMode ?? null,
      settings?.roundingMinutes ?? null
    );
    const roundedOut = getRoundedTimestamp(
      log.timestamp,
      settings?.roundingEnabled ?? false,
      settings?.roundingMode ?? null,
      settings?.roundingMinutes ?? null
    );
    const roundedDurationMs = Math.max(0, roundedOut.getTime() - roundedIn.getTime());

    totalRealMs += realDurationMs;
    totalRoundedMs += roundedDurationMs;
    pendingIn = null;
  }

  return {
    totalRealMs,
    totalRoundedMs,
  };
}

export async function buildMonthlyTotals(
  barId: string,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyTotals> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [timeLogs, settings] = await Promise.all([
    prisma.timeLog.findMany({
      where: {
        userId,
        barId,
        timestamp: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        id: true,
        type: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    }),
    prisma.barSettings.findUnique({
      where: { barId },
      select: {
        roundingEnabled: true,
        roundingMode: true,
        roundingMinutes: true,
      },
    }),
  ]);

  const totals = calculateMonthlyTotals(timeLogs, settings);

  return {
    realHours: toHours(totals.totalRealMs),
    roundedHours: toHours(totals.totalRoundedMs),
  };
}

export async function buildMonthlyDataset(
  barId: string,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyDataset> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const [timeLogs, settings, approvedRequests] = await Promise.all([
    prisma.timeLog.findMany({
      where: {
        userId,
        barId,
        timestamp: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
      select: {
        id: true,
        type: true,
        timestamp: true,
      },
      orderBy: {
        timestamp: "asc",
      },
    }),
    prisma.barSettings.findUnique({
      where: { barId },
      select: {
        roundingEnabled: true,
        roundingMode: true,
        roundingMinutes: true,
      },
    }),
    prisma.request.findMany({
      where: {
        barId,
        employeeId: userId,
        type: {
          in: [RequestType.VACATION, RequestType.PERMISSION],
        },
        status: RequestStatus.APPROVED,
        startsAt: {
          lt: monthEnd,
        },
        endsAt: {
          gte: monthStart,
        },
      },
      select: {
        type: true,
        startsAt: true,
        endsAt: true,
      },
    }),
  ]);

  const labelsByDay = new Map<string, Set<string>>();

  for (const request of approvedRequests) {
    if (!request.startsAt || !request.endsAt) {
      continue;
    }

    const cursor = new Date(request.startsAt);
    cursor.setHours(0, 0, 0, 0);

    const requestEnd = new Date(request.endsAt);
    requestEnd.setHours(0, 0, 0, 0);

    while (cursor <= requestEnd) {
      if (cursor >= monthStart && cursor < monthEnd) {
        const key = formatDayKey(cursor);
        const labels = labelsByDay.get(key) ?? new Set<string>();
        labels.add(requestLabel(request.type));
        labelsByDay.set(key, labels);
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const groupedMap = new Map<string, GroupedDay>();
  let pendingIn: Pick<Prisma.TimeLogGetPayload<{ select: { id: true; type: true; timestamp: true } }>, "id" | "type" | "timestamp"> | null = null;
  let totalRealMs = 0;
  let totalRoundedMs = 0;

  for (const log of timeLogs) {
    if (log.type === ClockType.IN) {
      pendingIn = log;
      continue;
    }

    if (!pendingIn) {
      continue;
    }

    const realDurationMs = Math.max(
      0,
      log.timestamp.getTime() - pendingIn.timestamp.getTime()
    );
    const roundedIn = getRoundedTimestamp(
      pendingIn.timestamp,
      settings?.roundingEnabled ?? false,
      settings?.roundingMode ?? null,
      settings?.roundingMinutes ?? null
    );
    const roundedOut = getRoundedTimestamp(
      log.timestamp,
      settings?.roundingEnabled ?? false,
      settings?.roundingMode ?? null,
      settings?.roundingMinutes ?? null
    );
    const roundedDurationMs = Math.max(
      0,
      roundedOut.getTime() - roundedIn.getTime()
    );

    const dayKey = formatDayKey(pendingIn.timestamp);
    const day =
      groupedMap.get(dayKey) ??
      {
        date: dayKey,
        entries: [],
        totals: {
          realHours: 0,
          roundedHours: 0,
        },
        labels: Array.from(labelsByDay.get(dayKey) ?? []),
      };

    const entry: ExportEntry = {
      inLogId: pendingIn.id,
      outLogId: log.id,
      clockIn: pendingIn.timestamp.toISOString(),
      clockOut: log.timestamp.toISOString(),
      realDurationMs,
      roundedDurationMs,
      realHours: toHours(realDurationMs),
      roundedHours: toHours(roundedDurationMs),
    };

    day.entries.push(entry);
    day.totals.realHours = Math.round((day.totals.realHours + entry.realHours) * 100) / 100;
    day.totals.roundedHours =
      Math.round((day.totals.roundedHours + entry.roundedHours) * 100) / 100;
    groupedMap.set(dayKey, day);
    totalRealMs += realDurationMs;
    totalRoundedMs += roundedDurationMs;
    pendingIn = null;
  }

  for (const [dayKey, labels] of labelsByDay.entries()) {
    if (!groupedMap.has(dayKey)) {
      groupedMap.set(dayKey, {
        date: dayKey,
        entries: [],
        totals: {
          realHours: 0,
          roundedHours: 0,
        },
        labels: Array.from(labels),
      });
    }
  }

  const groupedLogs = Array.from(groupedMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    groupedLogs,
    totals: {
      realHours: toHours(totalRealMs),
      roundedHours: toHours(totalRoundedMs),
    },
  };
}
