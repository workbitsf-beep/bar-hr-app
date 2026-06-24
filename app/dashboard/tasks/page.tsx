import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  completeTaskAction,
  createTaskAction,
  deleteAllCompletedTasksAction,
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

  if (!features.tasks) {
    return (
      <Panel title="Note">
        <EmptyState message="Modulo note disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const canManage = role === Role.OWNER || role === Role.MANAGER;
  const successMessage =
    success === "task-created"
      ? "Nota salvata correttamente."
        : success === "task-completed"
          ? "Nota completata correttamente."
          : null;
  const [tasks, members] = await Promise.all([
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
    prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
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
            role: true,
          },
        }),
  ]);

  return (
    <Stack>
      {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}

      <Panel
        title="Note"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {canManage && tasks.some((task) => task.status === "DONE") ? (
              <form action={deleteAllCompletedTasksAction}>
                <PrimaryButton type="submit" tone="red">
                  Elimina note completate
                </PrimaryButton>
              </form>
            ) : null}
            <PopupAction title="Crea nuova nota" ariaLabel="Aggiungi nota">
              <TaskComposeForm
                action={createTaskAction}
                members={members
                  .map((member) => ({
                    id: member.user.id,
                    firstName: member.user.firstName,
                    lastName: member.user.lastName,
                  }))
                  .filter((member) =>
                    canManage
                      ? members.some((source) => source.user.id === member.id && source.role !== Role.OWNER)
                      : member.id === session.user.id
                  )}
                canChooseAudience={canManage}
                notifySuccess
              />
            </PopupAction>
          </div>
        }
      >
        {tasks.length === 0 ? (
          <EmptyState message="Nessuna nota disponibile." />
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
                  subtitle={`Data ${formatDate(task.dueDate)}`}
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
                                Elimina nota completata
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
