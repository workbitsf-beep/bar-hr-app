import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  completeTaskAction,
  createTaskAction,
  deleteCompletedTaskAction,
} from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
  StatusPill,
  TextArea,
  TextInput,
  formatDate,
  formatDateTime,
} from "../ui";

export default async function DashboardTasksPage() {
  const { session, role, activeBarId, billingStatus } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Mansioni">
        <EmptyState message="Seleziona un locale attivo per gestire le mansioni." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const canManage = role === Role.OWNER || role === Role.MANAGER;
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
  ]);

  return (
    <Stack>
      {canManage ? (
        <Panel title="Crea nuova mansione">
          <form action={createTaskAction} style={{ display: "grid", gap: 16 }}>
            <FormField label="Titolo">
              <TextInput name="title" required placeholder="Pulizia banco caffetteria" />
            </FormField>

            <FormField label="Descrizione">
              <TextArea name="description" placeholder="Dettagli operativi opzionali" />
            </FormField>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <FormField label="Scadenza">
                <TextInput name="dueDate" type="date" required />
              </FormField>

              <FormField label="Assegna a">
                <Select name="assignedToId" defaultValue="">
                  <option value="">Nessun singolo assegnatario</option>
                  {members.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.firstName} {member.user.lastName}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="assignedToAll" />
                Assegna a tutto il team
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" name="isUrgent" />
                Segna come urgente
              </label>
            </div>

            <div>
              <PrimaryButton type="submit">Salva mansione</PrimaryButton>
            </div>
          </form>
        </Panel>
      ) : null}

      <Panel title="Elenco mansioni" action={`${tasks.length} risultati`}>
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
