import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createBoardNoteAction,
  completeTaskAction,
  createTaskAction,
  deleteAllBoardNotesAction,
  deleteAllCompletedTasksAction,
  deleteBoardNoteAction,
  deleteCompletedTaskAction,
} from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  StatusPill,
  formatDate,
  formatDateTime,
} from "../ui";
import { BoardComposeForm } from "./board-compose-form";
import { TaskComposeForm } from "./task-compose-form";

export default async function DashboardTasksPage() {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Mansioni e bacheca">
        <EmptyState message="Seleziona un locale attivo per gestire mansioni e bacheca." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const canManage = role === Role.OWNER || role === Role.MANAGER;
  const [tasks, members, notes] = await Promise.all([
    prisma.task.findMany({
      where: {
        barId: activeBarId,
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
        description: true,
        dueDate: true,
        status: true,
        isUrgent: true,
        assignedToAll: true,
        assignedToId: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        createdBy: {
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
        completions: {
          orderBy: {
            completedAt: "desc",
          },
          select: {
            id: true,
            completedAt: true,
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
    canManage
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
            role: {
              not: Role.OWNER,
            },
          },
          orderBy: {
            role: "asc",
          },
          select: {
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
    prisma.note.findMany({
      where: {
        barId: activeBarId,
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  return (
    <Stack>
      <div id="board-compose">
        <Panel title="Nuovo messaggio bacheca">
          <BoardComposeForm action={createBoardNoteAction} canManage={canManage} />
        </Panel>
      </div>

      {canManage ? (
        <div id="tasks-compose">
          <Panel title="Crea nuova mansione">
            <TaskComposeForm
              action={createTaskAction}
              members={members.map((member) => ({
                id: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
              }))}
            />
          </Panel>
        </div>
      ) : null}

      <Panel
        title="Bacheca"
        action={
          canManage && notes.length > 0 ? (
            <form action={deleteAllBoardNotesAction}>
              <PrimaryButton type="submit" tone="red">
                Pulisci bacheca
              </PrimaryButton>
            </form>
          ) : (
            `${notes.length} messaggi`
          )
        }
      >
        {notes.length === 0 ? (
          <EmptyState message="Nessun messaggio pubblicato al momento." />
        ) : (
          <ItemList scrollable>
            {notes.map((note) => (
              <ItemCard
                key={note.id}
                title={note.isPinned ? "Messaggio fissato" : "Messaggio"}
                subtitle={note.content}
                meta={`${note.author.firstName} ${note.author.lastName} - ${formatDateTime(note.createdAt)}`}
                footer={
                  <form action={deleteBoardNoteAction}>
                    <input type="hidden" name="noteId" value={note.id} />
                    <PrimaryButton type="submit" tone="red">
                      Elimina messaggio
                    </PrimaryButton>
                  </form>
                }
              />
            ))}
          </ItemList>
        )}
      </Panel>

      <Panel
        title="Elenco mansioni"
        action={
          canManage && tasks.some((task) => task.status === "DONE") ? (
            <form action={deleteAllCompletedTasksAction}>
              <PrimaryButton type="submit" tone="red">
                Elimina completate
              </PrimaryButton>
            </form>
          ) : (
            `${tasks.length} risultati`
          )
        }
      >
        {tasks.length === 0 ? (
          <EmptyState message="Nessuna mansione disponibile." />
        ) : (
          <ItemList scrollable>
            {tasks.map((task) => {
              const isDone = task.status === "DONE";
              const canComplete =
                !isDone &&
                (canManage || task.assignedToAll || task.assignedToId === session.user.id);
              const canDeleteCompleted = canManage && isDone;

              return (
                <ItemCard
                  key={task.id}
                  title={task.title}
                  subtitle={`Scadenza ${formatDate(task.dueDate)}`}
                  meta={
                    <>
                      Creata da {task.createdBy.firstName} {task.createdBy.lastName}
                      <br />
                      {task.assignedToAll
                        ? "Assegnata a tutto il team"
                        : task.assignedTo
                          ? `Assegnata a ${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                          : "Non assegnata"}
                    </>
                  }
                  footer={
                    <div style={{ display: "grid", gap: 12 }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <StatusPill
                          label={task.status}
                          tone={isDone ? "success" : task.isUrgent ? "danger" : "warning"}
                        />
                        {task.completedBy ? (
                          <StatusPill
                            label={`Completata da ${task.completedBy.firstName}`}
                            tone="neutral"
                          />
                        ) : null}
                      </div>

                      {task.description ? (
                        <div style={{ color: "#334155", lineHeight: 1.6 }}>{task.description}</div>
                      ) : null}

                      {task.completions.length > 0 ? (
                        <div style={{ display: "grid", gap: 6 }}>
                          {task.completions.map((completion) => (
                            <div key={completion.id} style={{ color: "#64748b", fontSize: 14 }}>
                              {completion.user.firstName} {completion.user.lastName} -{" "}
                              {formatDateTime(completion.completedAt)}
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {canComplete || canDeleteCompleted ? (
                        <div className="dashboard-action-row">
                          {canComplete ? (
                            <form action={completeTaskAction}>
                              <input type="hidden" name="taskId" value={task.id} />
                              <PrimaryButton type="submit" tone="green">
                                Segna completata
                              </PrimaryButton>
                            </form>
                          ) : null}

                          {canDeleteCompleted ? (
                            <form action={deleteCompletedTaskAction}>
                              <input type="hidden" name="taskId" value={task.id} />
                              <PrimaryButton type="submit" tone="red">
                                Elimina mansione completata
                              </PrimaryButton>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </ItemList>
        )}
      </Panel>
    </Stack>
  );
}
