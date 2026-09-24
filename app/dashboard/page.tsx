import { RequestStatus, RequestType, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDashboardKpiData } from "@/lib/dashboard-kpi";
import { buildMonthlyTotals } from "@/lib/reporting";
import { getDashboardContext } from "./context";
import { reviewRequestAction } from "./actions";
import { KpiDashboard } from "./kpi-dashboard";
import { ShoppingListQuickAdd } from "./shopping-list-quick-add";
import { ClockActionsPanel, type ClockActionStatus } from "./timelogs/timelogs-client";
import {
  BillingRequiredState,
  EmptyState,
  Panel,
  PrimaryButton,
  Stack,
} from "./ui";
import { formatDurationClock } from "@/lib/time-format";
import { toTimeInputValueInTimeZone, toDateInputValueInTimeZone } from "@/lib/time-zone";
import { findAssignedShiftForClockIn } from "@/lib/clockable-shift";
import { INTERNAL_NOTIFICATION_TYPES } from "@/lib/notifications";
import { formatDateInTimeZone } from "@/lib/time-zone";

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

export default async function DashboardPage() {
  const { session, role, activeBarId, activeBarActivityType, billingStatus, features } =
    await getDashboardContext();

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
    return <BillingRequiredState role={String(role)} />;
  }

  const now = new Date();
  const canManagePeople = role === Role.OWNER || role === Role.MANAGER;
  const isOwner = role === Role.OWNER;
  const isOperationalProfile = !isOwner;
  const showKpi =
    canManagePeople &&
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
    latestTimeLog,
    kpiData,
    pendingApprovalRequests,
    nextWeekShifts,
    assignedShiftForClockIn,
    crewShiftsToday,
    crewTimeLogsToday,
    shoppingPendingCount,
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
    canManagePeople && features.requests
      ? prisma.request.findMany({
          where: {
            barId: activeBarId,
            status: RequestStatus.PENDING,
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
    canManagePeople && features.shifts
      ? prisma.shift.findMany({
          where: {
            barId: activeBarId,
            startTime: {
              gte: startOfDay(now),
              lt: addDays(startOfDay(now), 1),
            },
          },
          orderBy: { startTime: "asc" },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            assignments: {
              select: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    canManagePeople && features.timeTracking
      ? prisma.timeLog.findMany({
          where: {
            barId: activeBarId,
            timestamp: {
              gte: startOfDay(now),
              lt: addDays(startOfDay(now), 1),
            },
          },
          orderBy: { timestamp: "asc" },
          select: { userId: true, type: true, timestamp: true },
        })
      : Promise.resolve([]),
    features.shoppingList
      ? prisma.shoppingListItem.count({ where: { barId: activeBarId } })
      : Promise.resolve(0),
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
          select: { id: true, startTime: true, endTime: true },
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
            OR: [{ employeeId: null }, { employeeId: session.user.id }],
            readReceipts: { none: { userId: session.user.id } },
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
  const clockStatus: ClockActionStatus =
    latestTimeLog?.type === "IN"
      ? "CAN_CLOCK_OUT"
      : "CAN_CLOCK_IN";
  const activeClockInAt =
    latestTimeLog?.type === "IN" ? latestTimeLog.timestamp.toISOString() : null;
  const timerShift = latestTimeLog?.type === "IN" && latestTimeLog.shift
    ? latestTimeLog.shift
    : todayShift;

  // Only the last stamp of the day decides where someone stands: an entry
  // means they are in, an exit means the shift is done, nothing at all means
  // they are still expected.
  const lastStampByUser = new Map<string, "IN" | "OUT">();

  for (const log of crewTimeLogsToday) {
    lastStampByUser.set(log.userId, log.type);
  }

  const crewToday = new Map<
    string,
    { id: string; name: string; initials: string; from: string; to: string }
  >();

  for (const shift of crewShiftsToday) {
    for (const assignment of shift.assignments) {
      if (crewToday.has(assignment.user.id)) {
        continue;
      }

      crewToday.set(assignment.user.id, {
        id: assignment.user.id,
        name: `${assignment.user.firstName} ${assignment.user.lastName}`,
        initials: initialsOf(assignment.user.firstName, assignment.user.lastName),
        from: toTimeInputValueInTimeZone(shift.startTime),
        to: toTimeInputValueInTimeZone(shift.endTime),
      });
    }
  }

  const crew = Array.from(crewToday.values());
  const crewInside = crew.filter((person) => lastStampByUser.get(person.id) === "IN").length;

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
      })),
    };
  });

  const myWeekMinutes = myWeekShifts.reduce(
    (total, shift) => total + (shift.endTime.getTime() - shift.startTime.getTime()) / 60000,
    0
  );

  const coveredNextWeekDays = new Set(
    nextWeekShifts.map((shift) => toDateInputValueInTimeZone(shift.startTime))
  ).size;
  const uncoveredNextWeekDays = 7 - coveredNextWeekDays;

  const crewBlock =
    canManagePeople && features.shifts ? (
      <section className="workbit-crew">
        <div className="workbit-crew-head">
          <strong>In servizio oggi</strong>
          {crew.length > 0 ? (
            <span>
              {crewInside} su {crew.length} {crewInside === 1 ? "dentro" : "dentro"}
            </span>
          ) : null}
        </div>

        {crew.length === 0 ? (
          <span style={{ color: "#667085", fontSize: 13.5 }}>Nessun turno programmato per oggi.</span>
        ) : (
          crew.map((person) => {
            const stamp = lastStampByUser.get(person.id);
            const state =
              stamp === "IN" ? "in" : stamp === "OUT" ? "out" : "waiting";
            const label =
              stamp === "IN" ? "Dentro" : stamp === "OUT" ? "Uscito" : "Attesa";

            return (
              <div className="workbit-crew-person" key={person.id}>
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
            );
          })
        )}
      </section>
    ) : null;

  const cartBlock = features.shoppingList ? (
    <ShoppingListQuickAdd pendingCount={shoppingPendingCount} />
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

  return (
    <Stack>
      {isOperationalProfile ? (
        <div className="workbit-home">
          <div className="workbit-home-title">
            <div className="workbit-home-greet">
              <span>Ciao {session.user.firstName}</span>
              <h1>Oggi</h1>
            </div>
            {cartBlock}
          </div>

          {features.timeTracking ? (
            <ClockActionsPanel
              role={role}
              settings={settings}
              clockStatus={clockStatus}
              hasScheduledShiftToday={Boolean(assignedShiftForClockIn)}
              activeClockInAt={activeClockInAt}
              shiftLabel={
                timerShift
                  ? `turno ${toTimeInputValueInTimeZone(timerShift.startTime)} – ${toTimeInputValueInTimeZone(timerShift.endTime)}`
                  : null
              }
              compact
            />
          ) : null}

          {features.shifts ? (
            <section className="workbit-week">
              <div className="workbit-week-head">
                <strong>La tua settimana</strong>
                {/* The month total used to have a card of its own, showing a
                    ring that read 00:00 most of the time. It belongs here,
                    beside the other hours. */}
                <span>
                  {myWeekShifts.length} {myWeekShifts.length === 1 ? "turno" : "turni"}
                  {myWeekMinutes > 0 ? ` · ${Math.round(myWeekMinutes / 60)}h` : ""}
                  {features.timeTracking && ownHours
                    ? ` · ${formatDurationClock(ownHours.roundedHours)} mese`
                    : ""}
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
                              {slot.from}
                              <br />
                              {slot.to}
                            </span>
                          ))}
                    </em>
                  </div>
                ))}
              </div>

              {todayColleagues.length > 0 ? (
                <small className="workbit-week-mates">Oggi con te: {todayColleagues.join(", ")}</small>
              ) : null}

              {nextShift.id === "__empty" && myWeekShifts.length === 0 ? (
                <small className="workbit-week-mates">Nessun turno programmato questa settimana.</small>
              ) : null}
            </section>
          ) : null}

          {unseenRequestOutcomes.map((outcome) => (
            <div className="workbit-home-row workbit-home-row--good" key={outcome.id}>
              <span className="workbit-home-row-icon" aria-hidden="true">
                ✓
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
                ✎
              </span>
              <div>
                <b>
                  {openTaskCount} {openTaskCount === 1 ? "mansione da fare" : "mansioni da fare"}
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
                ⚑
              </span>
              <div>
                <b>{upcomingCourse.title}</b>
                {formatDateInTimeZone(upcomingCourse.startsAt)}
              </div>
              <Link href="/dashboard/courses">Vedi</Link>
            </div>
          ) : null}

          {crewBlock}
        </div>
      ) : (
        <div className="workbit-home">
          <div className="workbit-home-title">
            <div className="workbit-home-greet">
              <span>Ciao {session.user.firstName}</span>
              <h1>Oggi</h1>
            </div>
            {cartBlock}
          </div>

          {crewBlock}
          {weekLine}
        </div>
      )}

      {canManagePeople && pendingApprovalRequests.length > 0 ? (
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
                    {request.startsAt ? toDateInputValueInTimeZone(request.startsAt) : "Data non indicata"}
                    {request.startsAt && request.endsAt
                      ? ` · ${toTimeInputValueInTimeZone(request.startsAt)}-${toTimeInputValueInTimeZone(request.endsAt)}`
                      : ""}
                  </div>
                </div>

                {request.reason ? (
                  <div style={{ color: "#64748b", lineHeight: 1.45 }}>{request.reason}</div>
                ) : null}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <form action={reviewRequestAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="APPROVED" />
                    <input type="hidden" name="notifySuccess" value="1" />
                    <PrimaryButton type="submit" tone="green" style={{ minHeight: 34, paddingInline: 12 }}>
                      Approva
                    </PrimaryButton>
                  </form>
                  <form action={reviewRequestAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input type="hidden" name="decision" value="REJECTED" />
                    <input type="hidden" name="notifySuccess" value="1" />
                    <PrimaryButton type="submit" tone="red" style={{ minHeight: 34, paddingInline: 12 }}>
                      Rifiuta
                    </PrimaryButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      {showKpi ? (
        <KpiDashboard
          activeBarId={activeBarId}
          role={role}
          activityType={activeBarActivityType}
          features={features}
          initialData={kpiData}
        />
      ) : null}

    </Stack>
  );
}
