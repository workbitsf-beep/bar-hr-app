import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canReviewOperationalRequests } from "@/lib/permissions";
import { buildShiftPresets } from "@/lib/shift-presets";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { getDashboardContext } from "../context";
import { BillingRequiredState, EmptyState, Panel, Stack } from "../ui";
import { DayActionCalendarClient } from "./day-action-calendar-client";
import { OwnerCalendarClient } from "./owner-calendar-client";
import { PublishWeekPanel } from "./publish-week-panel";
import { ScrollToTodayButton } from "./scroll-to-today-button";

type CalendarPageSettings = {
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsRadius?: number | null;
  companyShiftsEnabled?: boolean | null;
  roundingEnabled?: boolean | null;
  roundingMinutes?: number | null;
  roundingMode?: string | null;
  morningStartTime?: string | null;
  morningEndTime?: string | null;
  afternoonStartTime?: string | null;
  afternoonEndTime?: string | null;
  eveningStartTime?: string | null;
  eveningEndTime?: string | null;
  standardShiftPresets?: unknown;
};

const CALENDAR_LOOKBACK_WEEKS = 4;
const CALENDAR_LOOKAHEAD_WEEKS = 12;
const AVAILABILITY_VISIBILITY_HOURS = 24;

function getLocale(language: string) {
  if (language === "en") {
    return "en-US";
  }

  if (language === "es") {
    return "es-ES";
  }

  if (language === "fr") {
    return "fr-FR";
  }

  return "it-IT";
}

function startOfCalendarWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfCalendarWeek(date: Date) {
  const start = startOfCalendarWeek(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseAnchorDate(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(searchParams?.day) ? searchParams.day[0] : searchParams?.day;

  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  try {
    const parsed = parseDateTimeLocal(raw);
    if (Number.isNaN(parsed.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  } catch {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRangeDayKeys(start: Date, end: Date) {
  const keys: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  const limit = new Date(end);
  limit.setHours(0, 0, 0, 0);

  while (cursor <= limit) {
    keys.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

function parseDayFilter(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(searchParams?.day) ? searchParams?.day[0] : searchParams?.day;

  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  return raw;
}

function isMissingColumnError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2022"
  );
}

function isRecoverableSchemaError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ["P2021", "P2022"].includes(String((error as { code?: string }).code))
  );
}

async function safeCalendarQuery<T>(label: string, query: () => Promise<T>, fallback: T) {
  try {
    return await query();
  } catch (error) {
    if (!isRecoverableSchemaError(error)) {
      throw error;
    }

    console.error(`[calendar] ${label} skipped due to schema mismatch`, {
      code: (error as { code?: string }).code,
      message: error instanceof Error ? error.message : String(error),
    });

    return fallback;
  }
}

async function getCalendarPageSettings(barId: string) {
  try {
    return await prisma.barSettings.findUnique({
      where: { barId },
      select: {
        gpsLatitude: true,
        gpsLongitude: true,
        gpsRadius: true,
        companyShiftsEnabled: true,
        roundingEnabled: true,
        roundingMinutes: true,
        roundingMode: true,
        morningStartTime: true,
        morningEndTime: true,
        afternoonStartTime: true,
        afternoonEndTime: true,
        eveningStartTime: true,
        eveningEndTime: true,
        standardShiftPresets: true,
      },
    });
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
  }

  const expectedColumns = [
    "gpsLatitude",
    "gpsLongitude",
    "gpsRadius",
    "companyShiftsEnabled",
    "roundingEnabled",
    "roundingMinutes",
    "roundingMode",
    "morningStartTime",
    "morningEndTime",
    "afternoonStartTime",
    "afternoonEndTime",
    "eveningStartTime",
    "eveningEndTime",
    "standardShiftPresets",
  ];
  const availableColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'BarSettings'
      AND column_name IN (
        'gpsLatitude',
        'gpsLongitude',
        'gpsRadius',
        'companyShiftsEnabled',
        'roundingEnabled',
        'roundingMinutes',
        'roundingMode',
        'morningStartTime',
        'morningEndTime',
        'afternoonStartTime',
        'afternoonEndTime',
        'eveningStartTime',
        'eveningEndTime',
        'standardShiftPresets'
      )
  `;
  const columnSet = new Set(availableColumns.map((column) => column.column_name));
  const selectedColumns = expectedColumns.filter((column) => columnSet.has(column));

  if (selectedColumns.length === 0) {
    return null;
  }

  const quotedColumns = selectedColumns.map((column) => `"${column}"`).join(", ");
  const rows = await prisma.$queryRawUnsafe<CalendarPageSettings[]>(
    `SELECT ${quotedColumns} FROM "BarSettings" WHERE "barId" = $1 LIMIT 1`,
    barId
  );
  const row = rows[0];

  return row
    ? {
        ...row,
        companyShiftsEnabled: row.companyShiftsEnabled ?? true,
        roundingEnabled: row.roundingEnabled ?? false,
      }
    : null;
}

export default async function DashboardCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const { session, role, language, activeBarId, activeBarActivityType, billingStatus, features } =
    await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Calendario">
        <EmptyState message="Seleziona un locale attivo per visualizzare il calendario turni." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const hasCalendarModules =
    features.shifts ||
    features.requests ||
    features.availability ||
    features.tasks ||
    features.noticeBoard ||
    features.courses;

  if (!hasCalendarModules) {
    return (
      <Panel title="Calendario">
        <EmptyState message="Nessuna funzione calendario attiva nelle impostazioni." />
      </Panel>
    );
  }

  const locale = getLocale(language);
  const dayFilter = parseDayFilter(params);
  const anchorDate = parseAnchorDate(params);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const availabilityVisibleAfter = new Date();
  availabilityVisibleAfter.setHours(availabilityVisibleAfter.getHours() - AVAILABILITY_VISIBILITY_HOURS);
  const calendarStart = startOfCalendarWeek(addDays(anchorDate, -7 * CALENDAR_LOOKBACK_WEEKS));
  const calendarEnd = endOfCalendarWeek(addDays(anchorDate, 7 * CALENDAR_LOOKAHEAD_WEEKS));
  const isRestaurant = activeBarActivityType === ActivityType.RESTAURANT;
  const canManageRestaurantShifts =
    features.shifts && isRestaurant && (role === Role.OWNER || role === Role.MANAGER);
  const canReviewCompanyRequests =
    features.requests && !isRestaurant && canReviewOperationalRequests(role as Role);

  const loadShifts = async () => {
    if (!features.shifts) {
      return [];
    }

    try {
      return await prisma.shift.findMany({
        where: {
          barId: activeBarId,
          startTime: { lte: calendarEnd },
          endTime: { gte: calendarStart },
        },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          title: true,
          startTime: true,
          endTime: true,
          confirmedAt: true,
          isOnCall: true,
          assignments: {
            select: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      });
    } catch (error) {
      if (!isRecoverableSchemaError(error)) {
        throw error;
      }

      console.error("[calendar] shifts retried without optional fields", {
        code: (error as { code?: string }).code,
        message: error instanceof Error ? error.message : String(error),
      });

      return (
        await safeCalendarQuery(
          "shifts fallback",
          () =>
            prisma.shift.findMany({
              where: {
                barId: activeBarId,
                startTime: { lte: calendarEnd },
                endTime: { gte: calendarStart },
              },
              orderBy: { startTime: "asc" },
              select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                confirmedAt: true,
                assignments: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        role: true,
                      },
                    },
                  },
                },
              },
            }),
          []
        )
      ).map((shift) => ({
        ...shift,
        isOnCall: false,
      }));
    }
  };

  const [
    settings,
    shifts,
    availabilities,
    approvedRequests,
    pendingRequests,
    courses,
    closures,
    calendarMembers,
    tasks,
    notes,
  ] =
    await Promise.all([
      getCalendarPageSettings(activeBarId),
      loadShifts(),
      features.availability
        ? safeCalendarQuery(
            "availability",
            () =>
              prisma.availability.findMany({
                where: {
                  barId: activeBarId,
                  startsAt: { lte: calendarEnd },
                  endsAt: { gte: calendarStart > availabilityVisibleAfter ? calendarStart : availabilityVisibleAfter },
                },
                select: {
                  id: true,
                  userId: true,
                  startsAt: true,
                  endsAt: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
                orderBy: { startsAt: "asc" },
              }),
            []
          )
        : Promise.resolve([]),
      features.requests
        ? safeCalendarQuery(
            "approved requests",
            () =>
              prisma.request.findMany({
                where: {
                  barId: activeBarId,
                  type: {
                    in: [RequestType.VACATION, RequestType.PERMISSION, RequestType.SICKNESS],
                  },
                  status: RequestStatus.APPROVED,
                  startsAt: { lte: calendarEnd },
                  endsAt: { gte: calendarStart },
                },
                select: {
                  id: true,
                  type: true,
                  employeeId: true,
                  startsAt: true,
                  endsAt: true,
                  reviewedBy: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                  employee: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
                orderBy: { startsAt: "asc" },
              }),
            []
          )
        : Promise.resolve([]),
      canReviewCompanyRequests
        ? safeCalendarQuery(
            "pending requests",
            () =>
              prisma.request.findMany({
                where: {
                  barId: activeBarId,
                  type: {
                    in: [
                      RequestType.VACATION,
                      RequestType.PERMISSION,
                      RequestType.SICKNESS,
                      ...(features.overtime ? [RequestType.OVERTIME] : []),
                    ],
                  },
                  status: RequestStatus.PENDING,
                  startsAt: { lte: calendarEnd },
                  endsAt: { gte: calendarStart },
                },
                select: {
                  id: true,
                  type: true,
                  startsAt: true,
                  endsAt: true,
                  reason: true,
                  certificateCode: true,
                  employee: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
                orderBy: { startsAt: "asc" },
              }),
            []
          )
        : Promise.resolve([]),
      features.courses
        ? safeCalendarQuery(
            "courses",
            () =>
              prisma.course.findMany({
                where: {
                  barId: activeBarId,
                  startsAt: { lte: calendarEnd },
                  endsAt: { gte: calendarStart },
                  ...(role === Role.OWNER || role === Role.MANAGER
                    ? {}
                    : {
                        OR: [{ assignedToAll: true }, { assignedToId: session.user.id }],
                      }),
                },
                select: {
                  id: true,
                  title: true,
                  startsAt: true,
                  endsAt: true,
                  location: true,
                  assignedToAll: true,
                  assignedTo: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
                orderBy: { startsAt: "asc" },
              }),
            []
          )
        : Promise.resolve([]),
      features.requests
        ? safeCalendarQuery(
            "closures",
            () =>
              prisma.calendarClosure.findMany({
                where: {
                  barId: activeBarId,
                  startsAt: { lte: calendarEnd },
                  endsAt: { gte: calendarStart },
                },
                select: {
                  id: true,
                  title: true,
                  type: true,
                  startsAt: true,
                  endsAt: true,
                },
                orderBy: { startsAt: "asc" },
              }),
            []
          )
        : Promise.resolve([]),
      safeCalendarQuery(
        "members",
        () =>
          prisma.employeeBar.findMany({
            where: {
              barId: activeBarId,
              isActive: true,
            },
            orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
            select: {
              role: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          }),
        []
      ),
      features.tasks
        ? safeCalendarQuery(
            "tasks",
            () =>
              prisma.task.findMany({
                where: {
                  barId: activeBarId,
                  dueDate: {
                    gte: calendarStart,
                    lte: calendarEnd,
                  },
                  ...(role === Role.EMPLOYEE
                    ? {
                        OR: [{ assignedToId: session.user.id }, { assignedToAll: true }],
                      }
                    : {}),
                },
                orderBy: [{ status: "asc" }, { isUrgent: "desc" }, { dueDate: "asc" }],
                select: {
                  id: true,
                  title: true,
                  dueDate: true,
                  status: true,
                  isUrgent: true,
                  assignedToAll: true,
                  assignedTo: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                  completedBy: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              }),
            []
          )
        : Promise.resolve([]),
      features.noticeBoard
        ? safeCalendarQuery(
            "notes",
            () =>
              prisma.note.findMany({
                where: {
                  barId: activeBarId,
                  createdAt: {
                    gte: calendarStart,
                    lte: calendarEnd,
                  },
                  ...(role === Role.EMPLOYEE
                    ? {
                        OR: [{ employeeId: null }, { employeeId: session.user.id }],
                      }
                    : {}),
                },
                orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  content: true,
                  isPinned: true,
                  requiresConfirmation: true,
                  createdAt: true,
                  employeeId: true,
                  readReceipts: {
                    orderBy: {
                      readAt: "desc",
                    },
                    select: {
                      readAt: true,
                      userId: true,
                      user: {
                        select: {
                          firstName: true,
                          lastName: true,
                        },
                      },
                    },
                  },
                  author: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              }),
            []
          )
        : Promise.resolve([]),
    ]);

  const shiftsByDay = new Map<string, typeof shifts>();
  const availabilitiesByDay = new Map<string, typeof availabilities>();
  const requestsByDay = new Map<string, typeof approvedRequests>();
  const pendingRequestsByDay = new Map<string, typeof pendingRequests>();
  const coursesByDay = new Map<string, typeof courses>();
  const closuresByDay = new Map<string, typeof closures>();
  const tasksByDay = new Map<string, typeof tasks>();
  const notesByDay = new Map<string, typeof notes>();

  for (const shift of shifts) {
    const start = shift.startTime > calendarStart ? shift.startTime : calendarStart;
    const end = shift.endTime < calendarEnd ? shift.endTime : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayShifts = shiftsByDay.get(dayKey) ?? [];
      dayShifts.push(shift);
      shiftsByDay.set(dayKey, dayShifts);
    }
  }

  for (const availability of availabilities) {
    const start = availability.startsAt > calendarStart ? availability.startsAt : calendarStart;
    const end = availability.endsAt < calendarEnd ? availability.endsAt : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayAvailabilities = availabilitiesByDay.get(dayKey) ?? [];
      dayAvailabilities.push(availability);
      availabilitiesByDay.set(dayKey, dayAvailabilities);
    }
  }

  for (const request of approvedRequests) {
    const safeStart = request.startsAt ?? calendarStart;
    const safeEnd = request.endsAt ?? safeStart;
    const start = safeStart > calendarStart ? safeStart : calendarStart;
    const end = safeEnd < calendarEnd ? safeEnd : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayRequests = requestsByDay.get(dayKey) ?? [];
      dayRequests.push(request);
      requestsByDay.set(dayKey, dayRequests);
    }
  }

  for (const request of pendingRequests) {
    const safeStart = request.startsAt ?? calendarStart;
    const safeEnd = request.endsAt ?? safeStart;
    const start = safeStart > calendarStart ? safeStart : calendarStart;
    const end = safeEnd < calendarEnd ? safeEnd : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayPendingRequests = pendingRequestsByDay.get(dayKey) ?? [];
      dayPendingRequests.push(request);
      pendingRequestsByDay.set(dayKey, dayPendingRequests);
    }
  }

  for (const course of courses) {
    const start = course.startsAt > calendarStart ? course.startsAt : calendarStart;
    const end = course.endsAt < calendarEnd ? course.endsAt : calendarEnd;

    for (const dayKey of getRangeDayKeys(start, end)) {
      const dayCourses = coursesByDay.get(dayKey) ?? [];
      dayCourses.push(course);
      coursesByDay.set(dayKey, dayCourses);
    }
  }

  for (const closure of closures) {
    const cursor = new Date(closure.startsAt);
    cursor.setHours(0, 0, 0, 0);
    const closureEnd = new Date(closure.endsAt);
    closureEnd.setHours(0, 0, 0, 0);

    while (cursor <= closureEnd) {
      const dayKey = toLocalDateKey(cursor);
      const dayClosures = closuresByDay.get(dayKey) ?? [];
      dayClosures.push(closure);
      closuresByDay.set(dayKey, dayClosures);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const task of tasks) {
    const dayKey = toLocalDateKey(task.dueDate);
    const dayTasks = tasksByDay.get(dayKey) ?? [];
    dayTasks.push(task);
    tasksByDay.set(dayKey, dayTasks);
  }

  for (const note of notes) {
    const dayKey = toLocalDateKey(note.createdAt);
    const dayNotes = notesByDay.get(dayKey) ?? [];
    dayNotes.push(note);
    notesByDay.set(dayKey, dayNotes);
  }

  const dayCount =
    Math.floor((calendarEnd.getTime() - calendarStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    date.setHours(0, 0, 0, 0);
    const dayKey = toLocalDateKey(date);

    return {
      date,
      shifts: shiftsByDay.get(dayKey) ?? [],
      availabilities: availabilitiesByDay.get(dayKey) ?? [],
      requests: requestsByDay.get(dayKey) ?? [],
    };
  });

  const weekdayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(2026, 0, 5 + index);
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  });

  const serializedDays = days.map((day) => ({
    date: day.date.toISOString(),
    isToday: day.date.toDateString() === today.toDateString(),
    inCurrentMonth: true,
    shifts: day.shifts.map((shift) => ({
      id: shift.id,
      title: shift.title,
      startTime: shift.startTime.toISOString(),
      endTime: shift.endTime.toISOString(),
      confirmedAt: shift.confirmedAt?.toISOString() ?? null,
      isOnCall: shift.isOnCall,
      assignments: shift.assignments.map((assignment) => ({
        id: assignment.user.id,
        firstName: assignment.user.firstName,
        lastName: assignment.user.lastName,
        role: assignment.user.role,
        })),
      })),
      pendingOnCallShifts: day.shifts
        .filter((shift) => shift.isOnCall && !shift.confirmedAt)
        .map((shift) => ({
          id: shift.id,
          title: shift.title,
          startTime: shift.startTime.toISOString(),
          endTime: shift.endTime.toISOString(),
          confirmedAt: shift.confirmedAt?.toISOString() ?? null,
          isOnCall: shift.isOnCall,
          assignments: shift.assignments.map((assignment) => ({
            id: assignment.user.id,
            firstName: assignment.user.firstName,
            lastName: assignment.user.lastName,
            role: assignment.user.role,
          })),
        })),
    availabilities: day.availabilities.map((availability) => ({
      id: availability.id,
      userId: availability.userId,
      firstName: availability.user.firstName,
      lastName: availability.user.lastName,
      startsAt: availability.startsAt.toISOString(),
      endsAt: availability.endsAt.toISOString(),
    })),
    requests: day.requests.map((request) => ({
      id: request.id,
      type: request.type,
      userId: request.employeeId,
      firstName: request.employee.firstName,
      lastName: request.employee.lastName,
      startsAt: request.startsAt?.toISOString() ?? day.date.toISOString(),
      endsAt: request.endsAt?.toISOString() ?? day.date.toISOString(),
      approvedBy: request.reviewedBy
        ? `${request.reviewedBy.firstName} ${request.reviewedBy.lastName}`.trim()
        : request.type === RequestType.SICKNESS
          ? "Approvazione automatica"
          : null,
    })),
    pendingRequests: (pendingRequestsByDay.get(toLocalDateKey(day.date)) ?? []).map((request) => ({
      id: request.id,
      type: request.type,
      firstName: request.employee.firstName,
      lastName: request.employee.lastName,
      startsAt: request.startsAt?.toISOString() ?? day.date.toISOString(),
      endsAt: request.endsAt?.toISOString() ?? request.startsAt?.toISOString() ?? day.date.toISOString(),
      reason: role === Role.OWNER ? request.reason ?? null : null,
      certificateCode: role === Role.OWNER ? request.certificateCode ?? null : null,
    })),
    courses: (coursesByDay.get(toLocalDateKey(day.date)) ?? []).map((course) => ({
      id: course.id,
      title: course.title,
      startTime: course.startsAt.toISOString(),
      endTime: course.endsAt.toISOString(),
      location: course.location,
      audienceLabel: course.assignedToAll
        ? "Assegnato a tutto il team"
        : course.assignedTo
          ? `Assegnato a ${course.assignedTo.firstName} ${course.assignedTo.lastName}`
        : "Corso interno",
    })),
    closures: (closuresByDay.get(toLocalDateKey(day.date)) ?? []).map((closure) => ({
      id: closure.id,
      title: closure.title,
      type: closure.type,
      startTime: closure.startsAt.toISOString(),
      endTime: closure.endsAt.toISOString(),
    })),
    tasks: (tasksByDay.get(toLocalDateKey(day.date)) ?? []).map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate.toISOString(),
      status: task.status,
      isUrgent: task.isUrgent,
      assignedLabel: task.assignedToAll
        ? "Assegnata a tutto il team"
        : task.assignedTo
          ? `Assegnata a ${task.assignedTo.firstName} ${task.assignedTo.lastName}`
          : "Senza assegnatario singolo",
      completedByLabel: task.completedBy
        ? `${task.completedBy.firstName} ${task.completedBy.lastName}`
        : null,
    })),
    notes: (notesByDay.get(toLocalDateKey(day.date)) ?? []).map((note) => ({
      id: note.id,
      content: note.content,
      isPinned: note.isPinned,
      requiresConfirmation: note.requiresConfirmation,
      employeeId: note.employeeId,
      createdAt: note.createdAt.toISOString(),
      authorName: `${note.author.firstName} ${note.author.lastName}`.trim(),
      confirmations: note.readReceipts.map((receipt) => ({
        userId: receipt.userId,
        userName: `${receipt.user.firstName} ${receipt.user.lastName}`.trim(),
        readAt: receipt.readAt.toISOString(),
      })),
    })),
  }));

  const memberOptions = calendarMembers.map((member) => ({
    id: member.user.id,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    role: member.role,
  }));
  const shiftPresets = buildShiftPresets(settings);
  const unconfirmedShiftCount = shifts.filter(
    (shift) => !shift.confirmedAt && !shift.isOnCall
  ).length;
  const canPublishShifts =
    features.shifts &&
    (role === Role.OWNER || role === Role.MANAGER) &&
    (isRestaurant || Boolean(settings?.companyShiftsEnabled));
  const publishWeekAction = canPublishShifts ? (
    <PublishWeekPanel
      rangeStart={toLocalDateKey(calendarStart)}
      rangeEnd={toLocalDateKey(calendarEnd)}
      pendingCount={unconfirmedShiftCount}
    />
  ) : null;
  const calendarToolbarAction = (
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
      <ScrollToTodayButton fallbackHref="/dashboard/calendar" />
      {publishWeekAction}
    </div>
  );

  return (
    <Stack columns="minmax(0, 1fr)">
      <Panel title="Calendario">
        {canManageRestaurantShifts ? (
          <OwnerCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            members={memberOptions}
            presets={shiftPresets}
            filteredDay={dayFilter}
            role={String(role)}
            currentUserId={session.user.id}
            features={features}
            toolbarAction={calendarToolbarAction}
          />
        ) : (
          <DayActionCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            filteredDay={dayFilter}
            role={String(role)}
            activityType={activeBarActivityType ?? ActivityType.RESTAURANT}
            companyShiftsEnabled={Boolean(settings?.companyShiftsEnabled)}
            members={memberOptions}
            presets={shiftPresets}
            currentUserId={session.user.id}
            features={features}
            toolbarAction={calendarToolbarAction}
          />
        )}
      </Panel>
    </Stack>
  );
}
