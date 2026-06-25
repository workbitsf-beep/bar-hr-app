"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AudienceSelector } from "@/app/components/audience-selector";
import { FormField, IconButton, PrimaryButton, TextArea } from "../ui";

function createEmptyEntry() {
  return {
    id: crypto.randomUUID(),
    value: "",
    isPinned: false,
    requiresConfirmation: false,
    assignedToAll: true,
    assignedToId: "",
  };
}

export function BoardComposeForm({
  action,
  canManage,
  members = [],
  notifySuccess = false,
  initialContent = "",
  initialIsPinned = false,
  initialRequiresConfirmation = false,
  initialAssignedToAll = true,
  initialAssignedToId = "",
  submitLabel = "Conferma pubblicazione",
  allowMultiple = true,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  canManage: boolean;
  members?: Array<{ id: string; firstName: string; lastName: string }>;
  notifySuccess?: boolean;
  initialContent?: string;
  initialIsPinned?: boolean;
  initialRequiresConfirmation?: boolean;
  initialAssignedToAll?: boolean;
  initialAssignedToId?: string;
  submitLabel?: string;
  allowMultiple?: boolean;
  children?: ReactNode;
}) {
  const [entries, setEntries] = useState([
    ...(initialContent
      ? [
          {
            ...createEmptyEntry(),
            value: initialContent,
            isPinned: initialIsPinned,
            requiresConfirmation: initialRequiresConfirmation,
            assignedToAll: initialAssignedToAll,
            assignedToId: initialAssignedToId,
          },
        ]
      : []),
  ]);
  const [draft, setDraft] = useState({
    ...createEmptyEntry(),
    isPinned: initialIsPinned,
    requiresConfirmation: initialRequiresConfirmation,
    assignedToAll: initialAssignedToAll,
    assignedToId: initialAssignedToId,
  });

  function updateEntry(
    id: string,
    value: Partial<ReturnType<typeof createEmptyEntry>>
  ) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...value } : entry))
    );
  }

  function addEntry() {
    if (!draft.value.trim()) {
      return;
    }

    setEntries((current) => current.concat(draft));
    setDraft(createEmptyEntry());
  }

  function removeEntry(id: string) {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }

  function editEntry(id: string) {
    const entry = entries.find((item) => item.id === id);

    if (!entry) {
      return;
    }

    setDraft(entry);
    removeEntry(id);
  }

  const allEntries = entries.concat(draft.value.trim() ? [draft] : []);

  function renderHiddenEntry(entry: ReturnType<typeof createEmptyEntry>) {
    return (
      <div key={entry.id} style={{ display: "none" }}>
        <input type="hidden" name="boardEntryId" value={entry.id} />
        <input type="hidden" name={`content_${entry.id}`} value={entry.value} />
        {entry.assignedToAll ? <input type="hidden" name={`assignedToAll_${entry.id}`} value="on" /> : null}
        {!entry.assignedToAll && entry.assignedToId ? (
          <input type="hidden" name={`assignedToId_${entry.id}`} value={entry.assignedToId} />
        ) : null}
        {entry.isPinned ? <input type="hidden" name={`isPinned_${entry.id}`} value="on" /> : null}
        {entry.requiresConfirmation ? (
          <input type="hidden" name={`requiresConfirmation_${entry.id}`} value="on" />
        ) : null}
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {notifySuccess ? <input type="hidden" name="notifySuccess" value="1" /> : null}
      <FormField label="Messaggi">
        <div style={{ display: "grid", gap: 12 }}>
          {entries.map((entry) => (
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
                onClick={() => editEntry(entry.id)}
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
                  {entry.assignedToAll
                    ? "Tutto il team"
                    : members.find((member) => member.id === entry.assignedToId)
                      ? `${members.find((member) => member.id === entry.assignedToId)?.firstName} ${members.find((member) => member.id === entry.assignedToId)?.lastName}`
                      : "Persona non selezionata"}
                  {entry.isPinned ? " · In evidenza" : ""}
                </span>
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <IconButton type="button" onClick={() => editEntry(entry.id)} aria-label="Modifica messaggio">
                  ✎
                </IconButton>
                <IconButton type="button" onClick={() => removeEntry(entry.id)} aria-label="Elimina messaggio">
                  ×
                </IconButton>
              </div>
            </div>
          ))}

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
            {children}
            <strong style={{ color: "#0f172a", fontSize: 14 }}>Nuovo messaggio</strong>

            <TextArea
              value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })}
              placeholder="Scrivi il messaggio da pubblicare"
              style={{ minHeight: 96 }}
            />

            {canManage && members.length > 0 ? (
              <AudienceSelector
                members={members.map((member) => ({
                  id: member.id,
                  label: `${member.firstName} ${member.lastName}`,
                }))}
                assignedToAll={draft.assignedToAll}
                assignedToId={draft.assignedToId}
                onChange={(value) => setDraft({ ...draft, ...value })}
              />
            ) : null}

            {canManage ? (
              <div style={{ display: "grid", gap: 8 }}>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={draft.isPinned}
                    onChange={(event) => setDraft({ ...draft, isPinned: event.target.checked })}
                  />
                  In evidenza
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={draft.requiresConfirmation}
                    onChange={(event) =>
                      setDraft({ ...draft, requiresConfirmation: event.target.checked })
                    }
                  />
                  Richiedi conferma lettura
                </label>
              </div>
            ) : null}
            {allowMultiple ? (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <IconButton
                  type="button"
                  onClick={addEntry}
                  aria-label="Aggiungi messaggio alla lista"
                  disabled={!draft.value.trim()}
                  style={{
                    width: 38,
                    height: 38,
                    background: draft.value.trim() ? "#dcfce7" : "#f1f5f9",
                    color: draft.value.trim() ? "#166534" : "#94a3b8",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  ✓
                </IconButton>
              </div>
            ) : null}
          </div>

          {allowMultiple ? (
            <div style={{ display: "none", justifyContent: "flex-end" }}>
              <IconButton
                type="button"
                onClick={addEntry}
                aria-label="Aggiungi messaggio alla lista"
                disabled={!draft.value.trim()}
                style={{
                  width: 44,
                  height: 44,
                  background: draft.value.trim() ? "#dcfce7" : "#f1f5f9",
                  color: draft.value.trim() ? "#166534" : "#94a3b8",
                  border: "1px solid #bbf7d0",
                }}
              >
                ✓
              </IconButton>
            </div>
          ) : null}

          {allEntries.map(renderHiddenEntry)}

        </div>
      </FormField>

      <div>
        <PrimaryButton type="submit" disabled={allEntries.length === 0}>{submitLabel}</PrimaryButton>
      </div>
    </form>
  );
}
