import Link from "next/link";
import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildShiftPresets } from "@/lib/shift-presets";
import { getDashboardContext } from "../context";
import { ClockActionsPanel } from "../timelogs/timelogs-client";
import { BillingRequiredState, EmptyState, Panel, PrimaryButton, Stack, TextInput } from "../ui";
import { DayActionCalendarClient } from "./day-action-calendar-client";
import { OwnerCalendarClient } from "./owner-calendar-client";
import { PublishWeekPanel } from "./publish-week-panel";
import { ScrollToTodayButton } from "./scroll-to-today-button";

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

  const parsed = new Date(`${raw}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  parsed.setHours(0, 0, 0, 0);
  return parsed;
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

export default async function DashboardCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const { session, role, language, activeBarId, activeBarActivityType, billingStatus } =
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

  const locale = getLocale(language);
  const dayFilter = parseDayFilter(params);
  const anchorDate = parseAnchorDate(params);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const calendarStart = startOfCalendarWeek(addDays(anchorDate, -7 * 20));
  const calendarEnd = endOfCalendarWeek(addDays(anchorDate, 7 * 32));
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonthEnd = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  const isRestaurant = activeBarActivityType === ActivityType.RESTAURANT;
  const canManageShifts = isRestaurant && (role === Role.OWNER || role === Role.MANAGER);
  const canReviewCompanyRequests = !isRestaurant && role === Role.OWNER;
  const canAssignCompanyCourses = !isRestaurant && role === Role.OWNER;

  const [
    settings,
    shifts,
    availabilities,
    approvedRequests,
    pendingRequests,
    courses,
    calendarMembers,
    tasks,
    notes,
  ] =
    await Promise.all([
      isRestaurant
        ? prisma.barSettings.findUnique({
            where: { barId: activeBarId },
            select: {
              gpsLatitude: true,
              gpsLongitude: true,
              gpsRadius: true,
              roundingEnabled: true,
              roundingMinutes: true,
              roundingMode: true,
              morningStartTime: true,
              morningEndTime: true,
              afternoonStartTime: true,
              afternoonEndTime: true,
              eveningStartTime: true,
              eveningEndTime: true,
            },
          })
        : Promise.resolve(null),
      isRestaurant
        ? prisma.shift.findMany({
            where: {
              barId: activeBarId,
              startTime: {
                lte: calendarEnd,
              },
              endTime: {
                gte: calendarStart,
              },
            },
            orderBy: {
              startTime: "asc",
            },
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
          })
        : Promise.resolve([]),
      isRestaurant
        ? prisma.availability.findMany({
            where: {
              barId: activeBarId,
              startsAt: {
                lte: calendarEnd,
              },
              endsAt: {
                gte: calendarStart,
              },
            },
            select: {
              id: true,
              startsAt: true,
              endsAt: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
            orderBy: {
              startsAt: "asc",
            },
          })
        : Promise.resolve([]),
      prisma.request.findMany({
        where: {
          barId: activeBarId,
          type: {
            in: [RequestType.VACATION, RequestType.PERMISSION, RequestType.SICKNESS],
          },
          status: RequestStatus.APPROVED,
          startsAt: {
            lte: calendarEnd,
          },
          endsAt: {
            gte: calendarStart,
          },
        },
        select: {
          id: true,
          type: true,
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
        orderBy: {
          startsAt: "asc",
        },
      }),
      canReviewCompanyRequests
        ? prisma.request.findMany({
            where: {
              barId: activeBarId,
              type: {
                in: [RequestType.VACATION, RequestType.PERMISSION, RequestType.SICKNESS],
              },
              status: RequestStatus.PENDING,
              startsAt: {
                lte: calendarEnd,
              },
              endsAt: {
                gte: calendarStart,
              },
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
            orderBy: {
              startsAt: "asc",
            },
          })
        : Promise.resolve([]),
      !isRestaurant
        ? prisma.course.findMany({
            where: {
              barId: activeBarId,
              startsAt: {
                lte: calendarEnd,
              },
              endsAt: {
                gte: calendarStart,
              },
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
            orderBy: {
              startsAt: "asc",
            },
          })
        : Promise.resolve([]),
      canManageShifts
        ? prisma.employeeBar.findMany({
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
          })
        : canAssignCompanyCourses
          ? prisma.employeeBar.findMany({
              where: {
                barId: activeBarId,
                isActive: true,
                role: {
                  not: Role.OWNER,
                },
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
            })
          : Promise.resolve([]),
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
      prisma.note.findMany({
        where: {
          barId: activeBarId,
          createdAt: {
            gte: calendarStart,
            lte: calendarEnd,
          },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
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
    ]);

  const shiftsByDay = new Map<string, typeof shifts>();
  const availabilitiesByDay = new Map<string, typeof availabilities>();
  const requestsByDay = new Map<string, typeof approvedRequests>();
  const pendingRequestsByDay = new Map<string, typeof pendingRequests>();
  const coursesByDay = new Map<string, typeof courses>();
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
      assignments: shift.assignments.map((assignment) => ({
        id: assignment.user.id,
        firstName: assignment.user.firstName,
        lastName: assignment.user.lastName,
        role: assignment.user.role,
      })),
    })),
    availabilities: day.availabilities.map((availability) => ({
      id: availability.id,
      firstName: availability.user.firstName,
      lastName: availability.user.lastName,
    })),
    requests: day.requests.map((request) => ({
      id: request.id,
      type: request.type,
      firstName: request.employee.firstName,
      lastName: request.employee.lastName,
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
      reason: request.reason ?? null,
      certificateCode: request.certificateCode ?? null,
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
      createdAt: note.createdAt.toISOString(),
      authorName: `${note.author.firstName} ${note.author.lastName}`.trim(),
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
    (shift) =>
      !shift.confirmedAt &&
      shift.startTime <= currentMonthEnd &&
      shift.endTime >= currentMonthStart
  ).length;
  const canPublishShifts = canManageShifts;

  return (
    <Stack columns="minmax(0, 1fr)">
      {isRestaurant && role !== Role.OWNER ? (
        <ClockActionsPanel role={role} settings={settings} compact />
      ) : null}

      <Panel
        title="Calendario"
        action={
          <div style={{ display: "grid", gap: 10 }}>
            <form
              method="get"
              className="dashboard-desktop-only"
              style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
            >
              <TextInput
                type="date"
                name="day"
                defaultValue={dayFilter ?? ""}
                aria-label="Cerca giorno"
                style={{ minWidth: 180 }}
              />
              <PrimaryButton type="submit" tone="sand">
                Cerca giorno
              </PrimaryButton>
              {dayFilter ? (
                <Link href="/dashboard/calendar" style={{ textDecoration: "none" }}>
                  <PrimaryButton type="button" tone="sand">
                    Reset
                  </PrimaryButton>
                </Link>
              ) : null}
            </form>

            {canPublishShifts ? (
              <PublishWeekPanel
                before={<ScrollToTodayButton fallbackHref="/dashboard/calendar" />}
                rangeStart={toLocalDateKey(currentMonthStart)}
                rangeEnd={toLocalDateKey(currentMonthEnd)}
                pendingCount={unconfirmedShiftCount}
              />
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ScrollToTodayButton fallbackHref="/dashboard/calendar" />
              </div>
            )}
          </div>
        }
      >
        {canManageShifts ? (
          <OwnerCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            members={memberOptions}
            presets={shiftPresets}
            filteredDay={dayFilter}
            role={String(role)}
          />
        ) : (
          <DayActionCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            filteredDay={dayFilter}
            role={String(role)}
            activityType={activeBarActivityType ?? ActivityType.RESTAURANT}
            members={memberOptions}
          />
        )}
      </Panel>
    </Stack>
  );
}
