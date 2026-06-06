import { ActivityType, RequestStatus, RequestType, Role, TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMonthlyTotals } from "@/lib/reporting";
import { getDashboardKpiData } from "@/lib/dashboard-kpi";
import { confirmShiftAction } from "./actions";
import { getDashboardContext } from "./context";
import { KpiDashboard } from "./kpi-dashboard";
import { OwnerRequestCards } from "./owner-request-cards";
import { ClockActionsPanel } from "./timelogs/timelogs-client";
import {
  ArrowLinkButton,
  BillingRequiredState,
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  formatDate,
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
  const isOwner = role === Role.OWNER;
  const isEmployee = role === Role.EMPLOYEE;
  const isRestaurant = activeBarActivityType === ActivityType.RESTAURANT;
  const isCompany = activeBarActivityType === ActivityType.COMPANY;
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
    pendingOnCallShifts,
    tasks,
    notes,
    pendingRequests,
    pendingRequestCount,
    teamMembers,
    ownHours,
    kpiData,
  ] =
    await Promise.all([
      isOwner || !isRestaurant || !features.timeTracking
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
      isRestaurant && features.shifts
        ? prisma.shift.findMany({
            where: {
              barId: activeBarId,
              endTime: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
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
              confirmedAt: true,
              isOnCall: true,
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
      features.shifts
        ? prisma.shift.findMany({
            where: {
              barId: activeBarId,
              confirmedAt: null,
              isOnCall: true,
              assignments: {
                some: {
                  userId: session.user.id,
                },
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
              confirmedAt: true,
              isOnCall: true,
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
      features.tasks
        ? prisma.task.findMany({
        where: {
          barId: activeBarId,
          ...(isEmployee
            ? {
                OR: [{ assignedToId: session.user.id }, { assignedToAll: true }],
              }
            : {}),
          status: {
            not: TaskStatus.DONE,
          },
        },
        orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
        take: 6,
        select: {
          id: true,
          title: true,
          dueDate: true,
          assignedToAll: true,
          completions: {
            orderBy: {
              completedAt: "desc",
            },
            take: 1,
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
          })
        : Promise.resolve([]),
      features.noticeBoard
        ? prisma.note.findMany({
        where: {
          barId: activeBarId,
          ...(role === Role.EMPLOYEE
            ? {
                OR: [{ employeeId: null }, { employeeId: session.user.id }],
              }
            : {}),
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        take: 4,
        select: {
          id: true,
          content: true,
          isPinned: true,
          createdAt: true,
          employeeId: true,
          author: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
          })
        : Promise.resolve([]),
      isOwner && features.requests
        ? prisma.request.findMany({
            where: {
              barId: activeBarId,
              status: RequestStatus.PENDING,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 6,
            select: {
              id: true,
              type: true,
              status: true,
              peerStatus: true,
              ownerStatus: true,
              reason: true,
              startsAt: true,
              endsAt: true,
              employee: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              reviewedBy: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              peerReviewedBy: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              swapWith: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
              shift: {
                select: {
                  title: true,
                  startTime: true,
                  endTime: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      isOwner || !features.requests
        ? Promise.resolve(null)
        : prisma.request.count({
            where: {
              barId: activeBarId,
              ...(canManagePeople
                ? {
                    status: RequestStatus.PENDING,
                  }
                : {
                    employeeId: session.user.id,
                  }),
            },
          }),
      canManagePeople
        ? prisma.employeeBar.findMany({
            where: {
              barId: activeBarId,
              isActive: true,
            },
            orderBy: {
              role: "asc",
            },
            take: 6,
            select: {
              id: true,
              role: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      isOwner || !isRestaurant || !features.timeTracking
        ? Promise.resolve(null)
        : buildMonthlyTotals(activeBarId, session.user.id, now.getMonth() + 1, now.getFullYear()),
      kpiDataPromise,
    ]);

  const requestCount = isOwner ? pendingRequests.length : pendingRequestCount ?? 0;
  const personalShiftCount = shifts.filter((shift) =>
    shift.assignments.some((entry) => entry.user.id === session.user.id)
  ).length;
  const personalActionItems = [
    features.tasks
      ? {
          title: "Mansioni",
          subtitle: tasks.length === 0 ? "Tutto completato" : `${tasks.length} da controllare`,
          meta: "Apri la pagina",
          href: "/dashboard/tasks",
        }
      : null,
    features.noticeBoard
      ? {
          title: "Bacheca",
          subtitle: notes.length === 0 ? "Nessun messaggio" : `${notes.length} messaggi recenti`,
          meta: "Apri la pagina",
          href: "/dashboard/board",
        }
      : null,
    features.requests
      ? {
          title: "Richieste",
          subtitle: requestCount === 0 ? "Nessuna richiesta aperta" : `${requestCount} in sospeso`,
          meta: "Apri la pagina",
          href: "/dashboard/requests",
        }
      : null,
    features.availability && !isOwner && !isCompany
      ? {
          title: "Indisponibilità",
          subtitle: "Segnala quando non puoi lavorare",
          meta: "Apri la pagina",
          href: "/dashboard/availability",
        }
      : null,
  ].filter(Boolean) as Array<{
    title: string;
    subtitle: string;
    meta: string;
    href: string;
  }>;

  return (
    <Stack>
      {isRestaurant && !isOwner && features.timeTracking ? (
        <ClockActionsPanel role={role} settings={settings} />
      ) : null}

      {!canManagePeople ? (
        <Panel title="Il tuo riepilogo" action={<ArrowLinkButton href="/dashboard/calendar" />}>
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
            {features.tasks ? (
            <ItemCard
              title={`${tasks.length} mansioni`}
              subtitle={tasks.length === 0 ? "Tutto completato" : "Da gestire"}
              meta="Mansioni"
            />
            ) : null}
            {features.requests ? (
            <ItemCard
              title={`${requestCount} richieste`}
              subtitle={requestCount === 0 ? "Nessuna richiesta aperta" : "Controlla lo stato"}
              meta="Richieste"
            />
            ) : null}
            {features.noticeBoard ? (
            <ItemCard
              title={`${notes.length} messaggi`}
              subtitle="Ultime comunicazioni"
              meta="Bacheca"
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
        <Panel title="Turni e reperibilità" action={<ArrowLinkButton href="/dashboard/shifts" />}>
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
                  footer={
                    shift.isOnCall ? (
                      <span style={{ color: "#b45309", fontSize: 13, fontWeight: 600 }}>
                        Reperibilita {shift.confirmedAt ? "confermata" : "in attesa"}
                      </span>
                    ) : null
                  }
                />
              ))}
            </ItemList>
          )}

          {pendingOnCallShifts.length > 0 ? (
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              <h4 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Reperibilita da approvare</h4>
              <ItemList>
                {pendingOnCallShifts.map((shift) => (
                  <ItemCard
                    key={shift.id}
                    title={shift.title || "Reperibilita"}
                    subtitle={`${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}`}
                    meta={shift.assignments
                      .map((entry) => `${entry.user.firstName} ${entry.user.lastName}`)
                      .join(", ")}
                    footer={
                      <form action={confirmShiftAction}>
                        <input type="hidden" name="shiftId" value={shift.id} />
                        <PrimaryButton type="submit">Approva reperibilita</PrimaryButton>
                      </form>
                    }
                  />
                ))}
              </ItemList>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {!canManagePeople && personalActionItems.length > 0 ? (
        <Panel title="Da gestire">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {personalActionItems.map((item) => (
              <ItemCard
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                meta={item.meta}
                footer={
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <ArrowLinkButton href={item.href} />
                  </div>
                }
              />
            ))}
          </div>
        </Panel>
      ) : null}

    </Stack>
  );
}
