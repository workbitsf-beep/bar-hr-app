import {
  ActivityType,
  CalendarClosureType,
  RequestStatus,
  RequestType,
  Role,
} from "@prisma/client";
import { Fragment } from "react";
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
  updateCalendarClosureAction,
  reviewRequestAction,
} from "../actions";
import { getDashboardContext } from "../context";
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

const AVAILABILITY_VISIBILITY_HOURS = 24;

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
  const pageTitle = canManageClosures ? "Richieste e chiusure" : features.requests ? "Richieste" : "Indisponibilita";

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
  const requestPanelTitle = "Richiedi ferie, permesso o malattia";
  const successMessage =
    success === "request-created"
      ? "Richiesta salvata correttamente."
      : success === "shift-change-created"
        ? "Cambio turno richiesto correttamente."
        : success === "request-reviewed"
          ? "Richiesta confermata correttamente."
        : success === "availability-created"
          ? "Indisponibilita salvata correttamente."
          : success === "closure-created"
            ? "Chiusura salvata correttamente."
            : success === "closure-updated"
              ? "Chiusura aggiornata correttamente."
              : success === "closure-deleted"
                ? "Chiusura eliminata correttamente."
            : null;
  const [requests, ownShifts, teammates, availabilities, overtimeMembers, closures] = await Promise.all([
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
    canCreateRequests && !isCompany && canUseOvertime
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
  const overtimeRequests = requests.filter((request) => request.type === RequestType.OVERTIME);

  return (
    <>
      <Stack>
        {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}
        {canCreateRequests ? (
          <>
            <Panel
              title="Nuova richiesta"
              action={
                <PopupAction title="Nuova richiesta" ariaLabel="Aggiungi richiesta">
                  <form action={createTimeOffRequestAction} style={{ display: "grid", gap: 16 }}>
                    <RequestDateFields />

                    <FormField label="Motivo">
                      <TextArea
                        name="reason"
                        placeholder="Spiega brevemente la richiesta o le ore extra svolte"
                      />
                    </FormField>

                    <FormField label="Codice certificato malattia">
                      <TextInput
                        name="certificateCode"
                        placeholder="Obbligatorio solo se scegli Malattia"
                      />
                    </FormField>

                    <input type="hidden" name="notifySuccess" value="1" />

                    <div className="dashboard-form-actions">
                      <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                    </div>
                  </form>
                </PopupAction>
              }
            >
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>{requestPanelTitle}.</p>
            </Panel>

            {!isCompany ? (
              <Panel
                title="Cambio turno"
                action={
                  ownShifts.length === 0 ? null : (
                    <PopupAction title="Cambio turno" ariaLabel="Aggiungi cambio turno">
                      <form
                        action={createShiftChangeRequestAction}
                        style={{ display: "grid", gap: 16 }}
                      >
                        <FormField label="Turno da cambiare">
                          <Select name="shiftId" required defaultValue="">
                            <option value="" disabled>
                              Seleziona un turno
                            </option>
                            {ownShifts.map((shift) => (
                              <option key={shift.id} value={shift.id}>
                                {(shift.title || "Turno")} - {formatDateTime(shift.startTime)}
                              </option>
                            ))}
                          </Select>
                        </FormField>

                        <FormField label="Collega coinvolto">
                          <Select name="swapWithUserId" required defaultValue="">
                            <option value="" disabled>
                              Seleziona un collega
                            </option>
                            {teammates.map((teammate) => (
                              <option key={teammate.user.id} value={teammate.user.id}>
                                {teammate.user.firstName} {teammate.user.lastName}
                              </option>
                            ))}
                          </Select>
                        </FormField>

                        <FormField label="Motivo">
                          <TextArea name="reason" placeholder="Spiega il motivo del cambio turno" />
                        </FormField>

                        <input type="hidden" name="notifySuccess" value="1" />

                        <div className="dashboard-form-actions">
                          <PrimaryButton type="submit">Invia cambio turno</PrimaryButton>
                        </div>
                      </form>
                    </PopupAction>
                  )
                }
              >
                {ownShifts.length === 0 ? (
                  <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>Nessun turno disponibile.</p>
                ) : (
                  <p style={{ margin: 0, color: "#64748b", lineHeight: 1.6 }}>
                    Cambio turno
                  </p>
                )}
              </Panel>
            ) : null}
          </>
        ) : null}

        {role === Role.OWNER && canUseOvertime ? (
          <Panel
            title="Straordinari"
            action={
              <PopupAction title="Straordinario" ariaLabel="Aggiungi straordinario">
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
                  {overtimeRequests.map((request) => (
                    <ItemCard
                      key={request.id}
                      title={`${request.employee.firstName} ${request.employee.lastName}`}
                      subtitle={`${formatDateTime(request.startsAt ?? request.createdAt)} - ${formatDateTime(
                        request.endsAt ?? request.createdAt
                      )}`}
                      meta={request.reason || "Straordinario"}
                      footer={<StatusPill label={request.status} tone={requestTone(request.status)} />}
                    />
                  ))}
                </ItemList>
              )}
            </div>
          </Panel>
        ) : null}

        {canManageClosures ? (
          <Panel
            title="Chiusure"
            action={
              <PopupAction title="Chiusura" ariaLabel="Aggiungi chiusura">
                <ClosureComposeForm action={createCalendarClosureAction} />
              </PopupAction>
            }
          >
            {closures.length === 0 ? (
              <EmptyState message="Nessuna chiusura registrata." />
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 22,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    minWidth: 0,
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto",
                  }}
                >
                  {["Titolo", "Date", "Azioni"].map((label) => (
                    <div
                      key={label}
                      style={{
                        padding: "14px 16px",
                        background: "#f8fafc",
                        borderBottom: "1px solid #e2e8f0",
                        fontWeight: 700,
                        color: "#475569",
                        fontSize: 13,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label}
                    </div>
                  ))}

                  {closures.map((closure) => (
                    <Fragment key={closure.id}>
                      <div
                        key={`${closure.id}-title`}
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #eef2f7",
                          color: "#0f172a",
                          fontWeight: 700,
                          display: "grid",
                          gap: 4,
                        }}
                      >
                        <span>{closure.title}</span>
                      </div>

                      <div
                        key={`${closure.id}-type`}
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #eef2f7",
                          display: "none",
                          alignItems: "center",
                        }}
                      >
                        <StatusPill label={closureTypeLabel(closure.type)} tone={closureTypeTone(closure.type)} />
                      </div>

                      <div
                        key={`${closure.id}-hours`}
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #eef2f7",
                          color: "#334155",
                          lineHeight: 1.6,
                        }}
                      >
                        <div>{formatDate(closure.startsAt)}</div>
                        <div>{formatDate(closure.endsAt)}</div>
                      </div>

                      <div
                        key={`${closure.id}-author`}
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #eef2f7",
                          color: "#334155",
                          display: "none",
                          lineHeight: 1.5,
                        }}
                      >
                        {closure.createdBy ? (
                          <>
                            {closure.createdBy.firstName} {closure.createdBy.lastName}
                          </>
                        ) : (
                          "-"
                        )}
                      </div>

                      <div
                        key={`${closure.id}-actions`}
                        style={{
                          padding: "16px",
                          borderBottom: "1px solid #eef2f7",
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
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

                            <FormField label="Tipo attività">
                              <Select name="type" defaultValue={closure.type}>
                                <option value={CalendarClosureType.CLOSURE}>Chiusura</option>
                                <option value={CalendarClosureType.HOLIDAY}>Festività</option>
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

                        <PopupAction
                          title="Elimina chiusura"
                          ariaLabel={`Elimina ${closure.title}`}
                          closeOnSubmit
                          triggerContent={
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          }
                        >
                          <form action={deleteCalendarClosureAction} style={{ display: "grid", gap: 16 }}>
                            <input type="hidden" name="closureId" value={closure.id} />
                            <input type="hidden" name="notifySuccess" value="1" />

                            <p style={{ margin: 0, color: "#475569", lineHeight: 1.6 }}>
                              Vuoi eliminare questa chiusura? L&apos;azione non si può annullare.
                            </p>

                            <div className="dashboard-form-actions">
                              <PrimaryButton type="submit" tone="red">
                                Elimina chiusura
                              </PrimaryButton>
                            </div>
                          </form>
                        </PopupAction>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        ) : null}

        {features.availability && !isCompany ? (
            <Panel
              title="Indisponibilita"
              action={
                <PopupAction title="Indisponibilita" ariaLabel="Aggiungi indisponibilita">
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
                      <PrimaryButton type="submit">Salva indisponibilita</PrimaryButton>
                    </div>
                  </form>
                </PopupAction>
              }
            >
              <div style={{ display: "grid", gap: 12 }}>
              {availabilities.length === 0 ? (
                <EmptyState message="Nessuna indisponibilita registrata." />
              ) : (
                <ItemList scrollable>
                  {availabilities.map((availability) => (
                    <ItemCard
                      key={availability.id}
                      title={
                        availability.user.id === session.user.id
                          ? "La tua indisponibilita"
                          : availability.user.firstName + " " + availability.user.lastName
                      }
                      subtitle={formatDateTime(availability.startsAt) + " - " + formatDateTime(availability.endsAt)}
                      meta={availability.reason || "Nessuna nota aggiuntiva"}
                    />
                  ))}
                </ItemList>
              )}
              </div>
            </Panel>
        ) : null}
        {features.requests ? (
          <Panel title="Storico richieste" action={`${standardRequests.length} elementi`}>
            {standardRequests.length === 0 ? (
              <EmptyState message="Nessuna richiesta presente." />
            ) : (
              <ItemList scrollable>
                {standardRequests.map((request) => {
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

                  const requestSummary = request.shift
                    ? `${request.shift.title || "Turno"} - ${formatDateTime(request.shift.startTime)}`
                    : request.certificateCode
                      ? `Certificato: ${request.certificateCode}`
                      : request.reason || "Nessun dettaglio aggiuntivo";

                  return (
                    <ItemCard
                      key={request.id}
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
                            <StatusPill label={request.status} tone={requestTone(request.status)} />
                            {request.peerStatus ? (
                              <StatusPill label={request.peerStatus} tone={requestTone(request.peerStatus)} />
                            ) : null}
                            {request.ownerStatus ? (
                              <StatusPill label={request.ownerStatus} tone={requestTone(request.ownerStatus)} />
                            ) : null}
                          </div>

                          <div style={{ color: "#64748b", lineHeight: 1.5 }}>{requestSummary}</div>

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
                  );
                })}
              </ItemList>
            )}
          </Panel>
        ) : null}
      </Stack>
    </>
  );
}
