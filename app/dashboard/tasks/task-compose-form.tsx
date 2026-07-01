"use client";

import { useState } from "react";
import { AudienceSelector } from "@/app/components/audience-selector";
import { FormField, IconButton, PrimaryButton, TextInput } from "../ui";

type MemberOption = {
  id: string;
  firstName: string;
  lastName: string;
};

function createEmptyEntry() {
  return {
    id: crypto.randomUUID(),
    value: "",
    assignedToAll: true,
    assignedToId: "",
    isUrgent: false,
  };
}

function getSelectedIds(value: string) {
  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function TaskComposeForm({
  action,
  members,
  canChooseAudience = true,
  notifySuccess = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
  canChooseAudience?: boolean;
  notifySuccess?: boolean;
}) {
  const [entries, setEntries] = useState<ReturnType<typeof createEmptyEntry>[]>([]);
  const [draft, setDraft] = useState(createEmptyEntry());

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

  const allEntries = entries;

  function getAudienceLabel(entry: ReturnType<typeof createEmptyEntry>) {
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

  function renderHiddenEntry(entry: ReturnType<typeof createEmptyEntry>) {
    return (
      <div key={entry.id} style={{ display: "none" }}>
        <input type="hidden" name="taskEntryId" value={entry.id} />
        <input type="hidden" name={`title_${entry.id}`} value={entry.value} />
        {entry.assignedToAll ? <input type="hidden" name={`assignedToAll_${entry.id}`} value="on" /> : null}
        {!entry.assignedToAll && entry.assignedToId ? (
          <input type="hidden" name={`assignedToId_${entry.id}`} value={entry.assignedToId} />
        ) : null}
        {entry.isUrgent ? <input type="hidden" name={`isUrgent_${entry.id}`} value="on" /> : null}
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "grid", gap: 16 }}>
      {notifySuccess ? <input type="hidden" name="notifySuccess" value="1" /> : null}
      <FormField label="Note">
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
                  {getAudienceLabel(entry)}
                  {entry.isUrgent ? " · Urgente" : ""}
                </span>
              </button>
              <div style={{ display: "flex", gap: 6 }}>
                <IconButton type="button" onClick={() => editEntry(entry.id)} aria-label="Modifica nota">
                  ✎
                </IconButton>
                <IconButton type="button" onClick={() => removeEntry(entry.id)} aria-label="Elimina nota">
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
            <strong style={{ color: "#0f172a", fontSize: 14 }}>Nuova nota</strong>

            <TextInput
              value={draft.value}
              onChange={(event) => setDraft({ ...draft, value: event.target.value })}
              placeholder="Scrivi la nota"
            />

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 10,
              }}
            >
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
                  checked={draft.isUrgent}
                  onChange={(event) => setDraft({ ...draft, isUrgent: event.target.checked })}
                />
                Urgente
              </label>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <IconButton
                type="button"
                onClick={addEntry}
                aria-label="Aggiungi nota alla lista"
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

            <FormField label="Data">
              <TextInput name="dueDate" type="date" required />
            </FormField>
          </div>

          <div style={{ display: "none", justifyContent: "flex-end" }}>
            <IconButton
              type="button"
              onClick={addEntry}
              aria-label="Aggiungi nota alla lista"
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

          {allEntries.map(renderHiddenEntry)}

        </div>
      </FormField>

      <div>
        <PrimaryButton type="submit" disabled={allEntries.length === 0}>Conferma note</PrimaryButton>
      </div>
    </form>
  );
}
