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
  SuccessCallout,
  formatDate,
  formatDateTime,
} from "../ui";
import { PopupAction } from "../popup-action";
import { BoardComposeForm } from "./board-compose-form";
import { TaskComposeForm } from "./task-compose-form";

export default async function DashboardTasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const { session, role, activeBarId, billingStatus, features } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Contenuti">
        <EmptyState message="Seleziona un locale attivo per gestire i contenuti." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  if (!features.tasks && !features.noticeBoard) {
    return (
      <Panel title="Contenuti">
        <EmptyState message="Moduli contenuti disattivati nelle impostazioni." />
      </Panel>
    );
  }

  const canManage = role === Role.OWNER || role === Role.MANAGER;
  const successMessage =
    success === "task-created"
      ? "Mansione salvata correttamente."
      : success === "board-created"
        ? "Messaggio pubblicato correttamente."
        : success === "task-completed"
          ? "Mansione completata correttamente."
          : null;
  const [tasks, members, notes] = await Promise.all([
    features.tasks
      ? prisma.task.findMany({
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
        })
      : Promise.resolve([]),
    canManage && features.tasks
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
    features.noticeBoard
      ? prisma.note.findMany({
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
        })
      : Promise.resolve([]),
  ]);

  return (
    <Stack>
      {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}

      {features.noticeBoard ? (
      <Panel
        title="Bacheca"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {canManage && notes.length > 0 ? (
              <form action={deleteAllBoardNotesAction}>
                <PrimaryButton type="submit" tone="red">
                  Pulisci bacheca
                </PrimaryButton>
              </form>
            ) : null}
            <PopupAction title="Nuovo messaggio bacheca" ariaLabel="Aggiungi messaggio">
              <BoardComposeForm
                action={createBoardNoteAction}
                canManage={canManage}
                notifySuccess
              />
            </PopupAction>
          </div>
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
      ) : null}

      {features.tasks ? (
      <Panel
        title="Mansioni"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {canManage && tasks.some((task) => task.status === "DONE") ? (
              <form action={deleteAllCompletedTasksAction}>
                <PrimaryButton type="submit" tone="red">
                  Elimina completate
                </PrimaryButton>
              </form>
            ) : null}
            {canManage ? (
              <PopupAction title="Crea nuova mansione" ariaLabel="Aggiungi mansione">
                <TaskComposeForm
                  action={createTaskAction}
                  members={members.map((member) => ({
                    id: member.user.id,
                    firstName: member.user.firstName,
                    lastName: member.user.lastName,
                  }))}
                  notifySuccess
                />
              </PopupAction>
            ) : null}
          </div>
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
                              <input type="hidden" name="notifySuccess" value="1" />
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
      ) : null}
    </Stack>
  );
}
