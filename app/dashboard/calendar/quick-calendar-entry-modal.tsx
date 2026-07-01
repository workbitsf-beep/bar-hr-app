"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { AudienceSelector } from "@/app/components/audience-selector";
import { IconButton, PrimaryButton, TextArea, TextInput } from "../ui";

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
  isPinned: boolean;
};

function createEmptyEntry(): EntryItem {
  return {
    id: crypto.randomUUID(),
    value: "",
    assignedToAll: true,
    assignedToId: "",
    isUrgent: false,
    isPinned: false,
  };
}

function getSelectedIds(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function toDateInputValue(dateIso: string | null) {
  return dateIso ? dateIso.slice(0, 10) : "";
}

export function QuickCalendarEntryModal({
  open,
  mode,
  dateIso,
  members,
  canPinBoard,
  canChooseAudience = true,
  canCreateTask = true,
  canCreateBoard = true,
  isPending,
  onClose,
  onSubmitTask,
  onSubmitBoard,
}: {
  open: boolean;
  mode: "task" | "board" | null;
  dateIso: string | null;
  members: MemberOption[];
  canPinBoard: boolean;
  canChooseAudience?: boolean;
  canCreateTask?: boolean;
  canCreateBoard?: boolean;
  isPending: boolean;
  onClose: () => void;
  onSubmitTask: (formData: FormData) => void;
  onSubmitBoard: (formData: FormData) => void;
}) {
  const [taskEntries, setTaskEntries] = useState<EntryItem[]>([createEmptyEntry()]);
  const [taskDraft, setTaskDraft] = useState<EntryItem>(createEmptyEntry());
  const [taskDueDate, setTaskDueDate] = useState("");
  const [boardEntries, setBoardEntries] = useState<EntryItem[]>([createEmptyEntry()]);
  const [boardDraft, setBoardDraft] = useState<EntryItem>(createEmptyEntry());
  const [entryKind, setEntryKind] = useState<"board" | "task">("board");

  useEffect(() => {
    if (!open) {
      return;
    }

    setTaskEntries([]);
    setTaskDraft(createEmptyEntry());
    setTaskDueDate(toDateInputValue(dateIso));
    setBoardEntries([]);
    setBoardDraft(createEmptyEntry());
    setEntryKind(canCreateBoard ? "board" : "task");
  }, [canCreateBoard, dateIso, open, mode]);

  if (!open || !mode || (!canCreateTask && !canCreateBoard)) {
    return null;
  }

  const activeMode = canCreateTask && canCreateBoard ? entryKind : canCreateTask ? "task" : "board";

  function addTaskEntry() {
    if (!taskDraft.value.trim()) {
      return;
    }

    setTaskEntries((current) => current.concat(taskDraft));
    setTaskDraft(createEmptyEntry());
  }

  function addBoardEntry() {
    if (!boardDraft.value.trim()) {
      return;
    }

    setBoardEntries((current) => current.concat(boardDraft));
    setBoardDraft(createEmptyEntry());
  }

  function removeEntry(
    setter: Dispatch<SetStateAction<EntryItem[]>>,
    id: string
  ) {
    setter((current) => current.filter((entry) => entry.id !== id));
  }

  function getAudienceLabel(entry: EntryItem) {
    if (entry.assignedToAll) {
      return "Tutto il team";
    }

    const labels = getSelectedIds(entry.assignedToId)
      .map((id) => members.find((member) => member.id === id))
      .filter(Boolean)
      .map((member) => `${member?.firstName} ${member?.lastName}`);

    if (labels.length === 0) {
      return "Persona non selezionata";
    }

    return labels.length === 1 ? labels[0] : `${labels.length} dipendenti`;
  }

  function handleTaskSubmit() {
    const formData = new FormData();

    const entries = taskEntries.concat(taskDraft.value.trim() ? [taskDraft] : []);

    for (const entry of entries) {
      formData.append("taskEntryId", entry.id);
      formData.set(`title_${entry.id}`, entry.value);

      if (entry.assignedToAll) {
        formData.set(`assignedToAll_${entry.id}`, "on");
      } else if (entry.assignedToId) {
        formData.set(`assignedToId_${entry.id}`, entry.assignedToId);
      }

      if (entry.isUrgent) {
        formData.set(`isUrgent_${entry.id}`, "on");
      }
    }

    formData.set("description", "");
    formData.set("dueDate", taskDueDate);

    onSubmitTask(formData);
  }

  function handleBoardSubmit() {
    const formData = new FormData();

    const entries = boardEntries.concat(boardDraft.value.trim() ? [boardDraft] : []);

    for (const entry of entries) {
      formData.append("boardEntryId", entry.id);
      formData.set(`content_${entry.id}`, entry.value);

      if (entry.assignedToAll) {
        formData.set(`assignedToAll_${entry.id}`, "on");
      } else if (entry.assignedToId) {
        formData.set(`assignedToId_${entry.id}`, entry.assignedToId);
      }

      if (entry.isPinned) {
        formData.set(`isPinned_${entry.id}`, "on");
      }

      formData.set(`requiresConfirmation_${entry.id}`, "on");
    }

    onSubmitBoard(formData);
  }

  const content =
    activeMode === "task" ? (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 52 }}>
          <strong style={{ fontSize: 20, color: "#0f172a" }}>Aggiungi mansione</strong>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {taskEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 16,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setTaskDraft(entry);
                  removeEntry(setTaskEntries, entry.id);
                }}
                style={{
                  flex: "1 1 auto",
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  display: "grid",
                  gap: 3,
                  color: "#0f172a",
                }}
              >
                <strong style={{ fontSize: 13 }}>{entry.value}</strong>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {getAudienceLabel(entry)}
                  {entry.isUrgent ? " · Urgente" : ""}
                </span>
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <IconButton
                  type="button"
                  onClick={() => {
                    setTaskDraft(entry);
                    removeEntry(setTaskEntries, entry.id);
                  }}
                  aria-label="Modifica nota"
                >
                  ✎
                </IconButton>
                <IconButton
                  type="button"
                  onClick={() => removeEntry(setTaskEntries, entry.id)}
                  aria-label="Elimina nota"
                >
                  ×
                </IconButton>
              </div>
            </div>
          ))}

          {[taskDraft].map((entry, index) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gap: 10,
                padding: 14,
                borderRadius: 18,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <strong style={{ color: "#0f172a", fontSize: 14 }}>Mansione {index + 1}</strong>
                {false ? (
                  <IconButton
                    type="button"
                    onClick={() => removeEntry(setTaskEntries, entry.id)}
                    aria-label={`Rimuovi nota ${index + 1}`}
                    style={{ width: 34, height: 34, color: "#94a3b8", boxShadow: "none" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6 6 18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconButton>
                ) : null}
              </div>

              <TextInput
                value={entry.value}
                required={index === 0}
                onChange={(event) => setTaskDraft({ ...entry, value: event.target.value })}
              />

              <div style={{ display: "grid", gap: 10 }}>
                {canChooseAudience ? (
                  <AudienceSelector
                    members={members.map((member) => ({
                      id: member.id,
                      label: `${member.firstName} ${member.lastName}`,
                    }))}
                    assignedToAll={entry.assignedToAll}
                    assignedToId={entry.assignedToId}
                    onChange={(value) => setTaskDraft({ ...entry, ...value })}
                  />
                ) : (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderRadius: 18,
                      background: "#f8fafc",
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
                    checked={entry.isUrgent}
                    onChange={(event) => setTaskDraft({ ...entry, isUrgent: event.target.checked })}
                  />
                  Urgente
                </label>
              </div>

              <label style={{ display: "grid", gap: 8 }}>
                <span style={{ fontWeight: 600, color: "#1e293b" }}>Data</span>
                <TextInput
                  type="date"
                  value={taskDueDate}
                  onChange={(event) => setTaskDueDate(event.target.value)}
                />
              </label>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <IconButton
              type="button"
              onClick={addTaskEntry}
              aria-label="Aggiungi nota alla lista"
              disabled={!taskDraft.value.trim()}
              style={{
                width: 44,
                height: 44,
                background: taskDraft.value.trim() ? "#dcfce7" : "#f1f5f9",
                color: taskDraft.value.trim() ? "#166534" : "#94a3b8",
                border: "1px solid #bbf7d0",
              }}
            >
              ✓
            </IconButton>
          </div>
        </div>

        <div className="dashboard-modal-actions">
          <PrimaryButton
            type="button"
            onClick={handleTaskSubmit}
            disabled={isPending || !taskDueDate || (taskEntries.length === 0 && !taskDraft.value.trim())}
          >
            {isPending ? "Salvataggio..." : "Conferma mansioni"}
          </PrimaryButton>
        </div>
      </div>
    ) : (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 52 }}>
          <strong style={{ fontSize: 20, color: "#0f172a" }}>Aggiungi comunicazione</strong>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {boardEntries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 16,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setBoardDraft(entry);
                  removeEntry(setBoardEntries, entry.id);
                }}
                style={{
                  flex: "1 1 auto",
                  border: 0,
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  display: "grid",
                  gap: 3,
                  color: "#0f172a",
                }}
              >
                <strong style={{ fontSize: 13 }}>{entry.value}</strong>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {getAudienceLabel(entry)}
                  {entry.isPinned ? " · In evidenza" : ""}
                </span>
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <IconButton
                  type="button"
                  onClick={() => {
                    setBoardDraft(entry);
                    removeEntry(setBoardEntries, entry.id);
                  }}
                  aria-label="Modifica nota"
                >
                  ✎
                </IconButton>
                <IconButton
                  type="button"
                  onClick={() => removeEntry(setBoardEntries, entry.id)}
                  aria-label="Elimina nota"
                >
                  ×
                </IconButton>
              </div>
            </div>
          ))}

          {[boardDraft].map((entry, index) => (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gap: 10,
                padding: 14,
                borderRadius: 18,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <strong style={{ color: "#0f172a", fontSize: 14 }}>Comunicazione {index + 1}</strong>
                {false ? (
                  <IconButton
                    type="button"
                    onClick={() => removeEntry(setBoardEntries, entry.id)}
                    aria-label={`Rimuovi nota ${index + 1}`}
                    style={{ width: 34, height: 34, color: "#94a3b8", boxShadow: "none" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M6 6l12 12M18 6 6 18"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </IconButton>
                ) : null}
              </div>

              <TextArea
                value={entry.value}
                required={index === 0}
                onChange={(event) => setBoardDraft({ ...entry, value: event.target.value })}
                style={{ minHeight: 96 }}
              />

              {canChooseAudience ? (
                <AudienceSelector
                  members={members.map((member) => ({
                    id: member.id,
                    label: `${member.firstName} ${member.lastName}`,
                  }))}
                  assignedToAll={entry.assignedToAll}
                  assignedToId={entry.assignedToId}
                  onChange={(value) => setBoardDraft({ ...entry, ...value })}
                />
              ) : (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Nota personale
                </div>
              )}

              {canPinBoard ? (
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={entry.isPinned}
                    onChange={(event) => setBoardDraft({ ...entry, isPinned: event.target.checked })}
                  />
                  In evidenza
                </label>
              ) : null}
              <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
                Conferma visualizzazione richiesta a chi la apre.
              </div>
            </div>
          ))}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <IconButton
              type="button"
              onClick={addBoardEntry}
              aria-label="Aggiungi nota alla lista"
              disabled={!boardDraft.value.trim()}
              style={{
                width: 44,
                height: 44,
                background: boardDraft.value.trim() ? "#dcfce7" : "#f1f5f9",
                color: boardDraft.value.trim() ? "#166534" : "#94a3b8",
                border: "1px solid #bbf7d0",
              }}
            >
              ✓
            </IconButton>
          </div>
        </div>

        <div className="dashboard-modal-actions">
          <PrimaryButton
            type="button"
            onClick={handleBoardSubmit}
            disabled={isPending || (boardEntries.length === 0 && !boardDraft.value.trim())}
          >
            {isPending ? "Pubblicazione..." : "Conferma comunicazioni"}
          </PrimaryButton>
        </div>
      </div>
    );

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

        {canCreateTask && canCreateBoard ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 4,
              padding: 4,
              marginBottom: 14,
              borderRadius: 999,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            {[
              { key: "board" as const, label: "Comunicazione" },
              { key: "task" as const, label: "Mansione" },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setEntryKind(option.key)}
                style={{
                  minHeight: 38,
                  border: 0,
                  borderRadius: 999,
                  background:
                    activeMode === option.key
                      ? "linear-gradient(135deg, #111936, #7c3aed)"
                      : "transparent",
                  color: activeMode === option.key ? "#ffffff" : "#475569",
                  fontWeight: 850,
                  cursor: "pointer",
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        {content}
      </section>
    </div>,
    document.body
  );
}
