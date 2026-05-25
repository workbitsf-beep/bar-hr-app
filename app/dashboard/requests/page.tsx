import { ActivityType, RequestStatus, RequestType, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
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
  TextArea,
  TextInput,
  formatDateTime,
} from "../ui";

function requestTone(status: RequestStatus) {
  if (status === RequestStatus.APPROVED) {
    return "success" as const;
  }

  if (status === RequestStatus.REJECTED) {
    return "danger" as const;
  }

  return "warning" as const;
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

export default async function DashboardRequestsPage() {
  const { session, role, activeBarId, activeBarActivityType, billingStatus } =
    await getDashboardContext();

  if (!activeBarId) {
    return (
      <Panel title="Richieste e indisponibilita">
        <EmptyState message="Seleziona un locale attivo per vedere richieste e indisponibilita." />
      </Panel>
    );
  }

  if (billingStatus && !billingStatus.canAccess) {
    return <BillingRequiredState role={String(role)} />;
  }

  const isCompany = activeBarActivityType === ActivityType.COMPANY;
  const canCreateRequests = role !== Role.OWNER;
  const [requests, ownShifts, teammates, availabilities] = await Promise.all([
    prisma.request.findMany({
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
    }),
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
    isCompany
      ? Promise.resolve([])
      : prisma.availability.findMany({
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
        }),
  ]);

  return (
    <>
      <Stack>
        {canCreateRequests ? (
          <>
            <Panel title="Richiedi ferie, permesso o malattia">
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
                    </Select>
                  </FormField>

                  <FormField label="Da">
                    <TextInput name="startsAt" type="datetime-local" required />
                  </FormField>

                  <FormField label="A">
                    <TextInput name="endsAt" type="datetime-local" required />
                  </FormField>
                </div>

                <FormField label="Motivo">
                  <TextArea name="reason" placeholder="Spiega brevemente la richiesta" />
                </FormField>

                <FormField label="Codice certificato malattia">
                  <TextInput
                    name="certificateCode"
                    placeholder="Obbligatorio solo se scegli Malattia"
                  />
                </FormField>

                <div className="dashboard-form-actions">
                  <PrimaryButton type="submit">Invia richiesta</PrimaryButton>
                </div>
              </form>
            </Panel>

            {!isCompany ? (
              <Panel title="Richiedi cambio turno">
              {ownShifts.length === 0 ? (
                <EmptyState message="Non hai turni futuri disponibili per un cambio." />
              ) : (
                <form action={createShiftChangeRequestAction} style={{ display: "grid", gap: 16 }}>
                  <FormField label="Turno da cambiare">
                    <Select name="shiftId" required defaultValue="">
                      <option value="" disabled>
                        Seleziona un turno
                      </option>
                      {ownShifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {(shift.title || "Turno")} · {formatDateTime(shift.startTime)}
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

                  <div className="dashboard-form-actions">
                    <PrimaryButton type="submit">Invia cambio turno</PrimaryButton>
                  </div>
                </form>
              )}
              </Panel>
            ) : null}
          </>
        ) : null}

        {!isCompany ? (
          <>
            <Panel title="Nuova indisponibilita">
              <form action={createAvailabilityAction} style={{ display: "grid", gap: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <FormField label="Da">
                    <TextInput name="startsAt" type="datetime-local" required />
                  </FormField>

                  <FormField label="A">
                    <TextInput name="endsAt" type="datetime-local" required />
                  </FormField>
                </div>

                <FormField label="Motivo">
                  <TextArea
                    name="reason"
                    placeholder="Facoltativo: esame, visita, evento personale"
                  />
                </FormField>

                <div className="dashboard-form-actions">
                  <PrimaryButton type="submit">Salva indisponibilita</PrimaryButton>
                </div>
              </form>
            </Panel>

            <Panel title="Calendario indisponibilita" action={`${availabilities.length} elementi`}>
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
                          : `${availability.user.firstName} ${availability.user.lastName}`
                      }
                      subtitle={`${formatDateTime(availability.startsAt)} - ${formatDateTime(availability.endsAt)}`}
                      meta={availability.reason || "Nessuna nota aggiuntiva"}
                    />
                  ))}
                </ItemList>
              )}
            </Panel>
          </>
        ) : null}

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
                    title={
                      request.type === "VACATION"
                        ? "Ferie"
                        : request.type === "PERMISSION"
                          ? "Permesso"
                          : request.type === "SICKNESS"
                            ? "Malattia"
                            : "Cambio turno"
                    }
                    subtitle={`${request.employee.firstName} ${request.employee.lastName}`}
                    meta={
                      <>
                        {request.startsAt ? formatDateTime(request.startsAt) : "Data non disponibile"}
                        {request.endsAt ? ` - ${formatDateTime(request.endsAt)}` : ""}
                        <br />
                        {request.shift
                          ? `${request.shift.title || "Turno"} · ${formatDateTime(request.shift.startTime)}`
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
                              <PrimaryButton type="submit" tone="green">
                                Approva
                              </PrimaryButton>
                            </form>

                            <form action={reviewRequestAction}>
                              <input type="hidden" name="requestId" value={request.id} />
                              <input type="hidden" name="decision" value="REJECTED" />
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
      </Stack>
    </>
  );
}
