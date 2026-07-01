"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AudienceSelector } from "@/app/components/audience-selector";
import { IconButton, TextInput } from "../ui";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type EntryItem = {
  id: string;
  value: string;
  assignedToAll: boolean;
  assignedToId: string;
  isUrgent: boolean;
};

function createEmptyEntry(): EntryItem {
  return {
    id: crypto.randomUUID(),
    value: "",
    assignedToAll: true,
    assignedToId: "",
    isUrgent: false,
  };
}

function toDateInputValue(dateIso: string | null) {
  return dateIso ? dateIso.slice(0, 10) : "";
}

export function QuickCalendarEntryModal({
  open,
  mode,
  dateIso,
  members,
  canChooseAudience = true,
  canCreateTask = true,
  isPending,
  onClose,
  onSubmitTask,
}: {
  open: boolean;
  mode: "task" | "board" | null;
  dateIso: string | null;
  members: MemberOption[];
  canPinBoard?: boolean;
  canChooseAudience?: boolean;
  canCreateTask?: boolean;
  canCreateBoard?: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmitTask: (formData: FormData) => void;
  onSubmitBoard?: (formData: FormData) => void;
}) {
  const [draft, setDraft] = useState<EntryItem>(createEmptyEntry());
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(createEmptyEntry());
    setDueDate(toDateInputValue(dateIso));
  }, [dateIso, open, mode]);

  if (!open || !mode || !canCreateTask) {
    return null;
  }

  function submitNote() {
    if (!draft.value.trim() || !dueDate || isPending) {
      return;
    }

    const formData = new FormData();
    formData.append("taskEntryId", draft.id);
    formData.set(`title_${draft.id}`, draft.value);

    if (draft.assignedToAll) {
      formData.set(`assignedToAll_${draft.id}`, "on");
    } else if (draft.assignedToId) {
      formData.set(`assignedToId_${draft.id}`, draft.assignedToId);
    }

    if (draft.isUrgent) {
      formData.set(`isUrgent_${draft.id}`, "on");
    }

    formData.set("description", "");
    formData.set("dueDate", dueDate);

    onSubmitTask(formData);
    setDraft(createEmptyEntry());
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
        background: "rgba(15, 23, 42, 0.28)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onClick={onClose}
    >
      <section
        className="dashboard-modal-panel"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          maxHeight: "calc(100dvh - 32px)",
          overflowY: "auto",
          background: "rgba(255,255,255,0.98)",
          border: "1px solid rgba(226,232,240,0.9)",
          borderRadius: 28,
          padding: 22,
          boxShadow: "0 20px 48px rgba(15, 23, 42, 0.16)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <IconButton
          type="button"
          onClick={onClose}
          aria-label="Chiudi popup rapido"
          disabled={isPending}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
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

        <div style={{ display: "grid", gap: 14 }}>
          <strong style={{ fontSize: 20, color: "#0f172a", paddingRight: 52 }}>
            Aggiungi note
          </strong>

          <div
            style={{
              display: "grid",
              gap: 10,
              padding: 14,
              borderRadius: 18,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <TextInput
              value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })}
              placeholder="Scrivi la nota"
            />

            {canChooseAudience ? (
              <AudienceSelector
                members={members.map((member) => ({
                  id: member.id,
                  label: `${member.firstName} ${member.lastName}`,
                }))}
                assignedToAll={draft.assignedToAll}
                assignedToId={draft.assignedToId}
                onChange={(value) => setDraft({ ...draft, ...value })}
              />
            ) : (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 18,
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  color: "#475569",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Nota personale
              </div>
            )}

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={draft.isUrgent}
                onChange={(event) => setDraft({ ...draft, isUrgent: event.target.checked })}
              />
              Urgente
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#1e293b" }}>Data</span>
              <TextInput
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <IconButton
              type="button"
              onClick={submitNote}
              aria-label="Salva nota"
              disabled={isPending || !draft.value.trim() || !dueDate}
              style={{
                width: 44,
                height: 44,
                background: draft.value.trim() && dueDate ? "#dcfce7" : "#f1f5f9",
                color: draft.value.trim() && dueDate ? "#166534" : "#94a3b8",
                border: "1px solid #bbf7d0",
              }}
            >
              ✓
            </IconButton>
          </div>
        </div>
      </section>
    </div>,
    document.body
  );
}
