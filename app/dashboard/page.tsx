import { ActivityType, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMonthlyTotals } from "@/lib/reporting";
import { getDashboardKpiData } from "@/lib/dashboard-kpi";
import { getDashboardContext } from "./context";
import { KpiDashboard } from "./kpi-dashboard";
import { ClockActionsPanel } from "./timelogs/timelogs-client";
import {
  BillingRequiredState,
  EmptyState,
  Panel,
  Stack,
} from "./ui";
import { formatDurationClock } from "@/lib/time-format";
import { toTimeInputValueInTimeZone, toDateInputValueInTimeZone } from "@/lib/time-zone";

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
  const isManager = role === Role.MANAGER;
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

  const [settings, shifts, ownHours, kpiData] = await Promise.all([
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
    kpiDataPromise,
  ]);

  const todayKey = toDateInputValueInTimeZone(now);
  const todayShift = shifts.find((shift) => toDateInputValueInTimeZone(shift.startTime) === todayKey);
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

  return (
    <Stack>
      {isOperationalProfile ? (
        <Panel title="Profilo">
          <div style={{ display: "grid", gap: 18 }}>
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
                </div>
              ) : null}
            </div>

            {features.timeTracking ? <ClockActionsPanel role={role} settings={settings} /> : null}

            <div
              style={{
                padding: 18,
                borderRadius: 26,
                background: "#ffffff",
                border: "1px solid #e9d5ff",
                boxShadow: "0 14px 30px rgba(88,28,135,0.06)",
              }}
            >
              <strong style={{ display: "block", color: "#0f172a", fontSize: 20 }}>
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
