import { RequestStatus, RequestType, Role, TaskStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMonthlyDataset } from "@/lib/reporting";
import { getDashboardContext } from "./context";
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

export default async function DashboardPage() {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();

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
  const [settings, shifts, tasks, notes, requestCount, pendingRequests, teamMembers, ownHours] = await Promise.all([
    role === Role.OWNER
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
    prisma.shift.findMany({
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
      include: {
        assignments: {
          include: {
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
    prisma.task.findMany({
      where: {
        barId: activeBarId,
        ...(role === Role.EMPLOYEE
          ? {
              OR: [
                { assignedToId: session.user.id },
                { assignedToAll: true },
              ],
            }
          : {}),
        status: {
          not: TaskStatus.DONE,
        },
      },
      orderBy: [{ isUrgent: "desc" }, { dueDate: "asc" }],
      take: 6,
      include: {
        completions: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            completedAt: "desc",
          },
          take: 1,
        },
      },
    }),
    prisma.note.findMany({
      where: {
        barId: activeBarId,
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.request.count({
      where: {
        barId: activeBarId,
        status: RequestStatus.PENDING,
      },
    }),
    role === Role.OWNER
      ? prisma.request.findMany({
          where: {
            barId: activeBarId,
            status: RequestStatus.PENDING,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 6,
          include: {
            employee: {
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
    prisma.employeeBar.findMany({
      where: {
        barId: activeBarId,
        isActive: true,
      },
      orderBy: {
        role: "asc",
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      take: 6,
    }),
    role === Role.OWNER
      ? Promise.resolve(null)
      : buildMonthlyDataset(activeBarId, session.user.id, now.getMonth() + 1, now.getFullYear()),
  ]);

  return (
    <>
      <Stack>
        {role !== Role.OWNER ? <ClockActionsPanel role={role} settings={settings} /> : null}

        {role !== Role.OWNER && ownHours ? (
          <Panel title="Ore del mese" action={<ArrowLinkButton href="/dashboard/timelogs" />}>
            <ItemCard
              title={`${ownHours.totals.roundedHours.toFixed(2)} ore arrotondate`}
              subtitle={`Ore reali ${ownHours.totals.realHours.toFixed(2)} · aggiornate in tempo reale`}
            />
          </Panel>
        ) : null}

        <Panel
          title="Turni in arrivo"
          action={<ArrowLinkButton href="/dashboard/shifts" />}
        >
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

        <Panel
          title="Mansioni aperte"
          action={<ArrowLinkButton href="/dashboard/tasks" />}
        >
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

        <Panel title="Bacheca" action={<ArrowLinkButton href="/dashboard/board" />}>
          {notes.length === 0 ? (
            <EmptyState message="Nessun messaggio in bacheca." />
          ) : (
            <ItemList>
              {notes.map((note) => (
                <ItemCard
                  key={note.id}
                  title={note.isPinned ? "Messaggio in evidenza" : "Messaggio interno"}
                  subtitle={note.content}
                  meta={`${note.author.firstName} ${note.author.lastName} · ${formatDateTime(note.createdAt)}`}
                />
              ))}
            </ItemList>
          )}
        </Panel>

        <Panel
          title="Richieste in sospeso"
          action={<ArrowLinkButton href="/dashboard/requests" />}
        >
          {role === Role.OWNER ? (
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

        {(role === Role.OWNER || role === Role.MANAGER) && (
          <Panel
            title="Team attivo"
            action={
              <ArrowLinkButton
                href={role === Role.OWNER ? "/dashboard/people" : "/dashboard/shifts"}
              />
            }
          >
            {teamMembers.length === 0 ? (
              <EmptyState message="Nessun membro attivo collegato al locale." />
            ) : (
              <ItemList>
                {teamMembers.map((member) => (
                  <ItemCard
                    key={member.id}
                    title={`${member.user.firstName} ${member.user.lastName}`}
                    meta={member.role}
                  />
                ))}
              </ItemList>
            )}
          </Panel>
        )}
      </Stack>
    </>
  );
}
