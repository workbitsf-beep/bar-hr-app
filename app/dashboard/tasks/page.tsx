import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { describeTaskRepeat } from "@/lib/task-recurrence";
import { describeAssignees, groupSharedTasks } from "@/lib/task-groups";
import { buildNoteMeta } from "@/lib/note-list-format";
import { NoteRow } from "../note-row";
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
  Stack,
  SuccessCallout,
} from "../ui";
import { PopupAction } from "../popup-action";
import { SwipeRevealAction } from "../swipe-reveal-action";
import { TaskComposeForm } from "./task-compose-form";
import { ConfirmationArchive } from "./confirmation-archive";
import { confirmedTaskArchived } from "@/lib/note-visibility";

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
            // Confirmed a day ago or more: in the archive, not on the page.
            NOT: confirmedTaskArchived(),
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
            createdAt: true,
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
          <div className="workbit-notes-actions">
            {canManage && tasks.some((task) => task.status === "DONE") ? (
              <form action={deleteAllCompletedTasksAction} style={{ display: "contents" }}>
                <button
                  type="submit"
                  className="workbit-notes-icon workbit-notes-icon--danger"
                  aria-label="Elimina note completate"
                  title="Elimina note completate"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 7h16M9 7V4.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7m-8.5 0 .8 12.2c.1.9.8 1.8 1.8 1.8h5.8c1 0 1.7-.9 1.8-1.8L17.5 7M10 11v6M14 11v6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </form>
            ) : null}
            {canManage ? (
              <PopupAction
                title="Archivio conferme"
                ariaLabel="Apri archivio conferme"
                className="workbit-notes-icon workbit-notes-icon--archive"
                triggerContent={
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M3 7.5c0-1.1.9-2 2-2h4.2l2 2.2H19c1.1 0 2 .9 2 2v7.8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7.5Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                }
              >
                <ConfirmationArchive barId={activeBarId} />
              </PopupAction>
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
            {groupSharedTasks(tasks).map((group) => {
              // A note given to several people comes back as one row here,
              // with everyone's name; each of them still confirms their own.
              const task = group.lead;
              const isDone = group.members.every((member) => member.status === "DONE");
              const pendingIds = group.members
                .filter((member) => member.status !== "DONE")
                .map((member) => member.id)
                .join(",");
              const canComplete =
                !isDone &&
                task.requiresConfirmation &&
                (canManage || task.assignedToAll || task.assignedToId === session.user.id);
              const canDeleteTask = canManage || task.createdBy.id === session.user.id;
              const allCompletions = group.members
                .flatMap((member) => member.completions)
                .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
              const lastCompletion = allCompletions[0];
              const meta = buildNoteMeta({
                dueDate: task.dueDate,
                done: isDone,
                urgent: task.isUrgent,
                requiresConfirmation: task.requiresConfirmation,
                repeatLabel: describeTaskRepeat(task.repeatEvery, task.repeatUnit),
                assignedLabel: task.assignedToAll ? null : describeAssignees(group.members),
                authorLabel:
                  task.createdBy.id === session.user.id ? null : task.createdBy.firstName,
                completedBy: lastCompletion
                  ? {
                      name: `${lastCompletion.user.firstName} ${lastCompletion.user.lastName}`,
                      at: lastCompletion.completedAt,
                    }
                  : null,
              });

              // Who else confirmed it. On a note for the whole team that list
              // is the proof the check was done, so it stays.
              // On a shared note the ticks are already next to each name.
              const extraCompletions = (group.members.length > 1 ? [] : allCompletions)
                .slice(1)
                .map((completion) => completion.user.firstName)
                .join(", ");

              return (
                <SwipeRevealAction
                  key={group.ids}
                  enabled={canDeleteTask}
                  action={
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="taskId" value={group.ids} />
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
                <NoteRow
                  title={task.title}
                  meta={meta}
                  footnote={extraCompletions ? `anche ${extraCompletions}` : null}
                  action={
                    canComplete ? (
                      <form action={completeTaskAction}>
                        <input type="hidden" name="taskId" value={pendingIds} />
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
                    ) : null
                  }
                />
                </SwipeRevealAction>
              );
            })}
          </ItemList>
        )}
      </Panel>
    </Stack>
  );
}
