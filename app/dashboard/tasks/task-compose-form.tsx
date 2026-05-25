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
  };
}

export function TaskComposeForm({
  action,
  members,
}: {
  action: (formData: FormData) => void | Promise<void>;
  members: MemberOption[];
}) {
  const [entries, setEntries] = useState([createEmptyEntry()]);

  function updateEntry(id: string, value: string) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, value } : entry))
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
      <FormField
        label="Mansioni"
        hint="Usa il tasto + per aggiungere altre mansioni. Ogni voce verra salvata separatamente."
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
                  Mansione {index + 1}
                </strong>
                {entries.length > 1 ? (
                  <IconButton
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    aria-label={`Rimuovi mansione ${index + 1}`}
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
                name="title"
                required={index === 0}
                value={entry.value}
                onChange={(event) => updateEntry(entry.id, event.target.value)}
                placeholder="Scrivi la mansione"
              />
            </div>
          ))}

          <div>
            <IconButton type="button" onClick={addEntry} aria-label="Aggiungi mansione">
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

        <FormField label="Assegna a">
          <Select name="assignedToId" defaultValue="">
            <option value="">Nessun singolo assegnatario</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.firstName} {member.lastName}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="assignedToAll" />
          Assegna a tutto il team
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="isUrgent" />
          Segna come urgente
        </label>
      </div>

      <div>
        <PrimaryButton type="submit">Salva mansione</PrimaryButton>
      </div>
    </form>
  );
}
