import { RequestStatus, RequestType, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { buildDailyTotals, buildMonthlyTotals } from "@/lib/reporting";
import { getDashboardKpiData } from "@/lib/dashboard-kpi";
import { getDashboardContext } from "./context";
import { reviewRequestAction } from "./actions";
import { KpiDashboard } from "./kpi-dashboard";
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
    todayHours,
    latestTimeLog,
    kpiData,
    pendingApprovalRequests,
    nextWeekShiftCount,
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
      ? buildDailyTotals(activeBarId, session.user.id, now)
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
    isOwner && features.shifts
      ? prisma.shift.count({
          where: {
            barId: activeBarId,
            startTime: {
              gte: startOfNextWeek(now),
              lt: addDays(startOfNextWeek(now), 7),
            },
          },
        })
      : Promise.resolve(0),
  ]);

  const todayKey = toDateInputValueInTimeZone(now);
  const todayShift = shifts.find((shift) => toDateInputValueInTimeZone(shift.startTime) === todayKey);
  const nextShift = shifts.find((shift) => shift.id !== todayShift?.id) ?? null;
  const todayColleagues =
    todayShift?.assignments
      .filter((entry) => entry.user.id !== session.user.id)
      .map((entry) => `${entry.user.firstName} ${entry.user.lastName}`) ?? [];
  const roleLabel =
    role === Role.MANAGER
      ? "Responsabile"
      : role === Role.AMMINISTRAZIONE
        ? "Amministrazione"
        : "Dipendente";
  const clockStatus: ClockActionStatus =
    latestTimeLog?.type === "IN"
      ? "CAN_CLOCK_OUT"
      : "CAN_CLOCK_IN";

  return (
    <Stack>
      {isOperationalProfile ? (
        <Panel title="Profilo">
          <div className="dashboard-profile-layout" style={{ display: "grid", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 22,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #ede9fe, #f5f3ff)",
                    color: "#5b21b6",
                    fontSize: 25,
                    fontWeight: 800,
                  }}
                >
                  👤
                </div>
                <div>
                  <div style={{ color: "#64748b", fontWeight: 700 }}>Ciao</div>
                  <h1 style={{ margin: 0, color: "#0f172a", fontSize: 26, lineHeight: 1.1 }}>
                    {session.user.firstName} {session.user.lastName}
                  </h1>
                  <div style={{ color: "#64748b", marginTop: 4 }}>{roleLabel}</div>
                </div>
              </div>

              {features.timeTracking && ownHours ? (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 24,
                    background: "linear-gradient(135deg, #f5f3ff, #ffffff)",
                    border: "1px solid rgba(124,58,237,0.12)",
                    minWidth: 170,
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                    Le tue ore del mese
                  </div>
                  <div style={{ color: "#4c1d95", fontSize: 26, fontWeight: 800 }}>
                    {formatDurationClock(ownHours.roundedHours)}
                  </div>
                  {todayHours ? (
                    <div style={{ color: "#64748b", fontSize: 12, fontWeight: 750, marginTop: 2 }}>
                      Oggi {formatDurationClock(todayHours.roundedHours)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <div
                style={{
                  padding: 18,
                  borderRadius: 26,
                  background: "#ffffff",
                  border: "1px solid #e9d5ff",
                  boxShadow: "0 14px 30px rgba(88,28,135,0.06)",
                }}
              >
                <strong style={{ display: "block", color: "#0f172a", fontSize: 18 }}>
                  {todayShift
                    ? `Oggi lavori dalle ${toTimeInputValueInTimeZone(todayShift.startTime)} alle ${toTimeInputValueInTimeZone(todayShift.endTime)}`
                    : "Oggi non hai turni programmati"}
                </strong>
                {todayColleagues.length > 0 ? (
                  <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                    Con te: {todayColleagues.join(", ")}
                  </p>
                ) : null}
              </div>

              <div
                style={{
                  padding: 18,
                  borderRadius: 26,
                  background: "#ffffff",
                  border: "1px solid #e9d5ff",
                  boxShadow: "0 14px 30px rgba(88,28,135,0.06)",
                }}
              >
                <strong style={{ display: "block", color: "#0f172a", fontSize: 18 }}>
                  {nextShift
                    ? `Prossimo turno: ${toDateInputValueInTimeZone(nextShift.startTime)} · ${toTimeInputValueInTimeZone(nextShift.startTime)}-${toTimeInputValueInTimeZone(nextShift.endTime)}`
                    : "Nessun prossimo turno programmato"}
                </strong>
                {nextShift ? (
                  <p style={{ margin: "8px 0 0", color: "#64748b" }}>
                    {nextShift.assignments
                      .filter((entry) => entry.user.id !== session.user.id)
                      .map((entry) => `${entry.user.firstName} ${entry.user.lastName}`)
                      .join(", ") || "Nessun collega indicato"}
                  </p>
                ) : null}
              </div>
            </div>

            {features.timeTracking ? (
              <ClockActionsPanel role={role} settings={settings} clockStatus={clockStatus} />
            ) : null}
          </div>
        </Panel>
      ) : null}

      {isOwner && features.shifts && nextWeekShiftCount === 0 ? (
        <Panel title="Promemoria" action="Turni">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              padding: 16,
              borderRadius: 22,
              background: "linear-gradient(135deg, rgba(255,247,237,0.92), rgba(245,243,255,0.9))",
              border: "1px solid rgba(251,146,60,0.24)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 16,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#ffedd5",
                  fontSize: 18,
                }}
              >
                ⏰
              </span>
              <div>
                <strong style={{ display: "block", color: "#0f172a" }}>
                  Mancano i turni della prossima settimana
                </strong>
                <span style={{ color: "#64748b", fontSize: 13 }}>
                  Pianificali ora e confermali quando sono pronti.
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/calendar"
              style={{
                borderRadius: 999,
                padding: "9px 13px",
                background: "linear-gradient(135deg, #4c1d95, #7c3aed)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
                boxShadow: "0 10px 22px rgba(124,58,237,0.18)",
              }}
            >
              Apri turni
            </Link>
          </div>
        </Panel>
      ) : null}

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
