import type { CSSProperties, ReactNode } from "react";
import { CourseKind, Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { certificateState, daysLeft, latestOnly, type CertificateState } from "@/lib/course-certificates";
import { getCourseKind } from "@/lib/course-kinds";
import { canManageTraining } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createCourseAction, deleteCourseAction } from "../actions";
import { BillingRequired } from "../billing-required";
import { getDashboardContext } from "../context";
import { PopupAction } from "../popup-action";
import { Quiet, Sheet } from "../presenze/payroll-ui";
import { EmptyState, Panel } from "../ui";
import { deleteCertificateAction } from "./certificate-actions";
import { AddFileButton, CertificateButton, CertificateLink, ReminderDays } from "./certificate-ui";
import { CourseComposeForm } from "./course-compose-form";

export const dynamic = "force-dynamic";

const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });
const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

const TONE: Record<CertificateState, string> = { expired: "#b3202f", expiring: "#b45309", valid: "#0f7a4f", lasting: "#8a85a3" };
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", borderTop: "1px solid #f2f0f8", color: "#1f1b3a" };
const dot = (color: string): CSSProperties => ({ width: 8, height: 8, borderRadius: 999, background: color, flex: "0 0 auto" });
const link: CSSProperties = { border: 0, background: "transparent", padding: 0, color: "#5e4ae3", fontSize: 14.5, fontWeight: 600, cursor: "pointer" };
const quietButton: CSSProperties = { ...link, color: "#8a85a3", fontWeight: 500 };

function courseName(item: { kind: CourseKind; title: string }) {
  return item.kind === CourseKind.OTHER ? item.title : getCourseKind(item.kind).label;
}

function stateText(state: CertificateState, expiresAt: Date | null) {
  if (!expiresAt) return "non scade";
  if (state === "expired") return `scaduto il ${shortDate.format(expiresAt)}`;
  if (state === "expiring") {
    const left = daysLeft(expiresAt);
    return `scade fra ${left} ${left === 1 ? "giorno" : "giorni"}`;
  }
  return `fino al ${shortDate.format(expiresAt)}`;
}

function Group({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "0 4px" }}>
        <span style={{ fontSize: 13, color: "#8a85a3" }}>{title}</span>
        {aside}
      </div>
      <Sheet>
        <div style={{ marginTop: -1 }}>{children}</div>
      </Sheet>
    </section>
  );
}

/**
 * Courses as what a venue must keep in order: who is covered, what is
 * missing or lapsing, and the courses ahead. Reminders go out on their own.
 */
export default async function DashboardCoursesPage() {
  const { session, role, activeBarId, billingStatus, features } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Corsi">
        <EmptyState message="Seleziona un locale attivo per gestire i corsi." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (!features.courses) {
    return (
      <Panel title="Corsi">
        <EmptyState message="Modulo corsi disattivato nelle impostazioni." />
      </Panel>
    );
  }

  const manager = canManageTraining(role as Role);
  const now = new Date();
  const [settings, members, certificates, courses] = await Promise.all([
    prisma.barSettings.findUnique({ where: { barId: activeBarId }, select: { courseReminderDays: true } }),
    prisma.employeeBar.findMany({
      where: { barId: activeBarId, isActive: true, role: { not: Role.OWNER } },
      orderBy: [{ user: { lastName: "asc" } }, { user: { firstName: "asc" } }],
      select: { role: true, user: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.courseCertificate.findMany({
      where: { barId: activeBarId, ...(manager ? {} : { userId: session.user.id }) },
      orderBy: { completedAt: "desc" },
      select: { id: true, userId: true, kind: true, title: true, courseId: true, completedAt: true, expiresAt: true, fileName: true, fileSize: true },
    }),
    prisma.course.findMany({
      where: { barId: activeBarId, ...(manager ? {} : { OR: [{ assignedToAll: true }, { assignedToId: session.user.id }] }) },
      orderBy: { startsAt: "asc" },
      take: 300,
      select: { id: true, title: true, kind: true, startsAt: true, endsAt: true, location: true, assignedToAll: true, assignedToId: true },
    }),
  ]);
  const lead = settings?.courseReminderDays ?? 60;
  const people = members.map((member) => member.user);
  const nameOf = new Map(people.map((person) => [person.id, `${person.firstName} ${person.lastName}`.trim()]));
  const memberOptions = people.map((person) => ({ id: person.id, name: `${person.firstName} ${person.lastName}`.trim() }));

  const rank: Record<CertificateState, number> = { expired: 0, expiring: 1, valid: 2, lasting: 3 };
  const current = latestOnly(certificates)
    .map((certificate) => ({ ...certificate, state: certificateState(certificate.expiresAt, lead, now) }))
    .sort((a, b) => rank[a.state] - rank[b.state]);
  const upcoming = courses.filter((course) => course.endsAt >= now);

  // Courses done that still miss someone's certificate, one row per person.
  const withCertificate = new Set(certificates.filter((item) => item.courseId).map((item) => `${item.courseId}:${item.userId}`));
  const toUpload = manager
    ? courses
        .filter((course) => course.endsAt < now && course.endsAt.getTime() > now.getTime() - 120 * 86_400_000)
        .flatMap((course) =>
          (course.assignedToAll ? people.map((person) => person.id) : course.assignedToId ? [course.assignedToId] : [])
            .filter((userId) => nameOf.has(userId) && !withCertificate.has(`${course.id}:${userId}`))
            .map((userId) => ({ course, userId })),
        )
        .reverse()
    : [];

  const byPerson = new Map<string, typeof current>();
  for (const item of current) byPerson.set(item.userId, [...(byPerson.get(item.userId) ?? []), item]);
  const covered = people.filter((person) => {
    const items = byPerson.get(person.id) ?? [];
    return items.length > 0 && items.every((item) => item.state === "valid" || item.state === "lasting");
  }).length;

  const certificateLine = (item: (typeof current)[number], withName: boolean) => (
    <div key={item.id} style={{ ...row, alignItems: "flex-start" }}>
      <span style={{ ...dot(TONE[item.state]), marginTop: 7 }} />
      <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 3 }}>
        <span style={{ fontSize: 16 }}>
          {withName ? `${nameOf.get(item.userId) ?? "Persona"} · ` : ""}
          {courseName(item)}
        </span>
        <span style={{ fontSize: 13.5, color: TONE[item.state] }}>
          {stateText(item.state, item.expiresAt)}
          <span style={{ color: "#8a85a3" }}> · fatto il {shortDate.format(item.completedAt)}</span>
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingTop: 4 }}>
          {item.fileSize ? (
            <CertificateLink certificateId={item.id} fileName={item.fileName ?? "attestato"} style={link} />
          ) : (
            <AddFileButton certificateId={item.id} style={{ ...link, color: "#b45309" }} />
          )}
          {manager && (item.state === "expired" || item.state === "expiring") ? (
            <CertificateButton members={memberOptions} selfId={session.user.id} preset={{ userId: item.userId, kind: item.kind, title: item.title }} trigger="Rinnovato" style={link} />
          ) : null}
          {manager ? (
            <ActionForm action={deleteCertificateAction} success="Attestato tolto" style={{ display: "inline" }}>
              <input type="hidden" name="certificateId" value={item.id} />
              <PendingButton type="submit" pendingLabel="…" style={quietButton}>
                Togli
              </PendingButton>
            </ActionForm>
          ) : null}
        </span>
      </span>
    </div>
  );

  const plus = (
    <CertificateButton
      members={manager ? memberOptions : null}
      selfId={session.user.id}
      trigger={
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      }
      style={{ width: 42, height: 42, borderRadius: 999, border: 0, background: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 1px 2px rgba(31,27,58,.06)" }}
    />
  );

  // Each person's card: the ring tells the worst state, the sentence the most urgent fact.
  const STANDARD: CourseKind[] = [CourseKind.HACCP, CourseKind.FIRE_SAFETY, CourseKind.FIRST_AID];
  const BADGE: Record<CertificateState | "missing", { background: string; color: string }> = {
    expired: { background: "#fdecec", color: "#b3202f" },
    expiring: { background: "#fff4dc", color: "#b45309" },
    valid: { background: "#e7f7ef", color: "#0f7a4f" },
    lasting: { background: "#e7f7ef", color: "#0f7a4f" },
    missing: { background: "#f4f3f9", color: "#9a95b2" },
  };
  const RING: Record<string, string> = { expired: "#e5484d", expiring: "#f59e0b", valid: "#10b981", lasting: "#10b981", none: "#d9d5e8" };
  const monthYear = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
  const cards = (manager ? people : people.filter((person) => person.id === session.user.id).concat(nameOf.has(session.user.id) ? [] : [{ id: session.user.id, firstName: session.user.firstName ?? "", lastName: session.user.lastName ?? "" }]))
    .map((person) => {
      const items = byPerson.get(person.id) ?? [];
      const worst = items[0]?.state ?? null;
      const kinds = new Map(items.map((item) => [item.kind === CourseKind.OTHER ? `o:${item.title.toLowerCase()}` : item.kind, item]));
      const badges = [
        ...STANDARD.map((kind) => ({ key: kind, label: getCourseKind(kind).label, state: (kinds.get(kind)?.state ?? "missing") as CertificateState | "missing" })),
        ...items.filter((item) => item.kind === CourseKind.OTHER).map((item) => ({ key: item.id, label: item.title, state: item.state as CertificateState | "missing" })),
      ];
      const urgent = items.find((item) => item.state === "expired") ?? items.find((item) => item.state === "expiring") ?? null;
      const nextExpiry = items.filter((item) => item.expiresAt).sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())[0];
      const sentence = urgent
        ? `${courseName(urgent)} ${stateText(urgent.state, urgent.expiresAt)}`
        : items.length
          ? nextExpiry
            ? `In regola fino a ${monthYear.format(nextExpiry.expiresAt!)}`
            : "In regola"
          : "Nessun attestato";
      return { person, items, worst, badges, sentence, order: worst ? rank[worst] : 4 };
    })
    .sort((a, b) => a.order - b.order || a.person.lastName.localeCompare(b.person.lastName, "it"));

  return (
    <div style={{ display: "grid", gap: 18, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 640, margin: "0 auto", width: "100%", padding: "4px 4px 8px" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}>Corsi</h1>
          <Quiet style={{ fontSize: 15 }}>{manager ? `${covered} di ${people.length} in regola` : "I tuoi attestati"}</Quiet>
        </div>
        <span aria-label={manager ? "Aggiungi un attestato" : "Carica un attestato"}>{plus}</span>
      </header>

      {toUpload.length ? (
        <details style={{ background: "#f1eeff", borderRadius: 16 }}>
          <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "13px 16px" }}>
            <span style={dot("#6d5ce7")} />
            <span style={{ flex: 1, fontSize: 15, color: "#4c1d95" }}>
              {toUpload.length} {toUpload.length === 1 ? "attestato da caricare" : "attestati da caricare"}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#4c1d95" }}>Vedi</span>
          </summary>
          <div style={{ background: "#ffffff", borderRadius: "0 0 16px 16px" }}>
            {toUpload.map(({ course, userId }) => (
              <div key={`${course.id}:${userId}`} style={row}>
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
                  <span style={{ fontSize: 15.5 }}>{nameOf.get(userId)}</span>
                  <Quiet style={{ fontSize: 13 }}>
                    {course.title} · {dayMonth.format(course.startsAt)}
                  </Quiet>
                </span>
                <CertificateButton
                  members={memberOptions}
                  selfId={session.user.id}
                  preset={{ userId, kind: course.kind, title: course.title, courseId: course.id, completedAt: course.startsAt.toISOString().slice(0, 10) }}
                  trigger="Carica"
                  style={link}
                />
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {cards.length ? (
        cards.map(({ person, items, worst, badges, sentence }) => (
          <details key={person.id} style={{ background: "#ffffff", borderRadius: 22, boxShadow: "0 1px 2px rgba(31,27,58,.04)" }}>
            <summary style={{ listStyle: "none", cursor: "pointer", padding: 16, display: "grid", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  aria-hidden
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 999,
                    background: "#ffffff",
                    boxShadow: `inset 0 0 0 2.5px ${RING[worst ?? "none"]}`,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#1f1b3a",
                    flex: "0 0 auto",
                  }}
                >
                  {`${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toUpperCase()}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                  <span style={{ fontSize: 16.5 }}>{`${person.firstName} ${person.lastName}`.trim()}</span>
                  <span style={{ fontSize: 13.5, color: worst === "expired" || worst === "expiring" ? TONE[worst] : "#8a85a3" }}>{sentence}</span>
                </span>
                <span style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>
              </span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {badges.map((badge) => (
                  <span key={badge.key} style={{ borderRadius: 999, padding: "6px 11px", fontSize: 12.5, fontWeight: badge.state === "missing" ? 500 : 600, ...BADGE[badge.state] }}>
                    {badge.label}
                  </span>
                ))}
              </span>
            </summary>
            <div style={{ borderTop: "1px solid #f2f0f8" }}>
              <div style={{ marginTop: -1 }}>
                {items.map((item) => certificateLine(item, false))}
                <div style={row}>
                  <CertificateButton
                    members={manager ? memberOptions : null}
                    selfId={session.user.id}
                    preset={manager ? { userId: person.id } : undefined}
                    trigger="+ Aggiungi un attestato"
                    style={link}
                  />
                </div>
              </div>
            </div>
          </details>
        ))
      ) : (
        <Sheet>
          <div style={row}>
            <Quiet>Aggiungi le persone del locale per seguire i loro corsi.</Quiet>
          </div>
        </Sheet>
      )}

      <Group
        title="In programma"
        aside={
          manager ? (
            <PopupAction title="Nuovo corso" ariaLabel="Programma un corso" triggerContent="Programma un corso">
              <CourseComposeForm action={createCourseAction} members={members.map((member) => ({ id: member.user.id, label: `${member.user.firstName} ${member.user.lastName} - ${member.role}` }))} />
            </PopupAction>
          ) : undefined
        }
      >
        {upcoming.length ? (
          upcoming.map((course) => (
            <div key={course.id} style={row}>
              <span style={{ width: 52, display: "grid", justifyItems: "center", lineHeight: 1.1, flex: "0 0 auto" }}>
                <span style={{ fontSize: 18, fontWeight: 650 }}>{course.startsAt.toLocaleDateString("it-IT", { day: "numeric", timeZone: "Europe/Rome" })}</span>
                <Quiet style={{ fontSize: 12, textTransform: "capitalize" }}>{course.startsAt.toLocaleDateString("it-IT", { month: "short", timeZone: "Europe/Rome" }).replace(".", "")}</Quiet>
              </span>
              <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
                <span style={{ fontSize: 16 }}>{course.title}</span>
                <Quiet style={{ fontSize: 13.5 }}>
                  {[course.assignedToAll ? "Tutto il team" : nameOf.get(course.assignedToId ?? "") ?? "", `${clock.format(course.startsAt)}–${clock.format(course.endsAt)}`, course.location]
                    .filter(Boolean)
                    .join(" · ")}
                </Quiet>
              </span>
              {manager ? (
                <ActionForm action={deleteCourseAction} success="Corso annullato">
                  <input type="hidden" name="courseId" value={course.id} />
                  <PendingButton type="submit" pendingLabel="…" style={quietButton}>
                    Annulla
                  </PendingButton>
                </ActionForm>
              ) : null}
            </div>
          ))
        ) : (
          <div style={row}>
            <Quiet>Nessun corso in programma.</Quiet>
          </div>
        )}
      </Group>

      {manager ? (
        <Group title="Avvisi">
          <label style={{ ...row, borderTop: 0, cursor: "pointer" }}>
            <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
              <span style={{ fontSize: 16 }}>🔔 Primo avviso</span>
              <Quiet style={{ fontSize: 13 }}>A te e alla persona, poi a 30 e 7 giorni</Quiet>
            </span>
            <ReminderDays value={lead} />
            <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18 }}>›</span>
          </label>
        </Group>
      ) : null}
    </div>
  );
}
