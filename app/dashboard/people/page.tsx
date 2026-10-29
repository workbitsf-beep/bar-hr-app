import { BillingRequired } from "../billing-required";
import { ActivityType, ClockType, Role } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCourseUrgency } from "@/lib/course-kinds";
import { formatDurationFromMilliseconds } from "@/lib/time-format";
import { createEmployeeAction } from "../actions";
import { getDashboardContext } from "../context";
import { EmptyState, Panel } from "../ui";
import { PopupAction } from "../popup-action";
import { NewPersonForm } from "./new-person-form";
import { ClassicBack, ClassicToggle } from "../classic-toggle";
import { Avatar } from "../desk-helpers";
import "../desk.css";
import { getVenueDepartments, staffDepartments } from "@/lib/departments";
import { getSeatUsage, getVenueEntitlements } from "@/lib/plans";
import { SeatsFull } from "./seats-full";
import { DepartmentDot } from "../department-forms";
import { can, isStaffRole } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { AddFace } from "../round-button";

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

export default async function DashboardPeoplePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const errorParam = Array.isArray(params.error) ? params.error[0] : params.error;
  const { session, role, staff, activeBarId, activeBarActivityType, billingStatus } = await getDashboardContext();
  // The owner runs the whole team; staff with "Persone" their own employees.
  const isOwner = role === Role.OWNER;

  if (!can(staff, "people")) {
    return (
      <Panel title="Personale">
        <EmptyState message="Il team lo gestisce il titolare. Se ti serve, chiedigli il permesso Persone." />
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
    return <BillingRequired role={String(role)} />;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const departments = await getVenueDepartments(activeBarId, session.user.id);
  const [seats, entitlements] = await Promise.all([getSeatUsage(activeBarId), getVenueEntitlements(activeBarId)]);
  const departmentOf = (id: string | null) => departments.list.find((entry) => entry.id === id) ?? null;

  const [members, monthLogs, documents, courses, consultants] = await Promise.all([
    prisma.employeeBar.findMany({
      where: {
        barId: activeBarId,
        isActive: true,
        ...(isOwner ? {} : { role: Role.EMPLOYEE, ...memberScopeWhere(staff) }),
      },
      orderBy: [{ role: "asc" }, { hiredAt: "asc" }],
      select: {
        id: true,
        role: true,
        hourlyRate: true,
        payrollCode: true,
        department: true,
        helpsIn: true,
        permissions: true,
        managesDepartments: true,
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
    // With a consultant set up, a person without a code is a gap in the file.
    isOwner ? prisma.payrollRecipient.count({ where: { barId: activeBarId } }) : Promise.resolve(0),
  ]);

  const isCompany = activeBarActivityType === ActivityType.COMPANY;
  // Full: the form gives way to what the venue can do about it.
  const addPerson = seats.full ? (
    <SeatsFull seats={seats} entitlements={entitlements} company={isCompany} />
  ) : (
    <NewPersonForm
      action={createEmployeeAction}
      isCompany={isCompany}
      employeesOnly={!isOwner}
      departments={
        !departments.enabled
          ? []
          : isOwner
            ? staffDepartments(departments.list)
            : staffDepartments(departments.list).filter((entry) => can(staff, "people", entry.id))
      }
    />
  );
  const seatLabel = seats.limit === null ? null : `${seats.used} su ${seats.limit}`;
  // Responsabile / Amministrazione: where, and what the owner let them do.
  const scopeText = (member: (typeof members)[number]) =>
    member.managesDepartments.length
      ? member.managesDepartments.map((id) => departmentOf(id)?.name ?? id).join(", ")
      : isCompany && departments.enabled
        ? "tutte le sedi"
        : "tutto il locale";
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
      return "Non ha ancora aperto l'app";
    }

    const expired = expiredCourses.get(member.user.id) ?? 0;

    if (expired > 0) {
      return expired === 1 ? "1 corso scaduto" : `${expired} corsi scaduti`;
    }

    if (consultants > 0 && member.role !== Role.OWNER && !member.payrollCode) {
      return "Manca il codice per il consulente";
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

  // The owner reads who runs things first, then the employees.
  const leaders = isOwner ? rows.filter((row) => row.member.role !== Role.EMPLOYEE) : [];
  const team = rows.filter((row) => !leaders.includes(row));
  const onShift = team.filter((row) => row.since);
  const offShift = team.filter((row) => !row.since);
  const inServiceCount = rows.filter((row) => row.since).length;

  const clockTime = (value: Date) =>
    value.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const hoursText = (ms: number) => {
    const minutes = Math.round(ms / 60_000);
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  };

  // A line of the team: who, what they do or what is wrong, the month's hours.
  function personRow(row: (typeof rows)[number], first: boolean) {
    const { member } = row;
    const name = `${member.user.firstName} ${member.user.lastName}`;
    const memberDepartment = departments.enabled ? departmentOf(member.department) : null;
    const manages = isStaffRole(member.role);
    const roleLabel = manages
      ? `${formatRoleLabel(member.role)} · ${scopeText(member)}`
      : formatRoleLabel(member.role) + (memberDepartment ? ` · ${memberDepartment.name}` : "");
    const live = Boolean(row.since);
    const line = live ? `In lavoro dalle ${clockTime(row.since!)}${memberDepartment ? ` · ${memberDepartment.name}` : ""}` : row.warning ?? roleLabel;
    const tone = live ? "#0f7a4f" : row.warning ? (row.expired ? "#b3202f" : "#b45309") : "#8a85a3";

    return (
      <Link
        key={member.id}
        href={`/dashboard/people/${member.id}`}
        aria-label={`Apri la scheda di ${name}`}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: first ? 0 : "1px solid #f2f0f8", color: "#1f1b3a", textDecoration: "none" }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 999,
            background: live ? "#e7f7ef" : "#f1eeff",
            color: live ? "#0f7a4f" : "#4c1d95",
            fontSize: 13.5,
            fontWeight: 700,
          }}
        >
          {initialsOf(member.user.firstName, member.user.lastName)}
        </span>
        <span style={{ display: "grid", gap: 1, minWidth: 0, flex: "1 1 auto" }}>
          <span style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 7 }}>
            {name}
            {memberDepartment ? <DepartmentDot department={memberDepartment} size={16} /> : null}
          </span>
          <span style={{ fontSize: 13.5, color: tone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line}</span>
        </span>
        <span style={{ flex: "0 0 auto", fontSize: 15, fontVariantNumeric: "tabular-nums", color: live ? "#0f7a4f" : "#1f1b3a" }}>{hoursText(row.monthMs)}</span>
      </Link>
    );
  }

  function teamGroup(title: string, list: typeof rows, color = "#8a85a3") {
    if (!list.length) return null;
    return (
      <section style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 13, color, padding: "0 18px" }}>{title}</span>
        <div style={{ background: "#ffffff", borderRadius: 22, overflow: "hidden", boxShadow: "0 1px 2px rgba(31,27,58,.04)" }}>
          {list.map((row, index) => personRow(row, index === 0))}
        </div>
      </section>
    );
  }

  const freeSeats = seats.limit === null ? null : Math.max(0, seats.limit - seats.used);
  const teamLine = [
    members.length === 1 ? "1 persona" : `${members.length} persone`,
    freeSeats === null ? null : freeSeats === 0 ? "nessun posto libero" : freeSeats === 1 ? "1 posto libero" : `${freeSeats} posti liberi`,
  ]
    .filter(Boolean)
    .join(" · ");

  const phonePage = (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 640, margin: "0 auto", width: "100%", padding: "4px 4px 8px", color: "#1f1b3a" }}>
      {errorParam === "posti-finiti" ? <SeatsFull seats={seats} entitlements={entitlements} company={isCompany} callout /> : null}

      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}>Team</h1>
          <span style={{ fontSize: 15, color: "#8a85a3" }}>{teamLine}</span>
        </div>
        <PopupAction
          title="Nuova persona"
          ariaLabel="Aggiungi una persona"
          triggerRow={
            <AddFace />
          }
        >
          {addPerson}
        </PopupAction>
      </header>

      {members.length === 0 ? (
        <div style={{ background: "#ffffff", borderRadius: 22, padding: "16px 18px", color: "#8a85a3", fontSize: 15 }}>Nessuna persona in questo locale: aggiungila col +.</div>
      ) : (
        <>
          {teamGroup("Chi gestisce", leaders)}
          {teamGroup("In lavoro adesso", onShift, "#0f7a4f")}
          {teamGroup(onShift.length ? "Il resto del team" : "Dipendenti", offShift)}
        </>
      )}

      {members.length ? <span style={{ fontSize: 13, color: "#8a85a3", textAlign: "center" }}>Ore del mese. Tocca una persona per la sua scheda.</span> : null}
    </div>
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
          {errorParam === "posti-finiti" ? <SeatsFull seats={seats} entitlements={entitlements} company={isCompany} callout /> : null}
          <div className="wbd-top">
            <h1>Personale</h1>
            <span className="wbd-tag wbd-tag--violet">
              {seatLabel ? `${seatLabel} persone` : members.length === 1 ? "1 persona" : `${members.length} persone`}
              {inServiceCount ? ` · ${inServiceCount} in servizio` : ""}
            </span>
            <span className="wbd-spacer" />
            <ClassicToggle />
            <PopupAction title="Nuova persona" ariaLabel="Aggiungi persona" triggerContent="+ Nuova persona">
              {addPerson}
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
                              {departments.enabled && departmentOf(row.member.department) ? (
                                <>
                                  · <DepartmentDot department={departmentOf(row.member.department)!} size={16} />
                                  {departmentOf(row.member.department)!.name}
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
                      <b>{isOwner && selected.member.hourlyRate ? `${Number(selected.member.hourlyRate)} €` : "—"}</b>
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
                  <h3>
                    Gestisci
                    <Link className="wbd-r" href={`/dashboard/people/${selected.member.id}`}>
                      Apri la scheda →
                    </Link>
                  </h3>
                  <p className="wbd-empty">Ruolo, reparto, paga e matricola per il consulente.</p>
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
