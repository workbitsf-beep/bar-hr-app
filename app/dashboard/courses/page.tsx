import type { CSSProperties } from "react";
import { CourseKind, Role } from "@prisma/client";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { certificateKey, certificateState, daysLeft, latestOnly, type CertificateState } from "@/lib/course-certificates";
import { getCourseKind } from "@/lib/course-kinds";
import { canManageTraining } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createCourseAction, deleteCourseAction } from "../actions";
import { BillingRequired } from "../billing-required";
import { getDashboardContext } from "../context";
import { PopupAction } from "../popup-action";
import { Avatar, capStyle, Card, ghostButton, initials, SectionHead } from "../presenze/payroll-ui";
import { EmptyState, Panel } from "../ui";
import { deleteCertificateAction } from "./certificate-actions";
import { AddFileButton, CertificateButton, CertificateLink, ReminderDays } from "./certificate-ui";
import { CourseComposeForm } from "./course-compose-form";

export const dynamic = "force-dynamic";

const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const courseDay = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Rome" });
const clock = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

const STATE_LOOK: Record<CertificateState, { color: string; background: string }> = {
  expired: { color: "#b3202f", background: "#fdecec" },
  expiring: { color: "#b45309", background: "#fff4dc" },
  valid: { color: "#0f7a4f", background: "#e2f6ed" },
  lasting: { color: "#4b4763", background: "#f3f1fa" },
};

const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid #f1eff8", color: "#1f1b3a" };
const small: CSSProperties = { ...ghostButton, minHeight: 32, fontSize: 12.5, padding: "0 11px" };
const primary: CSSProperties = {
  ...ghostButton,
  border: 0,
  color: "#ffffff",
  background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
  boxShadow: "0 10px 22px rgba(124,58,237,.18)",
};

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

/**
 * Courses as what a venue has to keep in order: everyone's certificates,
 * valid, about to lapse or lapsed, with the file; the courses done that
 * still miss a certificate; the courses ahead. Reminders go out on their own.
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

  const current = latestOnly(certificates).map((certificate) => ({ ...certificate, state: certificateState(certificate.expiresAt, lead, now) }));
  const expired = current.filter((item) => item.state === "expired");
  const expiring = current.filter((item) => item.state === "expiring").sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());
  const upcoming = courses.filter((course) => course.endsAt >= now);

  // Courses done that still miss someone's certificate.
  const withCertificate = new Set(certificates.filter((item) => item.courseId).map((item) => `${item.courseId}:${item.userId}`));
  const toClose = manager
    ? courses
        .filter((course) => course.endsAt < now && course.endsAt.getTime() > now.getTime() - 120 * 86_400_000)
        .map((course) => {
          const attendees = course.assignedToAll ? people.map((person) => person.id) : course.assignedToId ? [course.assignedToId] : [];
          return { course, missing: attendees.filter((userId) => nameOf.has(userId) && !withCertificate.has(`${course.id}:${userId}`)) };
        })
        .filter((item) => item.missing.length > 0)
        .reverse()
    : [];

  const counts = { expired: expired.length, expiring: expiring.length };
  const headline = counts.expired
    ? `${counts.expired} ${counts.expired === 1 ? "attestato scaduto" : "attestati scaduti"}`
    : counts.expiring
      ? `${counts.expiring} in scadenza`
      : current.length
        ? "Tutto in regola"
        : "Nessun attestato ancora";

  const certificateRow = (item: (typeof current)[number], showName: boolean) => {
    const look = STATE_LOOK[item.state];
    return (
      <div key={item.id} style={{ ...row, alignItems: "flex-start" }}>
        {showName ? <Avatar text={initials(...((nameOf.get(item.userId) ?? "? ?").split(" ") as [string, string]))} size={32} /> : null}
        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
          <span style={{ fontSize: 15 }}>
            {showName ? `${nameOf.get(item.userId) ?? "Persona"} · ` : ""}
            {courseName(item)}
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "3px 9px", color: look.color, background: look.background }}>{stateText(item.state, item.expiresAt)}</span>
            <span style={{ fontSize: 12.5, color: "#6f6a88" }}>fatto il {shortDate.format(item.completedAt)}</span>
          </span>
          <span style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 2 }}>
            {item.fileSize ? (
              <CertificateLink certificateId={item.id} fileName={item.fileName ?? "attestato"} style={small} />
            ) : (
              <AddFileButton certificateId={item.id} style={{ ...small, color: "#b45309", background: "#fff7e8", border: "1px solid #fde7bd" }} />
            )}
            {manager && item.state !== "valid" && item.state !== "lasting" ? (
              <CertificateButton
                members={memberOptions}
                selfId={session.user.id}
                preset={{ userId: item.userId, kind: item.kind, title: item.title }}
                trigger="Rinnovato"
                style={small}
              />
            ) : null}
            {manager ? (
              <ActionForm action={deleteCertificateAction} success="Attestato tolto" style={{ display: "inline" }}>
                <input type="hidden" name="certificateId" value={item.id} />
                <PendingButton type="submit" pendingLabel="…" style={{ ...small, background: "transparent", border: "1px solid transparent", color: "#7c7894" }}>
                  Togli
                </PendingButton>
              </ActionForm>
            ) : null}
          </span>
        </span>
      </div>
    );
  };

  const byPerson = new Map<string, typeof current>();
  for (const item of current) byPerson.set(item.userId, [...(byPerson.get(item.userId) ?? []), item]);
  const rank: Record<CertificateState, number> = { expired: 0, expiring: 1, valid: 2, lasting: 3 };

  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 760, margin: "0 auto", width: "100%" }}>
      <header style={{ display: "grid", gap: 6, padding: "0 4px" }}>
        <span style={{ ...capStyle, color: "#0284c7" }}>Corsi</span>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 27, fontWeight: 750, letterSpacing: "-0.03em", color: counts.expired ? "#b3202f" : counts.expiring ? "#b45309" : "#1f1b3a" }}>
            {headline}
          </h1>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <CertificateButton members={manager ? memberOptions : null} selfId={session.user.id} trigger={manager ? "+ Attestato" : "+ Carica un attestato"} style={primary} />
            {manager ? (
              <PopupAction title="Nuovo corso" ariaLabel="Programma un corso" triggerContent="+ Corso">
                <CourseComposeForm action={createCourseAction} members={members.map((member) => ({ id: member.user.id, label: `${member.user.firstName} ${member.user.lastName} - ${member.role}` }))} />
              </PopupAction>
            ) : null}
          </div>
        </div>
      </header>

      {manager && (expired.length || expiring.length || toClose.length) ? (
        <section style={{ display: "grid", gap: 8 }}>
          <SectionHead title="Da sistemare" />
          <Card>
            <div style={{ marginTop: -1 }}>
              {[...expired, ...expiring].map((item) => certificateRow(item, true))}
              {toClose.map(({ course, missing }) => (
                <div key={course.id} style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: "#6d5ce7", flex: "0 0 auto" }} />
                    <span style={{ flex: 1, fontSize: 15 }}>
                      {course.title} del {courseDay.format(course.startsAt)}
                    </span>
                    <span style={{ fontSize: 12.5, color: "#6f6a88" }}>
                      {missing.length} senza attestato
                    </span>
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 17 }}>
                    {missing.map((userId) => (
                      <CertificateButton
                        key={userId}
                        members={memberOptions}
                        selfId={session.user.id}
                        preset={{
                          userId,
                          kind: course.kind,
                          title: course.title,
                          courseId: course.id,
                          completedAt: course.startsAt.toISOString().slice(0, 10),
                        }}
                        trigger={nameOf.get(userId) ?? "Persona"}
                        style={small}
                      />
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      ) : null}

      <section style={{ display: "grid", gap: 8 }}>
        <SectionHead title={manager ? "Attestati" : "I tuoi attestati"} aside={manager ? <ReminderDays value={lead} /> : undefined} />
        <Card>
          <div style={{ marginTop: -1 }}>
            {manager ? (
              people.length ? (
                people.map((person) => {
                  const items = (byPerson.get(person.id) ?? []).sort((a, b) => rank[a.state] - rank[b.state]);
                  return (
                    <details key={person.id} style={{ borderTop: "1px solid #f1eff8" }}>
                      <summary style={{ ...row, borderTop: 0, listStyle: "none", cursor: "pointer" }}>
                        <Avatar text={initials(person.firstName, person.lastName)} />
                        <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                          <span style={{ fontSize: 15 }}>{`${person.firstName} ${person.lastName}`.trim()}</span>
                          <span style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {items.length ? (
                              items.map((item) => (
                                <span
                                  key={certificateKey(item)}
                                  style={{ fontSize: 11.5, fontWeight: 600, borderRadius: 999, padding: "2px 8px", color: STATE_LOOK[item.state].color, background: STATE_LOOK[item.state].background }}
                                >
                                  {courseName(item)}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: 12.5, color: "#6f6a88" }}>Nessun attestato</span>
                            )}
                          </span>
                        </span>
                        <span style={{ color: "#b7b2cc" }}>›</span>
                      </summary>
                      <div style={{ background: "#fbfaff" }}>
                        {items.map((item) => certificateRow(item, false))}
                        <div style={{ ...row }}>
                          <CertificateButton members={memberOptions} selfId={session.user.id} preset={{ userId: person.id }} trigger="+ Attestato per questa persona" style={small} />
                        </div>
                      </div>
                    </details>
                  );
                })
              ) : (
                <div style={{ ...row, color: "#6f6a88", fontSize: 14 }}>Aggiungi le persone del locale per seguire i loro corsi.</div>
              )
            ) : current.length ? (
              current.sort((a, b) => rank[a.state] - rank[b.state]).map((item) => certificateRow(item, false))
            ) : (
              <div style={{ ...row, color: "#6f6a88", fontSize: 14 }}>Nessun attestato: caricalo appena lo ricevi, Workbit ti avvisa prima che scada.</div>
            )}
          </div>
        </Card>
        {manager ? (
          <span style={{ fontSize: 12, color: "#6f6a88", padding: "0 6px" }}>
            Avviso a te e alla persona {lead} giorni prima della scadenza, poi a un mese e a una settimana, per prenotare il corso in tempo.
          </span>
        ) : null}
      </section>

      {upcoming.length ? (
        <section style={{ display: "grid", gap: 8 }}>
          <SectionHead title="In programma" />
          <Card>
            <div style={{ marginTop: -1 }}>
              {upcoming.map((course) => (
                <div key={course.id} style={row}>
                  <span
                    aria-hidden
                    style={{ width: 44, display: "grid", justifyItems: "center", padding: "5px 0", borderRadius: 12, background: "#f1eeff", color: "#4c1d95", flex: "0 0 auto" }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 750, lineHeight: 1 }}>{course.startsAt.toLocaleDateString("it-IT", { day: "numeric", timeZone: "Europe/Rome" })}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 750, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      {course.startsAt.toLocaleDateString("it-IT", { month: "short", timeZone: "Europe/Rome" }).replace(".", "")}
                    </span>
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
                    <span style={{ fontSize: 15 }}>{course.title}</span>
                    <span style={{ fontSize: 12.5, color: "#6f6a88" }}>
                      {[
                        course.assignedToAll ? "Tutto il team" : nameOf.get(course.assignedToId ?? "") ?? "",
                        `${clock.format(course.startsAt)}–${clock.format(course.endsAt)}`,
                        course.location,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {manager ? (
                    <ActionForm action={deleteCourseAction} success="Corso annullato">
                      <input type="hidden" name="courseId" value={course.id} />
                      <PendingButton type="submit" pendingLabel="…" style={{ ...small, background: "transparent", border: "1px solid transparent", color: "#7c7894" }}>
                        Annulla
                      </PendingButton>
                    </ActionForm>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
          <span style={{ fontSize: 12, color: "#6f6a88", padding: "0 6px" }}>
            Finito il corso, compare in Da sistemare per caricare gli attestati delle persone.
          </span>
        </section>
      ) : null}

      {!current.length && !upcoming.length && manager ? (
        <Card style={{ padding: 16, display: "grid", gap: 8 }}>
          <span style={{ fontSize: 15 }}>HACCP, antincendio, primo soccorso</span>
          <span style={{ fontSize: 13, color: "#6f6a88" }}>
            Carica gli attestati che il personale ha già: Workbit calcola la scadenza, la tiene sotto controllo e avvisa {lead} giorni prima, così c&apos;è tempo per prenotare il corso.
          </span>
        </Card>
      ) : null}
    </div>
  );
}
