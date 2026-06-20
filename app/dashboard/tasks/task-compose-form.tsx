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
  const [entries, setEntries] = useState([createEmptyEntry()]);

  function updateEntry(
    id: string,
    value: Partial<ReturnType<typeof createEmptyEntry>>
  ) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...value } : entry))
    );
  }

  function addEntry() {
    setEntries((current) => [...current, createEmptyEntry()]);
  }

  function removeEntry(id: string) {
    setEntries((current) =>
      current.length === 1 ? current : current.filter((entry) => entry.id !== id)
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
          {entries.map((entry, index) => (
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
                <strong style={{ color: "#0f172a", fontSize: 14 }}>
                  Nota {index + 1}
                </strong>
                {entries.length > 1 ? (
                  <IconButton
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    aria-label={`Rimuovi nota ${index + 1}`}
                    style={{
                      width: 34,
                      height: 34,
                      color: "#94a3b8",
                      boxShadow: "none",
                    }}
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
                name={`title_${entry.id}`}
                required={index === 0}
                value={entry.value}
                onChange={(event) => updateEntry(entry.id, { value: event.target.value })}
                placeholder="Scrivi la nota"
              />

              <input type="hidden" name="taskEntryId" value={entry.id} />

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
                    name={`assignedToAll_${entry.id}`}
                    checked={entry.assignedToAll}
                    onChange={(event) =>
                      updateEntry(entry.id, {
                        assignedToAll: event.target.checked,
                        assignedToId: event.target.checked ? "" : entry.assignedToId,
                      })
                    }
                  />
                  Tutto il team
                </label>

                {!entry.assignedToAll ? (
                  <Select
                    name={`assignedToId_${entry.id}`}
                    value={entry.assignedToId}
                    onChange={(event) =>
                      updateEntry(entry.id, { assignedToId: event.target.value })
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
                    name={`isUrgent_${entry.id}`}
                    checked={entry.isUrgent}
                    onChange={(event) =>
                      updateEntry(entry.id, { isUrgent: event.target.checked })
                    }
                  />
                  Urgente
                </label>
              </div>
            </div>
          ))}

          <div>
            <IconButton type="button" onClick={addEntry} aria-label="Aggiungi nota">
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
        <FormField label="Scadenza">
          <TextInput name="dueDate" type="date" required />
        </FormField>

      </div>

      <div>
        <PrimaryButton type="submit">Conferma note</PrimaryButton>
      </div>
    </form>
  );
}
