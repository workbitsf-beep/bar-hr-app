import { Fragment, type ReactNode } from "react";
import { PopupAction } from "./popup-action";
import { costsEnabledFor } from "@/lib/costs/access";
import { HOME_BLOCKS, HOME_EXTRA, homeChoices, resolveHomeBlocks, type HomeBlockKey, type HomeProfile } from "@/lib/home-blocks";
import { HomeEditor } from "./home-editor";
import { HomeAbsencesWidget, HomeCostsWidget, HomeDeadlinesWidget, HomePricesWidget, HomeStaffWidget } from "./home-extra-blocks";
import { BillingRequired } from "./billing-required";
import { RequestStatus, RequestType, Role, type Department } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { visibleOnBoard } from "@/lib/note-visibility";
import { getDashboardKpiData } from "@/lib/dashboard-kpi";
import { buildDailyTotals, buildMonthlyTotals } from "@/lib/reporting";
import { getDashboardContext } from "./context";
import { reviewRequestAction } from "./actions";
import { KpiDashboard } from "./kpi-dashboard";
import { CrewBoard } from "./crew-board";
import { ChecklistsCard } from "./checklists";
import { getTodayChecklists } from "@/lib/checklists";
import { DepartmentDot } from "./department-forms";
import { getVenueDepartments, staffDepartments } from "@/lib/departments";
import { DesktopToday } from "./desktop-today";
import { ClockFixEmployee, ClockFixReview } from "./clock-fix";
import { CrewSwipe, TodayShiftAdd } from "./today-crew";
import { clockPlaceFor } from "@/lib/clock-points";
import { can, hasWholeScope, scopeOf } from "@/lib/staff-permissions";
import { memberScopeWhere, shiftScopeWhere, userScopeWhere } from "@/lib/staff-scope";
import { getClockFixesForReview, getEmployeeClockFixState } from "@/lib/clock-fixes";
import { ShoppingListQuickAdd } from "./shopping-list-quick-add";
import { WorkHoursRing } from "./work-hours-ring";
import { ClockActionsPanel, type ClockActionStatus } from "./timelogs/timelogs-client";
import {
  EmptyState,
  Panel,
  PrimaryButton,
  Stack,
} from "./ui";
import { toTimeInputValueInTimeZone, toDateInputValueInTimeZone } from "@/lib/time-zone";
import { findAssignedShiftForClockIn } from "@/lib/clockable-shift";
import { INTERNAL_NOTIFICATION_TYPES } from "@/lib/notifications";
import { formatDateInTimeZone } from "@/lib/time-zone";
import { ActionForm } from "@/app/components/action-form";
import { roundWhite } from "./round-button";

function requestTypeLabel(type: RequestType) {
  if (type === RequestType.VACATION) return "Ferie";
  if (type === RequestType.PERMISSION) return "Permesso";
  if (type === RequestType.SHIFT_CHANGE) return "Cambio turno";
  if (type === RequestType.OVERTIME) return "Straordinario";
  return "Assenza";
}

function startOfNextWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const daysUntilNextMonday = ((8 - day) % 7) || 7;
  start.setDate(start.getDate() + daysUntilNextMonday);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Monday, because that is where a work week starts here. */
function startOfWeek(date: Date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

const WEEKDAY_LABELS = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/**
 * When a request is for, as the owner reads it: "lun 20 ott · 09:00–13:00"
 * for a few hours, "20–21 ott · 2 giorni" for whole days. It showed
 * "2026-10-20 · 00:00-23:59", and a two-day holiday as its first day only.
 */
function describeRequestWhen(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt) return "Data non indicata";
  const day = (value: Date, withWeekday = true) =>
    new Intl.DateTimeFormat("it-IT", {
      ...(withWeekday ? { weekday: "short" as const } : {}),
      day: "numeric",
      month: "short",
      timeZone: "Europe/Rome",
    }).format(value);
  if (!endsAt) return day(startsAt);
  const startDay = toDateInputValueInTimeZone(startsAt);
  const endDay = toDateInputValueInTimeZone(endsAt);
  const startTime = toTimeInputValueInTimeZone(startsAt);
  const endTime = toTimeInputValueInTimeZone(endsAt);
  const wholeDays = startTime === "00:00" && (endTime === "23:59" || endTime === "00:00");
  if (startDay === endDay) return wholeDays ? `${day(startsAt)} · tutto il giorno` : `${day(startsAt)} · ${startTime}–${endTime}`;
  const days = Math.round((Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86400000) + 1;
  return `${day(startsAt, false)} – ${day(endsAt, false)} · ${days} giorni`;
}

export default async function DashboardPage() {
  const { session, role, staff, activeBarId, activeBarName, activeBarActivityType, billingStatus, features } =
    await getDashboardContext();
  // Pro: the departments, for the tiles over the crew and the week's bars.
  const departments = await getVenueDepartments(activeBarId, session.user.id);
  // Pro: today's opening and closing checklists this person can see.
  const todayChecklists =
    departments.enabled && activeBarId ? await getTodayChecklists(activeBarId, session.user.id, staff) : [];

  if (String(role) === "SUPER_ADMIN") {
    redirect("/dashboard/super-admin");
  }

  if (!activeBarId) {
    return (
      <Panel title="Dashboard">
        <EmptyState message="Seleziona un locale attivo per visualizzare i dati operativi." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequired role={String(role)} />;
  }

  const homeProfile: HomeProfile = role === Role.OWNER ? "owner" : "staff";
  const homeLayout = await prisma.homeLayout.findUnique({
    where: { userId_barId: { userId: session.user.id, barId: activeBarId } },
    select: { blocks: true },
  });
  const homeBlocks = resolveHomeBlocks(homeLayout?.blocks ?? null, homeProfile);

  const now = new Date();
  // What this person runs, as the owner chose (lib/staff-permissions); staff
  // over some departments or sites see their own people only.
  const canShifts = can(staff, "shifts");
  const canRequests = can(staff, "requests");
  const canTimelogs = can(staff, "timelogs");
  const seesCrew = canShifts || canTimelogs;
  const peopleInScope = userScopeWhere(staff, activeBarId);
  const isOwner = role === Role.OWNER;
  const isOperationalProfile = !isOwner;
  const showKpi =
    seesCrew &&
    (features.shifts ||
      features.requests ||
      features.availability ||
      features.tasks ||
      features.noticeBoard ||
      features.courses);

  const kpiDataPromise =
    showKpi && activeBarId
      ? getDashboardKpiData(activeBarId, activeBarActivityType)
      : Promise.resolve(null);

  const [
    settings,
    shifts,
    ownHours,
    todayHours,
    monthClockIns,
    latestTimeLog,
    kpiData,
    pendingApprovalRequests,
    nextWeekShifts,
    assignedShiftForClockIn,
    crewShiftsToday,
    barOwners,
    crewTimeLogsToday,
    shoppingItems,
    myWeekShifts,
    unseenRequestOutcomes,
    openTaskCount,
    unreadNoteCount,
    upcomingCourse,
  ] = await Promise.all([
    isOperationalProfile && features.timeTracking
      ? prisma.barSettings.findUnique({
          where: { barId: activeBarId },
          select: {
            gpsLatitude: true,
            gpsLongitude: true,
            gpsRadius: true,
            roundingEnabled: true,
            roundingMinutes: true,
            roundingMode: true,
          },
        })
      : Promise.resolve(null),
    isOperationalProfile && features.shifts
      ? prisma.shift.findMany({
          where: {
            barId: activeBarId,
            assignments: {
              some: {
                userId: session.user.id,
              },
            },
            endTime: {
              gte: now,
            },
          },
          orderBy: {
            startTime: "asc",
          },
          take: 6,
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            assignments: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    isOperationalProfile && features.timeTracking
      ? buildMonthlyTotals(activeBarId, session.user.id, now.getMonth() + 1, now.getFullYear())
      : Promise.resolve(null),
    // Closed sessions only: the one still open is added live by the ring.
    isOperationalProfile && features.timeTracking
      ? buildDailyTotals(activeBarId, session.user.id, now)
      : Promise.resolve(null),
    // Entries only, to count the days actually worked this month.
    isOperationalProfile && features.timeTracking
      ? prisma.timeLog.findMany({
          where: {
            barId: activeBarId,
            userId: session.user.id,
            type: "IN",
            timestamp: { gte: new Date(now.getFullYear(), now.getMonth(), 1) },
          },
          select: { timestamp: true },
        })
      : Promise.resolve([]),
    isOperationalProfile && features.timeTracking
      ? prisma.timeLog.findFirst({
          where: {
            barId: activeBarId,
            userId: session.user.id,
          },
          orderBy: {
            timestamp: "desc",
          },
          select: {
            type: true,
            timestamp: true,
            shift: {
              select: {
                startTime: true,
                endTime: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    kpiDataPromise,
    canRequests && features.requests
      ? prisma.request.findMany({
          where: {
            barId: activeBarId,
            status: RequestStatus.PENDING,
            employee: peopleInScope,
            // Someone's own request is answered by someone else.
            employeeId: { not: session.user.id },
            type: {
              not: RequestType.SICKNESS,
            },
            OR: [
              {
                type: {
                  not: RequestType.SHIFT_CHANGE,
                },
              },
              {
                type: RequestType.SHIFT_CHANGE,
                peerStatus: RequestStatus.APPROVED,
              },
            ],
          },
          orderBy: {
            createdAt: "asc",
          },
          take: 5,
          select: {
            id: true,
            type: true,
            startsAt: true,
            endsAt: true,
            reason: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    // The days that carry at least one shift matter more than how many shifts
    // there are: five shifts spread over five days is a covered week, five on
    // one day is not.
    isOwner && features.shifts
      ? prisma.shift.findMany({
          where: {
            barId: activeBarId,
            startTime: {
              gte: startOfNextWeek(now),
              lt: addDays(startOfNextWeek(now), 7),
            },
          },
          select: { startTime: true },
        })
      : Promise.resolve([]),
    isOperationalProfile && features.timeTracking && features.shifts
      ? findAssignedShiftForClockIn({
          barId: activeBarId,
          userId: session.user.id,
          now,
        })
      : Promise.resolve(null),
    seesCrew && features.shifts
      ? prisma.shift.findMany({
          where: {
            barId: activeBarId,
            ...shiftScopeWhere(staff, activeBarId),
            // Last night's shift still running past midnight is part of now.
            OR: [
              {
                startTime: {
                  gte: startOfDay(now),
                  lt: addDays(startOfDay(now), 1),
                },
              },
              { startTime: { lt: startOfDay(now) }, endTime: { gt: now } },
            ],
          },
          orderBy: { startTime: "asc" },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            department: true,
            isOnCall: true,
            assignments: {
              select: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    // Owners do not clock: the roster must not hold them as expected to.
    seesCrew
      ? prisma.bar.findUnique({
          where: { id: activeBarId },
          select: {
            ownerId: true,
            memberships: {
              where: { role: Role.OWNER, isActive: true },
              select: { userId: true },
            },
          },
        })
      : Promise.resolve(null),
    seesCrew && features.timeTracking
      ? prisma.timeLog.findMany({
          where: {
            barId: activeBarId,
            user: peopleInScope,
            timestamp: {
              gte: addDays(startOfDay(now), -1),
              lt: addDays(startOfDay(now), 1),
            },
          },
          orderBy: { timestamp: "asc" },
          select: { userId: true, type: true, timestamp: true },
        })
      : Promise.resolve([]),
    features.shoppingList
      ? prisma.shoppingListItem.findMany({
          where: { barId: activeBarId },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            quantity: true,
            department: true,
            createdBy: { select: { firstName: true } },
          },
        })
      : Promise.resolve([]),
    isOperationalProfile && features.shifts
      ? prisma.shift.findMany({
          where: {
            barId: activeBarId,
            assignments: { some: { userId: session.user.id } },
            startTime: {
              gte: startOfWeek(now),
              lt: addDays(startOfWeek(now), 7),
            },
          },
          orderBy: { startTime: "asc" },
          select: { id: true, startTime: true, endTime: true, isOnCall: true, department: true },
        })
      : Promise.resolve([]),
    // An unread notice of a reviewed request is exactly "an answer you have
    // not seen yet" — no new bookkeeping needed, and it goes away by itself
    // once read.
    isOperationalProfile && features.requests
      ? prisma.notification.findMany({
          where: {
            userId: session.user.id,
            barId: activeBarId,
            read: false,
            type: {
              in: [
                INTERNAL_NOTIFICATION_TYPES.REQUEST_REVIEWED,
                INTERNAL_NOTIFICATION_TYPES.GENERIC_REQUEST_REVIEWED,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: { id: true, title: true, message: true, actionUrl: true },
        })
      : Promise.resolve([]),
    // Due today or already late: a task whose day has passed is the one most
    // worth showing, and the old window hid exactly those.
    isOperationalProfile && features.tasks
      ? prisma.task.count({
          where: {
            barId: activeBarId,
            status: { not: "DONE" },
            dueDate: { lt: addDays(startOfDay(now), 1) },
            OR: [{ assignedToId: session.user.id }, { assignedToAll: true }],
          },
        })
      : Promise.resolve(0),
    isOperationalProfile && features.noticeBoard
      ? prisma.note.count({
          where: {
            barId: activeBarId,
            createdAt: { gte: addDays(now, -30) },
            readReceipts: { none: { userId: session.user.id } },
            // Only what is still on the board: an archived note cannot be
            // opened, so it must not count as one waiting to be read.
            AND: [
              { OR: [{ employeeId: null }, { employeeId: session.user.id }] },
              visibleOnBoard(now),
            ],
          },
        })
      : Promise.resolve(0),
    isOperationalProfile && features.courses
      ? prisma.course.findFirst({
          where: {
            barId: activeBarId,
            startsAt: { gte: now, lt: addDays(now, 14) },
            OR: [{ assignedToId: session.user.id }, { assignedToAll: true }],
          },
          orderBy: { startsAt: "asc" },
          select: { id: true, title: true, startsAt: true },
        })
      : Promise.resolve(null),
  ]);

  // Forgotten entries and exits: what the person can report, what waits for
  // approval, and - for the owner and managers - what is theirs to approve.
  // Where this person clocks in: the venue's point, or their company site's.
  const clockPlace =
    isOperationalProfile && features.timeTracking && activeBarId
      ? await clockPlaceFor({
          barId: activeBarId,
          userId: session.user.id,
          shiftDepartment: assignedShiftForClockIn?.department ?? null,
        })
      : null;
  const clockSettings =
    settings && clockPlace?.points.length
      ? { ...settings, gpsLatitude: clockPlace.points[0].latitude, gpsLongitude: clockPlace.points[0].longitude }
      : settings;

  const [clockFix, clockFixesToReview, venueOwner] = await Promise.all([
    isOperationalProfile && features.timeTracking && activeBarId
      ? getEmployeeClockFixState(activeBarId, session.user.id, now)
      : Promise.resolve(null),
    canTimelogs && features.timeTracking && activeBarId
      ? getClockFixesForReview(activeBarId, peopleInScope, isOwner ? undefined : session.user.id)
      : Promise.resolve([]),
    isOperationalProfile && features.timeTracking && activeBarId
      ? prisma.bar.findUnique({ where: { id: activeBarId }, select: { owner: { select: { firstName: true } } } })
      : Promise.resolve(null),
  ]);
  const reviewBlock = clockFixesToReview.length > 0 ? <ClockFixReview items={clockFixesToReview} /> : null;

  const todayKey = toDateInputValueInTimeZone(now);
  const todayShift = shifts.find((shift) => toDateInputValueInTimeZone(shift.startTime) === todayKey);
  const nextShift =
    shifts.find((shift) => shift.id !== todayShift?.id) ??
    ({
      id: "__empty",
      title: "",
      startTime: now,
      endTime: now,
      assignments: [],
    } as (typeof shifts)[number]);
  const todayColleagues =
    todayShift?.assignments
      .filter((entry) => entry.user.id !== session.user.id)
      .map((entry) => `${entry.user.firstName} ${entry.user.lastName}`) ?? [];
  // A forgotten exit sent for approval closes the entry for the clock; a
  // forgotten entry sent for approval opens it, from the time declared.
  // An entry left open since yesterday is not closed with Esci: the person
  // reports when they left, and the button offers today's entry.
  const entryOpen = latestTimeLog?.type === "IN" && !clockFix?.openEntryHandedOver && !clockFix?.staleEntry;
  const declaredInAt = !entryOpen ? clockFix?.declaredInAt ?? null : null;
  const clockStatus: ClockActionStatus =
    entryOpen || declaredInAt
      ? "CAN_CLOCK_OUT"
      : "CAN_CLOCK_IN";
  const activeClockInAt = entryOpen
    ? latestTimeLog.timestamp.toISOString()
    : declaredInAt?.toISOString() ?? null;
  const timerShift = entryOpen && latestTimeLog.shift
    ? latestTimeLog.shift
    : todayShift;

  // Only the last stamp of the day decides where someone stands: an entry
  // means they are in, an exit means the shift is done, nothing at all means
  // they are still expected. Yesterday's stamps count only while an entry is
  // still open: whoever came in before midnight is in, not expected, and an
  // exit from last night says nothing about today's shift.
  const lastStampByUser = new Map<string, "IN" | "OUT">();
  const lastInAtByUser = new Map<string, Date>();
  const lastOutAtByUser = new Map<string, Date>();
  const todayStart = startOfDay(now);

  for (const log of crewTimeLogsToday) {
    if (log.timestamp >= todayStart) {
      lastStampByUser.set(log.userId, log.type);
      (log.type === "IN" ? lastInAtByUser : lastOutAtByUser).set(log.userId, log.timestamp);
    } else if (log.type === "IN") {
      lastStampByUser.set(log.userId, "IN");
      lastInAtByUser.set(log.userId, log.timestamp);
    } else {
      lastStampByUser.delete(log.userId);
    }
  }

  // A forgotten exit or entry waiting for approval: the crew shows what was
  // declared, not an entry left open for hours.
  for (const fix of clockFixesToReview) {
    if (fix.kind === "MISSED_OUT" && fix.requestedOutAt && lastStampByUser.get(fix.userId) === "IN") {
      lastStampByUser.set(fix.userId, "OUT");
      lastOutAtByUser.set(fix.userId, new Date(fix.requestedOutAt));
    } else if (fix.kind === "MISSED_IN" && fix.requestedInAt && !fix.requestedOutAt && !lastStampByUser.has(fix.userId)) {
      lastStampByUser.set(fix.userId, "IN");
      lastInAtByUser.set(fix.userId, new Date(fix.requestedInAt));
    }
  }

  const crewToday = new Map<
    string,
    {
      id: string;
      shiftId: string;
      name: string;
      initials: string;
      from: string;
      to: string;
      startTime: Date;
      endTime: Date;
      department: (typeof crewShiftsToday)[number]["department"];
    }
  >();

  // With lunch and dinner on the same day, the shift that matters is the one
  // running now, otherwise the next one, otherwise the last of the day.
  const relevance = (shift: { startTime: Date; endTime: Date }) =>
    shift.startTime <= now && shift.endTime > now ? 0 : shift.startTime > now ? 1 : 2;

  for (const shift of crewShiftsToday) {
    for (const assignment of shift.assignments) {
      // Someone on call is not expected: they join the roster once called in.
      if (shift.isOnCall && lastStampByUser.get(assignment.user.id) !== "IN") {
        continue;
      }

      const current = crewToday.get(assignment.user.id);

      if (
        current &&
        (relevance(current) < relevance(shift) ||
          (relevance(current) === relevance(shift) &&
            (relevance(shift) === 2 ? current.startTime > shift.startTime : current.startTime <= shift.startTime)))
      ) {
        continue;
      }

      crewToday.set(assignment.user.id, {
        id: assignment.user.id,
        shiftId: shift.id,
        name: `${assignment.user.firstName} ${assignment.user.lastName}`,
        initials: initialsOf(assignment.user.firstName, assignment.user.lastName),
        from: toTimeInputValueInTimeZone(shift.startTime),
        to: toTimeInputValueInTimeZone(shift.endTime),
        startTime: shift.startTime,
        endTime: shift.endTime,
        department: shift.department,
      });
    }
  }

  const crew = Array.from(crewToday.values());
  // An owner has no clock to punch, so the roster counts them as present
  // rather than waiting for something that is never going to arrive.
  const ownerIds = new Set(
    [barOwners?.ownerId, ...(barOwners?.memberships.map((entry) => entry.userId) ?? [])].filter(
      (id): id is string => Boolean(id)
    )
  );


  function minutesLabel(ms: number) {
    const minutes = Math.max(0, Math.round(ms / 60_000));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours} h${rest ? ` ${String(rest).padStart(2, "0")}` : ""}` : `${rest} min`;
  }

  // What the line says about each person, as on the computer's Oggi. The
  // owner never clocks in: during their shift they are simply "in turno",
  // never late.
  function crewStatusOf(person: (typeof crew)[number]): {
    tone: "in" | "out" | "waiting" | "late" | "next";
    label: string;
  } {
    const running = person.startTime <= now && person.endTime > now;
    const ahead = person.startTime > now;

    if (ownerIds.has(person.id)) {
      return running
        ? { tone: "in", label: "In turno" }
        : ahead
          ? { tone: "next", label: `Arriva alle ${person.from}` }
          : { tone: "out", label: "Finito" };
    }

    const stamp = lastStampByUser.get(person.id);

    if (stamp === "IN") {
      const since = lastInAtByUser.get(person.id);
      return { tone: "in", label: since ? `Dentro · ${minutesLabel(now.getTime() - since.getTime())}` : "Dentro" };
    }

    if (ahead) {
      return { tone: "next", label: `Arriva alle ${person.from}` };
    }

    if (stamp === "OUT") {
      const outAt = lastOutAtByUser.get(person.id);
      return { tone: "out", label: outAt ? `Uscito alle ${toTimeInputValueInTimeZone(outAt)}` : "Uscito" };
    }

    if (running) {
      return { tone: "late", label: `In ritardo · ${minutesLabel(now.getTime() - person.startTime.getTime())}` };
    }

    return { tone: "out", label: "Non ha timbrato" };
  }

  // Counted from the same status the rows show: the owner was counted in all
  // day long, so "1 su 2 dentro" sat over an owner already gone home.
  const crewInside = crew.filter((person) => crewStatusOf(person).tone === "in").length;

  // One cell per day of this week. A day with more than one shift shows the
  // span from the first start to the last end, which is what someone planning
  // their day actually needs to know.
  const weekStart = startOfWeek(now);
  const myWeek = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const dayKey = toDateInputValueInTimeZone(day);
    const shiftsOfDay = myWeekShifts.filter(
      (shift) => toDateInputValueInTimeZone(shift.startTime) === dayKey
    );

    return {
      key: dayKey,
      label: WEEKDAY_LABELS[index],
      dayNumber: day.getDate(),
      isToday: dayKey === todayKey,
      // Each shift kept separate: a split day is two shifts, and collapsing
      // them into the first start and the last end reads as one long one.
      slots: shiftsOfDay.map((shift) => ({
        id: shift.id,
        from: toTimeInputValueInTimeZone(shift.startTime),
        to: toTimeInputValueInTimeZone(shift.endTime),
        // Pro: where the shift is, so the week says which department too.
        department: departments.enabled
          ? departments.list.find((entry) => entry.id === (shift.department ?? departments.mine.department)) ?? null
          : null,
      })),
    };
  });

  // Pro: the departments of today's shifts, said once under the week.
  const todayDepartments = Array.from(
    new Map(
      (myWeek.find((day) => day.isToday)?.slots ?? [])
        .flatMap((slot) => (slot.department ? [[slot.department.id, slot.department] as const] : []))
    ).values()
  );

  const myWeekMinutes = myWeekShifts.reduce(
    (total, shift) => total + (shift.endTime.getTime() - shift.startTime.getTime()) / 60000,
    0
  );

  // Today's target is every shift of the day, not the one being worked. The
  // ring counts all of today's hours, so on a split day measuring them against
  // the evening shift alone turned the morning into overtime.
  // Being on call is not hours owed: it becomes hours only if the call comes.
  const todayShiftsOfMine = myWeekShifts.filter(
    (shift) => !shift.isOnCall && toDateInputValueInTimeZone(shift.startTime) === todayKey
  );
  const plannedTodayMinutes =
    todayShiftsOfMine.length > 0
      ? todayShiftsOfMine.reduce(
          (total, shift) => total + (shift.endTime.getTime() - shift.startTime.getTime()) / 60000,
          0
        )
      : timerShift
        ? (timerShift.endTime.getTime() - timerShift.startTime.getTime()) / 60000
        : 0;

  const monthWorkedDays = new Set(
    monthClockIns.map((entry) => toDateInputValueInTimeZone(entry.timestamp))
  ).size;

  const inboxCount =
    unseenRequestOutcomes.length +
    (openTaskCount > 0 ? 1 : 0) +
    (unreadNoteCount > 0 ? 1 : 0) +
    (upcomingCourse ? 1 : 0);

  const coveredNextWeekDays = new Set(
    nextWeekShifts.map((shift) => toDateInputValueInTimeZone(shift.startTime))
  ).size;
  const uncoveredNextWeekDays = 7 - coveredNextWeekDays;

  const departmentInfo = (id: (typeof crew)[number]["department"]) =>
    departments.enabled && id ? departments.list.find((entry) => entry.id === id) ?? null : null;
  // A shift with no department of its own (made before departments, or on
  // "Tutti") counts in the department of the person working it.
  const memberDepartments = departments.enabled && activeBarId
    ? new Map(
        (
          await prisma.employeeBar.findMany({
            where: { barId: activeBarId, isActive: true, department: { not: null } },
            select: { userId: true, department: true },
          })
        ).map((member) => [member.userId, member.department])
      )
    : new Map<string, (typeof crew)[number]["department"]>();

  // Who can be put on a shift today, for "Turno al volo".
  const rosterMembers =
    canShifts && features.shifts && activeBarId
      ? (
          await prisma.employeeBar.findMany({
            where: { barId: activeBarId, isActive: true, ...memberScopeWhere(staff) },
            orderBy: { hiredAt: "asc" },
            select: { department: true, user: { select: { id: true, firstName: true, lastName: true } } },
          })
        ).map((member) => ({
          id: member.user.id,
          name: `${member.user.firstName} ${member.user.lastName}`.trim(),
          department: member.department,
        }))
      : [];
  const addTodayShift = canShifts ? (
    <TodayShiftAdd
      members={rosterMembers}
      departments={departments.enabled ? staffDepartments(departments.list) : null}
      label={departments.words.One}
    />
  ) : null;

  const crewBlock =
    seesCrew && features.shifts && departments.enabled ? (
      <CrewBoard
        departments={staffDepartments(departments.list)}
        addShift={addTodayShift}
        rows={crew.map((person) => {
          const status = crewStatusOf(person);
          return {
            id: person.id,
            shiftId: person.shiftId,
            initials: person.initials,
            name: person.name,
            from: person.from,
            to: person.to,
            tone: status.tone,
            label: status.label,
            department: departmentInfo(person.department ?? memberDepartments.get(person.id) ?? null),
          };
        })}
      />
    ) : seesCrew && features.shifts ? (
      <section className="workbit-crew">
        <div className="workbit-crew-head">
          <strong>In servizio oggi</strong>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {crew.length > 0 ? (
              <span>
                {crewInside} su {crew.length} dentro
              </span>
            ) : null}
            {addTodayShift}
          </span>
        </div>

        {crew.length === 0 ? (
          <span style={{ color: "#667085", fontSize: 13.5 }}>Nessun turno programmato per oggi.</span>
        ) : (
          crew.map((person) => {
            const { tone: state, label } = crewStatusOf(person);

            // Slide right to change the hours, left to take the person off today.
            return (
              <CrewSwipe
                key={person.id}
                shiftId={person.shiftId}
                userId={person.id}
                name={person.name}
                from={person.from}
                to={person.to}
              >
                <div className="workbit-crew-person">
                  <span className="workbit-crew-avatar" aria-hidden="true">
                    {person.initials}
                  </span>
                  <span className="workbit-crew-who">
                    <b>{person.name}</b>
                    <span>
                      {person.from} – {person.to}
                    </span>
                  </span>
                  <span className={`workbit-crew-state workbit-crew-state--${state}`}>{label}</span>
                </div>
              </CrewSwipe>
            );
          })
        )}
      </section>
    ) : null;

  const cartBlock = features.shoppingList ? (
    <ShoppingListQuickAdd
      pendingCount={shoppingItems.length}
      items={shoppingItems.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        createdByName: item.createdBy?.firstName ?? "Terminale",
        department: departmentInfo(item.department),
      }))}
      departments={
        departments.enabled
          ? {
              list: staffDepartments(departments.list),
              // Staff open the list on their own department; the owner on all of it.
              initial: hasWholeScope(staff)
                ? null
                : (scopeOf(staff)?.[0] as Department | undefined) ?? departments.mine.department,
            }
          : null
      }
    />
  ) : null;

  // Set up with "Imposto dopo", or never set: nobody can clock in until the
  // owner stands in the venue and saves the point.
  const clockPointMissing =
    isOwner && features.timeTracking && activeBarId
      ? (await clockPlaceFor({ barId: activeBarId, userId: session.user.id })).points.length === 0
      : false;
  const clockPointLine = clockPointMissing ? (
    <div className="workbit-week-line workbit-week-line--warn">
      <i aria-hidden="true" />
      <span>
        <b>Dove si timbra</b>
        {" · da impostare: finché manca nessuno può timbrare"}
      </span>
      <Link href="/dashboard/settings?posizione=1">Imposta</Link>
    </div>
  ) : null;

  const weekLine =
    isOwner && features.shifts ? (
      <div
        className={`workbit-week-line${uncoveredNextWeekDays > 0 ? " workbit-week-line--warn" : ""}`}
      >
        <i aria-hidden="true" />
        <span>
          <b>Prossima settimana</b>
          {" · "}
          {uncoveredNextWeekDays === 0
            ? "tutti e 7 i giorni coperti"
            : `${uncoveredNextWeekDays} ${uncoveredNextWeekDays === 1 ? "giorno scoperto" : "giorni scoperti"}`}
        </span>
        {uncoveredNextWeekDays > 0 ? <Link href="/dashboard/calendar">Pianifica</Link> : null}
      </div>
    ) : null;

  const checklistBlock = todayChecklists.length > 0 ? <ChecklistsCard checklists={todayChecklists} /> : null;

  const clockBlock = features.timeTracking ? (
            <ClockActionsPanel
              role={role}
              settings={clockSettings}
              clockPoints={clockPlace?.points ?? null}
              personName={session.user.firstName}
              venueName={activeBarName ?? ""}
              clockStatus={clockStatus}
              hasScheduledShiftToday={Boolean(assignedShiftForClockIn) || Boolean(clockPlace?.shiftOptional)}
              activeClockInAt={activeClockInAt}
              shiftLabel={
                timerShift
                  ? `turno ${toTimeInputValueInTimeZone(timerShift.startTime)} – ${toTimeInputValueInTimeZone(timerShift.endTime)}`
                  : null
              }
              shiftEndAt={timerShift ? timerShift.endTime.toISOString() : null}
              compact
            />
          ) : null;
  const myHoursBlock = features.timeTracking && ownHours ? (
            <WorkHoursRing
              activeClockInAt={activeClockInAt}
              plannedTodayMinutes={Math.max(0, Math.round(plannedTodayMinutes))}
              closedTodayMinutes={Math.round((todayHours?.roundedHours ?? 0) * 60)}
              closedMonthMinutes={Math.round(ownHours.roundedHours * 60)}
              monthDays={monthWorkedDays}
            />
          ) : null;
  const myWeekBlock = features.shifts ? (
            <section className="workbit-week">
              <div className="workbit-week-head">
                <strong>La tua settimana</strong>
                {/* The month total lives in the ring now, where it grows with
                    the session being worked. Repeating it here said the same
                    thing twice, and one of the two was always behind. */}
                <span>
                  {myWeekShifts.length} {myWeekShifts.length === 1 ? "turno" : "turni"}
                  {myWeekMinutes > 0 ? ` · ${Math.round(myWeekMinutes / 60)}h` : ""}
                </span>
              </div>

              <div className="workbit-week-grid">
                {myWeek.map((day) => (
                  <div
                    key={day.key}
                    className={`workbit-week-day${day.isToday ? " workbit-week-day--today" : ""}${day.slots.length > 0 ? "" : " workbit-week-day--off"}`}
                  >
                    <u>{day.label}</u>
                    <s>{day.dayNumber}</s>
                    <em>
                      {day.slots.length === 0
                        ? "—"
                        : day.slots.map((slot) => (
                            <span className="workbit-week-slot" key={slot.id}>
                              {slot.department ? (
                                <span style={{ display: "flex", justifyContent: "center", marginBottom: 3 }}>
                                  <DepartmentDot department={slot.department} size={16} />
                                </span>
                              ) : null}
                              {slot.from}
                              <br />
                              {slot.to}
                            </span>
                          ))}
                    </em>
                  </div>
                ))}
              </div>

              {todayDepartments.length > 0 ? (
                <small className="workbit-week-mates" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  Oggi lavori in
                  {todayDepartments.map((department, index) => (
                    <span key={department.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 800, color: department.ink }}>
                      {index > 0 ? <span style={{ color: "#8a84a8", fontWeight: 500 }}>e</span> : null}
                      <DepartmentDot department={department} size={14} />
                      {department.name.toLowerCase()}
                    </span>
                  ))}
                </small>
              ) : null}

              {todayColleagues.length > 0 ? (
                <small className="workbit-week-mates">Oggi con te: {todayColleagues.join(", ")}</small>
              ) : null}

              {nextShift.id === "__empty" && myWeekShifts.length === 0 ? (
                <small className="workbit-week-mates">Nessun turno programmato questa settimana.</small>
              ) : null}
            </section>
          ) : null;
  const inboxBlock = (
          <section className="workbit-inbox">
            <div className="workbit-inbox-head">
              <strong>Da leggere e da fare</strong>
              {inboxCount > 0 ? (
                <span>
                  {inboxCount} {inboxCount === 1 ? "cosa" : "cose"}
                </span>
              ) : null}
            </div>

            {inboxCount === 0 ? (
              <p className="workbit-inbox-empty">
                <i aria-hidden="true" /> Nessuna comunicazione in sospeso.
              </p>
            ) : null}

            {unseenRequestOutcomes.map((outcome) => (
            <div className="workbit-home-row workbit-home-row--good" key={outcome.id}>
              <span className="workbit-home-row-icon" aria-hidden="true">
                ✅
              </span>
              <div>
                <b>{outcome.title}</b>
                {outcome.message}
              </div>
              <Link href={outcome.actionUrl || "/dashboard/requests"}>Vedi</Link>
            </div>
          ))}

          {openTaskCount > 0 ? (
            <div className="workbit-home-row">
              <span className="workbit-home-row-icon" aria-hidden="true">
                📝
              </span>
              <div>
                <b>
                  {openTaskCount} {openTaskCount === 1 ? "nota da fare" : "note da fare"}
                </b>
                in scadenza oggi o già scadute
              </div>
              <Link href="/dashboard/tasks">Vedi</Link>
            </div>
          ) : null}

          {unreadNoteCount > 0 ? (
            <div className="workbit-home-row">
              <span className="workbit-home-row-icon" aria-hidden="true">
                📌
              </span>
              <div>
                <b>
                  {unreadNoteCount}{" "}
                  {unreadNoteCount === 1 ? "promemoria da leggere" : "promemoria da leggere"}
                </b>
                in bacheca
              </div>
              <Link href="/dashboard/board">Vedi</Link>
            </div>
          ) : null}

          {upcomingCourse ? (
            <div className="workbit-home-row workbit-home-row--warn">
              <span className="workbit-home-row-icon" aria-hidden="true">
                🎓
              </span>
              <div>
                <b>{upcomingCourse.title}</b>
                {formatDateInTimeZone(upcomingCourse.startsAt)}
              </div>
              <Link href="/dashboard/courses">Vedi</Link>
            </div>
          ) : null}
          </section>
  );
  const requestsBlock = canRequests && pendingApprovalRequests.length > 0 ? (
        <Panel title="Richieste da approvare" action={`${pendingApprovalRequests.length} in attesa`}>
          <div style={{ display: "grid", gap: 10 }}>
            {pendingApprovalRequests.map((request) => (
              <div
                key={request.id}
                className="dashboard-list-card"
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 14,
                  borderRadius: 20,
                  background: "#ffffff",
                  border: "1px solid #e9d5ff",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <strong style={{ color: "#0f172a" }}>{requestTypeLabel(request.type)}</strong>
                    <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                      {request.employee.firstName} {request.employee.lastName}
                    </div>
                  </div>
                  <div style={{ color: "#475569", fontSize: 13, fontWeight: 700 }}>
                    {describeRequestWhen(request.startsAt, request.endsAt)}
                  </div>
                </div>

                {request.reason ? (
                  <div style={{ color: "#64748b", lineHeight: 1.45 }}>{request.reason}</div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ActionForm action={reviewRequestAction} success="Richiesta approvata.">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <input type="hidden" name="notifySuccess" value="1" />
                    <PrimaryButton type="submit" tone="green" style={{ minHeight: 34, paddingInline: 12 }}>
                      Approva
                    </PrimaryButton>
                  </ActionForm>
                  <ActionForm action={reviewRequestAction} success="Richiesta rifiutata.">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <input type="hidden" name="notifySuccess" value="1" />
                    <PrimaryButton type="submit" tone="red" style={{ minHeight: 34, paddingInline: 12 }}>
                      Rifiuta
                    </PrimaryButton>
                  </ActionForm>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null;
  const teamBlock = showKpi ? (
        <KpiDashboard
          activeBarId={activeBarId}
          role={role}
          activityType={activeBarActivityType}
          features={features}
          initialData={kpiData}
          departments={departments.enabled ? departments.list : null}
        />
      ) : null;
  // Oggi as this person arranged it (lib/home-blocks.ts); warnings that ask
  // for something to be done stay on top, whatever the arrangement.
  const homeBlockNodes: Record<HomeBlockKey, ReactNode> = {
    crew: crewBlock,
    checklists: checklistBlock,
    nextWeek: weekLine,
    requests: requestsBlock,
    team: teamBlock,
    costs: homeBlocks.includes("costs") ? <HomeCostsWidget barId={activeBarId} /> : null,
    absences: homeBlocks.includes("absences") ? (
      <HomeAbsencesWidget barId={activeBarId} pending={pendingApprovalRequests} employeeWhere={peopleInScope} />
    ) : null,
    prices: homeBlocks.includes("prices") ? <HomePricesWidget barId={activeBarId} /> : null,
    staffMonth: homeBlocks.includes("staffMonth") ? <HomeStaffWidget barId={activeBarId} /> : null,
    deadlines: homeBlocks.includes("deadlines") ? (
      <HomeDeadlinesWidget barId={activeBarId} courses={features.courses} notes={features.tasks} />
    ) : null,
    clock: clockBlock,
    myHours: myHoursBlock,
    myWeek: myWeekBlock,
    inbox: inboxBlock,
  };
  // What this venue can show at all: a block with nothing behind it is not offered.
  const homeAvailable: Record<HomeBlockKey, boolean> = {
    crew: Boolean(crewBlock),
    checklists: departments.enabled,
    nextWeek: isOwner && features.shifts,
    requests: canRequests && features.requests,
    team: showKpi,
    costs: isOwner && costsEnabledFor(String(role)),
    absences: canRequests && features.requests,
    prices: isOwner && costsEnabledFor(String(role)),
    staffMonth: isOwner && features.timeTracking,
    deadlines: features.courses || features.tasks,
    clock: features.timeTracking,
    myHours: features.timeTracking,
    myWeek: features.shifts,
    inbox: true,
  };
  // The widgets' door sits next to the cart: a round button with tiles and a +.
  const homeEditor = (
    <PopupAction
      title="Personalizza Oggi"
      ariaLabel="Personalizza Oggi"
      triggerRow={
        <span style={roundWhite}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="3" width="7" height="7" rx="2" />
            <rect x="3" y="14" width="7" height="7" rx="2" />
            <path d="M17.5 14v7M14 17.5h7" />
          </svg>
        </span>
      }
    >
      <HomeEditor
        shown={homeBlocks}
        extras={HOME_EXTRA[homeProfile]}
        choices={homeChoices(homeProfile)
          .filter((key) => homeAvailable[key])
          .map((key) => HOME_BLOCKS[key])}
      />
    </PopupAction>
  );
  const phoneHome = (
    <Stack>
      <div className="workbit-home">
        <div className="workbit-home-title">
          <div className="workbit-home-greet">
            <span>Ciao {session.user.firstName}</span>
            <h1>Oggi</h1>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {homeEditor}
            {cartBlock}
          </span>
        </div>
        {reviewBlock}
        {clockFix && (clockFix.offer || clockFix.pending.length > 0) ? (
          <ClockFixEmployee
            offer={clockFix.offer}
            pending={clockFix.pending}
            reviewerName={venueOwner?.owner.firstName ?? "il titolare"}
          />
        ) : null}
        {clockPointLine}
        {homeBlocks.map((key) => (homeAvailable[key] && homeBlockNodes[key] ? <Fragment key={key}>{homeBlockNodes[key]}</Fragment> : null))}
      </div>
    </Stack>
  );
  // On a computer the home is "Oggi" (desktop-today.tsx); the phone keeps
  // this one. Which shows is decided in CSS at 1100px.
  return (
    <>
      <div className="wb-desk-only">
        {reviewBlock || (clockFix && (clockFix.offer || clockFix.pending.length > 0)) ? (
          <div style={{ display: "grid", gap: 10, maxWidth: 560, marginBottom: 16 }}>
            {reviewBlock}
            {clockFix && (clockFix.offer || clockFix.pending.length > 0) ? (
              <ClockFixEmployee
                offer={clockFix.offer}
                pending={clockFix.pending}
                reviewerName={venueOwner?.owner.firstName ?? "il titolare"}
              />
            ) : null}
          </div>
        ) : null}
        <DesktopToday
          barId={activeBarId}
          userId={session.user.id}
          firstName={session.user.firstName}
          staff={staff}
          locale="it-IT"
        />
      </div>
      <div className="wb-phone-only">{phoneHome}</div>
    </>
  );
}
