import {
  ActivityType,
  CalendarClosureType,
  RequestStatus,
  RequestType,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
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
import { SwipeRevealAction } from "../swipe-reveal-action";
import {
  BillingRequiredState,
  EmptyState,
  FormField,
  ItemCard,
  ItemList,
  Panel,
  PrimaryButton,
  Select,
  Stack,
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

  return (
    <div className="workbit-requests-page">
      <div className="workbit-requests-heading">
        <span>Gestisci</span>
        <h2>{canManageClosures ? "Richieste e chiusure" : "Richieste"}</h2>
      </div>

      <Stack className="workbit-requests-stack">
        {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}
        {canCreateRequests ? (
          <PopupAction
            title="Nuova richiesta"
            ariaLabel="Chiedi qualcosa"
            triggerContent="＋ Chiedi qualcosa"
            triggerStyle={{
              width: "100%",
              minHeight: 52,
              borderRadius: 18,
              border: 0,
              background: "linear-gradient(135deg, #30217f 0%, #5e5ce6 58%, #8b5cf6 100%)",
              color: "#ffffff",
              fontSize: 15.5,
              fontWeight: 830,
              boxShadow: "0 10px 22px rgba(94, 92, 230, 0.26)",
            }}
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
          <div style={{ display: "grid", gap: 9 }}>
            <span
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 11.5,
                fontWeight: 820,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#92400e",
              }}
            >
              <span>{canManageClosures ? "Da approvare" : "In attesa di risposta"}</span>
              <span>{pendingRequests.length}</span>
            </span>

            {pendingRequests.map((request) => {
              const canPeerReview =
                request.type === "SHIFT_CHANGE" &&
                request.swapWithUserId === session.user.id &&
                request.peerStatus !== RequestStatus.REJECTED;
              const canOwnerReview =
                canManageClosures &&
                request.type !== RequestType.SICKNESS &&
                (request.type !== "SHIFT_CHANGE" || request.peerStatus === RequestStatus.APPROVED);
              const canSeeRequestDetails =
                canManageClosures ||
                request.employee.id === session.user.id ||
                !isPrivateAbsenceRequest(request.type);

              return (
                <div
                  key={request.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "38px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 11,
                    padding: "11px 12px",
                    borderRadius: 16,
                    border: "1px solid #fde68a",
                    background: "#fffbeb",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 38,
                      height: 38,
                      display: "inline-grid",
                      placeItems: "center",
                      borderRadius: 12,
                      background: "#ffffff",
                      fontSize: 16,
                    }}
                  >
                    {requestEmoji(request.type)}
                  </span>

                  <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 14.5, letterSpacing: "-0.015em", color: "#0f172a" }}>
                      {requestLabel(request.type)}
                      {canManageClosures ? ` · ${request.employee.firstName}` : ""}
                    </strong>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 780,
                        color: "#92400e",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {canSeeRequestDetails
                        ? `${request.startsAt ? formatDateTime(request.startsAt) : "Data non disponibile"}${
                            request.endsAt ? ` – ${formatDateTime(request.endsAt)}` : ""
                          }`
                        : "Dettaglio riservato"}
                    </span>
                  </span>

                  {canPeerReview || canOwnerReview ? (
                    <span style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
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
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        {role === Role.OWNER && canUseOvertime ? (
          <Panel
            title="Straordinari"
            action={
              <PopupAction
                title="Straordinario"
                ariaLabel="Aggiungi straordinario"
                className="workbit-request-plus"
              >
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
              </PopupAction>
            }
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
                        <ItemCard
                          title={`${request.employee.firstName} ${request.employee.lastName}`}
                          subtitle={`${formatDateTime(request.startsAt ?? request.createdAt)} - ${formatDateTime(
                            request.endsAt ?? request.createdAt
                          )}`}
                          meta={request.reason || "Straordinario"}
                          footer={<StatusPill label={requestStatusLabel(request.status)} tone={requestTone(request.status)} />}
                        />
                      </SwipeRevealAction>
                    );
                  })}
                </ItemList>
              )}
            </div>
          </Panel>
        ) : null}

        {canManageClosures ? (
          <Panel
            title="Chiusure"
            action={
              <PopupAction
                title="Chiusura"
                ariaLabel="Aggiungi chiusura"
                className="workbit-request-plus"
              >
                <ClosureComposeForm action={createCalendarClosureAction} />
              </PopupAction>
            }
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
                    <ItemCard
                      title={closure.title}
                      subtitle={`${formatDate(closure.startsAt)}${
                        closure.startsAt.toDateString() !== closure.endsAt.toDateString()
                          ? ` - ${formatDate(closure.endsAt)}`
                          : ""
                      }`}
                      meta={<StatusPill label={closureTypeLabel(closure.type)} tone={closureTypeTone(closure.type)} />}
                      footer={
                        <span style={{ color: "#64748b", fontSize: 13 }}>
                          {closure.createdBy
                            ? `${closure.createdBy.firstName} ${closure.createdBy.lastName}`.trim()
                            : "Autore non disponibile"}
                        </span>
                      }
                    />
                  </SwipeRevealAction>
                ))}
              </ItemList>
            )}
          </Panel>
        ) : null}

        {features.availability && !isCompany ? (
            <Panel
              className="workbit-requests-list-panel workbit-availability-panel"
              title="Indisponibilità"
              action={
                availabilities.length === 1 ? "1 giorno" : `${availabilities.length} giorni`
              }
            >
              <div style={{ display: "grid", gap: 12 }}>
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
                        <ItemCard
                          title={
                            availability.user.id === session.user.id
                              ? "La tua indisponibilità"
                              : availability.user.firstName + " " + availability.user.lastName
                          }
                          subtitle={formatDateTime(availability.startsAt) + " - " + formatDateTime(availability.endsAt)}
                          meta={
                            canSeeAvailabilityReason
                              ? availability.reason || null
                              : "Dettaglio riservato"
                          }
                        />
                      </SwipeRevealAction>
                    );
                  })}
                </ItemList>
              )}
              </div>
            </Panel>
        ) : null}
        {features.requests ? (
          <Panel
            className="workbit-requests-list-panel workbit-requests-history-panel"
            title="Già chiuse"
            action={
              closedRequests.length === 1 ? "1 richiesta" : `${closedRequests.length} richieste`
            }
          >
            {closedRequests.length === 0 ? (
              <EmptyState message="Nessuna richiesta chiusa." />
            ) : (
              <ItemList scrollable>
                {closedRequests.map((request) => {
                  const canPeerReview =
                    request.type === "SHIFT_CHANGE" &&
                    request.swapWithUserId === session.user.id &&
                    request.status === RequestStatus.PENDING &&
                    request.peerStatus !== RequestStatus.REJECTED;
                  const canOwnerReview =
                    canManageClosures &&
                    request.status === RequestStatus.PENDING &&
                    request.type !== RequestType.SICKNESS &&
                    (request.type !== "SHIFT_CHANGE" || request.peerStatus === RequestStatus.APPROVED);
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
                      <ItemCard
                        title={requestLabel(request.type)}
                        subtitle={`${request.employee.firstName} ${request.employee.lastName}`}
                        meta={
                          <>
                            {request.startsAt ? formatDateTime(request.startsAt) : "Data non disponibile"}
                            {request.endsAt ? ` - ${formatDateTime(request.endsAt)}` : ""}
                          </>
                        }
                        footer={
                          <div style={{ display: "grid", gap: 10 }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <StatusPill label={requestStatusLabel(request.status)} tone={requestTone(request.status)} />
                              {request.peerStatus ? (
                                <StatusPill label={requestStatusLabel(request.peerStatus)} tone={requestTone(request.peerStatus)} />
                              ) : null}
                              {request.ownerStatus ? (
                                <StatusPill label={requestStatusLabel(request.ownerStatus)} tone={requestTone(request.ownerStatus)} />
                              ) : null}
                            </div>

                            {requestSummary ? (
                              <div style={{ color: "#64748b", lineHeight: 1.5 }}>{requestSummary}</div>
                            ) : null}

                            {canPeerReview || canOwnerReview ? (
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <form action={reviewRequestAction}>
                                  <input type="hidden" name="requestId" value={request.id} />
                                  <input type="hidden" name="decision" value="APPROVED" />
                                  <input type="hidden" name="notifySuccess" value="1" />
                                  <PrimaryButton type="submit" tone="green">
                                    Approva
                                  </PrimaryButton>
                                </form>

                                <form action={reviewRequestAction}>
                                  <input type="hidden" name="requestId" value={request.id} />
                                  <input type="hidden" name="decision" value="REJECTED" />
                                  <input type="hidden" name="notifySuccess" value="1" />
                                  <PrimaryButton type="submit" tone="red">
                                    Rifiuta
                                  </PrimaryButton>
                                </form>
                              </div>
                            ) : null}
                          </div>
                        }
                      />
                    </SwipeRevealAction>
                  );
                })}
              </ItemList>
            )}
          </Panel>
        ) : null}
      </Stack>
    </div>
  );
}
