"use client";

import { RequestStatus, RequestType } from "@prisma/client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { reviewRequestAction } from "./actions";
import { EmptyState, PrimaryButton, StatusPill } from "./ui";

type RequestCardItem = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  peerStatus: RequestStatus | null;
  ownerStatus: RequestStatus | null;
  reason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  employee: {
    firstName: string;
    lastName: string;
  };
  swapWith: {
    firstName: string;
    lastName: string;
  } | null;
  shift: {
    title: string | null;
    startTime: string;
    endTime: string;
  } | null;
};

function requestTone(status: RequestStatus) {
  if (status === RequestStatus.APPROVED) {
    return "success" as const;
  }

  if (status === RequestStatus.REJECTED) {
    return "danger" as const;
  }

  return "warning" as const;
}

function requestLabel(type: RequestType) {
  if (type === RequestType.VACATION) {
    return "Ferie";
  }

  if (type === RequestType.PERMISSION) {
    return "Permesso";
  }

  return "Cambio turno";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function OwnerRequestCards({ requests }: { requests: RequestCardItem[] }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!selectedRequestId) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedRequestId]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  function closeModal() {
    if (isPending) {
      return;
    }

    setSelectedRequestId(null);
  }

  async function handleDecision(requestId: string, decision: "APPROVED" | "REJECTED") {
    const formData = new FormData();
    formData.set("requestId", requestId);
    formData.set("decision", decision);

    startTransition(async () => {
      await reviewRequestAction(formData);
      setSelectedRequestId(null);
      router.refresh();
    });
  }

  if (requests.length === 0) {
    return <EmptyState message="Nessuna richiesta in sospeso." />;
  }

  return (
    <>
      <div style={{ display: "grid", gap: 10 }}>
        {requests.map((request) => {
          const canOwnerReview =
            request.status === RequestStatus.PENDING &&
            (request.type !== RequestType.SHIFT_CHANGE ||
              request.peerStatus === RequestStatus.APPROVED);

          return (
            <button
              key={request.id}
              type="button"
              onClick={() => setSelectedRequestId(request.id)}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 20,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ color: "#0f172a" }}>
                  {requestLabel(request.type)} · {request.employee.firstName} {request.employee.lastName}
                </strong>
                <span style={{ color: "#475569", fontSize: 14 }}>
                  {request.shift
                    ? `${request.shift.title || "Turno"} · ${formatDateTime(request.shift.startTime)}`
                    : request.startsAt
                      ? `${formatDateTime(request.startsAt)}${request.endsAt ? ` - ${formatDateTime(request.endsAt)}` : ""}`
                      : "Dettagli richiesta"}
                </span>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {canOwnerReview ? "Apri per approvare o rifiutare" : "In attesa di revisione del collega"}
                </span>
              </div>

              <span
                style={{
                  color: "#64748b",
                  fontSize: 18,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                &rsaquo;
              </span>
            </button>
          );
        })}
      </div>

      {mounted && selectedRequest
        ? createPortal(
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 2147483646,
                display: "grid",
                placeItems: "center",
                padding: 16,
              }}
            >
              <button
                type="button"
                aria-label="Chiudi popup richiesta"
                onClick={closeModal}
                style={{
                  position: "absolute",
                  inset: 0,
                  border: 0,
                  background: "rgba(15, 23, 42, 0.28)",
                  backdropFilter: "blur(6px)",
                }}
              />

              <section
                style={{
                  position: "relative",
                  width: "min(720px, calc(100vw - 32px))",
                  maxHeight: "calc(100vh - 32px)",
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.98)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 28,
                  boxShadow: "0 24px 48px rgba(15, 23, 42, 0.18)",
                  padding: 24,
                  display: "grid",
                  gap: 18,
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong style={{ fontSize: 22, color: "#0f172a" }}>
                      {requestLabel(selectedRequest.type)}
                    </strong>
                    <span style={{ color: "#475569" }}>
                      {selectedRequest.employee.firstName} {selectedRequest.employee.lastName}
                    </span>
                  </div>

                  <PrimaryButton type="button" tone="sand" onClick={closeModal} disabled={isPending}>
                    Chiudi
                  </PrimaryButton>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <StatusPill label={selectedRequest.status} tone={requestTone(selectedRequest.status)} />
                  {selectedRequest.peerStatus ? (
                    <StatusPill
                      label={`Collega ${selectedRequest.peerStatus}`}
                      tone={requestTone(selectedRequest.peerStatus)}
                    />
                  ) : null}
                  {selectedRequest.ownerStatus ? (
                    <StatusPill
                      label={`Titolare ${selectedRequest.ownerStatus}`}
                      tone={requestTone(selectedRequest.ownerStatus)}
                    />
                  ) : null}
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: 18,
                    borderRadius: 20,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 14 }}>Dettagli richiesta</div>
                  <div style={{ color: "#0f172a", fontWeight: 600 }}>
                    {selectedRequest.startsAt
                      ? `${formatDateTime(selectedRequest.startsAt)}${selectedRequest.endsAt ? ` - ${formatDateTime(selectedRequest.endsAt)}` : ""}`
                      : "Data non disponibile"}
                  </div>

                  {selectedRequest.shift ? (
                    <div style={{ color: "#475569", lineHeight: 1.6 }}>
                      {selectedRequest.shift.title || "Turno"} · {formatDateTime(selectedRequest.shift.startTime)}
                      {" - "}
                      {formatDateTime(selectedRequest.shift.endTime)}
                    </div>
                  ) : null}

                  {selectedRequest.swapWith ? (
                    <div style={{ color: "#475569", lineHeight: 1.6 }}>
                      Collega coinvolto: {selectedRequest.swapWith.firstName} {selectedRequest.swapWith.lastName}
                    </div>
                  ) : null}

                  {selectedRequest.reason ? (
                    <div style={{ color: "#334155", lineHeight: 1.6 }}>{selectedRequest.reason}</div>
                  ) : null}
                </div>

                {selectedRequest.status === RequestStatus.PENDING &&
                (selectedRequest.type !== RequestType.SHIFT_CHANGE ||
                  selectedRequest.peerStatus === RequestStatus.APPROVED) ? (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <PrimaryButton
                      type="button"
                      tone="green"
                      onClick={() => handleDecision(selectedRequest.id, RequestStatus.APPROVED)}
                      disabled={isPending}
                    >
                      Approva
                    </PrimaryButton>

                    <PrimaryButton
                      type="button"
                      tone="red"
                      onClick={() => handleDecision(selectedRequest.id, RequestStatus.REJECTED)}
                      disabled={isPending}
                    >
                      Rifiuta
                    </PrimaryButton>
                  </div>
                ) : (
                  <div style={{ color: "#64748b" }}>
                    {selectedRequest.type === RequestType.SHIFT_CHANGE &&
                    selectedRequest.peerStatus !== RequestStatus.APPROVED
                      ? "Questa richiesta diventa approvabile dal titolare dopo il via libera del collega coinvolto."
                      : "Questa richiesta non richiede altre azioni in questo momento."}
                  </div>
                )}
              </section>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
