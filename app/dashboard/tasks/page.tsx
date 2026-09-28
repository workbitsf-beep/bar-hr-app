import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeTaskRepeat } from "@/lib/task-recurrence";
import { isOverdue, relativeDayLabel } from "@/lib/note-list-format";
import {
  completeTaskAction,
  createTaskAction,
  deleteAllCompletedTasksAction,
  deleteTaskAction,
} from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  IconButton,
  ItemList,
  Panel,
  PrimaryButton,
  Stack,
  SuccessCallout,
} from "../ui";
import { PopupAction } from "../popup-action";
import { SwipeRevealAction } from "../swipe-reveal-action";
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

  const notesEnabled = features.tasks || features.noticeBoard;

  if (!notesEnabled) {
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
            requiresConfirmation: true,
            repeatEvery: true,
            repeatUnit: true,
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
                id: true,
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
    <Stack columns="1fr" className="workbit-notes-page">
      {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}

      <Panel
        title="Note"
        className="workbit-notes-panel"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {canManage && tasks.some((task) => task.status === "DONE") ? (
              <form action={deleteAllCompletedTasksAction}>
                <PrimaryButton type="submit" tone="red">
                  Elimina note completate
                </PrimaryButton>
              </form>
            ) : null}
            <PopupAction title="Nuova nota" ariaLabel="Aggiungi nota">
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
          <ItemList>
            {tasks.map((task) => {
              const isDone = task.status === "DONE";
              const canComplete =
                !isDone &&
                task.requiresConfirmation &&
                (canManage || task.assignedToAll || task.assignedToId === session.user.id);
              const canDeleteTask = canManage || task.createdBy.id === session.user.id;
              const late = !isDone && isOverdue(task.dueDate);
              const repeats = describeTaskRepeat(task.repeatEvery, task.repeatUnit);
              const lastCompletion = task.completions[0];

              // A strip of colour on the edge instead of a pill on its own
              // line: red when it should already have been done, purple when
              // the note is one of a series, nothing at all otherwise.
              const accent = late ? "#ef4444" : repeats ? "#7c3aed" : null;

              // Everything here is left out when it is the ordinary case. The
              // whole team, written by you, a plain note due today: all of it
              // was on every single card and none of it was news.
              const metaParts = [
                isDone && lastCompletion
                  ? {
                      text: `fatta da ${lastCompletion.user.firstName} ${lastCompletion.user.lastName} · ${relativeDayLabel(lastCompletion.completedAt)}`,
                      alarming: false,
                    }
                  : { text: relativeDayLabel(task.dueDate), alarming: false },
                late ? { text: "in ritardo", alarming: true } : null,
                !isDone && task.isUrgent ? { text: "urgente", alarming: true } : null,
                !task.assignedToAll && task.assignedTo
                  ? {
                      text: `${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
                      alarming: false,
                    }
                  : null,
                !task.assignedToAll && !task.assignedTo
                  ? { text: "non assegnata", alarming: false }
                  : null,
                task.createdBy.id === session.user.id
                  ? null
                  : { text: `da ${task.createdBy.firstName}`, alarming: false },
                repeats ? { text: repeats, alarming: false } : null,
                !task.requiresConfirmation && !isDone
                  ? { text: "solo da leggere", alarming: false }
                  : null,
              ].filter((part): part is { text: string; alarming: boolean } => part !== null);

              // Who else confirmed it. On a note for the whole team that list
              // is the proof the check was done, so it stays.
              const extraCompletions = task.completions
                .slice(1)
                .map((completion) => completion.user.firstName)
                .join(", ");

              return (
                <SwipeRevealAction
                  key={task.id}
                  enabled={canDeleteTask}
                  action={
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        type="submit"
                        aria-label="Elimina nota"
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 18,
                          border: "1px solid #fecaca",
                          background: "#ef4444",
                          color: "#ffffff",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </form>
                  }
                >
                <div
                  className="workbit-note-card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 12,
                    padding: "13px 14px",
                    borderRadius: 18,
                    border: "1px solid #e9edf3",
                    borderLeft: accent ? `3px solid ${accent}` : "1px solid #e9edf3",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                    <strong
                      style={{
                        fontSize: 15.5,
                        letterSpacing: "-0.015em",
                        color: isDone ? "#94a3b8" : "#0f172a",
                        textDecoration: isDone ? "line-through" : "none",
                      }}
                    >
                      {task.title}
                    </strong>
                    <span style={{ fontSize: 12.5, color: "#64748b", fontWeight: 650 }}>
                      {metaParts.map((part, index) => (
                        <span key={part.text}>
                          {index > 0 ? " · " : ""}
                          <span style={part.alarming ? { color: "#b91c1c", fontWeight: 800 } : undefined}>
                            {part.text}
                          </span>
                        </span>
                      ))}
                    </span>
                    {extraCompletions.length > 0 ? (
                      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 650 }}>
                        anche {extraCompletions}
                      </span>
                    ) : null}
                  </div>

                  {canComplete ? (
                    <form action={completeTaskAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="notifySuccess" value="1" />
                      <IconButton
                        type="submit"
                        aria-label="Completa nota"
                        title="Completa nota"
                        style={{
                          width: 40,
                          height: 40,
                          background: "#dcfce7",
                          color: "#166534",
                          border: "1px solid #bbf7d0",
                          fontSize: 15,
                          fontWeight: 900,
                        }}
                      >
                        ✓
                      </IconButton>
                    </form>
                  ) : null}
                </div>
                </SwipeRevealAction>
              );
            })}
          </ItemList>
        )}
      </Panel>
    </Stack>
  );
}
