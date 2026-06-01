import { ActivityType, RequestStatus, RequestType, Role, TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMonthlyTotals } from "@/lib/reporting";
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
  Stack,
  formatDate,
  formatDateTime,
} from "./ui";
import { formatDurationClock } from "@/lib/time-format";

export default async function DashboardPage() {
  const { session, role, activeBarId, activeBarActivityType, billingStatus } =
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

  const [settings, shifts, tasks, notes, pendingRequests, pendingRequestCount, teamMembers, ownHours] =
    await Promise.all([
      isOwner || !isRestaurant
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
      prisma.task.findMany({
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
      }),
      prisma.note.findMany({
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
      }),
      isOwner
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
      isOwner
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
      isOwner || !isRestaurant
        ? Promise.resolve(null)
        : buildMonthlyTotals(activeBarId, session.user.id, now.getMonth() + 1, now.getFullYear()),
    ]);

  const requestCount = isOwner ? pendingRequests.length : pendingRequestCount ?? 0;
  const personalShiftCount = shifts.filter((shift) =>
    shift.assignments.some((entry) => entry.user.id === session.user.id)
  ).length;

  return (
    <Stack>
      {isRestaurant && !isOwner ? <ClockActionsPanel role={role} settings={settings} /> : null}

      {!canManagePeople ? (
        <Panel title="Il tuo riepilogo" action={<ArrowLinkButton href="/dashboard/calendar" />}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
            }}
          >
            {isRestaurant && ownHours ? (
              <ItemCard
                title={formatDurationClock(ownHours.roundedHours)}
                subtitle={`Ore reali ${formatDurationClock(ownHours.realHours)}`}
                meta="Ore mese"
              />
            ) : null}
            <ItemCard
              title={`${personalShiftCount} turni`}
              subtitle="Prossimi turni assegnati"
              meta="Calendario"
            />
            <ItemCard
              title={`${tasks.length} mansioni`}
              subtitle={tasks.length === 0 ? "Tutto completato" : "Da gestire"}
              meta="Mansioni"
            />
            <ItemCard
              title={`${requestCount} richieste`}
              subtitle={requestCount === 0 ? "Nessuna richiesta aperta" : "Controlla lo stato"}
              meta="Richieste"
            />
            <ItemCard
              title={`${notes.length} messaggi`}
              subtitle="Ultime comunicazioni"
              meta="Bacheca"
            />
          </div>
        </Panel>
      ) : null}

      {canManagePeople ? (
        <KpiDashboard
          activeBarId={activeBarId}
          role={role}
          activityType={activeBarActivityType}
        />
      ) : null}

      {!canManagePeople && isRestaurant ? (
        <Panel title="Turni in arrivo" action={<ArrowLinkButton href="/dashboard/shifts" />}>
          {shifts.length === 0 ? (
            <EmptyState message="Nessun turno schedulato al momento." />
          ) : (
            <ItemList>
              {shifts.map((shift) => (
                <ItemCard
                  key={shift.id}
                  title={shift.title || "Turno condiviso"}
                  subtitle={`${formatDateTime(shift.startTime)} - ${formatDateTime(shift.endTime)}`}
                  meta={shift.assignments.map((entry) => `${entry.user.firstName} ${entry.user.lastName}`).join(", ")}
                />
              ))}
            </ItemList>
          )}
        </Panel>
      ) : null}

      {!canManagePeople ? (
      <Panel title="Mansioni aperte" action={<ArrowLinkButton href="/dashboard/tasks" />}>
        {tasks.length === 0 ? (
          <EmptyState message="Nessuna mansione aperta per il locale." />
        ) : (
          <ItemList>
            {tasks.map((task) => (
              <ItemCard
                key={task.id}
                title={task.title}
                subtitle={`Scadenza ${formatDate(task.dueDate)}`}
                meta={
                  task.completions[0]
                    ? `Ultimo completamento: ${task.completions[0].user.firstName} ${task.completions[0].user.lastName}`
                    : task.assignedToAll
                      ? "Assegnata a tutto il team"
                      : "In attesa di completamento"
                }
              />
            ))}
          </ItemList>
        )}
      </Panel>
      ) : null}

      {!canManagePeople ? (
      <Panel title="Bacheca" action={<ArrowLinkButton href="/dashboard/tasks" />}>
        {notes.length === 0 ? (
          <EmptyState message="Nessun messaggio in bacheca." />
        ) : (
          <ItemList>
            {notes.map((note) => (
              <ItemCard
                key={note.id}
                title={note.isPinned ? "Messaggio in evidenza" : "Messaggio interno"}
                subtitle={note.content}
                meta={`${note.author.firstName} ${note.author.lastName} - ${formatDateTime(note.createdAt)}`}
              />
            ))}
          </ItemList>
        )}
      </Panel>
      ) : null}

      {!canManagePeople ? (
      <Panel title="Richieste in sospeso" action={<ArrowLinkButton href="/dashboard/requests" />}>
        {isOwner ? (
          requestCount === 0 ? (
            <ItemCard
              title="Tutto aggiornato"
              subtitle="Nessuna richiesta in sospeso da gestire."
            />
          ) : (
            <OwnerRequestCards
              requests={pendingRequests.map((request) => ({
                id: request.id,
                type: request.type as RequestType,
                status: request.status,
                peerStatus: request.peerStatus,
                ownerStatus: request.ownerStatus,
                reason: request.reason,
                startsAt: request.startsAt?.toISOString() ?? null,
                endsAt: request.endsAt?.toISOString() ?? null,
                employee: {
                  firstName: request.employee.firstName,
                  lastName: request.employee.lastName,
                },
                reviewedBy: request.reviewedBy
                  ? {
                      firstName: request.reviewedBy.firstName,
                      lastName: request.reviewedBy.lastName,
                    }
                  : null,
                peerReviewedBy: request.peerReviewedBy
                  ? {
                      firstName: request.peerReviewedBy.firstName,
                      lastName: request.peerReviewedBy.lastName,
                    }
                  : null,
                swapWith: request.swapWith
                  ? {
                      firstName: request.swapWith.firstName,
                      lastName: request.swapWith.lastName,
                    }
                  : null,
                shift: request.shift
                  ? {
                      title: request.shift.title,
                      startTime: request.shift.startTime.toISOString(),
                      endTime: request.shift.endTime.toISOString(),
                    }
                  : null,
              }))}
            />
          )
        ) : (
          <ItemCard
            title={requestCount === 0 ? "Tutto aggiornato" : `${requestCount} richieste da gestire`}
            subtitle="Controlla lo stato delle tue richieste e dei cambi turno."
          />
        )}
      </Panel>
      ) : null}

    </Stack>
  );
}
