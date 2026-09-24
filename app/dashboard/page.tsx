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
import { WorkSessionTimer } from "./work-session-timer";
import { findAssignedShiftForClockIn } from "@/lib/clockable-shift";

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
            <span>Ciao {session.user.firstName}</span>
            <h1>Oggi</h1>
          </div>

          {features.timeTracking && ownHours ? (
            <WorkSessionTimer
              activeClockInAt={activeClockInAt}
              scheduledStartAt={timerShift?.startTime.toISOString() ?? null}
              scheduledEndAt={timerShift?.endTime.toISOString() ?? null}
              monthlyHours={formatDurationClock(ownHours.roundedHours)}
            />
          ) : null}

          {features.timeTracking ? (
            <ClockActionsPanel
              role={role}
              settings={settings}
              clockStatus={clockStatus}
              hasScheduledShiftToday={Boolean(assignedShiftForClockIn)}
              compact
            />
          ) : null}

          <section className="workbit-home-shift">
            <span aria-hidden="true">⏱️</span>
            <div>
              <strong>
                {todayShift
                  ? `Oggi lavori dalle ${toTimeInputValueInTimeZone(todayShift.startTime)} alle ${toTimeInputValueInTimeZone(todayShift.endTime)}`
                  : "Oggi non hai turni programmati"}
              </strong>
              {todayColleagues.length > 0 ? (
                <small>Con te: {todayColleagues.join(", ")}</small>
              ) : null}
            </div>
          </section>

          <section className="workbit-home-shift workbit-home-next-shift">
            <span aria-hidden="true">📅</span>
            <div>
              <strong>
                {nextShift.id !== "__empty"
                  ? `Prossimo turno ${toDateInputValueInTimeZone(nextShift.startTime)} dalle ${toTimeInputValueInTimeZone(nextShift.startTime)} alle ${toTimeInputValueInTimeZone(nextShift.endTime)}`
                  : "Nessun prossimo turno programmato"}
              </strong>
            </div>
          </section>

          {crewBlock}
          {cartBlock}
        </div>
      ) : (
        <div className="workbit-home">
          <div className="workbit-home-title">
            <span>Ciao {session.user.firstName}</span>
            <h1>Oggi</h1>
          </div>

          {crewBlock}
          {weekLine}
          {cartBlock}
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
