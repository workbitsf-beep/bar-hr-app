import { BillingRequired } from "../billing-required";
import {
  ActivityType,
  CalendarClosureType,
  RequestStatus,
  RequestType,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReactNode } from "react";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { can, hasWholeScope } from "@/lib/staff-permissions";
import { userScopeWhere } from "@/lib/staff-scope";
import { ClosureDateRangeInput } from "@/app/components/closure-date-range-input";
import { SingleDayTimeRangeInput } from "@/app/components/single-day-time-range-input";
import {
  createCalendarClosureAction,
  createAvailabilityAction,
  createShiftChangeRequestAction,
  createTimeOffRequestAction,
  deleteCalendarClosureAction,
  deleteAvailabilityAction,
  deleteRequestAction,
  updateCalendarClosureAction,
  reviewRequestAction,
} from "../actions";
import { getDashboardContext } from "../context";
import { ClassicBack } from "../classic-toggle";
import { DesktopRequests } from "./desktop-requests";
import { RequestsAside } from "../desktop-asides";
import { SwipeRevealAction } from "../swipe-reveal-action";
import {
  EmptyState,
  FormField,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  TextArea,
  TextInput,
  formatDate,
  formatDateTime,
} from "../ui";
import { PopupAction } from "../popup-action";
import { ClosureComposeForm } from "./closure-compose-form";
import { RequestDateFields } from "./request-date-fields";
import { ShiftChangeForm } from "./shift-change-form";
import { AskSomething, type AskOption } from "./ask-something";
import { Avatar, mixCard, mixPage, mixRow, PageHead, Pill } from "../mix-ui";
import { ActionForm } from "@/app/components/action-form";

const AVAILABILITY_VISIBILITY_HOURS = 24;

/** A request's state as the small pill of the rest of the app. */
function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const tones = { neutral: "violet", success: "good", warning: "wait", danger: "bad" } as const;
  return <Pill tone={tones[tone]}>{label}</Pill>;
}

const approveButtonStyle = {
  width: 40,
  height: 40,
  display: "inline-grid",
  placeItems: "center",
  borderRadius: 999,
  border: "1px solid #bfe8cd",
  background: "#e9f7ee",
  color: "#15803d",
  fontSize: 16,
  fontWeight: 900,
  cursor: "pointer",
} as const;

const rejectButtonStyle = {
  ...approveButtonStyle,
  border: "1px solid #f6cfcf",
  background: "#fdecec",
  color: "#b91c1c",
} as const;

/**
 * A span said the way people say it.
 *
 * "25 set 2026, 00:00 – 26 set 2026, 23:59" is a whole day and a half of
 * nothing: the year is this year, and midnight to one minute to midnight is
 * just "the 25th and the 26th". It was also too long for the row, so the end
 * of it was cut off - the half that says when it finishes.
 */
function describeSpan(start: Date | null, end: Date | null) {
  if (!start) {
    return "Data non disponibile";
  }

  const thisYear = new Date().getFullYear();

  const day = (value: Date) =>
    new Intl.DateTimeFormat("it-IT", {
      day: "numeric",
      month: "short",
      ...(value.getFullYear() === thisYear ? {} : { year: "numeric" }),
      timeZone: APP_TIME_ZONE,
    })
      .format(value)
      .replace(/\.$/, "");

  const time = (value: Date) =>
    new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    }).format(value);

  if (!end) {
    return `${day(start)} · ${time(start)}`;
  }

  // Whole days carry no useful clock: they start at midnight and end just
  // before the next one.
  const wholeDays =
    start.getHours() === 0 && start.getMinutes() === 0 && end.getHours() === 23;
  const sameDay = start.toDateString() === end.toDateString();

  if (wholeDays) {
    return sameDay ? day(start) : `${day(start)} – ${day(end)}`;
  }

  if (sameDay) {
    return `${day(start)} · ${time(start)}–${time(end)}`;
  }

  return `${day(start)} ${time(start)} – ${day(end)} ${time(end)}`;
}

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase();
}

function requestEmoji(type: RequestType | string) {
  if (type === RequestType.VACATION) {
    return "🏖️";
  }

  if (type === RequestType.PERMISSION) {
    return "⏱️";
  }

  if (type === RequestType.SICKNESS) {
    return "🤒";
  }

  if (type === RequestType.OVERTIME) {
    return "📋";
  }

  return "🔄";
}

function closureTypeLabel(type: CalendarClosureType) {
  if (type === CalendarClosureType.HOLIDAY) {
    return "Festività";
  }

  if (type === CalendarClosureType.VACATION) {
    return "Ferie aziendali";
  }

  return "Chiusura";
}

function closureTypeTone(type: CalendarClosureType) {
  if (type === CalendarClosureType.HOLIDAY) {
    return "warning" as const;
  }

  if (type === CalendarClosureType.VACATION) {
    return "success" as const;
  }

  return "neutral" as const;
}

/** The pill used to print the database's own word: APPROVED, PENDING. */
function requestStatusLabel(status: RequestStatus | string) {
  if (status === RequestStatus.APPROVED) {
    return "Approvata";
  }

  if (status === RequestStatus.REJECTED) {
    return "Rifiutata";
  }

  return "In attesa";
}

function requestTone(status: RequestStatus) {
  if (status === RequestStatus.APPROVED) {
    return "success" as const;
  }

  if (status === RequestStatus.REJECTED) {
    return "danger" as const;
  }

  return "warning" as const;
}

function requestLabel(type: RequestType | string) {
  if (type === RequestType.VACATION) {
    return "Ferie";
  }

  if (type === RequestType.PERMISSION) {
    return "Permesso";
  }

  if (type === RequestType.SICKNESS) {
    return "Malattia";
  }

  if (type === RequestType.OVERTIME) {
    return "Straordinario";
  }

  return "Cambio turno";
}

function isPrivateAbsenceRequest(type: RequestType | string) {
  return (
    type === RequestType.VACATION ||
    type === RequestType.PERMISSION ||
    type === RequestType.SICKNESS ||
    type === RequestType.OVERTIME
  );
}

function DeleteSwipeButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      aria-label={label}
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
  );
}

/**
 * One kind of row, everywhere on this page: 62 tall, white, 18 round. It turns
 * amber only when it is waiting for an answer, and nothing else changes.
 */
function RequestRow({
  emoji,
  title,
  detail,
  pending = false,
  trailing,
}: {
  emoji: string;
  title: string;
  detail?: string;
  pending?: boolean;
  trailing?: ReactNode;
}) {
  return (
    <div style={{ ...mixRow, background: "#ffffff" }}>
      <span style={{ display: "grid", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
        <b style={{ fontSize: 15, fontWeight: 650 }}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>
            {emoji}
          </span>
          {title}
        </b>
        {detail ? <span style={{ fontSize: 13, color: pending ? "#92400e" : "#667085", lineHeight: 1.35 }}>{detail}</span> : null}
      </span>
      {trailing}
    </div>
  );
}

/** A card's title. It sits a pixel over the first row, hiding that row's rule. */
function RequestGroup({ label, count }: { label: string; count?: number; hot?: boolean }) {
  return (
    <span
      style={{
        position: "relative",
        zIndex: 1,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        background: "#ffffff",
        paddingBottom: 4,
        marginBottom: -1,
        fontSize: 14.5,
        fontWeight: 750,
        letterSpacing: "-0.01em",
        color: "#111827",
      }}
    >
      <span>{label}</span>
      {count === undefined ? null : <span style={{ fontSize: 13, fontWeight: 400, color: "#667085" }}>{count}</span>}
    </span>
  );
}

/** A quiet row that opens what it holds. The sheet carries the title, so the
 *  list inside never repeats it. */
function ArchiveRow({
  title,
  emoji,
  count,
  sheetTitle,
  children,
}: {
  title: string;
  emoji: string;
  count: number;
  sheetTitle: string;
  children: ReactNode;
}) {
  return (
    <PopupAction
      title={sheetTitle}
      ariaLabel={`Apri ${title}`}
      triggerRow={
        <div style={{ ...mixRow, background: "#ffffff" }}>
          <span aria-hidden="true">{emoji}</span>
          <span style={{ flex: "1 1 auto" }}>{title}</span>
          <span style={{ flex: "0 0 auto", color: "#667085", fontSize: 13.5 }}>{count} &rsaquo;</span>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </PopupAction>
  );
}

export default async function DashboardRequestsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const { session, role, staff, activeBarId, activeBarActivityType, billingStatus, features } =
    await getDashboardContext();
  // "Richieste": the owner and staff the owner gave it to; over some
  // departments or sites, the requests of their people only.
  const canManageClosures = can(staff, "requests");
  const scopedReviewer = canManageClosures && !hasWholeScope(staff);
  const pageTitle = canManageClosures ? "Richieste e chiusure" : features.requests ? "Richieste" : "Indisponibilità";

  if (!activeBarId) {
    return (
      <Panel title={pageTitle}>
        <EmptyState message="Seleziona un locale attivo per vedere i moduli operativi." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequired role={String(role)} />;
  }

  if (!features.requests && !features.availability && !canManageClosures) {
    return (
      <Panel title={pageTitle}>
        <EmptyState message="Moduli operativi disattivati nelle impostazioni." />
      </Panel>
    );
  }

  const isCompany = activeBarActivityType === ActivityType.COMPANY;
  const canCreateRequests = features.requests && role !== Role.OWNER;
  const canCreateAvailability = features.availability && !isCompany && role !== Role.OWNER;
  const canUseOvertime = features.requests && features.overtime;
  const availabilityVisibleAfter = new Date();
  availabilityVisibleAfter.setHours(availabilityVisibleAfter.getHours() - AVAILABILITY_VISIBILITY_HOURS);
  const [requests, ownShifts, teammates, teammateShifts, availabilities, overtimeMembers, closures] = await Promise.all([
    features.requests
      ? prisma.request.findMany({
      where: {
        barId: activeBarId,
        ...(canManageClosures && !scopedReviewer
          ? {}
          : {
              OR: [
                { employeeId: session.user.id },
                { swapWithUserId: session.user.id },
                ...(scopedReviewer ? [{ employee: userScopeWhere(staff, activeBarId) }] : []),
              ],
            }),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 80,
      select: {
        id: true,
        type: true,
        status: true,
        peerStatus: true,
        ownerStatus: true,
        reason: true,
        certificateCode: true,
        startsAt: true,
        endsAt: true,
        createdAt: true,
        swapWithUserId: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        swapWith: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        reviewedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        peerReviewedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        shift: {
          select: {
            title: true,
            startTime: true,
            endTime: true,
          },
        },
        swapShift: {
          select: {
            title: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    })
      : Promise.resolve([]),
    canCreateRequests && !isCompany
      ? prisma.shift.findMany({
          where: {
            barId: activeBarId,
            startTime: {
              gte: new Date(),
            },
            assignments: {
              some: {
                userId: session.user.id,
              },
            },
          },
          orderBy: {
            startTime: "asc",
          },
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
          },
        })
      : Promise.resolve([]),
    canCreateRequests && !isCompany
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
            role: {
              not: Role.OWNER,
            },
            userId: {
              not: session.user.id,
            },
          },
          orderBy: {
            role: "asc",
          },
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
    canCreateRequests && !isCompany
      ? prisma.shift.findMany({
          where: {
            barId: activeBarId,
            startTime: {
              gte: new Date(),
            },
            assignments: {
              some: {
                userId: {
                  not: session.user.id,
                },
              },
            },
          },
          orderBy: {
            startTime: "asc",
          },
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            assignments: {
              where: {
                userId: {
                  not: session.user.id,
                },
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
            },
          },
        })
      : Promise.resolve([]),
    canCreateAvailability
      ? prisma.availability.findMany({
          where: {
            barId: activeBarId,
            endsAt: {
              gte: availabilityVisibleAfter,
            },
          },
          orderBy: {
            startsAt: "asc",
          },
          take: 60,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            reason: true,
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
    role === Role.OWNER
      ? prisma.employeeBar.findMany({
          where: {
            barId: activeBarId,
            isActive: true,
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
    canManageClosures
      ? prisma.calendarClosure.findMany({
          where: {
            barId: activeBarId,
          },
          orderBy: [{ title: "asc" }, { startsAt: "asc" }],
          take: 20,
          select: {
            id: true,
            title: true,
            type: true,
            startsAt: true,
            endsAt: true,
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);
  const standardRequests = requests.filter((request) => request.type !== RequestType.OVERTIME);
  // What is waiting for an answer is why this page gets opened - by the owner
  // to give one, by the employee to see whether it came. It used to be at the
  // bottom, mixed in with everything already settled.
  const pendingRequests = requests.filter(
    (request) => request.status === RequestStatus.PENDING
  );
  const closedRequests = standardRequests.filter(
    (request) => request.status !== RequestStatus.PENDING
  );
  const overtimeRequests = requests.filter((request) => request.type === RequestType.OVERTIME);

  // What is happening in the venue right now or in the next fortnight: the
  // closures people plan around, and who has said they cannot be there.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);

  const happeningNow: {
    key: string;
    emoji: string;
    title: string;
    detail: string;
    at: Date;
    /** Set for a person who is away: shown with their avatar and a pill. */
    person?: { initials: string; name: string; when: string };
  }[] = [
    ...closures
      .filter((closure) => closure.endsAt >= availabilityVisibleAfter && closure.startsAt <= horizon)
      .map((closure) => ({
        key: `closure-${closure.id}`,
        emoji: "📝",
        title: closure.title,
        detail: `${describeSpan(closure.startsAt, closure.endsAt)} · ${closureTypeLabel(
          closure.type
        )}`,
        at: closure.startsAt,
      })),
    ...availabilities
      .filter(
        (availability) =>
          availability.endsAt >= availabilityVisibleAfter && availability.startsAt <= horizon
      )
      .map((availability) => ({
        key: `availability-${availability.id}`,
        emoji: "🚫",
        title:
          availability.user.id === session.user.id
            ? "Non ci sei"
            : `${availability.user.firstName} non c'è`,
        detail: describeSpan(availability.startsAt, availability.endsAt),
        at: availability.startsAt,
        person: {
          initials: initialsOf(availability.user.firstName, availability.user.lastName),
          name: availability.user.firstName,
          when: describeSpan(availability.startsAt, availability.endsAt),
        },
      })),
    // Approved time off of the people: who is out, said with their face.
    ...standardRequests
      .filter(
        (request) =>
          request.status === RequestStatus.APPROVED &&
          (request.type === RequestType.VACATION ||
            request.type === RequestType.PERMISSION ||
            request.type === RequestType.SICKNESS) &&
          request.startsAt &&
          request.endsAt &&
          request.endsAt >= availabilityVisibleAfter &&
          request.startsAt <= horizon
      )
      .map((request) => ({
        key: `request-${request.id}`,
        emoji: requestEmoji(request.type),
        title: request.employee.firstName,
        detail: describeSpan(request.startsAt, request.endsAt),
        at: request.startsAt as Date,
        person: {
          initials: initialsOf(request.employee.firstName, request.employee.lastName),
          name: request.employee.firstName,
          when: describeSpan(request.startsAt, request.endsAt),
        },
      })),
  ].sort((left, right) => left.at.getTime() - right.at.getTime());

  const ownAvailabilities = availabilities.filter(
    (availability) => availability.user.id === session.user.id
  );
  // Approved time off still to come belongs here too: with two days of
  // holiday approved, "Quando non ci sei" said "Niente in programma".
  const awayFrom = new Date();
  const ownApprovedAway = standardRequests.filter(
    (request) =>
      request.employee.id === session.user.id &&
      request.status === RequestStatus.APPROVED &&
      (request.type === RequestType.VACATION ||
        request.type === RequestType.PERMISSION ||
        request.type === RequestType.SICKNESS) &&
      request.endsAt &&
      request.endsAt >= awayFrom
  );

  // What an employee can ask for: one tile each, the form in its own popup.
  const askOptions: AskOption[] = canCreateRequests
    ? [
                {
                  id: "vacation",
                  emoji: "🏖️",
                  label: "Ferie",
                  hint: "giorni",
                  form: (
                    <ActionForm action={createTimeOffRequestAction} success="Richiesta inviata." style={{ display: "grid", gap: 16 }}>
                      <RequestDateFields type={RequestType.VACATION} />
                      <FormField label="Motivo">
                        <TextArea name="reason" placeholder="Facoltativo" />
                      </FormField>
                      <input type="hidden" name="notifySuccess" value="1" />
                      <div className="dashboard-form-actions">
                        <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                      </div>
                    </ActionForm>
                  ),
                },
                {
                  id: "permission",
                  emoji: "⏱️",
                  label: "Permesso",
                  hint: "ore",
                  form: (
                    <ActionForm action={createTimeOffRequestAction} success="Richiesta inviata." style={{ display: "grid", gap: 16 }}>
                      <RequestDateFields type={RequestType.PERMISSION} />
                      <FormField label="Motivo">
                        <TextArea name="reason" placeholder="Facoltativo" />
                      </FormField>
                      <input type="hidden" name="notifySuccess" value="1" />
                      <div className="dashboard-form-actions">
                        <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                      </div>
                    </ActionForm>
                  ),
                },
                {
                  id: "sickness",
                  emoji: "🤒",
                  label: "Malattia",
                  hint: "certificato",
                  form: (
                    <ActionForm action={createTimeOffRequestAction} success="Richiesta inviata." style={{ display: "grid", gap: 16 }}>
                      <RequestDateFields type={RequestType.SICKNESS} />
                      <FormField label="Codice certificato">
                        <TextInput name="certificateCode" placeholder="Il numero sul certificato" />
                      </FormField>
                      <input type="hidden" name="notifySuccess" value="1" />
                      <div className="dashboard-form-actions">
                        <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                      </div>
                    </ActionForm>
                  ),
                },
                ...(isCompany || ownShifts.length === 0
                  ? []
                  : [
                      {
                        id: "swap",
                        emoji: "🔄",
                        label: "Cambio",
                        hint: "con un collega",
                        form: (
                          <ShiftChangeForm
                            action={createShiftChangeRequestAction}
                            ownShifts={ownShifts.map((shift) => ({
                              id: shift.id,
                              title: shift.title,
                              startTime: shift.startTime.toISOString(),
                              endTime: shift.endTime.toISOString(),
                            }))}
                            teammates={teammates.map((teammate) => ({
                              id: teammate.user.id,
                              firstName: teammate.user.firstName,
                              lastName: teammate.user.lastName,
                            }))}
                            teammateShifts={teammateShifts.flatMap((shift) =>
                              shift.assignments.map((assignment) => ({
                                id: shift.id,
                                title: shift.title,
                                startTime: shift.startTime.toISOString(),
                                endTime: shift.endTime.toISOString(),
                                userId: assignment.user.id,
                                userName: `${assignment.user.firstName} ${assignment.user.lastName}`.trim(),
                              }))
                            )}
                          />
                        ),
                      },
                    ]),
                ...(features.availability && !isCompany
                  ? [
                      {
                        id: "unavailable",
                        emoji: "🚫",
                        label: "Non ci sono",
                        hint: "un giorno",
                        form: (
                          <ActionForm action={createAvailabilityAction} success="Indisponibilità salvata." style={{ display: "grid", gap: 16 }}>
                            <SingleDayTimeRangeInput startName="startsAt" endName="endsAt" required />
                            <FormField label="Motivo">
                              <TextArea
                                name="reason"
                                placeholder="Facoltativo: esame, visita, evento personale"
                              />
                            </FormField>
                            <input type="hidden" name="notifySuccess" value="1" />
                            <div className="dashboard-form-actions">
                              <PrimaryButton type="submit">Salva</PrimaryButton>
                            </div>
                          </ActionForm>
                        ),
                      },
                    ]
                  : []),
                ...(canUseOvertime
                  ? [
                      {
                        id: "overtime",
                        emoji: "⏱",
                        label: "Straordinario",
                        hint: "ore in più",
                        form: (
                          <ActionForm action={createTimeOffRequestAction} success="Straordinario segnalato." style={{ display: "grid", gap: 16 }}>
                            <input type="hidden" name="type" value="OVERTIME" />
                            <SingleDayTimeRangeInput startName="startsAt" endName="endsAt" required pastDays={31} />
                            <FormField label="Cosa hai fatto">
                              <TextArea name="reason" placeholder="Facoltativo: es. inventario dopo la chiusura" />
                            </FormField>
                            <input type="hidden" name="notifySuccess" value="1" />
                            <div className="dashboard-form-actions">
                              <PrimaryButton type="submit">Segnala straordinario</PrimaryButton>
                            </div>
                          </ActionForm>
                        ),
                      },
                    ]
                  : []),
      ]
    : [];

  const phonePage = (
    <div className="workbit-requests-page" style={mixPage}>
      <PageHead
        title="Richieste"
        actions={
        canManageClosures ? (
          <PopupAction title="Cosa aggiungi?" ariaLabel="Aggiungi">
            <AskSomething
              heading="Cosa aggiungi?"
              options={[
                ...(canUseOvertime && role === Role.OWNER
                  ? [
                      {
                        id: "overtime",
                        emoji: "📋",
                        label: "Straordinario",
                        hint: "Ore già fatte da registrare",
                        form: (
                <ActionForm action={createTimeOffRequestAction} success="Richiesta inviata." style={{ display: "grid", gap: 16 }}>
                  <input type="hidden" name="type" value="OVERTIME" />

                  <div
                    className="dashboard-inline-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <FormField label="Persona">
                      <Select name="employeeId" required defaultValue="">
                        <option value="" disabled>
                          Seleziona una persona
                        </option>
                        {overtimeMembers.map((member) => (
                          <option key={member.user.id} value={member.user.id}>
                            {member.user.firstName} {member.user.lastName} - {member.role}
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <SingleDayTimeRangeInput startName="startsAt" endName="endsAt" required pastDays={31} />
                    </div>
                  </div>

                  <FormField label="Dettaglio">
                    <TextArea name="reason" placeholder="Motivo o descrizione dello straordinario" />
                  </FormField>

                  <input type="hidden" name="notifySuccess" value="1" />

                  <div className="dashboard-form-actions">
                    <PrimaryButton type="submit">Registra straordinario</PrimaryButton>
                  </div>
                </ActionForm>
                        ),
                      },
                    ]
                  : []),
                {
                  id: "closure",
                  emoji: "📝",
                  label: "Chiusura o ferie aziendali",
                  hint: "Giorni in cui il locale è chiuso",
                  form: <ClosureComposeForm action={createCalendarClosureAction} />,
                },
              ]}
            />
          </PopupAction>
        ) : null
        }
      />

      <div style={{ display: "grid", gap: 12 }}>

        {askOptions.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {askOptions.map((option) => (
              <PopupAction
                key={option.id}
                title={option.label}
                ariaLabel={`Chiedi: ${option.label}`}
                triggerRow={
                  <span style={{ ...mixCard, display: "grid", justifyItems: "center", gap: 2, padding: "10px 6px", borderRadius: 16, textAlign: "center" }}>
                    <span aria-hidden style={{ fontSize: 22 }}>{option.emoji}</span>
                    <b style={{ fontSize: 13.5, fontWeight: 700 }}>{option.label}</b>
                    <span style={{ fontSize: 11.5, color: "#667085" }}>{option.hint}</span>
                  </span>
                }
              >
                {option.form}
              </PopupAction>
            ))}
          </div>
        ) : null}


        {features.requests && pendingRequests.length > 0 ? (
          <section style={mixCard}>
            <RequestGroup
              label={canManageClosures ? "Da approvare" : "In attesa di risposta"}
              count={pendingRequests.length}
              hot
            />

            {pendingRequests.map((request) => {
              const canPeerReview =
                request.type === "SHIFT_CHANGE" &&
                request.swapWithUserId === session.user.id &&
                request.peerStatus !== RequestStatus.REJECTED;
              const canOwnerReview =
                canManageClosures &&
                request.employee.id !== session.user.id &&
                request.type !== RequestType.SICKNESS &&
                (request.type !== "SHIFT_CHANGE" || request.peerStatus === RequestStatus.APPROVED);
              const canSeeRequestDetails =
                canManageClosures ||
                request.employee.id === session.user.id ||
                !isPrivateAbsenceRequest(request.type);

              return (
                <RequestRow
                  key={request.id}
                  emoji={requestEmoji(request.type)}
                  title={`${requestLabel(request.type)}${
                    canManageClosures ? ` · ${request.employee.firstName}` : ""
                  }`}
                  detail={
                    canSeeRequestDetails
                      ? describeSpan(request.startsAt, request.endsAt)
                      : "Dettaglio riservato"
                  }
                  pending
                  trailing={
                    canPeerReview || canOwnerReview ? (
                      <span style={{ display: "flex", gap: 7, flex: "0 0 auto" }}>
                        <ActionForm action={reviewRequestAction} success="Richiesta rifiutata.">
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <input type="hidden" name="notifySuccess" value="1" />
                          <button type="submit" aria-label="Rifiuta" style={rejectButtonStyle}>
                            ✕
                          </button>
                        </ActionForm>
                        <ActionForm action={reviewRequestAction} success="Richiesta approvata.">
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="APPROVED" />
                          <input type="hidden" name="notifySuccess" value="1" />
                          <button type="submit" aria-label="Approva" style={approveButtonStyle}>
                            ✓
                          </button>
                        </ActionForm>
                      </span>
                    ) : (
                      <StatusPill label="In attesa" tone="warning" />
                    )
                  }
                />
              );
            })}
          </section>
        ) : null}

        {canManageClosures && happeningNow.length > 0 ? (
          <section style={mixCard}>
            <RequestGroup label="In questi giorni" />
            {happeningNow.map((item) =>
              item.person ? (
                <div key={item.key} style={{ ...mixRow, gap: 12 }}>
                  <Avatar>{item.person.initials}</Avatar>
                  <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 15 }}>{item.person.name}</span>
                  <Pill tone="grey">
                    <span aria-hidden="true" style={{ marginRight: 5 }}>
                      {item.emoji}
                    </span>
                    {item.person.when}
                  </Pill>
                </div>
              ) : (
                <RequestRow key={item.key} emoji={item.emoji} title={item.title} detail={item.detail} />
              )
            )}
          </section>
        ) : null}

        {!canManageClosures && features.requests && closedRequests.length > 0 ? (
          <section style={mixCard}>
            <RequestGroup label="Già risposte" />
            {closedRequests.map((request) => (
              <RequestRow
                key={request.id}
                emoji={requestEmoji(request.type)}
                title={requestLabel(request.type)}
                detail={describeSpan(request.startsAt, request.endsAt)}
                trailing={
                  <StatusPill
                    label={requestStatusLabel(request.status)}
                    tone={requestTone(request.status)}
                  />
                }
              />
            ))}
          </section>
        ) : null}

        {!canManageClosures && features.availability && !isCompany ? (
          <section style={mixCard}>
            <RequestGroup label="Quando non ci sei" count={ownAvailabilities.length + ownApprovedAway.length} />
            {ownApprovedAway.map((request) => (
              <RequestRow
                key={request.id}
                emoji={requestEmoji(request.type)}
                title={requestLabel(request.type)}
                detail={describeSpan(request.startsAt, request.endsAt)}
                trailing={<StatusPill label="Approvata" tone="success" />}
              />
            ))}
            {ownAvailabilities.length === 0 && ownApprovedAway.length === 0 ? (
              <p style={{ ...mixRow, margin: 0, color: "#667085", fontSize: 14 }}>Niente in programma.</p>
            ) : (
              ownAvailabilities.map((availability) => (
                <SwipeRevealAction
                  key={availability.id}
                  enabled
                  action={
                    <ActionForm action={deleteAvailabilityAction} success="Indisponibilità eliminata.">
                      <input type="hidden" name="availabilityId" value={availability.id} />
                      <DeleteSwipeButton label="Elimina indisponibilità" />
                    </ActionForm>
                  }
                >
                  <RequestRow
                    emoji="🚫"
                    title={formatDate(availability.startsAt)}
                    detail={`${describeSpan(availability.startsAt, availability.endsAt)}${
                      availability.reason ? ` · ${availability.reason}` : ""
                    }`}
                  />
                </SwipeRevealAction>
              ))
            )}
          </section>
        ) : null}

        {canManageClosures ? (
          <section style={mixCard}>
            <RequestGroup label="Archivio" />

            {canUseOvertime && role === Role.OWNER ? (
              <ArchiveRow
                title="Straordinari registrati"
                emoji="📋"
                count={overtimeRequests.length}
                sheetTitle="Straordinari registrati"
              >
            <div style={{ display: "grid", gap: 12 }}>
              {overtimeRequests.length === 0 ? (
                <EmptyState message="Nessuno straordinario registrato." />
              ) : (
                <ItemList scrollable>
                  {overtimeRequests.map((request) => {
                    const canDeleteRequest = canManageClosures || request.employee.id === session.user.id;

                    return (
                      <SwipeRevealAction
                        key={request.id}
                        enabled={canDeleteRequest}
                        action={
                          <ActionForm action={deleteRequestAction} success="Richiesta eliminata.">
                            <input type="hidden" name="requestId" value={request.id} />
                            <DeleteSwipeButton label="Elimina straordinario" />
                          </ActionForm>
                        }
                      >
                        <RequestRow
                          emoji="📋"
                          title={`${request.employee.firstName} ${request.employee.lastName}`}
                          detail={`${describeSpan(
                            request.startsAt ?? request.createdAt,
                            request.endsAt ?? request.createdAt
                          )}${request.reason ? ` · ${request.reason}` : ""}`}
                          trailing={
                            <StatusPill
                              label={requestStatusLabel(request.status)}
                              tone={requestTone(request.status)}
                            />
                          }
                        />
                      </SwipeRevealAction>
                    );
                  })}
                </ItemList>
              )}
            </div>
              </ArchiveRow>
            ) : null}

            <ArchiveRow
              title="Chiusure e ferie aziendali"
              emoji="📝"
              count={closures.length}
              sheetTitle="Chiusure e ferie aziendali"
            >
            {closures.length === 0 ? (
              <EmptyState message="Nessuna chiusura registrata." />
            ) : (
              <ItemList scrollable>
                {closures.map((closure) => (
                  <SwipeRevealAction
                    key={closure.id}
                    leadingAction={
                      <PopupAction
                        title="Modifica chiusura"
                        ariaLabel={`Modifica ${closure.title}`}
                        closeOnSubmit
                        triggerContent={
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="m14.5 5.5 4 4M4 20l4.5-1 10.5-10.5a2.8 2.8 0 0 0-4-4L4.5 15 4 20Z"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        }
                      >
                        <ActionForm action={updateCalendarClosureAction} success="Chiusura aggiornata." style={{ display: "grid", gap: 16 }}>
                          <input type="hidden" name="closureId" value={closure.id} />
                          <input type="hidden" name="notifySuccess" value="1" />

                          <FormField label="Nome">
                            <TextInput name="title" defaultValue={closure.title} />
                          </FormField>

                          <FormField label="Tipo attività">
                            <Select name="type" defaultValue={closure.type}>
                              <option value={CalendarClosureType.CLOSURE}>Chiusura</option>
                              <option value={CalendarClosureType.HOLIDAY}>Festivita</option>
                              <option value={CalendarClosureType.VACATION}>Ferie aziendali</option>
                            </Select>
                          </FormField>

                          <ClosureDateRangeInput
                            startName="startsAt"
                            endName="endsAt"
                            startValue={closure.startsAt.toISOString()}
                            endValue={closure.endsAt.toISOString()}
                            required
                          />

                          <div className="dashboard-form-actions">
                            <PrimaryButton type="submit">Salva modifiche</PrimaryButton>
                          </div>
                        </ActionForm>
                      </PopupAction>
                    }
                    action={
                      <ActionForm action={deleteCalendarClosureAction} success="Chiusura eliminata.">
                        <input type="hidden" name="closureId" value={closure.id} />
                        <input type="hidden" name="notifySuccess" value="1" />
                        <DeleteSwipeButton label="Elimina chiusura" />
                      </ActionForm>
                    }
                  >
                    <RequestRow
                      emoji="📝"
                      title={closure.title}
                      detail={describeSpan(closure.startsAt, closure.endsAt)}
                      trailing={
                        <StatusPill
                          label={closureTypeLabel(closure.type)}
                          tone={closureTypeTone(closure.type)}
                        />
                      }
                    />
                  </SwipeRevealAction>
                ))}
              </ItemList>
            )}
            </ArchiveRow>

            {features.availability && !isCompany ? (
              <ArchiveRow
                title="Indisponibilità del team"
                emoji="🚫"
                count={availabilities.length}
                sheetTitle="Indisponibilità del team"
              >
              {availabilities.length === 0 ? (
                <EmptyState message="Nessuna indisponibilità registrata." />
              ) : (
                <ItemList scrollable>
                  {availabilities.map((availability) => {
                    const canDeleteAvailability =
                      canManageClosures || availability.user.id === session.user.id;
                    const canSeeAvailabilityReason =
                      canManageClosures || availability.user.id === session.user.id;

                    return (
                      <SwipeRevealAction
                        key={availability.id}
                        enabled={canDeleteAvailability}
                        action={
                          <ActionForm action={deleteAvailabilityAction} success="Indisponibilità eliminata.">
                            <input type="hidden" name="availabilityId" value={availability.id} />
                            <DeleteSwipeButton label="Elimina indisponibilità" />
                          </ActionForm>
                        }
                      >
                        <RequestRow
                          emoji="🚫"
                          title={
                            availability.user.id === session.user.id
                              ? "Non ci sei"
                              : `${availability.user.firstName} ${availability.user.lastName}`
                          }
                          detail={`${describeSpan(availability.startsAt, availability.endsAt)}${
                            canSeeAvailabilityReason && availability.reason
                              ? ` · ${availability.reason}`
                              : canSeeAvailabilityReason
                                ? ""
                                : " · dettaglio riservato"
                          }`}
                        />
                      </SwipeRevealAction>
                    );
                  })}
                </ItemList>
              )}
              </ArchiveRow>
            ) : null}

            {features.requests ? (
              <ArchiveRow
                title="Richieste già chiuse"
                emoji="✓"
                count={closedRequests.length}
                sheetTitle="Richieste già chiuse"
              >
            {closedRequests.length === 0 ? (
              <EmptyState message="Nessuna richiesta chiusa." />
            ) : (
              <ItemList scrollable>
                {closedRequests.map((request) => {
                  // Nothing to review here: this list is what has already been
                  // answered. Approving happens at the top of the page.
                  const canDeleteRequest =
                    (canManageClosures || request.employee.id === session.user.id);
                  const canSeeRequestDetails =
                    canManageClosures ||
                    request.employee.id === session.user.id ||
                    !isPrivateAbsenceRequest(request.type);

                  const requestSummary = request.shift && request.swapShift
                    ? `${request.shift.title || "Tuo turno"} ${formatDateTime(request.shift.startTime)} ⇄ ${
                        request.swapShift.title || "Turno collega"
                      } ${formatDateTime(request.swapShift.startTime)}`
                    : request.shift
                      ? `${request.shift.title || "Turno"} - ${formatDateTime(request.shift.startTime)}`
                    : !canSeeRequestDetails
                      ? "Dettaglio riservato"
                    : request.certificateCode
                      ? `Certificato: ${request.certificateCode}`
                    : request.reason || null;

                  return (
                    <SwipeRevealAction
                      key={request.id}
                      enabled={canDeleteRequest}
                      action={
                        <ActionForm action={deleteRequestAction} success="Richiesta eliminata.">
                          <input type="hidden" name="requestId" value={request.id} />
                          <DeleteSwipeButton label="Elimina richiesta" />
                        </ActionForm>
                      }
                    >
                      <RequestRow
                        emoji={requestEmoji(request.type)}
                        title={`${requestLabel(request.type)} · ${request.employee.firstName}`}
                        detail={
                          canSeeRequestDetails
                            ? `${describeSpan(request.startsAt, request.endsAt)}${
                                requestSummary ? ` · ${requestSummary}` : ""
                              }`
                            : "Dettaglio riservato"
                        }
                        trailing={
                          <StatusPill
                            label={requestStatusLabel(request.status)}
                            tone={requestTone(request.status)}
                          />
                        }
                      />
                    </SwipeRevealAction>
                  );
                })}
              </ItemList>
            )}
              </ArchiveRow>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );

  // On a computer whoever decides gets the list-and-detail page
  // (desktop-requests.tsx); everyone else, and the phone, keep this one.
  if (!canManageClosures || !features.requests) {
    return (
      <div className="wb-desk-split">
        {phonePage}
        <aside className="wb-desk-only">
          <RequestsAside barId={activeBarId} userId={session.user.id} />
        </aside>
      </div>
    );
  }

  const selectedId = Array.isArray(params.r) ? params.r[0] : params.r;
  const coverResult = Array.isArray(params.cover) ? params.cover[0] : params.cover;

  return (
    <>
      <div className="wb-desk-only">
        <DesktopRequests
          barId={activeBarId}
          userId={session.user.id}
          selectedId={selectedId ?? null}
          coverResult={coverResult ?? null}
          canSeePrivate={canManageClosures}
        />
      </div>
      <div className="wb-phone-only">
        <ClassicBack />
        {phonePage}
      </div>
    </>
  );
}
