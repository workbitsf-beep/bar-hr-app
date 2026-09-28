import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageTrainingAndDocuments } from "@/lib/permissions";
import { createCourseAction, deleteCourseAction } from "../actions";
import { getDashboardContext } from "../context";
import { CourseComposeForm } from "./course-compose-form";
import {
  getCourseKind,
  getCourseUrgency,
  type CourseUrgency,
} from "@/lib/course-kinds";
import { BillingRequiredState, EmptyState, Panel, Stack, SuccessCallout } from "../ui";
import { PopupAction } from "../popup-action";
import { SwipeRevealAction } from "../swipe-reveal-action";

export default async function DashboardCoursesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const { session, role, activeBarId, billingStatus, features } =
    await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Corsi">
        <EmptyState message="Seleziona un locale attivo per gestire i corsi." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  if (!features.courses) {
    return (
      <Panel title="Corsi">
        <EmptyState message="Modulo corsi disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const canManage = canManageTrainingAndDocuments(role as Role);
  const successMessage = success === "course-created" ? "Corso salvato correttamente." : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [courses, members] = await Promise.all([
    prisma.course.findMany({
      where: {
        barId: activeBarId,
        ...(canManage
          ? {}
          : {
              OR: [{ assignedToAll: true }, { assignedToId: session.user.id }],
            }),
      },
      orderBy: {
        startsAt: "desc",
      },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        kind: true,
        expiresAt: true,
        startsAt: true,
        endsAt: true,
        location: true,
        assignedToAll: true,
        assignedTo: {
          select: {
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
          orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
          select: {
            role: true,
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

  // A course in a venue is a deadline as much as an event, so the page is
  // sorted by how much trouble each one is rather than by date. Both the owner
  // and the employee get this: the employee sees their own expiries, which is
  // the half that was missing most.
  const groups: { key: CourseUrgency; label: string; tone: "bad" | "warn" | "plain" | "good" }[] = [
    { key: "expired", label: "Scaduti", tone: "bad" },
    { key: "expiring", label: "In scadenza", tone: "warn" },
    { key: "upcoming", label: "In programma", tone: "plain" },
    { key: "valid", label: "In regola", tone: "good" },
    { key: "past", label: "Già fatti", tone: "plain" },
  ];

  const byUrgency = new Map<CourseUrgency, typeof courses>();

  for (const course of courses) {
    const urgency = getCourseUrgency(course);
    byUrgency.set(urgency, (byUrgency.get(urgency) ?? []).concat(course));
  }

  const expiredCount = byUrgency.get("expired")?.length ?? 0;
  const expiringCount = byUrgency.get("expiring")?.length ?? 0;

  const headline =
    expiredCount > 0
      ? `${expiredCount} ${expiredCount === 1 ? "corso scaduto" : "corsi scaduti"}`
      : expiringCount > 0
        ? `${expiringCount} in scadenza`
        : courses.length === 0
          ? "Nessun corso registrato"
          : "Tutto in regola";

  const monthLabel = (value: Date) =>
    new Intl.DateTimeFormat("it-IT", { month: "short", timeZone: "Europe/Rome" })
      .format(value)
      .replace(/\.$/, "");

  function describeCourse(course: (typeof courses)[number], urgency: CourseUrgency) {
    const who = course.assignedToAll
      ? "Tutto il team"
      : course.assignedTo
        ? `${course.assignedTo.firstName} ${course.assignedTo.lastName}`
        : "Non assegnato";

    if (urgency === "expired" && course.expiresAt) {
      return `${who} · scaduto il ${course.expiresAt.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`;
    }

    if (urgency === "expiring" && course.expiresAt) {
      const days = Math.max(
        0,
        Math.round((course.expiresAt.getTime() - Date.now()) / 86_400_000)
      );

      return `${who} · scade fra ${days === 1 ? "1 giorno" : `${days} giorni`}`;
    }

    if (urgency === "valid" && course.expiresAt) {
      return `${who} · fino al ${course.expiresAt.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}`;
    }

    const time = course.startsAt.toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    });

    return [who, urgency === "upcoming" ? time : null, course.location]
      .filter(Boolean)
      .join(" · ");
  }

  return (
    <Stack className="workbit-courses-page">
      {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}

      <Panel
        title="Corsi"
        className="workbit-courses-panel"
        action={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 800,
                color: expiredCount > 0 ? "#b91c1c" : expiringCount > 0 ? "#92400e" : "#64748b",
              }}
            >
              {headline}
            </span>
            {canManage ? (
              <PopupAction title="Nuovo corso" ariaLabel="Aggiungi corso">
                <CourseComposeForm
                  action={createCourseAction}
                  members={members.map((member) => ({
                    id: member.user.id,
                    label: `${member.user.firstName} ${member.user.lastName} - ${member.role}`,
                  }))}
                />
              </PopupAction>
            ) : null}
          </div>
        }
      >
        {courses.length === 0 ? (
          <EmptyState
            message={
              canManage
                ? "Nessun corso registrato. HACCP, antincendio e primo soccorso scadono: segnali qui e Workbit ti avvisa prima."
                : "Nessun corso registrato per te."
            }
          />
        ) : (
          <div style={{ display: "grid", gap: 9 }}>
            {groups.map((group) => {
              const items = byUrgency.get(group.key) ?? [];

              if (items.length === 0) {
                return null;
              }

              const tone =
                group.tone === "bad"
                  ? "#b91c1c"
                  : group.tone === "warn"
                    ? "#92400e"
                    : group.tone === "good"
                      ? "#15803d"
                      : "#94a3b8";

              return (
                <div key={group.key} style={{ display: "grid", gap: 9 }}>
                  <span
                    style={{
                      marginTop: 3,
                      fontSize: 11.5,
                      fontWeight: 820,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: tone,
                    }}
                  >
                    {group.label} · {items.length}
                  </span>

                  {items.map((course) => {
                    const kind = getCourseKind(course.kind);
                    const anchor = course.expiresAt ?? course.startsAt;
                    const alarming = group.tone === "bad" || group.tone === "warn";

                    return (
                      <SwipeRevealAction
                        key={course.id}
                        enabled={canManage}
                        action={
                          <form action={deleteCourseAction}>
                            <input type="hidden" name="courseId" value={course.id} />
                            <button
                              type="submit"
                              aria-label="Elimina corso"
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
                          style={{
                            display: "grid",
                            gridTemplateColumns: "44px minmax(0, 1fr)",
                            alignItems: "center",
                            gap: 11,
                            padding: "11px 12px",
                            borderRadius: 16,
                            border: `1px solid ${
                              group.tone === "bad"
                                ? "#f6cfcf"
                                : group.tone === "warn"
                                  ? "#fde68a"
                                  : "#e9edf3"
                            }`,
                            background:
                              group.tone === "bad"
                                ? "#fdecec"
                                : group.tone === "warn"
                                  ? "#fffbeb"
                                  : "#ffffff",
                            opacity: group.key === "past" ? 0.75 : 1,
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 44,
                              display: "grid",
                              justifyItems: "center",
                              padding: "5px 0",
                              borderRadius: 12,
                              background: alarming ? "#ffffff" : group.tone === "good" ? "#e9f7ee" : "#f3e8ff",
                              color: alarming
                                ? tone
                                : group.tone === "good"
                                  ? "#15803d"
                                  : "#4c1d95",
                            }}
                          >
                            <span style={{ fontSize: 16, fontWeight: 850, lineHeight: 1 }}>
                              {anchor.getDate()}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 850,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                              }}
                            >
                              {monthLabel(anchor)}
                            </span>
                          </span>

                          <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                            <strong
                              style={{
                                fontSize: 14.5,
                                letterSpacing: "-0.015em",
                                color: "#0f172a",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {kind.emoji} {course.title}
                            </strong>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: alarming ? 800 : 680,
                                color: alarming ? tone : "#64748b",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {describeCourse(course, group.key)}
                            </span>
                          </span>
                        </div>
                      </SwipeRevealAction>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </Stack>
  );
}
