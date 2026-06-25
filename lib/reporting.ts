import "server-only";

import {
  ActivityType,
  ClockType,
  RequestStatus,
  RequestType,
  RoundingMode,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateRoundedWorkDuration } from "@/lib/rounding";
import { getOrSetRuntimeCache, invalidateRuntimeCache } from "@/lib/runtime-cache";

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

export type CompanyReportItem = {
  id: string;
  type: "Indisponibilita" | "Ferie" | "Permesso" | "Malattia" | "Straordinario" | "Corso" | "Chiusura";
  title: string;
  startsAt: string;
  endsAt: string;
  note?: string | null;
};

export type GroupedDay = {
  date: string;
  entries: ExportEntry[];
  totals: {
    realHours: number;
    roundedHours: number;
  };
  labels: string[];
  items?: CompanyReportItem[];
};

export type CompanyMonthlySummary = {
  availability: number;
  vacation: number;
  permission: number;
  sickness: number;
  overtime: number;
  courses: number;
  closures: number;
  total: number;
};

export type MonthlyDataset =
  | {
      mode: "restaurant";
      groupedLogs: GroupedDay[];
      totals: {
        realHours: number;
        roundedHours: number;
      };
      summary?: undefined;
    }
  | {
      mode: "company";
      groupedLogs: GroupedDay[];
      totals: {
        realHours: number;
        roundedHours: number;
      };
      summary: CompanyMonthlySummary;
    };

export type MonthlyTotals = {
  realHours: number;
  roundedHours: number;
};

type MinimalTimeLog = {
  id: string;
  type: ClockType;
  timestamp: Date;
  shift: {
    startTime: Date;
    endTime: Date;
  } | null;
};

type MinimalRoundingSettings = {
  roundingEnabled: boolean;
  roundingMode: RoundingMode | null;
  roundingMinutes: number | null;
} | null;

function formatDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toHours(durationMs: number): number {
  return Math.round((durationMs / 3600000) * 100) / 100;
}

function requestLabel(type: RequestType): "Ferie" | "Permesso" | "Malattia" | "Straordinario" | "Richiesta" {
  if (type === RequestType.VACATION) {
    return "Ferie";
  }

  if (type === RequestType.PERMISSION) {
    return "Permesso";
  }

  if (type === RequestType.SICKNESS) {
    return "Malattia";
  }

  if (type === RequestType.OVERTIME) {
    return "Straordinario";
  }

  return "Richiesta";
}

function createEmptyDay(date: string): GroupedDay {
  return {
    date,
    entries: [],
    totals: {
      realHours: 0,
      roundedHours: 0,
    },
    labels: [],
    items: [],
  };
}

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

    const duration = calculateRoundedWorkDuration(pendingIn.timestamp, log.timestamp, settings);

    totalRealMs += duration.realMs;
    totalRoundedMs += duration.roundedMs;
    pendingIn = null;
  }

  return {
    totalRealMs,
    totalRoundedMs,
  };
}

function getClampedDayKey(date: Date, monthStart: Date, monthEnd: Date): string {
  const safeDate = new Date(date);

  if (safeDate < monthStart) {
    return formatDayKey(monthStart);
  }

  if (safeDate >= monthEnd) {
    const lastDayInMonth = new Date(monthEnd);
    lastDayInMonth.setDate(lastDayInMonth.getDate() - 1);
    return formatDayKey(lastDayInMonth);
  }

  return formatDayKey(safeDate);
}

function upsertCompanyDayItem(
  groupedMap: Map<string, GroupedDay>,
  dayKey: string,
  item: CompanyReportItem
) {
  const day = groupedMap.get(dayKey) ?? createEmptyDay(dayKey);
  day.items = [...(day.items ?? []), item].sort(
    (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
  );
  groupedMap.set(dayKey, day);
}

async function buildRestaurantMonthlyDataset(
  barId: string,
  userId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyDataset> {
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
        shift: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
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
          in: [RequestType.VACATION, RequestType.PERMISSION, RequestType.SICKNESS],
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
  const dayRealTotalsMs = new Map<string, number>();
  const dayRoundedTotalsMs = new Map<string, number>();
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

    const duration = calculateRoundedWorkDuration(pendingIn.timestamp, log.timestamp, settings);

    const dayKey = formatDayKey(pendingIn.timestamp);
    const day =
      groupedMap.get(dayKey) ??
      {
        ...createEmptyDay(dayKey),
        labels: Array.from(labelsByDay.get(dayKey) ?? []),
      };

    const entry: ExportEntry = {
      inLogId: pendingIn.id,
      outLogId: log.id,
      clockIn: pendingIn.timestamp.toISOString(),
      clockOut: log.timestamp.toISOString(),
      realDurationMs: duration.realMs,
      roundedDurationMs: duration.roundedMs,
      realHours: toHours(duration.realMs),
      roundedHours: toHours(duration.roundedMs),
    };

    day.entries.push(entry);
    const nextDayRealMs = (dayRealTotalsMs.get(dayKey) ?? 0) + duration.realMs;
    const nextDayRoundedMs = (dayRoundedTotalsMs.get(dayKey) ?? 0) + duration.roundedMs;
    dayRealTotalsMs.set(dayKey, nextDayRealMs);
    dayRoundedTotalsMs.set(dayKey, nextDayRoundedMs);
    day.totals.realHours = toHours(nextDayRealMs);
    day.totals.roundedHours = toHours(nextDayRoundedMs);
    groupedMap.set(dayKey, day);
    totalRealMs += duration.realMs;
    totalRoundedMs += duration.roundedMs;
    pendingIn = null;
  }

  for (const [dayKey, labels] of labelsByDay.entries()) {
    if (!groupedMap.has(dayKey)) {
      groupedMap.set(dayKey, {
        ...createEmptyDay(dayKey),
        labels: Array.from(labels),
      });
    }
  }

  return {
    mode: "restaurant",
    groupedLogs: Array.from(groupedMap.values()).sort((left, right) =>
      left.date.localeCompare(right.date)
    ),
    totals: {
      realHours: toHours(totalRealMs),
      roundedHours: toHours(totalRoundedMs),
    },
  };
}

async function buildCompanyMonthlyDataset(
  barId: string,
  userId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<MonthlyDataset> {
  const [availabilities, approvedRequests, courses, closures] = await Promise.all([
    prisma.availability.findMany({
      where: {
        barId,
        userId,
        startsAt: {
          lt: monthEnd,
        },
        endsAt: {
          gte: monthStart,
        },
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        reason: true,
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
    prisma.request.findMany({
      where: {
        barId,
        employeeId: userId,
        type: {
          in: [
            RequestType.VACATION,
            RequestType.PERMISSION,
            RequestType.SICKNESS,
            RequestType.OVERTIME,
          ],
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
        id: true,
        type: true,
        startsAt: true,
        endsAt: true,
        reason: true,
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
    prisma.course.findMany({
      where: {
        barId,
        startsAt: {
          lt: monthEnd,
        },
        endsAt: {
          gte: monthStart,
        },
        OR: [
          {
            assignedToAll: true,
          },
          {
            assignedToId: userId,
          },
        ],
      },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
    prisma.calendarClosure.findMany({
      where: {
        barId,
        startsAt: {
          lt: monthEnd,
        },
        endsAt: {
          gte: monthStart,
        },
      },
      select: {
        id: true,
        title: true,
        type: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: {
        startsAt: "asc",
      },
    }),
  ]);

  const groupedMap = new Map<string, GroupedDay>();
  const summary: CompanyMonthlySummary = {
    availability: 0,
    vacation: 0,
    permission: 0,
    sickness: 0,
    overtime: 0,
    courses: 0,
    closures: 0,
    total: 0,
  };

  for (const availability of availabilities) {
    const dayKey = getClampedDayKey(availability.startsAt, monthStart, monthEnd);

    upsertCompanyDayItem(groupedMap, dayKey, {
      id: availability.id,
      type: "Indisponibilita",
      title: availability.reason?.trim() || "Indisponibilita registrata",
      startsAt: availability.startsAt.toISOString(),
      endsAt: availability.endsAt.toISOString(),
    });

    summary.availability += 1;
    summary.total += 1;
  }

  for (const request of approvedRequests) {
    if (!request.startsAt || !request.endsAt) {
      continue;
    }

    const label = requestLabel(request.type);
    const dayKey = getClampedDayKey(request.startsAt, monthStart, monthEnd);

    upsertCompanyDayItem(groupedMap, dayKey, {
      id: request.id,
      type: label === "Richiesta" ? "Permesso" : label,
      title: request.reason?.trim() || `${label} registrati`,
      startsAt: request.startsAt.toISOString(),
      endsAt: request.endsAt.toISOString(),
    });

    if (request.type === RequestType.VACATION) {
      summary.vacation += 1;
    } else if (request.type === RequestType.PERMISSION) {
      summary.permission += 1;
    } else if (request.type === RequestType.SICKNESS) {
      summary.sickness += 1;
    } else if (request.type === RequestType.OVERTIME) {
      summary.overtime += 1;
    }

    summary.total += 1;
  }

  for (const course of courses) {
    const dayKey = getClampedDayKey(course.startsAt, monthStart, monthEnd);
    const noteParts = [course.location?.trim(), course.description?.trim()].filter(Boolean);

    upsertCompanyDayItem(groupedMap, dayKey, {
      id: course.id,
      type: "Corso",
      title: course.title,
      startsAt: course.startsAt.toISOString(),
      endsAt: course.endsAt.toISOString(),
      note: noteParts.length > 0 ? noteParts.join(" - ") : null,
    });

    summary.courses += 1;
    summary.total += 1;
  }

  for (const closure of closures) {
    const dayKey = getClampedDayKey(closure.startsAt, monthStart, monthEnd);

    upsertCompanyDayItem(groupedMap, dayKey, {
      id: closure.id,
      type: "Chiusura",
      title: closure.title || (closure.type === "HOLIDAY" ? "Festivita" : "Chiusura"),
      startsAt: closure.startsAt.toISOString(),
      endsAt: closure.endsAt.toISOString(),
    });

    summary.closures += 1;
    summary.total += 1;
  }

  return {
    mode: "company",
    groupedLogs: Array.from(groupedMap.values()).sort((left, right) =>
      left.date.localeCompare(right.date)
    ),
    totals: {
      realHours: 0,
      roundedHours: 0,
    },
    summary,
  };
}

export async function buildMonthlyTotals(
  barId: string,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyTotals> {
  return getOrSetRuntimeCache(
    `monthly-totals:${barId}:${userId}:${year}:${month}`,
    20_000,
    async () => {
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
            shift: {
              select: {
                startTime: true,
                endTime: true,
              },
            },
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
  );
}

export async function buildMonthlyDataset(
  barId: string,
  userId: string,
  month: number,
  year: number,
  activityType: ActivityType = ActivityType.RESTAURANT
): Promise<MonthlyDataset> {
  return getOrSetRuntimeCache(
    `monthly-dataset:${barId}:${userId}:${year}:${month}:${activityType}`,
    20_000,
    async () => {
      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);

      if (activityType === ActivityType.COMPANY) {
        return buildCompanyMonthlyDataset(barId, userId, monthStart, monthEnd);
      }

      return buildRestaurantMonthlyDataset(barId, userId, monthStart, monthEnd);
    }
  );
}

export function invalidateReportingCache(barId: string, userId?: string) {
  invalidateRuntimeCache(`monthly-totals:${barId}:`);
  invalidateRuntimeCache(`monthly-dataset:${barId}:`);

  if (userId) {
    invalidateRuntimeCache(`monthly-totals:${barId}:${userId}:`);
    invalidateRuntimeCache(`monthly-dataset:${barId}:${userId}:`);
  }
}
