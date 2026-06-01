"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  combineDateAndTime,
  toDateInputValue,
  toTimeInputValue,
} from "@/lib/shift-datetime";
import { TimeInput } from "@/app/components/time-input";
import type { ShiftPreset } from "@/lib/shift-presets";
import { deleteShiftAction, updateShiftAction } from "../actions";
import { IconButton, PrimaryButton, Select } from "../ui";

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

function formatDayTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRoleLabel(role: string) {
  if (role === "MANAGER") {
    return "Manager";
  }

  if (role === "OWNER") {
    return "Titolare";
  }

  return "Dipendente";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operazione non riuscita.";
}

export function ShiftEditorModal({
  open,
  locale,
  canManage,
  shift,
  members,
  presets,
  onClose,
}: {
  open: boolean;
  locale: string;
  canManage: boolean;
  shift: ShiftOption | null;
  members: MemberOption[];
  presets: ShiftPreset[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedPresetKey, setSelectedPresetKey] = useState("CUSTOM");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "danger";
    message: string;
  } | null>(null);

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

    setFeedback(null);
    setTitle(shift.title ?? "");
    setShiftDate(toDateInputValue(shift.startTime));
    setStartTime(toTimeInputValue(shift.startTime));
    setEndTime(toTimeInputValue(shift.endTime));
    setSelectedMembers(shift.assignments.map((assignment) => assignment.id));
    setSelectedPresetKey("CUSTOM");
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

  function applyPresetByKey(nextKey: string) {
    setSelectedPresetKey(nextKey);

    if (!shift || nextKey === "CUSTOM") {
      return;
    }

    const preset = presets.find((entry) => entry.key === nextKey);

    if (!preset) {
      return;
    }

    setStartTime(preset.startTime);
    setEndTime(preset.endTime);
  }

  async function handleUpdate() {
    if (
      !shift ||
      !canManage ||
      selectedMembers.length === 0 ||
      !shiftDate ||
      !startTime ||
      !endTime
    ) {
      return;
    }

    const formData = new FormData();
    formData.set("shiftId", shift.id);
    formData.set("title", title);
    formData.set("startTime", combineDateAndTime(shiftDate, startTime));
    formData.set("endTime", combineDateAndTime(shiftDate, endTime));

    for (const memberId of selectedMembers) {
      formData.append("employeeIds", memberId);
    }

    startTransition(async () => {
      try {
        await updateShiftAction(formData);
        setFeedback(null);
        onClose();
        window.setTimeout(() => {
          router.refresh();
        }, 0);
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
    });
  }

  async function handleDelete() {
    if (!shift || !canManage) {
      return;
    }

    const formData = new FormData();
    formData.set("shiftId", shift.id);

    startTransition(async () => {
      try {
        await deleteShiftAction(formData);
        setFeedback(null);
        onClose();
        window.setTimeout(() => {
          router.refresh();
        }, 0);
      } catch (error) {
        setFeedback({ tone: "danger", message: getErrorMessage(error) });
      }
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
        zIndex: 2147483647,
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
        <IconButton
          type="button"
          onClick={handleClose}
          aria-label="Chiudi popup turno"
          disabled={isPending}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 40,
            height: 40,
            color: "#475569",
            background: "#ffffff",
            zIndex: 2,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6 6 18"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </IconButton>

        <div
          className="dashboard-modal-header"
          style={{
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            paddingRight: 56,
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
              {" - "}
              {formatDayTime(shift.startTime, locale)} - {formatDayTime(shift.endTime, locale)}
            </span>
          </div>
        </div>

        {canManage ? (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              {feedback ? (
                <div
                  style={{
                    borderRadius: 18,
                    padding: "12px 14px",
                    background: feedback.tone === "danger" ? "#fee2e2" : "#dcfce7",
                    color: feedback.tone === "danger" ? "#991b1b" : "#166534",
                    lineHeight: 1.6,
                  }}
                >
                  {feedback.message}
                </div>
              ) : null}

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

              {presets.length > 0 ? (
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario standard</span>
                  <Select
                    value={selectedPresetKey}
                    onChange={(event) => applyPresetByKey(event.target.value)}
                  >
                    <option value="CUSTOM">Personalizzato</option>
                    {presets.map((preset) => (
                      <option key={preset.key} value={preset.key}>
                        {preset.label} - {preset.startTime} / {preset.endTime}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}

              <div
                className="dashboard-modal-body-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Giorno</span>
                  <input
                    type="date"
                    value={shiftDate}
                    onChange={(event) => setShiftDate(event.target.value)}
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
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario di inizio</span>
                  <TimeInput
                    value={startTime}
                    onChange={(value) => {
                      setSelectedPresetKey("CUSTOM");
                      setStartTime(value);
                    }}
                  />
                </label>

                <label style={{ display: "grid", gap: 8 }}>
                  <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario di fine</span>
                  <TimeInput
                    value={endTime}
                    onChange={(value) => {
                      setSelectedPresetKey("CUSTOM");
                      setEndTime(value);
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
                      {member.firstName} {member.lastName} - {formatRoleLabel(member.role)}
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
                disabled={
                  isPending ||
                  selectedMembers.length === 0 ||
                  !shiftDate ||
                  !startTime ||
                  !endTime
                }
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
