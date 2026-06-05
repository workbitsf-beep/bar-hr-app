"use client";

import { useState } from "react";
import { FormField, IconButton, PrimaryButton, TextArea } from "../ui";

function createEmptyEntry() {
  return {
    id: crypto.randomUUID(),
    value: "",
    isPinned: false,
  };
}

export function BoardComposeForm({
  action,
  canManage,
  notifySuccess = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  canManage: boolean;
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
        label="Messaggi"
        hint="Usa il tasto + per aggiungere altri messaggi. Ogni voce verra pubblicata separatamente."
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
                  Messaggio {index + 1}
                </strong>
                {entries.length > 1 ? (
                  <IconButton
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    aria-label={`Rimuovi messaggio ${index + 1}`}
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

              <TextArea
                name={`content_${entry.id}`}
                required={index === 0}
                value={entry.value}
                onChange={(event) => updateEntry(entry.id, { value: event.target.value })}
                placeholder="Scrivi il messaggio da pubblicare"
                style={{ minHeight: 96 }}
              />

              <input type="hidden" name="boardEntryId" value={entry.id} />

              {canManage ? (
                <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    name={`isPinned_${entry.id}`}
                    checked={entry.isPinned}
                    onChange={(event) =>
                      updateEntry(entry.id, { isPinned: event.target.checked })
                    }
                  />
                  In evidenza
                </label>
              ) : null}
            </div>
          ))}

          <div>
            <IconButton type="button" onClick={addEntry} aria-label="Aggiungi messaggio">
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

      <div>
        <PrimaryButton type="submit">Conferma pubblicazione</PrimaryButton>
      </div>
    </form>
  );
}
