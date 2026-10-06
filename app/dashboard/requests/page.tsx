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
import { canReviewOperationalRequests } from "@/lib/permissions";
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
  BillingRequiredState,
  EmptyState,
  FormField,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  StatusPill,
  SuccessCallout,
  TextArea,
  TextInput,
  formatDate,
  formatDateTime,
} from "../ui";
import { PopupAction } from "../popup-action";
import { ClosureComposeForm } from "./closure-compose-form";
import { RequestDateFields } from "./request-date-fields";
import { ShiftChangeForm } from "./shift-change-form";
import { AskSomething } from "./ask-something";

const AVAILABILITY_VISIBILITY_HOURS = 24;

const approveButtonStyle = {
  width: 34,
  height: 34,
  display: "inline-grid",
  placeItems: "center",
  borderRadius: 999,
  border: "1px solid #bfe8cd",
  background: "#e9f7ee",
  color: "#15803d",
  fontSize: 14,
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 62,
        padding: "12px 14px",
        borderRadius: 18,
        boxSizing: "border-box",
        border: `1px solid ${pending ? "#fde68a" : "#e9edf3"}`,
        background: pending ? "#fffbeb" : "#ffffff",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 38,
          height: 38,
          flex: "0 0 auto",
          display: "inline-grid",
          placeItems: "center",
          borderRadius: 12,
          background: pending ? "#ffffff" : "#f8fafc",
          fontSize: 16,
        }}
      >
        {emoji}
      </span>

      <span style={{ display: "grid", gap: 2, minWidth: 0, flex: "1 1 auto" }}>
        <strong style={{ fontSize: 14.5, letterSpacing: "-0.015em", color: "#0f172a" }}>
          {title}
        </strong>
        {detail ? (
          <span
            style={{
              fontSize: 12.5,
              fontWeight: pending ? 780 : 690,
              color: pending ? "#92400e" : "#64748b",
              lineHeight: 1.35,
            }}
          >
            {detail}
          </span>
        ) : null}
      </span>

      {trailing}
    </div>
  );
}

function RequestGroup({ label, count, hot = false }: { label: string; count?: number; hot?: boolean }) {
  return (
    <span
      style={{
        marginTop: 7,
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 10,
        fontSize: 11.5,
        fontWeight: 820,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: hot ? "#92400e" : "#94a3b8",
      }}
    >
      <span>{label}</span>
      {count === undefined ? null : <span>{count}</span>}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minHeight: 62,
            padding: "12px 14px",
            borderRadius: 18,
            boxSizing: "border-box",
            border: "1px solid #e9edf3",
            background: "#f8fafc",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 38,
              height: 38,
              flex: "0 0 auto",
              display: "inline-grid",
              placeItems: "center",
              borderRadius: 12,
              background: "#ffffff",
              fontSize: 16,
            }}
          >
            {emoji}
          </span>
          <span style={{ flex: "1 1 auto", fontSize: 14.5, fontWeight: 780, color: "#0f172a" }}>
            {title}
          </span>
          <span style={{ flex: "0 0 auto", color: "#94a3b8", fontWeight: 800, fontSize: 13.5 }}>
            {count} &rsaquo;
          </span>
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
  const success = Array.isArray(params.success) ? params.success[0] : params.success;
  const { session, role, activeBarId, activeBarActivityType, billingStatus, features } =
    await getDashboardContext();
  const canManageClosures = canReviewOperationalRequests(role as Role);
  const pageTitle = canManageClosures ? "Richieste e chiusure" : features.requests ? "Richieste" : "Indisponibilità";

  if (!activeBarId) {
    return (
      <Panel title={pageTitle}>
        <EmptyState message="Seleziona un locale attivo per vedere i moduli operativi." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
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
  const successMessage =
    success === "request-created"
      ? "Richiesta salvata correttamente."
      : success === "shift-change-created"
        ? "Cambio turno richiesto correttamente."
        : success === "request-reviewed"
          ? "Richiesta confermata correttamente."
        : success === "availability-created"
          ? "Indisponibilità salvata correttamente."
          : success === "closure-created"
            ? "Chiusura salvata correttamente."
            : success === "closure-updated"
              ? "Chiusura aggiornata correttamente."
              : success === "closure-deleted"
                ? "Chiusura eliminata correttamente."
            : null;
  const [requests, ownShifts, teammates, teammateShifts, availabilities, overtimeMembers, closures] = await Promise.all([
    features.requests
      ? prisma.request.findMany({
      where: {
        barId: activeBarId,
        ...(canManageClosures
          ? {}
          : {
              OR: [
                { employeeId: session.user.id },
                { swapWithUserId: session.user.id },
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
  const pendingRequests = standardRequests.filter(
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

  const happeningNow = [
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
      })),
  ].sort((left, right) => left.at.getTime() - right.at.getTime());

  const ownAvailabilities = availabilities.filter(
    (availability) => availability.user.id === session.user.id
  );

  const phonePage = (
    <div className="workbit-requests-page">
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div className="workbit-requests-heading">
          <span>{canManageClosures ? "Gestisci" : "Le tue"}</span>
          <h2>Richieste</h2>
        </div>

        {canManageClosures ? (
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
                <form action={createTimeOffRequestAction} style={{ display: "grid", gap: 16 }}>
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
                      <SingleDayTimeRangeInput startName="startsAt" endName="endsAt" required />
                    </div>
                  </div>

                  <FormField label="Dettaglio">
                    <TextArea name="reason" placeholder="Motivo o descrizione dello straordinario" />
                  </FormField>

                  <input type="hidden" name="notifySuccess" value="1" />

                  <div className="dashboard-form-actions">
                    <PrimaryButton type="submit">Registra straordinario</PrimaryButton>
                  </div>
                </form>
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
        ) : null}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}

        {canCreateRequests ? (
          <PopupAction
            title="Nuova richiesta"
            ariaLabel="Chiedi qualcosa"
            triggerRow={
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  width: "100%",
                  minHeight: 52,
                  borderRadius: 18,
                  boxSizing: "border-box",
                  background: "linear-gradient(135deg, #30217f 0%, #5e5ce6 58%, #8b5cf6 100%)",
                  color: "#ffffff",
                  fontSize: 15.5,
                  fontWeight: 830,
                  boxShadow: "0 10px 22px rgba(94, 92, 230, 0.26)",
                }}
              >
                ＋ Chiedi qualcosa
              </span>
            }
          >
            <AskSomething
              options={[
                {
                  id: "vacation",
                  emoji: "🏖️",
                  label: "Ferie",
                  hint: "Uno o più giorni · da approvare",
                  form: (
                    <form action={createTimeOffRequestAction} style={{ display: "grid", gap: 16 }}>
                      <RequestDateFields type={RequestType.VACATION} />
                      <FormField label="Motivo">
                        <TextArea name="reason" placeholder="Facoltativo" />
                      </FormField>
                      <input type="hidden" name="notifySuccess" value="1" />
                      <div className="dashboard-form-actions">
                        <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                      </div>
                    </form>
                  ),
                },
                {
                  id: "permission",
                  emoji: "⏱️",
                  label: "Permesso",
                  hint: "Qualche ora in un giorno",
                  form: (
                    <form action={createTimeOffRequestAction} style={{ display: "grid", gap: 16 }}>
                      <RequestDateFields type={RequestType.PERMISSION} />
                      <FormField label="Motivo">
                        <TextArea name="reason" placeholder="Facoltativo" />
                      </FormField>
                      <input type="hidden" name="notifySuccess" value="1" />
                      <div className="dashboard-form-actions">
                        <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                      </div>
                    </form>
                  ),
                },
                {
                  id: "sickness",
                  emoji: "🤒",
                  label: "Malattia",
                  hint: "Serve il codice del certificato",
                  form: (
                    <form action={createTimeOffRequestAction} style={{ display: "grid", gap: 16 }}>
                      <RequestDateFields type={RequestType.SICKNESS} />
                      <FormField label="Codice certificato">
                        <TextInput name="certificateCode" placeholder="Il numero sul certificato" />
                      </FormField>
                      <input type="hidden" name="notifySuccess" value="1" />
                      <div className="dashboard-form-actions">
                        <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                      </div>
                    </form>
                  ),
                },
                ...(isCompany || ownShifts.length === 0
                  ? []
                  : [
                      {
                        id: "swap",
                        emoji: "🔄",
                        label: "Cambio turno",
                        hint: "Proponi uno scambio a un collega",
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
                        label: "Non posso esserci",
                        hint: "Avvisi senza chiedere permesso",
                        form: (
                          <form action={createAvailabilityAction} style={{ display: "grid", gap: 16 }}>
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
                          </form>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </PopupAction>
        ) : null}


        {features.requests && pendingRequests.length > 0 ? (
          <>
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
                        <form action={reviewRequestAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <input type="hidden" name="notifySuccess" value="1" />
                          <button type="submit" aria-label="Rifiuta" style={rejectButtonStyle}>
                            ✕
                          </button>
                        </form>
                        <form action={reviewRequestAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <input type="hidden" name="decision" value="APPROVED" />
                          <input type="hidden" name="notifySuccess" value="1" />
                          <button type="submit" aria-label="Approva" style={approveButtonStyle}>
                            ✓
                          </button>
                        </form>
                      </span>
                    ) : (
                      <StatusPill label="In attesa" tone="warning" />
                    )
                  }
                />
              );
            })}
          </>
        ) : null}

        {canManageClosures && happeningNow.length > 0 ? (
          <>
            <RequestGroup label="In questi giorni" />
            {happeningNow.map((item) => (
              <RequestRow key={item.key} emoji={item.emoji} title={item.title} detail={item.detail} />
            ))}
          </>
        ) : null}

        {!canManageClosures && features.requests && closedRequests.length > 0 ? (
          <>
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
          </>
        ) : null}

        {!canManageClosures && features.availability && !isCompany ? (
          <>
            <RequestGroup label="Quando non ci sei" count={ownAvailabilities.length} />
            {ownAvailabilities.length === 0 ? (
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: "#f8fafc",
                  color: "#64748b",
                  fontSize: 13.5,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                Niente in programma.
              </div>
            ) : (
              ownAvailabilities.map((availability) => (
                <SwipeRevealAction
                  key={availability.id}
                  enabled
                  action={
                    <form action={deleteAvailabilityAction}>
                      <input type="hidden" name="availabilityId" value={availability.id} />
                      <DeleteSwipeButton label="Elimina indisponibilità" />
                    </form>
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
          </>
        ) : null}

        {canManageClosures ? (
          <>
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
                          <form action={deleteRequestAction}>
                            <input type="hidden" name="requestId" value={request.id} />
                            <DeleteSwipeButton label="Elimina straordinario" />
                          </form>
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
                        <form action={updateCalendarClosureAction} style={{ display: "grid", gap: 16 }}>
                          <input type="hidden" name="closureId" value={closure.id} />
                          <input type="hidden" name="notifySuccess" value="1" />

                          <FormField label="Nome">
                            <TextInput name="title" defaultValue={closure.title} />
                          </FormField>

                          <FormField label="Tipo attivita">
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
                        </form>
                      </PopupAction>
                    }
                    action={
                      <form action={deleteCalendarClosureAction}>
                        <input type="hidden" name="closureId" value={closure.id} />
                        <input type="hidden" name="notifySuccess" value="1" />
                        <DeleteSwipeButton label="Elimina chiusura" />
                      </form>
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
                          <form action={deleteAvailabilityAction}>
                            <input type="hidden" name="availabilityId" value={availability.id} />
                            <DeleteSwipeButton label="Elimina indisponibilità" />
                          </form>
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
                        <form action={deleteRequestAction}>
                          <input type="hidden" name="requestId" value={request.id} />
                          <DeleteSwipeButton label="Elimina richiesta" />
                        </form>
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
          </>
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
