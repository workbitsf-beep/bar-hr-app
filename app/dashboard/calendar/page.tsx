import Link from "next/link";
import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDashboardContext } from "../context";
import { ClockActionsPanel } from "../timelogs/timelogs-client";
import { BillingRequiredState, EmptyState, Panel, PrimaryButton, Stack, TextInput } from "../ui";
import { DayActionCalendarClient } from "./day-action-calendar-client";
import { OwnerCalendarClient } from "./owner-calendar-client";
import { PublishWeekPanel } from "./publish-week-panel";

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

function parseMonth(searchParams?: Record<string, string | string[] | undefined>) {
  const now = new Date();
  const monthRaw = Array.isArray(searchParams?.month)
    ? searchParams.month[0]
    : searchParams?.month;
  const yearRaw = Array.isArray(searchParams?.year)
    ? searchParams.year[0]
    : searchParams?.year;
  const month = Number(monthRaw ?? now.getMonth() + 1);
  const year = Number(yearRaw ?? now.getFullYear());

  const safeMonth =
    Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1;
  const safeYear =
    Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : now.getFullYear();

  return { month: safeMonth, year: safeYear };
}

function startOfCalendarMonth(year: number, month: number) {
  const firstDay = new Date(year, month - 1, 1);
  const day = firstDay.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfCalendarMonth(year: number, month: number) {
  const start = startOfCalendarMonth(year, month);
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getMonthNavigation(year: number, month: number) {
  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);

  return {
    prev: { year: prev.getFullYear(), month: prev.getMonth() + 1 },
    next: { year: next.getFullYear(), month: next.getMonth() + 1 },
  };
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
  const { month, year } = parseMonth(params);
  const dayFilter = parseDayFilter(params);
  const calendarStart = startOfCalendarMonth(year, month);
  const calendarEnd = endOfCalendarMonth(year, month);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const navigation = getMonthNavigation(year, month);
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
      role === Role.OWNER || !isRestaurant
        ? Promise.resolve(null)
        : prisma.barSettings.findUnique({
            where: { barId: activeBarId },
            select: {
              gpsLatitude: true,
              gpsLongitude: true,
              gpsRadius: true,
              roundingEnabled: true,
              roundingMinutes: true,
              roundingMode: true,
            },
          }),
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

  const days = Array.from({ length: 42 }, (_, index) => {
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
    isToday: day.date.toDateString() === new Date().toDateString(),
    inCurrentMonth: day.date >= monthStart && day.date <= monthEnd,
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
  const unconfirmedShiftCount = shifts.filter(
    (shift) => !shift.confirmedAt && shift.startTime <= monthEnd && shift.endTime >= monthStart
  ).length;
  const canPublishShifts = canManageShifts;

  return (
    <Stack columns="minmax(0, 1fr)">
      {isRestaurant && role !== Role.OWNER ? (
        <ClockActionsPanel role={role} settings={settings} compact />
      ) : null}

      <Panel
        title={new Intl.DateTimeFormat(locale, {
          month: "long",
          year: "numeric",
        }).format(monthStart)}
        action={
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link
                href={`/dashboard/calendar?month=${navigation.prev.month}&year=${navigation.prev.year}`}
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 42,
                  height: 42,
                  borderRadius: 999,
                  background: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                }}
              >
                {"<"}
              </Link>
              <Link
                href="/dashboard/calendar"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 64,
                  height: 42,
                  padding: "0 14px",
                  borderRadius: 999,
                  background: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                }}
              >
                Oggi
              </Link>
              <Link
                href={`/dashboard/calendar?month=${navigation.next.month}&year=${navigation.next.year}`}
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 42,
                  height: 42,
                  borderRadius: 999,
                  background: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #e2e8f0",
                  fontWeight: 700,
                }}
              >
                {">"}
              </Link>
            </div>

            <form
              method="get"
              className="dashboard-desktop-only"
              style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
            >
              <input type="hidden" name="month" value={month} />
              <input type="hidden" name="year" value={year} />
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
                <Link href={`/dashboard/calendar?month=${month}&year=${year}`} style={{ textDecoration: "none" }}>
                  <PrimaryButton type="button" tone="sand">
                    Reset
                  </PrimaryButton>
                </Link>
              ) : null}
            </form>

            {canPublishShifts ? (
              <PublishWeekPanel
                rangeStart={toLocalDateKey(monthStart)}
                rangeEnd={toLocalDateKey(monthEnd)}
                pendingCount={unconfirmedShiftCount}
              />
            ) : null}
          </div>
        }
      >
        {canManageShifts ? (
          <OwnerCalendarClient
            locale={locale}
            weekdayLabels={weekdayLabels}
            days={serializedDays}
            members={memberOptions}
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
