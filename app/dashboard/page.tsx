import { ActivityType, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMonthlyTotals } from "@/lib/reporting";
import { getDashboardKpiData } from "@/lib/dashboard-kpi";
import { getDashboardContext } from "./context";
import { KpiDashboard } from "./kpi-dashboard";
import { ClockActionsPanel } from "./timelogs/timelogs-client";
import {
  ArrowLinkButton,
  BillingRequiredState,
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  Stack,
  formatDateTime,
} from "./ui";
import { formatDurationClock } from "@/lib/time-format";

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
  const isRestaurant = activeBarActivityType === ActivityType.RESTAURANT;
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
    isManager && isRestaurant && features.timeTracking
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
    !canManagePeople && isRestaurant && features.shifts
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
    !canManagePeople && isRestaurant && features.timeTracking
      ? buildMonthlyTotals(activeBarId, session.user.id, now.getMonth() + 1, now.getFullYear())
      : Promise.resolve(null),
    kpiDataPromise,
  ]);

  const personalShiftCount = shifts.length;

  return (
    <Stack>
      {isManager && isRestaurant && features.timeTracking ? (
        <ClockActionsPanel role={role} settings={settings} />
      ) : null}

      {!canManagePeople ? (
        <Panel title="Il tuo KPI" action={<ArrowLinkButton href="/dashboard/calendar" />}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {isRestaurant && features.timeTracking && ownHours ? (
              <ItemCard
                title={formatDurationClock(ownHours.roundedHours)}
                subtitle={`Ore reali ${formatDurationClock(ownHours.realHours)}`}
                meta="Ore mese"
              />
            ) : null}
            {features.shifts ? (
              <ItemCard
                title={`${personalShiftCount} turni`}
                subtitle="Prossimi turni assegnati"
                meta="Calendario"
              />
            ) : null}
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

      {!canManagePeople && features.shifts ? (
        <Panel title="Prossimi turni" action={<ArrowLinkButton href="/dashboard/shifts" />}>
          {shifts.length === 0 ? (
            <EmptyState message="Nessun turno schedulato al momento." />
          ) : (
            <ItemList>
              {shifts.map((shift) => (
                <ItemCard
                  key={shift.id}
                  title={shift.title || "Turno condiviso"}
                  subtitle={`${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}`}
                  meta={shift.assignments
                    .map((entry) => `${entry.user.firstName} ${entry.user.lastName}`)
                    .join(", ")}
                />
              ))}
            </ItemList>
          )}
        </Panel>
      ) : null}
    </Stack>
  );
}
