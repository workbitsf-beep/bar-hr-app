"use client";

import { useMemo, useState } from "react";
import { TimeInput } from "@/app/components/time-input";
import { IconButton, PrimaryButton, TextInput } from "../ui";

export type StandardHourEntry = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
};

function createEmptyEntry(): StandardHourEntry {
  return {
    id: crypto.randomUUID(),
    title: "",
    startTime: "",
    endTime: "",
  };
}

export function StandardHoursPreview({ entries }: { entries: StandardHourEntry[] }) {
  const visibleEntries = entries.filter((entry) => entry.startTime && entry.endTime);

  if (visibleEntries.length === 0) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 18,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          color: "#64748b",
        }}
      >
        Nessun orario impostato.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {visibleEntries.map((entry, index) => (
        <div
          key={entry.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 12px",
            borderRadius: 16,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            color: "#334155",
            fontSize: 14,
          }}
        >
          <strong>{entry.title || `Orario ${index + 1}`}</strong>
          <span>{entry.startTime} - {entry.endTime}</span>
        </div>
      ))}
    </div>
  );
}

export function StandardHoursForm({
  initialEntries,
}: {
  initialEntries: StandardHourEntry[];
}) {
  const seededEntries = useMemo(
    () => (initialEntries.length > 0 ? initialEntries : [createEmptyEntry()]),
    [initialEntries]
  );
  const [entries, setEntries] = useState<StandardHourEntry[]>(seededEntries);

  function updateEntry(id: string, patch: Partial<StandardHourEntry>) {
    setEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  }

  function addEntry() {
    setEntries((current) => current.concat(createEmptyEntry()));
  }

  function removeEntry(id: string) {
    setEntries((current) =>
      current.length === 1 ? [{ ...createEmptyEntry(), id: current[0].id }] : current.filter((entry) => entry.id !== id)
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
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
          <input type="hidden" name="standardShiftPresetId" value={entry.id} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <strong style={{ color: "#0f172a" }}>Orario {index + 1}</strong>
            <IconButton
              type="button"
              aria-label="Elimina orario"
              onClick={() => removeEntry(entry.id)}
              style={{ width: 34, height: 34, color: "#94a3b8", boxShadow: "none" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </IconButton>
          </div>

          <TextInput
            name={`standardShiftPresetTitle_${entry.id}`}
            value={entry.title}
            onChange={(event) => updateEntry(entry.id, { title: event.target.value })}
            placeholder="Titolo opzionale"
          />

          <div
            className="dashboard-inline-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <TimeInput
              name={`standardShiftPresetStart_${entry.id}`}
              value={entry.startTime}
              onChange={(value) => updateEntry(entry.id, { startTime: value })}
            />
            <TimeInput
              name={`standardShiftPresetEnd_${entry.id}`}
              value={entry.endTime}
              onChange={(value) => updateEntry(entry.id, { endTime: value })}
            />
          </div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <IconButton type="button" onClick={addEntry} aria-label="Aggiungi orario">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </IconButton>
        <PrimaryButton type="submit">Salva</PrimaryButton>
      </div>
    </div>
  );
}
