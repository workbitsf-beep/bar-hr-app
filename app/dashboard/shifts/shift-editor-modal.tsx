"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { deleteShiftAction, updateShiftAction } from "../actions";
import { PrimaryButton } from "../ui";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ShiftAssignment = {
  id: string;
  firstName: string;
  lastName: string;
};

type ShiftOption = {
  id: string;
  title: string | null;
  startTime: string;
  endTime: string;
  assignments: ShiftAssignment[];
  createdBy?: {
    firstName: string;
    lastName: string;
  } | null;
};

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDayTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ShiftEditorModal({
  open,
  locale,
  canManage,
  shift,
  members,
  onClose,
}: {
  open: boolean;
  locale: string;
  canManage: boolean;
  shift: ShiftOption | null;
  members: MemberOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!shift) {
      return;
    }

    setTitle(shift.title ?? "");
    setStartTime(toDateTimeLocal(shift.startTime));
    setEndTime(toDateTimeLocal(shift.endTime));
    setSelectedMembers(shift.assignments.map((assignment) => assignment.id));
  }, [shift]);

  function toggleMember(memberId: string) {
    setSelectedMembers((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : current.concat(memberId)
    );
  }

  function handleClose() {
    if (isPending) {
      return;
    }

    onClose();
  }

  async function handleUpdate() {
    if (!shift || !canManage || selectedMembers.length === 0 || !startTime || !endTime) {
      return;
    }

    const formData = new FormData();
    formData.set("shiftId", shift.id);
    formData.set("title", title);
    formData.set("startTime", startTime);
    formData.set("endTime", endTime);

    for (const memberId of selectedMembers) {
      formData.append("employeeIds", memberId);
    }

    startTransition(async () => {
      await updateShiftAction(formData);
      onClose();
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!shift || !canManage) {
      return;
    }

    const formData = new FormData();
    formData.set("shiftId", shift.id);

    startTransition(async () => {
      await deleteShiftAction(formData);
      onClose();
      router.refresh();
    });
  }

  if (!mounted || !open || !shift) {
    return null;
  }

  return createPortal(
    <div
      className="dashboard-modal-wrap"
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
        aria-label="Chiudi popup turno"
        onClick={handleClose}
        style={{
          position: "absolute",
          inset: 0,
          border: 0,
          background: "rgba(15, 23, 42, 0.28)",
          backdropFilter: "blur(6px)",
        }}
      />

      <section
        className="dashboard-modal-panel"
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
          className="dashboard-modal-header"
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
              {shift.title || "Turno"}
            </strong>
            <span style={{ color: "#475569" }}>
              {new Intl.DateTimeFormat(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              }).format(new Date(shift.startTime))}
              {" Â· "}
              {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
            </span>
          </div>

          <PrimaryButton type="button" tone="sand" onClick={handleClose} disabled={isPending}>
            Chiudi
          </PrimaryButton>
        </div>

        {canManage ? (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>Titolo turno</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Servizio pranzo"
                  style={{
                    borderRadius: 16,
                    border: "1px solid #dbe3ee",
                    padding: "12px 14px",
                    fontSize: 15,
                    background: "#ffffff",
                  }}
                />
              </label>

              <div
                className="dashboard-modal-body-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Inizio</span>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    style={{
                      borderRadius: 16,
                      border: "1px solid #dbe3ee",
                      padding: "12px 14px",
                      fontSize: 15,
                      background: "#ffffff",
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Fine</span>
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    style={{
                      borderRadius: 16,
                      border: "1px solid #dbe3ee",
                      padding: "12px 14px",
                      fontSize: 15,
                      background: "#ffffff",
                    }}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>Persone nel turno</span>
                <div
                  className="dashboard-modal-members-grid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                  }}
                >
                  {members.map((member) => (
                    <label
                      key={member.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: "1px solid #e2e8f0",
                        background: selectedMembers.includes(member.id) ? "#e2e8f0" : "#f8fafc",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                      />
                      {member.firstName} {member.lastName} Â· {member.role}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="dashboard-modal-actions"
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <PrimaryButton type="button" tone="red" onClick={handleDelete} disabled={isPending}>
                Elimina turno
              </PrimaryButton>

              <PrimaryButton
                type="button"
                tone="sand"
                onClick={handleUpdate}
                disabled={isPending || selectedMembers.length === 0 || !startTime || !endTime}
              >
                {isPending ? "Salvataggio..." : "Salva modifiche"}
              </PrimaryButton>
            </div>
          </>
        ) : (
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
            <div style={{ color: "#64748b", fontSize: 14 }}>Persone nel turno</div>
            <div style={{ color: "#0f172a", fontWeight: 600 }}>
              {shift.assignments.map((assignment) => `${assignment.firstName} ${assignment.lastName}`).join(", ")}
            </div>
            {shift.createdBy ? (
              <div style={{ color: "#64748b", fontSize: 14 }}>
                Creato da {shift.createdBy.firstName} {shift.createdBy.lastName}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}
