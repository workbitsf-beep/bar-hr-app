import {
  ActivityType,
  RequestStatus,
  RequestType,
  TaskStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DashboardKpiData = {
  today: {
    scheduledUsers: number;
    scheduledShifts: number;
    confirmedShifts: number;
    pendingShifts: number;
    absences: number;
    approvedLeaves: number;
    approvedPermissions: number;
    sickness: number;
    unavailability: number;
  };
  requests: {
    pendingLeaves: number;
    pendingPermissions: number;
    pendingShiftSwaps: number;
    totalPending: number;
  };
  tasks: {
    totalToday: number;
    completedToday: number;
    openToday: number;
    completionRate: number;
  };
  shifts: {
    weekTotal: number;
    byDay: Array<{
      date: string;
      label: string;
      count: number;
    }>;
  };
  board: {
    last7DaysCount: number;
    recent: Array<{
      id: string;
      content: string;
      isPinned: boolean;
      createdAt: string;
      authorName: string;
    }>;
  };
  training: {
    enabled: boolean;
    completed: number;
    expiring: number;
    pending: number;
  };
  charts: {
    tasksLast7Days: Array<{
      date: string;
      label: string;
      completed: number;
      total: number;
    }>;
    requestsCurrentMonth: Array<{
      key: "VACATION" | "PERMISSION" | "SICKNESS" | "SHIFT_CHANGE";
      label: string;
      count: number;
    }>;
    shiftsCurrentWeek: Array<{
      date: string;
      label: string;
      count: number;
    }>;
  };
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatShortDay(value: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
  }).format(value);
}

function clampRate(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createDayBuckets(start: Date, length: number) {
  return Array.from({ length }, (_, index) => {
    const date = addDays(start, index);
    return {
      date: dateKey(date),
      label: formatShortDay(date),
      count: 0,
    };
  });
}

function createTaskBuckets(start: Date, length: number) {
  return Array.from({ length }, (_, index) => {
    const date = addDays(start, index);
    return {
      date: dateKey(date),
      label: formatShortDay(date),
      completed: 0,
      total: 0,
    };
  });
}

export async function getDashboardKpiData(
  barId: string,
  activityType: ActivityType | null
): Promise<DashboardKpiData> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfDay(addDays(weekStart, 6));
  const sevenDaysStart = startOfDay(addDays(now, -6));
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const nextThirtyDays = endOfDay(addDays(now, 30));

  const [
    todayAssignments,
    weekShifts,
    pendingRequestTypes,
    approvedTodayRequestTypes,
    todayUnavailabilityCount,
    tasksLast7Days,
    boardRecent,
    boardLast7DaysCount,
    monthRequestTypes,
    courses,
  ] = await Promise.all([
    prisma.shiftAssignment.findMany({
      where: {
        shift: {
          barId,
          startTime: {
            lte: todayEnd,
          },
          endTime: {
            gte: todayStart,
          },
        },
      },
      select: {
        userId: true,
      },
    }),
    prisma.shift.findMany({
      where: {
        barId,
        startTime: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: {
        startTime: "asc",
      },
      select: {
        id: true,
        startTime: true,
        confirmedAt: true,
      },
    }),
    prisma.request.findMany({
      where: {
        barId,
        status: RequestStatus.PENDING,
        type: {
          in: [
            RequestType.VACATION,
            RequestType.PERMISSION,
            RequestType.SHIFT_CHANGE,
          ],
        },
      },
      select: {
        type: true,
      },
    }),
    prisma.request.findMany({
      where: {
        barId,
        status: RequestStatus.APPROVED,
        type: {
          in: [
            RequestType.VACATION,
            RequestType.PERMISSION,
            RequestType.SICKNESS,
          ],
        },
        startsAt: {
          lte: todayEnd,
        },
        endsAt: {
          gte: todayStart,
        },
      },
      select: {
        type: true,
      },
    }),
    prisma.availability.count({
      where: {
        barId,
        startsAt: {
          lte: todayEnd,
        },
        endsAt: {
          gte: todayStart,
        },
      },
    }),
    prisma.task.findMany({
      where: {
        barId,
        dueDate: {
          gte: sevenDaysStart,
          lte: todayEnd,
        },
      },
      select: {
        dueDate: true,
        status: true,
      },
    }),
    prisma.note.findMany({
      where: {
        barId,
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 4,
      select: {
        id: true,
        content: true,
        isPinned: true,
        createdAt: true,
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.note.count({
      where: {
        barId,
        createdAt: {
          gte: sevenDaysStart,
        },
      },
    }),
    prisma.request.findMany({
      where: {
        barId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        type: {
          in: [
            RequestType.VACATION,
            RequestType.PERMISSION,
            RequestType.SICKNESS,
            RequestType.SHIFT_CHANGE,
          ],
        },
      },
      select: {
        type: true,
      },
    }),
    activityType === ActivityType.COMPANY
      ? prisma.course.findMany({
          where: {
            barId,
          },
          select: {
            startsAt: true,
            endsAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const scheduledUsers = new Set(todayAssignments.map((assignment) => assignment.userId)).size;

  const pendingRequests = {
    pendingLeaves: 0,
    pendingPermissions: 0,
    pendingShiftSwaps: 0,
    totalPending: pendingRequestTypes.length,
  };

  for (const request of pendingRequestTypes) {
    if (request.type === RequestType.VACATION) {
      pendingRequests.pendingLeaves += 1;
    } else if (request.type === RequestType.PERMISSION) {
      pendingRequests.pendingPermissions += 1;
    } else if (request.type === RequestType.SHIFT_CHANGE) {
      pendingRequests.pendingShiftSwaps += 1;
    }
  }

  const todayCounts = {
    approvedLeaves: 0,
    approvedPermissions: 0,
    sickness: 0,
  };

  for (const request of approvedTodayRequestTypes) {
    if (request.type === RequestType.VACATION) {
      todayCounts.approvedLeaves += 1;
    } else if (request.type === RequestType.PERMISSION) {
      todayCounts.approvedPermissions += 1;
    } else if (request.type === RequestType.SICKNESS) {
      todayCounts.sickness += 1;
    }
  }

  const shiftsByDay = createDayBuckets(weekStart, 7);
  const shiftDayMap = new Map(shiftsByDay.map((entry) => [entry.date, entry]));
  let scheduledShifts = 0;
  let confirmedShifts = 0;
  let pendingShifts = 0;

  for (const shift of weekShifts) {
    const key = dateKey(shift.startTime);
    const shiftBucket = shiftDayMap.get(key);
    if (shiftBucket) {
      shiftBucket.count += 1;
    }

    if (shift.startTime >= todayStart && shift.startTime <= todayEnd) {
      scheduledShifts += 1;
      if (shift.confirmedAt) {
        confirmedShifts += 1;
      } else {
        pendingShifts += 1;
      }
    }
  }

  const taskChart = createTaskBuckets(sevenDaysStart, 7);
  const taskMap = new Map(taskChart.map((entry) => [entry.date, entry]));
  let totalToday = 0;
  let completedToday = 0;

  for (const task of tasksLast7Days) {
    const key = dateKey(task.dueDate);
    const bucket = taskMap.get(key);

    if (bucket) {
      bucket.total += 1;
      if (task.status === TaskStatus.DONE) {
        bucket.completed += 1;
      }
    }

    if (task.dueDate >= todayStart && task.dueDate <= todayEnd) {
      totalToday += 1;
      if (task.status === TaskStatus.DONE) {
        completedToday += 1;
      }
    }
  }

  const requestBars = [
    { key: "VACATION" as const, label: "Ferie", count: 0 },
    { key: "PERMISSION" as const, label: "Permessi", count: 0 },
    { key: "SICKNESS" as const, label: "Malattie", count: 0 },
    { key: "SHIFT_CHANGE" as const, label: "Cambi turno", count: 0 },
  ];
  const requestBarMap = new Map(requestBars.map((entry) => [entry.key, entry]));

  for (const request of monthRequestTypes) {
    const requestBucket = requestBarMap.get(
      request.type as (typeof requestBars)[number]["key"]
    );
    if (requestBucket) {
      requestBucket.count += 1;
    }
  }

  const training = {
    enabled: activityType === ActivityType.COMPANY,
    completed: 0,
    expiring: 0,
    pending: 0,
  };

  if (activityType === ActivityType.COMPANY) {
    for (const course of courses) {
      if (course.endsAt < now) {
        training.completed += 1;
      } else if (course.endsAt <= nextThirtyDays) {
        training.expiring += 1;
      } else {
        training.pending += 1;
      }
    }
  }

  return {
    today: {
      scheduledUsers,
      scheduledShifts,
      confirmedShifts,
      pendingShifts,
      absences:
        todayCounts.approvedLeaves +
        todayCounts.approvedPermissions +
        todayCounts.sickness +
        todayUnavailabilityCount,
      approvedLeaves: todayCounts.approvedLeaves,
      approvedPermissions: todayCounts.approvedPermissions,
      sickness: todayCounts.sickness,
      unavailability: todayUnavailabilityCount,
    },
    requests: pendingRequests,
    tasks: {
      totalToday,
      completedToday,
      openToday: Math.max(0, totalToday - completedToday),
      completionRate: totalToday === 0 ? 0 : clampRate((completedToday / totalToday) * 100),
    },
    shifts: {
      weekTotal: weekShifts.length,
      byDay: shiftsByDay,
    },
    board: {
      last7DaysCount: boardLast7DaysCount,
      recent: boardRecent.map((note) => ({
        id: note.id,
        content: note.content,
        isPinned: note.isPinned,
        createdAt: note.createdAt.toISOString(),
        authorName: `${note.author.firstName} ${note.author.lastName}`,
      })),
    },
    training,
    charts: {
      tasksLast7Days: taskChart,
      requestsCurrentMonth: requestBars,
      shiftsCurrentWeek: shiftsByDay,
    },
  };
}
