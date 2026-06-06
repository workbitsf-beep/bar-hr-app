import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ClosureDateRangeInput } from "@/app/components/closure-date-range-input";
import { DateTimeInput } from "@/app/components/date-time-input";
import {
  createCalendarClosureAction,
  createAvailabilityAction,
  createShiftChangeRequestAction,
  createTimeOffRequestAction,
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

function getReviewerName(
  reviewer:
    | {
        firstName: string;
        lastName: string;
      }
    | null
    | undefined
) {
  if (!reviewer) {
    return null;
  }

  return `${reviewer.firstName} ${reviewer.lastName}`.trim();
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
  const pageTitle = features.requests ? "Richieste" : "Indisponibilita";

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

  if (!features.requests && !features.availability) {
    return (
      <Panel title={pageTitle}>
        <EmptyState message="Moduli operativi disattivati nelle impostazioni." />
      </Panel>
    );
  }

  const isCompany = activeBarActivityType === ActivityType.COMPANY;
  const canCreateRequests = features.requests && role !== Role.OWNER;
  const canCreateAvailability = features.availability && !isCompany && role !== Role.OWNER;
  const canManageClosures = features.requests && (role === Role.OWNER || role === Role.MANAGER);
  const canUseOvertime = features.requests && features.overtime;
  const requestPanelTitle = canUseOvertime
    ? "Richiedi ferie, permesso, malattia o straordinario"
    : "Richiedi ferie, permesso o malattia";
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
            : null;
  const [requests, ownShifts, teammates, availabilities, overtimeMembers, closures] = await Promise.all([
    features.requests
      ? prisma.request.findMany({
      where: {
        barId: activeBarId,
        ...(role === Role.OWNER
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
      include: {
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
          include: {
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
          },
          orderBy: {
            startsAt: "asc",
          },
          include: {
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
          include: {
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
          orderBy: {
            startsAt: "desc",
          },
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

  return (
    <>
      <Stack>
        {successMessage ? <SuccessCallout>{successMessage}</SuccessCallout> : null}
        {canCreateRequests ? (
          <>
            <Panel
              title={requestPanelTitle}
              action={
                <PopupAction title="Nuova richiesta" ariaLabel="Aggiungi richiesta">
                  <form action={createTimeOffRequestAction} style={{ display: "grid", gap: 16 }}>
                    <div
                      className="dashboard-inline-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <FormField label="Tipo">
                        <Select name="type" defaultValue="VACATION">
                          <option value="VACATION">Ferie</option>
                          <option value="PERMISSION">Permesso</option>
                          <option value="SICKNESS">Malattia</option>
                          {canUseOvertime ? <option value="OVERTIME">Straordinario</option> : null}
                        </Select>
                      </FormField>

                      <FormField label="Da">
                        <DateTimeInput name="startsAt" required />
                      </FormField>

                      <FormField label="A">
                        <DateTimeInput name="endsAt" required />
                      </FormField>
                    </div>

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
              <EmptyState message="Le richieste inserite compaiono nello storico qui sotto." />
            </Panel>

            {!isCompany ? (
              <Panel
                title="Richiedi cambio turno"
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
                  <EmptyState message="Non hai turni futuri disponibili per un cambio." />
                ) : (
                  <EmptyState message="Apri il popup con il + per richiedere un cambio turno." />
                )}
              </Panel>
            ) : null}
          </>
        ) : null}

        {role === Role.OWNER && canUseOvertime ? (
          <Panel
            title="Registra straordinario"
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

                    <FormField label="Da">
                      <DateTimeInput name="startsAt" required />
                    </FormField>

                    <FormField label="A">
                      <DateTimeInput name="endsAt" required />
                    </FormField>
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
            <EmptyState message="Apri il popup con il + per registrare uno straordinario." />
          </Panel>
        ) : null}

        {canManageClosures ? (
          <Panel
            title="Chiusure"
            action={
              <PopupAction title="Chiusura" ariaLabel="Aggiungi chiusura">
                <form action={createCalendarClosureAction} style={{ display: "grid", gap: 16 }}>
                  <input type="hidden" name="type" value="CLOSURE" />

                  <FormField label="Titolo">
                    <TextInput name="title" placeholder="Chiusura locale" />
                  </FormField>

                  <ClosureDateRangeInput startName="startsAt" endName="endsAt" required />

                  <input type="hidden" name="notifySuccess" value="1" />

                  <div className="dashboard-form-actions">
                    <PrimaryButton type="submit">Salva chiusura</PrimaryButton>
                  </div>
                </form>
              </PopupAction>
            }
          >
            {closures.length === 0 ? (
              <EmptyState message="Nessuna chiusura registrata." />
            ) : (
              <ItemList scrollable>
                {closures.map((closure) => (
                  <ItemCard
                    key={closure.id}
                    title={closure.title}
                    subtitle="Chiusura"
                    meta={formatDate(closure.startsAt) + " - " + formatDate(closure.endsAt)}
                    footer={
                      closure.createdBy ? (
                        <span>
                          Inserita da {closure.createdBy.firstName} {closure.createdBy.lastName}
                        </span>
                      ) : null
                    }
                  />
                ))}
              </ItemList>
            )}
          </Panel>
        ) : null}

        {features.availability && !isCompany ? (
          <>
            <Panel
              title="Nuova indisponibilita"
              action={
                <PopupAction title="Indisponibilita" ariaLabel="Aggiungi indisponibilita">
                  <form action={createAvailabilityAction} style={{ display: "grid", gap: 16 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <FormField label="Da">
                        <DateTimeInput name="startsAt" required />
                      </FormField>

                      <FormField label="A">
                        <DateTimeInput name="endsAt" required />
                      </FormField>
                    </div>

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
              <EmptyState message="Apri il popup con il + per segnalare un'indisponibilita." />
            </Panel>

            <Panel title="Calendario indisponibilita" action={availabilities.length + " elementi"}>
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
            </Panel>
          </>
        ) : null}
        {features.requests ? (
          <Panel title="Storico richieste" action={`${requests.length} elementi`}>
            {requests.length === 0 ? (
              <EmptyState message="Nessuna richiesta presente." />
            ) : (
              <ItemList scrollable>
                {requests.map((request) => {
                  const peerReviewerName = getReviewerName(request.peerReviewedBy);
                  const ownerReviewerName = getReviewerName(request.reviewedBy);
                  const canPeerReview =
                    request.type === "SHIFT_CHANGE" &&
                    request.swapWithUserId === session.user.id &&
                    request.status === RequestStatus.PENDING &&
                    request.peerStatus !== RequestStatus.REJECTED;
                  const canOwnerReview =
                    role === Role.OWNER &&
                    request.status === RequestStatus.PENDING &&
                    request.type !== RequestType.SICKNESS &&
                    (request.type !== "SHIFT_CHANGE" || request.peerStatus === RequestStatus.APPROVED);

                  return (
                    <ItemCard
                      key={request.id}
                      title={requestLabel(request.type)}
                      subtitle={`${request.employee.firstName} ${request.employee.lastName}`}
                      meta={
                        <>
                          {request.startsAt ? formatDateTime(request.startsAt) : "Data non disponibile"}
                          {request.endsAt ? ` - ${formatDateTime(request.endsAt)}` : ""}
                          <br />
                          {request.shift
                            ? `${request.shift.title || "Turno"} - ${formatDateTime(request.shift.startTime)}`
                            : request.certificateCode
                              ? `Certificato: ${request.certificateCode}${request.reason ? ` - ${request.reason}` : ""}`
                              : request.reason || "Nessun dettaglio aggiuntivo"}
                        </>
                      }
                      footer={
                        <div style={{ display: "grid", gap: 12 }}>
                          <div className="dashboard-inline-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <StatusPill label={request.status} tone={requestTone(request.status)} />
                            {request.peerStatus ? (
                              <StatusPill
                                label={`Collega ${request.peerStatus}`}
                                tone={requestTone(request.peerStatus)}
                              />
                            ) : null}
                            {request.ownerStatus ? (
                              <StatusPill
                                label={`Titolare ${request.ownerStatus}`}
                                tone={requestTone(request.ownerStatus)}
                              />
                            ) : null}
                          </div>

                          {request.type === "SHIFT_CHANGE" && request.swapWith ? (
                            <div style={{ color: "#475569" }}>
                              Collega coinvolto: {request.swapWith.firstName} {request.swapWith.lastName}
                            </div>
                          ) : null}

                          {request.reason ? (
                            <div style={{ color: "#334155", lineHeight: 1.6 }}>{request.reason}</div>
                          ) : null}

                          {request.type === "SHIFT_CHANGE" &&
                          request.peerStatus &&
                          request.peerStatus !== RequestStatus.PENDING ? (
                            <div style={{ color: "#475569", lineHeight: 1.6 }}>
                              Revisione collega:{" "}
                              {peerReviewerName
                                ? `${peerReviewerName} (${request.peerStatus.toLowerCase()})`
                                : request.peerStatus.toLowerCase()}
                            </div>
                          ) : null}

                          {request.ownerStatus &&
                          request.ownerStatus !== RequestStatus.PENDING ? (
                            <div style={{ color: "#475569", lineHeight: 1.6 }}>
                              Revisione titolare:{" "}
                              {ownerReviewerName
                                ? `${ownerReviewerName} (${request.ownerStatus.toLowerCase()})`
                                : request.type === RequestType.SICKNESS &&
                                    request.ownerStatus === RequestStatus.APPROVED
                                  ? "Approvazione automatica"
                                  : request.ownerStatus.toLowerCase()}
                            </div>
                          ) : null}

                          {canPeerReview || canOwnerReview ? (
                            <div className="dashboard-action-row" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
