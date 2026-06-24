"use client";

import { useState } from "react";
import { FormField, IconButton, PrimaryButton, Select, TextArea, TextInput } from "../ui";

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

export function TaskComposeForm({
  action,
  members,
  notifySuccess = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
  notifySuccess?: boolean;
}) {
  const [entries, setEntries] = useState<ReturnType<typeof createEmptyEntry>[]>([]);
  const [draft, setDraft] = useState(createEmptyEntry());

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
      <FormField
        label="Note"
        hint="Usa il tasto + per aggiungere altre note. Ogni voce verra salvata separatamente."
      >
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
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={draft.assignedToAll}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      assignedToAll: event.target.checked,
                      assignedToId: event.target.checked ? "" : draft.assignedToId,
                    })
                  }
                />
                Tutto il team
              </label>

              {!draft.assignedToAll ? (
                <Select
                  value={draft.assignedToId}
                  onChange={(event) => setDraft({ ...draft, assignedToId: event.target.value })}
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

      <FormField label="Descrizione">
        <TextArea name="description" placeholder="Dettagli operativi opzionali" />
      </FormField>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        <FormField label="Data">
          <TextInput name="dueDate" type="date" required />
        </FormField>

      </div>

      <div>
        <PrimaryButton type="submit" disabled={allEntries.length === 0}>Conferma note</PrimaryButton>
      </div>
    </form>
  );
}
