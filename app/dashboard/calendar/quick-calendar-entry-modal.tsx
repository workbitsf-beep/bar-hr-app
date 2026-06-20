"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { createPortal } from "react-dom";
import { IconButton, PrimaryButton, Select, TextArea, TextInput } from "../ui";

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

function toDateInputValue(dateIso: string | null) {
  return dateIso ? dateIso.slice(0, 10) : "";
}

export function QuickCalendarEntryModal({
  open,
  mode,
  dateIso,
  members,
  canPinBoard,
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
  isPending: boolean;
  onClose: () => void;
  onSubmitTask: (formData: FormData) => void;
  onSubmitBoard: (formData: FormData) => void;
}) {
  const [taskEntries, setTaskEntries] = useState<EntryItem[]>([createEmptyEntry()]);
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [boardEntries, setBoardEntries] = useState<EntryItem[]>([createEmptyEntry()]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTaskEntries([createEmptyEntry()]);
    setTaskDescription("");
    setTaskDueDate(toDateInputValue(dateIso));
    setBoardEntries([createEmptyEntry()]);
  }, [dateIso, open, mode]);

  if (!open || !mode) {
    return null;
  }

  function updateEntries(
    setter: Dispatch<SetStateAction<EntryItem[]>>,
    id: string,
    value: Partial<EntryItem>
  ) {
    setter((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...value } : entry))
    );
  }

  function addEntry(setter: Dispatch<SetStateAction<EntryItem[]>>) {
    setter((current) => [...current, createEmptyEntry()]);
  }

  function removeEntry(
    setter: Dispatch<SetStateAction<EntryItem[]>>,
    id: string
  ) {
    setter((current) =>
      current.length === 1 ? current : current.filter((entry) => entry.id !== id)
    );
  }

  function handleTaskSubmit() {
    const formData = new FormData();

    for (const entry of taskEntries) {
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

    formData.set("description", taskDescription);
    formData.set("dueDate", taskDueDate);

    onSubmitTask(formData);
  }

  function handleBoardSubmit() {
    const formData = new FormData();

    for (const entry of boardEntries) {
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
    }

    onSubmitBoard(formData);
  }

  const content =
    mode === "task" ? (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 52 }}>
          <strong style={{ fontSize: 20, color: "#0f172a" }}>Aggiungi note</strong>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {taskEntries.map((entry, index) => (
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
                <strong style={{ color: "#0f172a", fontSize: 14 }}>Nota {index + 1}</strong>
                {taskEntries.length > 1 ? (
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
                onChange={(event) =>
                  updateEntries(setTaskEntries, entry.id, { value: event.target.value })
                }
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 10,
                }}
              >
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={entry.assignedToAll}
                    onChange={(event) =>
                      updateEntries(setTaskEntries, entry.id, {
                        assignedToAll: event.target.checked,
                        assignedToId: event.target.checked ? "" : entry.assignedToId,
                      })
                    }
                  />
                  Tutto il team
                </label>

                {!entry.assignedToAll ? (
                  <Select
                    value={entry.assignedToId}
                    onChange={(event) =>
                      updateEntries(setTaskEntries, entry.id, {
                        assignedToId: event.target.value,
                      })
                    }
                  >
                    <option value="">Seleziona persona</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </Select>
                ) : null}

                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={entry.isUrgent}
                    onChange={(event) =>
                      updateEntries(setTaskEntries, entry.id, {
                        isUrgent: event.target.checked,
                      })
                    }
                  />
                  Urgente
                </label>
              </div>
            </div>
          ))}

          <div>
            <IconButton type="button" onClick={() => addEntry(setTaskEntries)} aria-label="Aggiungi nota">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          </div>
        </div>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontWeight: 600, color: "#1e293b" }}>Descrizione</span>
          <TextArea
            value={taskDescription}
            onChange={(event) => setTaskDescription(event.target.value)}
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
            <span style={{ fontWeight: 600, color: "#1e293b" }}>Scadenza</span>
            <TextInput
              type="date"
              value={taskDueDate}
              onChange={(event) => setTaskDueDate(event.target.value)}
            />
          </label>

        </div>

        <div className="dashboard-modal-actions">
          <PrimaryButton
            type="button"
            onClick={handleTaskSubmit}
            disabled={isPending || !taskDueDate}
          >
            {isPending ? "Salvataggio..." : "Conferma note"}
          </PrimaryButton>
        </div>
      </div>
    ) : (
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingRight: 52 }}>
          <strong style={{ fontSize: 20, color: "#0f172a" }}>Aggiungi nota rapida</strong>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {boardEntries.map((entry, index) => (
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
                <strong style={{ color: "#0f172a", fontSize: 14 }}>Nota {index + 1}</strong>
                {boardEntries.length > 1 ? (
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
                onChange={(event) =>
                  updateEntries(setBoardEntries, entry.id, { value: event.target.value })
                }
                style={{ minHeight: 96 }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 10,
                }}
              >
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={entry.assignedToAll}
                    onChange={(event) =>
                      updateEntries(setBoardEntries, entry.id, {
                        assignedToAll: event.target.checked,
                        assignedToId: event.target.checked ? "" : entry.assignedToId,
                      })
                    }
                  />
                  Tutto il team
                </label>

                {!entry.assignedToAll ? (
                  <Select
                    value={entry.assignedToId}
                    onChange={(event) =>
                      updateEntries(setBoardEntries, entry.id, {
                        assignedToId: event.target.value,
                      })
                    }
                  >
                    <option value="">Seleziona persona</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.firstName} {member.lastName}
                      </option>
                    ))}
                  </Select>
                ) : null}
              </div>

              {canPinBoard ? (
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={entry.isPinned}
                    onChange={(event) =>
                      updateEntries(setBoardEntries, entry.id, {
                        isPinned: event.target.checked,
                      })
                    }
                  />
                  In evidenza
                </label>
              ) : null}
            </div>
          ))}

          <div>
            <IconButton type="button" onClick={() => addEntry(setBoardEntries)} aria-label="Aggiungi nota">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 5v14M5 12h14"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          </div>
        </div>

        <div className="dashboard-modal-actions">
          <PrimaryButton type="button" onClick={handleBoardSubmit} disabled={isPending}>
            {isPending ? "Pubblicazione..." : "Conferma pubblicazione"}
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

        {content}
      </section>
    </div>,
    document.body
  );
}
