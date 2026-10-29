import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityType, ClockType, Role } from "@prisma/client";
import type { CSSProperties, ReactNode } from "react";
import { ActionForm } from "@/app/components/action-form";
import { PendingButton } from "@/app/components/pending-button";
import { certificateState, daysLeft, latestOnly } from "@/lib/course-certificates";
import { getCourseKind } from "@/lib/course-kinds";
import { getVenueDepartments, staffDepartments } from "@/lib/departments";
import { prisma } from "@/lib/prisma";
import { can, isStaffRole, PERMISSION_LABELS, PERMISSIONS } from "@/lib/staff-permissions";
import { memberScopeWhere } from "@/lib/staff-scope";
import { removeEmployeeAction } from "../../actions";
import { BillingRequired } from "../../billing-required";
import { getDashboardContext } from "../../context";
import { MemberDepartmentForm } from "../../department-forms";
import { PopupAction } from "../../popup-action";
import { MixCard } from "../../mix-ui";
import { Quiet, Sheet } from "../../presenze/payroll-ui";
import { EmptyState, Panel } from "../../ui";
import { ConfirmSubmit } from "../confirm-submit";
import { savePersonDetailAction } from "../person-actions";
import { StaffRoleForm } from "../staff-role-form";

export const dynamic = "force-dynamic";

const row: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: "1px solid #f1eff8", color: "#1f1b3a", fontSize: 15.5, textDecoration: "none" };
const value: CSSProperties = { marginLeft: "auto", color: "#8a85a3", fontSize: 15, textAlign: "right", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const chevron = <span aria-hidden style={{ color: "#c4c0d6", fontSize: 18, flex: "0 0 auto" }}>›</span>;
const field: CSSProperties = { minHeight: 50, borderRadius: 14, border: "1px solid #e9e6f5", background: "#fbfaff", fontSize: 17, color: "#1f1b3a", padding: "0 14px", width: "100%", boxSizing: "border-box", textAlign: "center" };
const primary: CSSProperties = { minHeight: 50, borderRadius: 999, border: 0, background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)", color: "#ffffff", fontSize: 15.5, fontWeight: 700, width: "100%", cursor: "pointer" };

function roleLabel(role: Role) {
  if (role === Role.OWNER) return "Titolare";
  if (role === Role.MANAGER) return "Responsabile";
  if (role === Role.AMMINISTRAZIONE) return "Amministrazione";
  return "Dipendente";
}

function hoursText(ms: number) {
  const minutes = Math.round(ms / 60_000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** A line of the card; tapping it opens what changes it. */
const icon: CSSProperties = { width: 26, flex: "0 0 auto", fontSize: 19, lineHeight: 1, textAlign: "center" };

function Line({ emoji, label, shown, tone, first = false }: { emoji: string; label: string; shown: ReactNode; tone?: string; first?: boolean }) {
  return (
    <span style={{ ...row, borderTop: first ? 0 : row.borderTop }}>
      <span aria-hidden style={icon}>{emoji}</span>
      <span style={{ flex: "0 0 auto" }}>{label}</span>
      <span style={{ ...value, ...(tone ? { color: tone, fontWeight: 600 } : {}) }}>{shown}</span>
      {chevron}
    </span>
  );
}

/** One value, one box, one button: the pay or the consultant's code. */
function DetailForm({ membershipId, name, current, placeholder, hint, inputMode }: { membershipId: string; name: "hourlyRate" | "payrollCode"; current: string; placeholder: string; hint: string; inputMode: "decimal" | "text" }) {
  return (
    <ActionForm action={savePersonDetailAction} success="Salvato" style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="field" value={name} />
      <input name="value" defaultValue={current} placeholder={placeholder} inputMode={inputMode} autoCapitalize={name === "payrollCode" ? "characters" : undefined} maxLength={30} style={field} />
      <Quiet style={{ fontSize: 13, textAlign: "center" }}>{hint}</Quiet>
      <PendingButton type="submit" pendingLabel="Salvo…" style={primary}>
        Salva
      </PendingButton>
    </ActionForm>
  );
}

/** A person of the team on their own page: who they are, what they do here, and their papers. */
export default async function PersonPage({ params }: { params: Promise<{ membershipId: string }> }) {
  const { session, role, staff, activeBarId, activeBarActivityType, billingStatus } = await getDashboardContext();
  if (!activeBarId) {
    return (
      <Panel title="Team">
        <EmptyState message="Seleziona un locale attivo per gestire il personale." />
      </Panel>
    );
  }
  if (billingStatus && !billingStatus.canAccess) return <BillingRequired role={String(role)} />;
  if (!can(staff, "people")) redirect("/dashboard/people");

  const { membershipId } = await params;
  const isOwner = role === Role.OWNER;
  const member = await prisma.employeeBar.findFirst({
    where: { id: membershipId, barId: activeBarId, isActive: true, ...(isOwner ? {} : { role: Role.EMPLOYEE, ...memberScopeWhere(staff) }) },
    select: {
      id: true,
      role: true,
      hourlyRate: true,
      payrollCode: true,
      department: true,
      helpsIn: true,
      permissions: true,
      managesDepartments: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, mustChangePwd: true } },
    },
  });
  if (!member) redirect("/dashboard/people");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [departments, bar, logs, documents, certificates, settings] = await Promise.all([
    getVenueDepartments(activeBarId, session.user.id),
    prisma.bar.findUnique({ where: { id: activeBarId }, select: { ownerId: true } }),
    prisma.timeLog.findMany({
      where: { barId: activeBarId, userId: member.user.id, timestamp: { gte: monthStart } },
      orderBy: { timestamp: "asc" },
      select: { type: true, timestamp: true },
    }),
    prisma.document.count({ where: { barId: activeBarId, isActive: true, assignedToId: member.user.id } }),
    prisma.courseCertificate.findMany({
      where: { barId: activeBarId, userId: member.user.id },
      select: { userId: true, kind: true, title: true, completedAt: true, expiresAt: true },
    }),
    prisma.barSettings.findUnique({ where: { barId: activeBarId }, select: { courseReminderDays: true } }),
  ]);

  // The month so far, and whether they are in right now.
  let ms = 0;
  let since: Date | null = null;
  for (const log of logs) {
    if (log.type === ClockType.IN) since = log.timestamp;
    else if (since) {
      ms += log.timestamp.getTime() - since.getTime();
      since = null;
    }
  }
  if (since) ms += now.getTime() - since.getTime();

  const isCompany = activeBarActivityType === ActivityType.COMPANY;
  const name = `${member.user.firstName} ${member.user.lastName}`.trim();
  const manages = isStaffRole(member.role);
  const departmentOf = (id: string | null) => departments.list.find((entry) => entry.id === id) ?? null;
  const scopeText = member.managesDepartments.length
    ? member.managesDepartments.map((id) => departmentOf(id)?.name ?? id).join(", ")
    : isCompany && departments.enabled
      ? "tutte le sedi"
      : "tutto il locale";
  const permissionText =
    PERMISSIONS.filter((permission) => member.permissions.includes(permission))
      .map((permission) => PERMISSION_LABELS[permission].title)
      .join(" · ") || "Nessun permesso";

  // The courses in one phrase: the most urgent fact, or that all is well.
  const lead = settings?.courseReminderDays ?? 60;
  const current = latestOnly(certificates).map((item) => ({ ...item, state: certificateState(item.expiresAt, lead, now) }));
  const expired = current.filter((item) => item.state === "expired");
  const expiring = current.filter((item) => item.state === "expiring").sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());
  const courseName = (item: (typeof current)[number]) => (item.kind === "OTHER" ? item.title : getCourseKind(item.kind).label);
  const courses = expired.length
    ? { text: expired.length === 1 ? `${courseName(expired[0])} scaduto` : `${expired.length} scaduti`, tone: "#b3202f" }
    : expiring.length
      ? { text: `${courseName(expiring[0])} fra ${daysLeft(expiring[0].expiresAt!, now)} giorni`, tone: "#b45309" }
      : { text: current.length ? "in regola" : "nessun attestato", tone: undefined };

  const canRole = isOwner && member.role !== Role.OWNER;
  const departmentChoices = departments.enabled
    ? isOwner
      ? staffDepartments(departments.list)
      : staffDepartments(departments.list).filter((entry) => can(staff, "people", entry.id))
    : [];
  // A titolare goes only when added by mistake: never came in, and not the one the venue belongs to.
  const canRemove =
    member.user.id !== session.user.id &&
    (member.role !== Role.OWNER || (isOwner && member.user.mustChangePwd && bar?.ownerId !== member.user.id));
  const time = since?.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const month = now.toLocaleDateString("it-IT", { month: "long", timeZone: "Europe/Rome" });

  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "minmax(0, 1fr)", maxWidth: 560, margin: "0 auto", width: "100%", padding: "4px 4px 8px", color: "#1f1b3a" }}>
      <Link href="/dashboard/people" style={{ fontSize: 15, fontWeight: 600, color: "#5e4ae3", textDecoration: "none", justifySelf: "start" }}>
        ‹ Team
      </Link>

      <header style={{ display: "grid", justifyItems: "center", gap: 5, padding: "4px 0 8px", textAlign: "center" }}>
        <span
          aria-hidden
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: "#f1eeff",
            color: "#4c1d95",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 21,
            fontWeight: 700,
          }}
        >
          {`${member.user.firstName.charAt(0)}${member.user.lastName.charAt(0)}`.toUpperCase()}
        </span>
        <h1 style={{ margin: "4px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-0.035em" }}>{name}</h1>
        <Quiet style={{ fontSize: 14.5, overflowWrap: "anywhere" }}>{member.user.email}</Quiet>
        <span style={{ fontSize: 14.5, marginTop: 2 }}>
          <b style={{ fontWeight: 650, fontVariantNumeric: "tabular-nums" }}>{hoursText(ms)}</b> <Quiet style={{ fontSize: 14.5 }}>ore a {month}</Quiet>
        </span>
        {since ? <span style={{ fontSize: 14, color: "#0f7a4f" }}>In lavoro dalle {time}</span> : null}
        {member.user.mustChangePwd ? <span style={{ fontSize: 14, color: "#b45309" }}>Non ha ancora aperto l&apos;app</span> : null}
      </header>

      <MixCard title="Lavoro">
        {canRole ? (
          <PopupAction title={manages ? "Ruolo e permessi" : "Ruolo"} ariaLabel="Cambia il ruolo" triggerRow={<Line first emoji="👤" label="Ruolo" shown={manages ? `${roleLabel(member.role)} · ${scopeText}` : roleLabel(member.role)} />}>
            <StaffRoleForm
              membershipId={member.id}
              firstName={member.user.firstName}
              isCompany={isCompany}
              role={member.role as "EMPLOYEE" | "MANAGER" | "AMMINISTRAZIONE"}
              permissions={member.permissions}
              managesDepartments={member.managesDepartments}
              departments={departments.enabled ? staffDepartments(departments.list) : null}
              kind={departments.kind}
            />
          </PopupAction>
        ) : (
          <span style={{ ...row, borderTop: 0 }}>
            <span aria-hidden style={icon}>👤</span>
            <span>Ruolo</span>
            <span style={value}>{roleLabel(member.role)}</span>
          </span>
        )}
        {manages ? (
          <span style={{ ...row, fontSize: 13, color: "#667085", paddingTop: 0, paddingLeft: 38, borderTop: 0, marginTop: -6 }}>Può: {permissionText}</span>
        ) : null}

        {departments.enabled && departmentChoices.length ? (
          <PopupAction title={isCompany ? "Sede" : "Reparto"} ariaLabel={isCompany ? "Cambia la sede" : "Cambia il reparto"} triggerRow={<Line emoji={isCompany ? "📍" : "🟣"} label={isCompany ? "Sede" : "Reparto"} shown={departmentOf(member.department)?.name ?? "Nessuno"} />}>
            <MemberDepartmentForm words={departments.words} membershipId={member.id} department={member.department} helpsIn={member.helpsIn} departments={departmentChoices} />
          </PopupAction>
        ) : null}

        {isOwner ? (
          <>
            <PopupAction title="Paga oraria" ariaLabel="Cambia la paga oraria" triggerRow={<Line emoji="💶" label="Paga oraria" shown={member.hourlyRate ? `${Number(member.hourlyRate).toFixed(2).replace(".", ",")} €` : "Aggiungi"} tone={member.hourlyRate ? undefined : "#5e4ae3"} />}>
              <DetailForm membershipId={member.id} name="hourlyRate" current={member.hourlyRate ? Number(member.hourlyRate).toFixed(2).replace(".", ",") : ""} placeholder="9,50" hint="Euro lordi all'ora. La vedi solo tu." inputMode="decimal" />
            </PopupAction>
            <PopupAction title="Matricola o codice fiscale" ariaLabel="Cambia matricola o codice fiscale" triggerRow={<Line emoji="🪪" label="Matricola o cod. fiscale" shown={member.payrollCode ?? "Aggiungi"} tone={member.payrollCode ? undefined : "#5e4ae3"} />}>
              <DetailForm membershipId={member.id} name="payrollCode" current={member.payrollCode ?? ""} placeholder="Matricola o codice fiscale" hint="Va nel file delle presenze per il consulente." inputMode="text" />
            </PopupAction>
          </>
        ) : null}
      </MixCard>

      <MixCard title="Le sue cose">
        <Link href={`/dashboard/presenze/persona/${member.user.id}`} style={{ ...row, borderTop: 0 }}>
          <span aria-hidden style={icon}>⏱️</span>
          <span>Presenze</span>
          <span style={value}>{month}</span>
          {chevron}
        </Link>
        <Link href="/dashboard/documents" style={row}>
          <span aria-hidden style={icon}>📄</span>
          <span>Documenti</span>
          <span style={value}>{documents}</span>
          {chevron}
        </Link>
        <Link href="/dashboard/courses" style={row}>
          <span aria-hidden style={icon}>🎓</span>
          <span>Corsi</span>
          <span style={{ ...value, ...(courses.tone ? { color: courses.tone } : {}) }}>{courses.text}</span>
          {chevron}
        </Link>
      </MixCard>

      {canRemove ? (
        <Sheet>
          <ConfirmSubmit action={removeEmployeeAction} question={`Togliere ${name} da questo locale? Non vedrà più turni, note e documenti di qui.`}>
            <input type="hidden" name="membershipId" value={member.id} />
            <button type="submit" style={{ ...row, borderTop: 0, width: "100%", justifyContent: "center", border: 0, background: "transparent", color: "#b3202f", fontSize: 15.5, cursor: "pointer" }}>
              Togli dal locale
            </button>
          </ConfirmSubmit>
        </Sheet>
      ) : null}
    </div>
  );
}
