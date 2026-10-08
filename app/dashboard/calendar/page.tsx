import { ActivityType, type Department, RequestStatus, RequestType, Role, TaskStatus } from "@prisma/client";
import { getVenueDepartments, showsInDepartment, staffDepartments } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import { visibleOnBoard } from "@/lib/note-visibility";
import { buildNoteMeta } from "@/lib/note-list-format";
import { describeTaskRepeat } from "@/lib/task-recurrence";
import { describeAssignees, groupSharedTasks } from "@/lib/task-groups";
import { canReviewOperationalRequests } from "@/lib/permissions";
import { buildShiftPresets } from "@/lib/shift-presets";
import { parseDateTimeLocal } from "@/lib/date-time-local";
import { toDateInputValueInTimeZone } from "@/lib/time-zone";
import { serializeDay, toDayKey } from "@/lib/day-key";
import { getDashboardContext } from "../context";
import { BillingRequiredState, EmptyState, Panel, Stack } from "../ui";
import { DayActionCalendarClient } from "./day-action-calendar-client";
import { OwnerCalendarClient } from "./owner-calendar-client";
import { PublishWeekPanel } from "./publish-week-panel";
import { ClassicViewBack, DesktopWeekPlanner } from "./desktop-planner";
import { ScrollToTodayButton } from "./scroll-to-today-button";
import { DepartmentBar } from "./department-bar";

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

const CALENDAR_LOOKBACK_WEEKS = 1;
const CALENDAR_LOOKAHEAD_WEEKS = 3;
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
  const rawAnchor = Array.isArray(searchParams?.anchor)
    ? searchParams.anchor[0]
    : searchParams?.anchor;
  const rawDay = Array.isArray(searchParams?.day) ? searchParams.day[0] : searchParams?.day;
  const raw = rawAnchor ?? rawDay;

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

function dateKeyToLocalDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function getRangeDayKeys(start: Date, end: Date) {
  const keys: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  const limit = new Date(end);
  limit.setHours(0, 0, 0, 0);

  while (cursor <= limit) {
    keys.push(toDayKey(cursor));
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

function parseCalendarView(searchParams?: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(searchParams?.view) ? searchParams.view[0] : searchParams?.view;
  return raw === "day" ? "day" : "week";
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
      <Panel title="Turni">
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

  // Departments (Pro): which one the week below is showing. On one calendar
  // the owner starts from everyone and staff from their own department; with a
  // calendar per department, staff and leads only ever see their own.
  const departments = await getVenueDepartments(activeBarId, session.user.id);
  const managesVenue = role === Role.OWNER || role === Role.MANAGER;
  // Jolly has no tab: its shifts and notes show in every department.
  const departmentIds = staffDepartments(departments.list).map((entry) => entry.id);
  const rawDepartment = Array.isArray(params?.rep) ? params.rep[0] : params?.rep;
  const requestedDepartment = departmentIds.find((id) => id === rawDepartment) ?? null;
  const ownDepartment = departmentIds.find((id) => id === departments.mine.department) ?? null;
  const separateCalendars = departments.enabled && departments.mode === "SEPARATE";
  // A department lead manages the shifts of their department and sees that
  // department only, on either kind of calendar.
  const leadsDepartment = departments.enabled && !managesVenue && departments.mine.isLead && Boolean(ownDepartment);
  const lockedToOwnDepartment = (separateCalendars && !managesVenue && Boolean(ownDepartment)) || leadsDepartment;
  let activeDepartment: Department | null = null;
  if (departments.enabled) {
    activeDepartment = separateCalendars || leadsDepartment
      ? lockedToOwnDepartment
        ? ownDepartment
        : requestedDepartment ?? ownDepartment ?? departmentIds[0] ?? null
      : rawDepartment === "TUTTI"
        ? null
        : requestedDepartment ?? (managesVenue ? null : ownDepartment);
  }
  const departmentInfo = (id: Department | null | undefined) =>
    departments.enabled && id ? departments.list.find((entry) => entry.id === id) ?? null : null;

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
  const canSeePrivateRequestDetails = canReviewOperationalRequests(role as Role);
  const canReviewCompanyRequests =
    features.requests && !isRestaurant && canSeePrivateRequestDetails;

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
          department: true,
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
        department: null,
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
              department: true,
              helpsIn: true,
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
                  requiresConfirmation: true,
                  repeatEvery: true,
                  repeatUnit: true,
                  department: true,
                  completedAt: true,
                  createdAt: true,
                  assignedToAll: true,
                  assignedTo: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                  createdBy: {
                    select: {
                      id: true,
                      firstName: true,
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
                  AND: [
                    visibleOnBoard(),
                    {
                      OR: [
                        {
                          activityDate: {
                            gte: calendarStart,
                            lte: calendarEnd,
                          },
                        },
                        {
                          activityDate: null,
                          createdAt: {
                            gte: calendarStart,
                            lte: calendarEnd,
                          },
                        },
                      ],
                    },
                    ...(role === Role.EMPLOYEE
                      ? [
                          {
                            OR: [{ employeeId: null }, { employeeId: session.user.id }],
                          },
                        ]
                      : []),
                  ],
                      },
                orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
                select: {
                  id: true,
                  content: true,
                  isPinned: true,
                  requiresConfirmation: true,
                  activityDate: true,
                  createdAt: true,
                  employeeId: true,
                  readReceipts: {
                    where: {
                      userId: session.user.id,
                    },
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
                  _count: {
                    select: {
                      readReceipts: true,
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

  // A shift without a department of its own (made before departments, or on
  // "Tutti") belongs to the department of the first person on it.
  const memberDepartment = new Map(
    calendarMembers.map((member) => [member.user.id, member.department ?? null] as const)
  );
  const effectiveDepartment = (shift: (typeof shifts)[number]) =>
    shift.department ?? memberDepartment.get(shift.assignments[0]?.user.id ?? "") ?? null;

  for (const shift of shifts) {
    if (!showsInDepartment(effectiveDepartment(shift), activeDepartment)) {
      continue;
    }

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
    const courseStartKey = toDateInputValueInTimeZone(course.startsAt);
    const courseEndKey = toDateInputValueInTimeZone(course.endsAt);
    const visibleStartKey = toDayKey(calendarStart);
    const visibleEndKey = toDayKey(calendarEnd);
    const startKey = courseStartKey > visibleStartKey ? courseStartKey : visibleStartKey;
    const endKey = courseEndKey < visibleEndKey ? courseEndKey : visibleEndKey;

    for (const dayKey of getRangeDayKeys(dateKeyToLocalDate(startKey), dateKeyToLocalDate(endKey))) {
      const dayCourses = coursesByDay.get(dayKey) ?? [];
      dayCourses.push(course);
      coursesByDay.set(dayKey, dayCourses);
    }
  }

  for (const closure of closures) {
    const cursor = dateKeyToLocalDate(toDateInputValueInTimeZone(closure.startsAt));
    const closureEnd = dateKeyToLocalDate(toDateInputValueInTimeZone(closure.endsAt));

    while (cursor <= closureEnd) {
      const dayKey = toDayKey(cursor);
      const dayClosures = closuresByDay.get(dayKey) ?? [];
      dayClosures.push(closure);
      closuresByDay.set(dayKey, dayClosures);
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  for (const task of tasks) {
    // A note for one department shows on its calendar and on "Tutti", not on
    // the other departments' calendars. Notes for everyone show everywhere.
    if (task.department && !showsInDepartment(task.department, activeDepartment)) {
      continue;
    }

    const dayKey = toDayKey(task.dueDate);
    const dayTasks = tasksByDay.get(dayKey) ?? [];
    dayTasks.push(task);
    tasksByDay.set(dayKey, dayTasks);
  }

  for (const note of notes) {
    const dayKey = toDayKey(note.activityDate ?? note.createdAt);
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
    const dayKey = toDayKey(date);

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
    // Ancorata a mezzanotte UTC, non a quella del server: il perche sta in
    // lib/day-key.ts, insieme ai test che impediscono che ricapiti.
    date: serializeDay(day.date),
    isToday: day.date.toDateString() === today.toDateString(),
    inCurrentMonth: true,
    shifts: day.shifts.map((shift) => ({
      id: shift.id,
      title: shift.title,
      startTime: shift.startTime.toISOString(),
      endTime: shift.endTime.toISOString(),
      confirmedAt: shift.confirmedAt?.toISOString() ?? null,
      isOnCall: shift.isOnCall,
      department: departmentInfo(effectiveDepartment(shift)),
      assignments: shift.assignments.map((assignment) => ({
        id: assignment.user.id,
        firstName: assignment.user.firstName,
        lastName: assignment.user.lastName,
        role: assignment.user.role,
        isCurrentUser: assignment.user.id === session.user.id,
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
          department: departmentInfo(effectiveDepartment(shift)),
          assignments: shift.assignments.map((assignment) => ({
            id: assignment.user.id,
            firstName: assignment.user.firstName,
            lastName: assignment.user.lastName,
            role: assignment.user.role,
            isCurrentUser: assignment.user.id === session.user.id,
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
    pendingRequests: (pendingRequestsByDay.get(toDayKey(day.date)) ?? []).map((request) => ({
      id: request.id,
      type: request.type,
      firstName: request.employee.firstName,
      lastName: request.employee.lastName,
      startsAt: request.startsAt?.toISOString() ?? day.date.toISOString(),
      endsAt: request.endsAt?.toISOString() ?? request.startsAt?.toISOString() ?? day.date.toISOString(),
      reason: canSeePrivateRequestDetails ? request.reason ?? null : null,
      certificateCode: canSeePrivateRequestDetails ? request.certificateCode ?? null : null,
    })),
    courses: (coursesByDay.get(toDayKey(day.date)) ?? []).map((course) => ({
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
    closures: (closuresByDay.get(toDayKey(day.date)) ?? []).map((closure) => ({
      id: closure.id,
      title: closure.title,
      type: closure.type,
      startTime: closure.startsAt.toISOString(),
      endTime: closure.endsAt.toISOString(),
    })),
    // A note given to several people is one copy each; here it is one row,
    // with every name, and its ids together so a tick or a delete reaches all.
    tasks: groupSharedTasks(tasksByDay.get(toDayKey(day.date)) ?? []).map((group) => {
      const task = group.lead;
      const done = group.members.every((member) => member.status === TaskStatus.DONE);
      const lastDone = group.members
        .filter((member) => member.completedBy && member.completedAt)
        .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime())[0];

      return {
        id: group.ids,
        title: task.title,
        dueDate: task.dueDate.toISOString(),
        status: done ? TaskStatus.DONE : TaskStatus.TODO,
        isUrgent: task.isUrgent,
        requiresConfirmation: task.requiresConfirmation,
        // What the note's line says is worked out in one place, so it reads the
        // same here as it does on the Note page.
        meta: buildNoteMeta({
          dueDate: task.dueDate,
          done,
          urgent: task.isUrgent,
          requiresConfirmation: task.requiresConfirmation,
          repeatLabel: describeTaskRepeat(task.repeatEvery, task.repeatUnit),
          assignedLabel: task.assignedToAll ? null : describeAssignees(group.members),
          authorLabel: task.createdBy.id === session.user.id ? null : task.createdBy.firstName,
          completedBy:
            done && lastDone?.completedBy && lastDone.completedAt
              ? {
                  name: `${lastDone.completedBy.firstName} ${lastDone.completedBy.lastName}`,
                  at: lastDone.completedAt,
                }
              : null,
        }),
      };
    }),
    notes: (notesByDay.get(toDayKey(day.date)) ?? []).map((note) => ({
      id: note.id,
      content: note.content,
      isPinned: note.isPinned,
      requiresConfirmation: note.requiresConfirmation,
      employeeId: note.employeeId,
      activityDate: (note.activityDate ?? note.createdAt).toISOString(),
      createdAt: note.createdAt.toISOString(),
      authorName: `${note.author.firstName} ${note.author.lastName}`.trim(),
      confirmationCount: note._count.readReceipts,
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
  // On a computer the week is a row per person: with a department in view,
  // the rows are the people who work in it or can lend a hand there, plus
  // anyone already on one of its shifts.
  const onDepartmentShift = new Set(
    activeDepartment
      ? shifts
          .filter((shift) => showsInDepartment(effectiveDepartment(shift), activeDepartment))
          .flatMap((shift) => shift.assignments.map((entry) => entry.user.id))
      : []
  );
  // A company's people can be moved to any of its sites: one account each,
  // offered in every site's calendar, the site's own people first.
  const departmentById = new Map(memberOptions.map((option, index) => [option.id, calendarMembers[index]?.department ?? null]));
  const outsideSite = (id: string) => Number(departmentById.get(id) !== activeDepartment);
  const plannerMembers = activeDepartment && departments.kind === "sites"
    ? [...memberOptions].sort((a, b) => outsideSite(a.id) - outsideSite(b.id))
    : activeDepartment
    ? memberOptions.filter((option, index) => {
        const member = calendarMembers[index];
        return (
          member.department === activeDepartment ||
          (member.helpsIn ?? []).includes(activeDepartment) ||
          onDepartmentShift.has(option.id)
        );
      })
    : memberOptions;
  const shiftPresets = buildShiftPresets(settings);
  const initialFocusedDay = toDayKey(anchorDate);
  const initialCalendarView = parseCalendarView(params);
  const unconfirmedShiftCount = shifts.filter(
    (shift) => !shift.confirmedAt && !shift.isOnCall
  ).length;
  const canPublishShifts =
    features.shifts &&
    (role === Role.OWNER || role === Role.MANAGER) &&
    (isRestaurant || Boolean(settings?.companyShiftsEnabled));
  const publishWeekAction = canPublishShifts ? (
    <PublishWeekPanel
      rangeStart={toDayKey(calendarStart)}
      rangeEnd={toDayKey(calendarEnd)}
      pendingCount={unconfirmedShiftCount}
      variant="icon"
    />
  ) : null;
  const todayAction = <ScrollToTodayButton fallbackHref="/dashboard/calendar" variant="segment" />;

  const activeLead =
    separateCalendars && activeDepartment
      ? await prisma.employeeBar.findFirst({
          where: { barId: activeBarId, isActive: true, department: activeDepartment, isDepartmentLead: true },
          select: { user: { select: { firstName: true, lastName: true } } },
        })
      : null;
  const viewParam = Array.isArray(params?.view) ? params.view[0] : params?.view;
  const activeDepartmentInfo = departmentInfo(activeDepartment);
  const departmentBar =
    departments.enabled && features.shifts ? (
      <DepartmentBar
        departments={staffDepartments(departments.list)}
        active={activeDepartment}
        separate={separateCalendars}
        locked={lockedToOwnDepartment}
        leadWord={departments.words.lead}
        lead={
          separateCalendars && activeDepartmentInfo
            ? activeLead
              ? { name: `${activeLead.user.firstName} ${activeLead.user.lastName}`, department: activeDepartmentInfo }
              : "none"
            : null
        }
        hrefs={Object.fromEntries(
          [null, ...departmentIds].map((id) => [
            id ?? "TUTTI",
            `/dashboard/calendar?rep=${id ?? "TUTTI"}${viewParam ? `&view=${viewParam}` : ""}`,
          ])
        )}
      />
    ) : null;
  // What a new shift is filed under: on "Tutti" any department or Jolly; in a
  // department its own, or Jolly to put it on every calendar. A lead only
  // ever files shifts under their own department.
  const jolly = departments.list.find((entry) => entry.id === "JOLLY") ?? null;
  const activeInfo = departmentInfo(activeDepartment);
  const departmentPick = departments.enabled
    ? {
        list: activeInfo
          ? leadsDepartment || !jolly
            ? [activeInfo]
            : [activeInfo, jolly]
          : departments.list,
        active: activeDepartment,
        label: departments.words.One,
      }
    : null;
  // What the lead's calendar leaves out: notes, tasks, requests and publishing
  // the week stay with the owner and the managers.
  const leadFeatures = { ...features, tasks: false, noticeBoard: false, requests: false, availability: false };

  return (
    <Stack className="dashboard-calendar-page" columns="minmax(0, 1fr)">
      <Panel title={features.shifts ? "Turni" : "Calendario"}>
        {departmentBar}
        {canManageRestaurantShifts ? (
          <>
          {/* On a computer the week is a grid of people and days; the phone
              keeps its calendar. Which one shows is decided in CSS at 1100px,
              in desktop-planner.tsx. */}
          <ClassicViewBack />
          <div className="wbp-desktop-only">
            <DesktopWeekPlanner
              days={serializedDays}
              members={plannerMembers}
              presets={shiftPresets}
              locale={locale}
              currentUserId={session.user.id}
              initialDayKey={initialFocusedDay}
              departmentPick={departmentPick}
            />
          </div>
          <div className="wbp-phone-only">
          <OwnerCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            members={memberOptions}
            presets={shiftPresets}
            filteredDay={dayFilter}
            initialFocusedDay={initialFocusedDay}
            initialCalendarView={initialCalendarView}
            role={String(role)}
            currentUserId={session.user.id}
            features={features}
            todayAction={todayAction}
            publishAction={publishWeekAction}
            departmentPick={departmentPick}
          />
          </div>
          </>
        ) : leadsDepartment && features.shifts && isRestaurant ? (
          <>
          <ClassicViewBack />
          <div className="wbp-desktop-only">
            <DesktopWeekPlanner
              days={serializedDays}
              members={plannerMembers}
              presets={shiftPresets}
              locale={locale}
              currentUserId={session.user.id}
              initialDayKey={initialFocusedDay}
              mode="view"
            />
          </div>
          <div className="wbp-phone-only">
          <OwnerCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            members={memberOptions}
            presets={shiftPresets}
            filteredDay={dayFilter}
            initialFocusedDay={initialFocusedDay}
            initialCalendarView={initialCalendarView}
            role={String(role)}
            currentUserId={session.user.id}
            features={leadFeatures}
            todayAction={todayAction}
            publishAction={null}
            departmentPick={departmentPick}
          />
          </div>
          </>
        ) : features.shifts && role === Role.EMPLOYEE ? (
          <>
          <ClassicViewBack />
          <div className="wbp-desktop-only">
            <DesktopWeekPlanner
              days={serializedDays}
              members={plannerMembers}
              presets={shiftPresets}
              locale={locale}
              currentUserId={session.user.id}
              initialDayKey={initialFocusedDay}
              mode="view"
            />
          </div>
          <div className="wbp-phone-only">
          <DayActionCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            filteredDay={dayFilter}
            initialFocusedDay={initialFocusedDay}
            initialCalendarView={initialCalendarView}
            role={String(role)}
            activityType={activeBarActivityType ?? ActivityType.RESTAURANT}
            companyShiftsEnabled={Boolean(settings?.companyShiftsEnabled)}
            members={memberOptions}
            presets={shiftPresets}
            currentUserId={session.user.id}
            features={features}
            todayAction={todayAction}
            publishAction={publishWeekAction}
          />
          </div>
          </>
        ) : (
          <DayActionCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            filteredDay={dayFilter}
            initialFocusedDay={initialFocusedDay}
            initialCalendarView={initialCalendarView}
            role={String(role)}
            activityType={activeBarActivityType ?? ActivityType.RESTAURANT}
            companyShiftsEnabled={Boolean(settings?.companyShiftsEnabled)}
            members={memberOptions}
            presets={shiftPresets}
            currentUserId={session.user.id}
            features={features}
            todayAction={todayAction}
            publishAction={publishWeekAction}
          />
        )}
      </Panel>
    </Stack>
  );
}
