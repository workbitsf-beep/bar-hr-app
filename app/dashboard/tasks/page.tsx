import { BillingRequired } from "../billing-required";
import { Role } from "@prisma/client";
import { can, hasWholeScope } from "@/lib/staff-permissions";
import { prisma } from "@/lib/prisma";
import { describeTaskRepeat, nextTaskDueDate } from "@/lib/task-recurrence";
import { describeAssignees, groupSharedTasks } from "@/lib/task-groups";
import { buildNoteMeta } from "@/lib/note-list-format";
import Link from "next/link";
import { chipsOf, NoteCard, tickStyle } from "./note-card";
import {
  completeTaskAction,
  createTaskAction,
  deleteAllCompletedTasksAction,
  deleteTaskAction,
} from "../actions";
import { getDashboardContext } from "../context";
import { NotesAside } from "../desktop-asides";
import { EmptyState, Panel } from "../ui";
import { PopupAction } from "../popup-action";
import { SwipeRevealAction } from "../swipe-reveal-action";
import { TaskComposeForm } from "./task-compose-form";
import { ConfirmationArchive } from "./confirmation-archive";
import { confirmedTaskArchived } from "@/lib/note-visibility";
import { getVenueDepartments, staffDepartments } from "@/lib/departments";
import { ActionForm } from "@/app/components/action-form";

export default async function DashboardTasksPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const requestedTab = Array.isArray(params.vista) ? params.vista[0] : params.vista;
  const { session, role, staff, activeBarId, billingStatus, features } = await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Contenuti">
        <EmptyState message="Seleziona un locale attivo per gestire i contenuti." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequired role={String(role)} />;
  }

  const notesEnabled = features.tasks || features.noticeBoard;

  if (!notesEnabled) {
    return (
      <Panel title="Note">
        <EmptyState message="Modulo note disattivato nelle impostazioni." />
      </Panel>
    );
  }

  // "Note e avvisi", as the owner chose (lib/staff-permissions).
  const canManage = can(staff, "notes");
  const departments = await getVenueDepartments(activeBarId, session.user.id);
  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
          where: {
            barId: activeBarId,
            // Confirmed a day ago or more: in the archive, not on the page.
            NOT: confirmedTaskArchived(),
            ...(!canManage
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
            department: true,
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

  // Three tabs, by what the note asks: something to do, something to read,
  // a check that comes back. Department and date travel as chips on the card.
  const groupedTasks = groupSharedTasks(tasks);
  type Group = (typeof groupedTasks)[number];
  const tabOf = (group: Group) => (group.lead.repeatEvery ? "controlli" : !group.lead.requiresConfirmation ? "avvisi" : "fare");
  const isDoneGroup = (group: Group) => group.members.every((member) => member.status === "DONE");
  const TABS = [
    { id: "fare", label: "Da fare" },
    { id: "avvisi", label: "Avvisi" },
    { id: "controlli", label: "Controlli" },
  ] as const;
  const pendingIn = (id: string) => groupedTasks.filter((group) => tabOf(group) === id && !isDoneGroup(group)).length;
  const tab = TABS.some((entry) => entry.id === requestedTab) ? (requestedTab as string) : "fare";
  const inTab = groupedTasks.filter((group) => tabOf(group) === tab);
  const pending = inTab.filter((group) => !isDoneGroup(group));
  const finished = inTab.filter(isDoneGroup);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const departmentName = (id: string | null) =>
    departments.enabled && id && id !== "JOLLY" ? staffDepartments(departments.list).find((entry) => entry.id === id)?.name ?? null : null;

  function card(group: Group) {
    // A note given to several people comes back as one card here, with
    // everyone's name; each of them still confirms their own.
    const task = group.lead;
    const isDone = isDoneGroup(group);
    const pendingIds = group.members
      .filter((member) => member.status !== "DONE")
      .map((member) => member.id)
      .join(",");
    const canComplete =
      !isDone && task.requiresConfirmation && (canManage || task.assignedToAll || task.assignedToId === session.user.id);
    const canDeleteTask = canManage || task.createdBy.id === session.user.id;
    const allCompletions = group.members
      .flatMap((member) => member.completions)
      .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    const lastCompletion = allCompletions[0];
    const repeatLabel = describeTaskRepeat(task.repeatEvery, task.repeatUnit);
    const meta = buildNoteMeta({
      dueDate: task.dueDate,
      done: isDone,
      urgent: task.isUrgent,
      requiresConfirmation: task.requiresConfirmation,
      repeatLabel,
      assignedLabel: task.assignedToAll ? null : describeAssignees(group.members),
      authorLabel: task.createdBy.id === session.user.id ? null : task.createdBy.firstName,
      completedBy: lastCompletion
        ? { name: `${lastCompletion.user.firstName} ${lastCompletion.user.lastName}`, at: lastCompletion.completedAt }
        : null,
    });
    const chips = chipsOf(meta, { ahead: task.dueDate > todayEnd, repeat: Boolean(repeatLabel), department: departmentName(task.department),
      date: task.dueDate,
      // A check that comes back says when: the occurrence after this one.
      next: task.repeatEvery && task.repeatUnit ? nextTaskDueDate(task.dueDate, { repeatEvery: task.repeatEvery, repeatUnit: task.repeatUnit }, task.dueDate) : null,
    });
    // On a team check, who else confirmed it is the proof it was done.
    const extraCompletions = (group.members.length > 1 ? [] : allCompletions)
      .slice(1)
      .map((completion) => completion.user.firstName)
      .join(", ");

    return (
      <SwipeRevealAction
        key={group.ids}
        enabled={canDeleteTask}
        action={
          <ActionForm action={deleteTaskAction} success="Nota eliminata.">
            <input type="hidden" name="taskId" value={group.ids} />
            <button
              type="submit"
              aria-label="Elimina nota"
              style={{ width: 54, height: 54, borderRadius: 18, border: 0, background: "#ef4444", color: "#ffffff", cursor: "pointer" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </ActionForm>
        }
      >
        <NoteCard
          title={task.title}
          chips={chips}
          done={isDone}
          urgent={task.isUrgent || meta.late}
          footnote={extraCompletions ? `anche ${extraCompletions}` : null}
          tick={
            canComplete ? (
              <ActionForm action={completeTaskAction} success="Nota fatta.">
                <input type="hidden" name="taskId" value={pendingIds} />
                <input type="hidden" name="notifySuccess" value="1" />
                <button type="submit" aria-label="Segna come fatta" title="Segna come fatta" style={tickStyle}>
                  ✓
                </button>
              </ActionForm>
            ) : task.requiresConfirmation ? (
              <span aria-hidden style={{ ...tickStyle, cursor: "default", opacity: 0.4 }}>
                ✓
              </span>
            ) : null
          }
        />
      </SwipeRevealAction>
    );
  }

  const composeMembers = members
    .map((member) => ({ id: member.user.id, firstName: member.user.firstName, lastName: member.user.lastName }))
    .filter((member) =>
      canManage
        ? members.some((source) => source.user.id === member.id && source.role !== Role.OWNER)
        : member.id === session.user.id
    );
  const emptyText = tab === "avvisi" ? "Nessun avviso." : tab === "controlli" ? "Nessun controllo periodico." : "Niente da fare.";

  return (
    <div className="wb-desk-split">
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 640, margin: "0 auto", width: "100%", padding: "4px 4px 8px", color: "#1f1b3a" }}>
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}>Note</h1>
          <PopupAction
            title="Nuova nota"
            ariaLabel="Aggiungi nota"
            triggerRow={
              <span style={{ width: 42, height: 42, borderRadius: 999, background: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 2px rgba(31,27,58,.06)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            }
          >
            <TaskComposeForm action={createTaskAction} members={composeMembers} canChooseAudience={canManage} />
          </PopupAction>
        </header>

        <nav aria-label="Tipi di nota" style={{ display: "flex", background: "#eeebf7", borderRadius: 14, padding: 3 }}>
          {TABS.map((entry) => {
            const active = entry.id === tab;
            const count = pendingIn(entry.id);
            return (
              <Link
                key={entry.id}
                href={entry.id === "fare" ? "/dashboard/tasks" : `/dashboard/tasks?vista=${entry.id}`}
                scroll={false}
                aria-current={active ? "page" : undefined}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "center",
                  padding: "9px 0",
                  borderRadius: 11,
                  fontSize: 14,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  color: active ? "#1f1b3a" : "#5b5675",
                  fontWeight: active ? 600 : 500,
                  background: active ? "#ffffff" : "transparent",
                  boxShadow: active ? "0 1px 2px rgba(31,27,58,.08)" : "none",
                }}
              >
                {entry.label}
                {count ? ` · ${count}` : ""}
              </Link>
            );
          })}
        </nav>

        {pending.length ? (
          <div style={{ display: "grid", gap: 10 }}>{pending.map(card)}</div>
        ) : (
          <div style={{ background: "#ffffff", borderRadius: 20, padding: "16px 18px", fontSize: 15, color: "#8a85a3" }}>{emptyText}</div>
        )}

        {finished.length ? (
          <details className="wb-week" style={{ display: "grid", gap: 10 }}>
            <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, padding: "4px 16px", fontSize: 13.5, color: "#8a85a3" }}>
              <span style={{ flex: 1 }}>Fatte · {finished.length}</span>
              <span aria-hidden className="wb-week-chev" style={{ color: "#c4c0d6", fontSize: 16 }}>›</span>
            </summary>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {finished.map(card)}
              {canManage && hasWholeScope(staff) ? (
                <ActionForm action={deleteAllCompletedTasksAction} success="Note fatte eliminate." style={{ display: "flex", justifyContent: "center" }}>
                  <button type="submit" style={{ border: 0, background: "transparent", color: "#b3202f", fontSize: 14.5, cursor: "pointer", minHeight: 40 }}>
                    Elimina le note fatte
                  </button>
                </ActionForm>
              ) : null}
            </div>
          </details>
        ) : null}

        {canManage ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PopupAction
              title="Archivio conferme"
              ariaLabel="Apri archivio conferme"
              triggerRow={<span style={{ fontSize: 13.5, color: "#8a85a3", padding: "8px 12px", display: "inline-block" }}>Archivio delle conferme ›</span>}
            >
              <ConfirmationArchive barId={activeBarId} />
            </PopupAction>
          </div>
        ) : null}
      </div>
      <aside className="wb-desk-only">
        <NotesAside barId={activeBarId} userId={session.user.id} manage={canManage} />
      </aside>
    </div>
  );
}
