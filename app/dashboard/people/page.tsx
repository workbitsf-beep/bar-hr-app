import { ActivityType, ClockType, Role } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCourseUrgency } from "@/lib/course-kinds";
import { formatDurationFromMilliseconds } from "@/lib/time-format";
import { createEmployeeAction, removeEmployeeAction } from "../actions";
import { getDashboardContext } from "../context";
import {
  BillingRequiredState,
  EmptyState,
  Panel,
  PrimaryButton,
  Stack,
  SuccessCallout,
} from "../ui";
import { PopupAction } from "../popup-action";
import { ListRowTrigger } from "../list-row-trigger";
import { ConfirmSubmit } from "./confirm-submit";
import { NewPersonForm } from "./new-person-form";
import { ClassicBack, ClassicToggle } from "../classic-toggle";
import { Avatar } from "../desk-helpers";
import "../desk.css";
import { getVenueDepartments, JOLLY_LOOK } from "@/lib/departments";
import { DepartmentDot, MemberDepartmentForm } from "../department-forms";

function formatRoleLabel(role: Role) {
  if (role === Role.OWNER) {
    return "Titolare";
  }

  if (role === Role.MANAGER) {
    return "Responsabile";
  }

  if (role === Role.AMMINISTRAZIONE) {
    return "Amministrazione";
  }

  return "Dipendente";
}

const personLinkStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "11px 12px",
  borderRadius: 15,
  border: "1px solid #e9edf3",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13.5,
  fontWeight: 780,
  textDecoration: "none",
} as const;

function PersonFigure({ label, value, lead = false }: { label: string; value: string; lead?: boolean }) {
  return (
    <span
      style={{
        display: "grid",
        gap: 1,
        padding: "10px 12px",
        borderRadius: 15,
        background: lead ? "#f3e8ff" : "#f8fafc",
        border: `1px solid ${lead ? "rgba(124, 58, 237, 0.42)" : "#e9edf3"}`,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 820,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: lead ? "#8b5cf6" : "#94a3b8",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 830,
          letterSpacing: "-0.03em",
          fontVariantNumeric: "tabular-nums",
          color: lead ? "#4c1d95" : "#0f172a",
        }}
      >
        {value}
      </span>
    </span>
  );
}

export default async function DashboardPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const { session, role, activeBarId, activeBarActivityType, billingStatus } = await getDashboardContext();

  if (role !== Role.OWNER) {
    return (
      <Panel title="Personale">
        <EmptyState message="Solo i titolari possono creare e gestire il team." />
      </Panel>
    );
  }

  if (!activeBarId) {
    return (
      <Panel title="Personale">
        <EmptyState message="Seleziona un locale attivo per gestire il personale." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const departments = await getVenueDepartments(activeBarId, session.user.id);
  const departmentOf = (id: string | null) => departments.list.find((entry) => entry.id === id) ?? null;

  const [members, monthLogs, documents, courses] = await Promise.all([
    prisma.employeeBar.findMany({
      where: {
        barId: activeBarId,
        isActive: true,
      },
      orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
      select: {
        id: true,
        role: true,
        hourlyRate: true,
        department: true,
        helpsIn: true,
        isDepartmentLead: true,
        isJolly: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            mustChangePwd: true,
          },
        },
      },
    }),
    prisma.timeLog.findMany({
      where: { barId: activeBarId, timestamp: { gte: monthStart } },
      orderBy: { timestamp: "asc" },
      select: { userId: true, type: true, timestamp: true },
    }),
    prisma.document.findMany({
      where: { barId: activeBarId, isActive: true },
      select: { assignedToId: true, assignedToAll: true },
    }),
    prisma.course.findMany({
      where: { barId: activeBarId },
      select: { assignedToId: true, assignedToAll: true, startsAt: true, endsAt: true, expiresAt: true },
    }),
  ]);

  const isCompany = activeBarActivityType === ActivityType.COMPANY;
  const leadNames: Partial<Record<NonNullable<(typeof members)[number]["department"]>, string>> = {};
  for (const member of members) {
    if (member.isDepartmentLead && member.department) {
      leadNames[member.department] = `${member.user.firstName} ${member.user.lastName}`;
    }
  }

  // How the month is going for each person, and who is in right now: a shift
  // is open when the last stamp of the month is an entrata.
  const worked = new Map<string, { ms: number; since: Date | null }>();

  for (const log of monthLogs) {
    const entry = worked.get(log.userId) ?? { ms: 0, since: null };

    if (log.type === ClockType.IN) {
      entry.since = log.timestamp;
    } else if (entry.since) {
      entry.ms += log.timestamp.getTime() - entry.since.getTime();
      entry.since = null;
    }

    worked.set(log.userId, entry);
  }

  const documentCount = new Map<string, number>();

  for (const document of documents) {
    if (document.assignedToId) {
      documentCount.set(document.assignedToId, (documentCount.get(document.assignedToId) ?? 0) + 1);
    }
  }

  const expiredCourses = new Map<string, number>();

  for (const course of courses) {
    if (!course.assignedToId || getCourseUrgency(course) !== "expired") {
      continue;
    }

    expiredCourses.set(course.assignedToId, (expiredCourses.get(course.assignedToId) ?? 0) + 1);
  }

  function initialsOf(firstName: string, lastName: string) {
    return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  }

  // Only what is not the ordinary case. A person who is here, has entered, has
  // their documents and their courses in order says nothing beyond their role.
  function warningFor(member: (typeof members)[number]) {
    if (member.user.mustChangePwd) {
      return "Non è mai entrato nell'app";
    }

    const expired = expiredCourses.get(member.user.id) ?? 0;

    if (expired > 0) {
      return expired === 1 ? "1 corso scaduto" : `${expired} corsi scaduti`;
    }

    if (member.role !== Role.OWNER && (documentCount.get(member.user.id) ?? 0) === 0) {
      return "Nessun documento personale";
    }

    return null;
  }

  const rows = members.map((member) => {
    const entry = worked.get(member.user.id);
    const openMs = entry?.since ? now.getTime() - entry.since.getTime() : 0;

    return {
      member,
      warning: warningFor(member),
      since: entry?.since ?? null,
      monthMs: (entry?.ms ?? 0) + openMs,
      documents: documentCount.get(member.user.id) ?? 0,
      expired: expiredCourses.get(member.user.id) ?? 0,
    };
  });

  const onShift = rows.filter((row) => row.since);
  const offShift = rows.filter((row) => !row.since);

  function groupStyle(color: string) {
    return {
      marginTop: 3,
      fontSize: 11.5,
      fontWeight: 820,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color,
    };
  }

  function renderPerson(row: (typeof rows)[number], live: boolean) {
    const { member } = row;
    const name = `${member.user.firstName} ${member.user.lastName}`;
    const memberDepartment = departments.enabled
      ? member.isJolly
        ? JOLLY_LOOK
        : departmentOf(member.department)
      : null;
    const roleLabel =
      formatRoleLabel(member.role) +
      (memberDepartment ? ` · ${memberDepartment.name}${member.isDepartmentLead ? " (capo)" : ""}` : "");
    const line = live
      ? `dalle ${row.since?.toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Rome",
        })} · ${roleLabel}`
      : row.warning ?? roleLabel;

    return (
      <PopupAction
        key={member.id}
        title={name}
        ariaLabel={`Apri la scheda di ${name}`}
        triggerRow={(
          <ListRowTrigger
            tone={live ? "live" : row.warning ? "warn" : "plain"}
            minHeight={66}
          >
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                flex: "0 0 auto",
                display: "inline-grid",
                placeItems: "center",
                borderRadius: 999,
                background: live ? "#dcfce7" : row.warning ? "#ffffff" : "#f3e8ff",
                color: live ? "#15803d" : row.warning ? "#92400e" : "#4c1d95",
                fontSize: 13,
                fontWeight: 850,
              }}
            >
              {initialsOf(member.user.firstName, member.user.lastName)}
            </span>

            <span style={{ display: "grid", gap: 3, minWidth: 0, flex: "1 1 auto" }}>
              <strong style={{ fontSize: 15, letterSpacing: "-0.015em", color: "#0f172a", display: "flex", alignItems: "center", gap: 7 }}>
                {name}
                {memberDepartment ? <DepartmentDot department={memberDepartment} size={18} /> : null}
              </strong>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: live || row.warning ? 790 : 690,
                  color: live ? "#15803d" : row.warning ? "#92400e" : "#64748b",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </span>
            </span>

            <span style={{ flex: "0 0 auto", textAlign: "right", display: "grid", gap: 1 }}>
              <strong
                style={{
                  fontSize: 14.5,
                  fontWeight: 830,
                  fontVariantNumeric: "tabular-nums",
                  color: live ? "#15803d" : "#0f172a",
                }}
              >
                {formatDurationFromMilliseconds(row.monthMs)}
              </strong>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                }}
              >
                mese
              </span>
            </span>
          </ListRowTrigger>
        )}
      >
        <div style={{ display: "grid", gap: 13 }}>
          <span style={{ color: "#64748b", fontSize: 13, fontWeight: 720 }}>
            {roleLabel} · {member.user.email}
          </span>

          <div
            className="dashboard-inline-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}
          >
            <PersonFigure label="Ore mese" value={formatDurationFromMilliseconds(row.monthMs)} lead />
            <PersonFigure label="Documenti" value={String(row.documents)} />
            <PersonFigure
              label="Paga"
              value={member.hourlyRate ? `${Number(member.hourlyRate).toFixed(2)}` : "—"}
            />
          </div>

          {departments.enabled ? (
            <MemberDepartmentForm
              membershipId={member.id}
              isOwner={member.role === Role.OWNER}
              department={member.department}
              helpsIn={member.helpsIn}
              isLead={member.isDepartmentLead}
              isJolly={member.isJolly}
              currentLeadName={Object.fromEntries(
                Object.entries(leadNames).filter(([, leadName]) => leadName !== name)
              )}
              departments={departments.list}
            />
          ) : null}

          {row.warning ? (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: 12.5,
                fontWeight: 790,
              }}
            >
              ⚠ {row.warning}
            </div>
          ) : null}

          <Link href="/dashboard/documents" style={personLinkStyle}>
            <span>📄 Documenti</span>
            <span style={{ color: "#94a3b8", fontWeight: 800 }}>{row.documents} &rsaquo;</span>
          </Link>
          <Link href="/dashboard/courses" style={personLinkStyle}>
            <span>🎓 Corsi</span>
            <span style={{ color: row.expired > 0 ? "#b91c1c" : "#94a3b8", fontWeight: 800 }}>
              {row.expired > 0 ? `${row.expired} scaduti` : "in regola"} &rsaquo;
            </span>
          </Link>
          <Link href="/dashboard/timelogs" style={personLinkStyle}>
            <span>⏱️ Timbrature</span>
            <span style={{ color: "#94a3b8", fontWeight: 800 }}>&rsaquo;</span>
          </Link>
          <Link href="/dashboard/export" style={personLinkStyle}>
            <span>🧾 Report del mese</span>
            <span style={{ color: "#94a3b8", fontWeight: 800 }}>&rsaquo;</span>
          </Link>

          {member.role !== Role.OWNER ? (
            <ConfirmSubmit
              action={removeEmployeeAction}
              question={`Togliere ${name} da questo locale? Non vedrà più turni, note e documenti di qui.`}
            >
              <input type="hidden" name="membershipId" value={member.id} />
              <PrimaryButton type="submit" tone="red">
                Rimuovi dal locale
              </PrimaryButton>
            </ConfirmSubmit>
          ) : null}
        </div>
      </PopupAction>
    );
  }

  const phonePage = (
    <>
      <Stack className="workbit-people-page">
        {success === "employee-created" ? (
          <SuccessCallout>Account creato correttamente. La password temporanea automatica e stata inviata via email.</SuccessCallout>
        ) : null}
        {success === "employee-linked" ? (
          <SuccessCallout>Utente collegato correttamente a questo locale.</SuccessCallout>
        ) : null}
        {success === "employee-removed" ? (
          <SuccessCallout>Utente rimosso da questo locale.</SuccessCallout>
        ) : null}

        <Panel
          title="Team"
          className="workbit-people-panel"
          action={
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span>
                {members.length === 1 ? "1 persona" : `${members.length} persone`}
                {onShift.length > 0 ? ` · ${onShift.length} in servizio` : ""}
              </span>
              <PopupAction title="Nuova persona" ariaLabel="Aggiungi persona">
                <NewPersonForm action={createEmployeeAction} isCompany={isCompany} />
              </PopupAction>
            </div>
          }
        >
          {members.length === 0 ? (
            <EmptyState message="Nessuna persona collegata a questo locale." />
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {onShift.length > 0 ? (
                <span style={groupStyle("#15803d")}>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 9,
                      height: 9,
                      borderRadius: 999,
                      background: "#22c55e",
                      marginRight: 6,
                    }}
                  />
                  In servizio adesso
                </span>
              ) : null}

              {onShift.map((row) => renderPerson(row, true))}

              {onShift.length > 0 ? (
                <span style={groupStyle("#94a3b8")}>Il resto del team</span>
              ) : null}

              {offShift.map((row) => renderPerson(row, false))}
            </div>
          )}
        </Panel>
      </Stack>
    </>
  );

  // ---- On a computer: the team as a table, the chosen person on the side.
  const selectedUserId =
    (Array.isArray(params.u) ? params.u[0] : params.u) ??
    rows.find((row) => row.member.role !== Role.OWNER)?.member.user.id ??
    rows[0]?.member.user.id ??
    null;
  const selected = rows.find((row) => row.member.user.id === selectedUserId) ?? null;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000);
  const [selectedShifts, selectedDocuments, selectedCourses] = selected
    ? await Promise.all([
        prisma.shift.findMany({
          where: {
            barId: activeBarId,
            startTime: { gte: weekStart, lt: weekEnd },
            assignments: { some: { userId: selected.member.user.id } },
          },
          orderBy: { startTime: "asc" },
          select: { id: true, title: true, startTime: true, endTime: true, isOnCall: true, confirmedAt: true },
        }),
        prisma.document.findMany({
          where: { barId: activeBarId, isActive: true, assignedToId: selected.member.user.id },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, title: true, createdAt: true },
        }),
        prisma.course.findMany({
          where: {
            barId: activeBarId,
            OR: [{ assignedToId: selected.member.user.id }, { assignedToAll: true }],
          },
          orderBy: { expiresAt: "asc" },
          take: 6,
          select: { id: true, title: true, startsAt: true, endsAt: true, expiresAt: true },
        }),
      ])
    : [[], [], []];
  const shortDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "Europe/Rome" });
  const dayName = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", timeZone: "Europe/Rome" });
  const time = (value: Date) =>
    value.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });

  return (
    <>
      <div className="wb-desk-only">
        <div className="wbd">
          {success === "employee-created" ? (
            <SuccessCallout>Account creato. La password temporanea è stata inviata via email.</SuccessCallout>
          ) : null}
          {success === "employee-removed" ? <SuccessCallout>Persona rimossa da questo locale.</SuccessCallout> : null}
          <div className="wbd-top">
            <h1>Personale</h1>
            <span className="wbd-tag wbd-tag--violet">
              {members.length === 1 ? "1 persona" : `${members.length} persone`}
              {onShift.length ? ` · ${onShift.length} in servizio` : ""}
            </span>
            <span className="wbd-spacer" />
            <ClassicToggle />
            <PopupAction title="Nuova persona" ariaLabel="Aggiungi persona" triggerContent="+ Nuova persona">
              <NewPersonForm action={createEmployeeAction} isCompany={isCompany} />
            </PopupAction>
          </div>

          <div className="wbd-twocol">
            <section className="wbd-card wbd-table-card">
              <table className="wbd-table">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th>Adesso</th>
                    <th className="num">Ore del mese</th>
                    <th className="num">Documenti</th>
                    <th>Da guardare</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.member.id}
                      style={row.member.user.id === selected?.member.user.id ? { background: "#f6f2ff" } : undefined}
                    >
                      <td>
                        <Link className="row-link wbd-who" href={`/dashboard/people?u=${row.member.user.id}`} scroll={false}>
                          <Avatar user={row.member.user} />
                          <span style={{ display: "grid", whiteSpace: "nowrap" }}>
                            <b>
                              {row.member.user.firstName} {row.member.user.lastName}
                            </b>
                            <small style={{ color: "#847ea3", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                              {formatRoleLabel(row.member.role)}
                              {departments.enabled && row.member.isJolly ? (
                                <>
                                  · <DepartmentDot department={JOLLY_LOOK} size={16} />
                                  Jolly
                                </>
                              ) : departments.enabled && departmentOf(row.member.department) ? (
                                <>
                                  · <DepartmentDot department={departmentOf(row.member.department)!} size={16} />
                                  {departmentOf(row.member.department)!.name}
                                  {row.member.isDepartmentLead ? " (capo)" : ""}
                                </>
                              ) : null}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {row.since ? (
                          <span className="wbd-tag wbd-tag--ok">Dentro dalle {time(row.since)}</span>
                        ) : (
                          <span className="wbd-tag wbd-tag--gray">Fuori</span>
                        )}
                      </td>
                      <td className="num">{row.monthMs ? formatDurationFromMilliseconds(row.monthMs) : "—"}</td>
                      <td className="num">{row.member.role === Role.OWNER ? "—" : row.documents}</td>
                      <td>
                        {row.warning ? (
                          <span className={`wbd-tag ${row.expired ? "wbd-tag--bad" : "wbd-tag--warn"}`}>{row.warning}</span>
                        ) : (
                          <span className="wbd-tag wbd-tag--ok">In regola</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {selected ? (
              <aside className="wbd-panel">
                <section className="wbd-card">
                  <div className="wbd-person-head">
                    <Avatar user={selected.member.user} />
                    <div>
                      <h2>
                        {selected.member.user.firstName} {selected.member.user.lastName}
                      </h2>
                      <small>
                        {formatRoleLabel(selected.member.role)} · {selected.member.user.email}
                      </small>
                    </div>
                  </div>
                  <div className="wbd-boxes" style={{ marginTop: 14 }}>
                    <div className="wbd-box">
                      <span>Mese</span>
                      <b>{selected.monthMs ? formatDurationFromMilliseconds(selected.monthMs) : "—"}</b>
                    </div>
                    <div className="wbd-box">
                      <span>Settimana</span>
                      <b>{selectedShifts.filter((s) => !s.isOnCall).length} turni</b>
                    </div>
                    <div className="wbd-box">
                      <span>Paga oraria</span>
                      <b>{selected.member.hourlyRate ? `${Number(selected.member.hourlyRate)} €` : "—"}</b>
                    </div>
                  </div>
                </section>

                <section className="wbd-card">
                  <h3>
                    Questa settimana
                    <Link className="wbd-r" href="/dashboard/calendar">
                      Turni →
                    </Link>
                  </h3>
                  {selectedShifts.length === 0 ? <p className="wbd-empty">Nessun turno.</p> : null}
                  {selectedShifts.map((shift) => (
                    <div key={shift.id} className="wbd-line">
                      <i>{dayName.format(shift.startTime).toUpperCase()}</i>
                      <span>
                        <b>
                          {shift.isOnCall ? "Reperibilità" : `${time(shift.startTime)}–${time(shift.endTime)}`}
                        </b>
                        <small>
                          {shift.title ?? ""}
                          {!shift.confirmedAt && !shift.isOnCall ? " · bozza" : ""}
                        </small>
                      </span>
                    </div>
                  ))}
                </section>

                <section className="wbd-card">
                  <h3>
                    Documenti e corsi
                    <Link className="wbd-r" href="/dashboard/documents">
                      Documenti →
                    </Link>
                  </h3>
                  {selectedDocuments.length === 0 && selectedCourses.length === 0 ? (
                    <p className="wbd-empty">Nessun documento personale e nessun corso.</p>
                  ) : null}
                  {selectedDocuments.map((doc) => (
                    <div key={doc.id} className="wbd-line">
                      <i>DOC</i>
                      <span>
                        <b>{doc.title}</b>
                        <small>caricato il {shortDate.format(doc.createdAt)}</small>
                      </span>
                    </div>
                  ))}
                  {selectedCourses.map((course) => {
                    const urgency = getCourseUrgency(course);
                    return (
                      <div key={course.id} className="wbd-line">
                        <i>CORSO</i>
                        <span>
                          <b>{course.title}</b>
                          <small>{course.expiresAt ? `valido fino al ${shortDate.format(course.expiresAt)}` : "senza scadenza"}</small>
                        </span>
                        <span
                          className={`wbd-tag ${urgency === "expired" ? "wbd-tag--bad" : urgency === "expiring" ? "wbd-tag--warn" : "wbd-tag--ok"}`}
                        >
                          {urgency === "expired" ? "Scaduto" : urgency === "expiring" ? "In scadenza" : "In regola"}
                        </span>
                      </div>
                    );
                  })}
                </section>

                <section className="wbd-card">
                  <h3>Gestisci</h3>
                  {renderPerson(selected, Boolean(selected.since))}
                </section>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
      <div className="wb-phone-only">
        <ClassicBack />
        {phonePage}
      </div>
    </>
  );
}
