"use client";

import { useMemo, useState } from "react";
import { TimeInput } from "@/app/components/time-input";
import { PrimaryButton, TextInput } from "../ui";

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

  const label = (text: string) => (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 830,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "#a3a0b8",
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {entries.map((entry, index) => (
        <div
          key={entry.id}
          style={{
            display: "grid",
            gap: 9,
            padding: "12px 12px 13px",
            borderRadius: 16,
            background: "#fbfaff",
            border: "1px solid #e9e6f5",
          }}
        >
          <input type="hidden" name="standardShiftPresetId" value={entry.id} />

          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <strong style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 800, color: "#17161f" }}>
              {entry.title.trim() || `Fascia ${index + 1}`}
            </strong>
            <button
              type="button"
              aria-label="Togli la fascia"
              onClick={() => removeEntry(entry.id)}
              style={{
                width: 26,
                height: 26,
                flex: "0 0 auto",
                borderRadius: 999,
                border: 0,
                background: "#f2f0fa",
                color: "#8b88a3",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            {label("Nome")}
            <TextInput
              name={`standardShiftPresetTitle_${entry.id}`}
              value={entry.title}
              onChange={(event) => updateEntry(entry.id, { title: event.target.value })}
              // Not "titolo opzionale": this is the word that shows on the
              // keypad when a shift is being written, and left empty the slot
              // ends up called "Fascia 2".
              placeholder="mattina"
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            <label style={{ display: "grid", gap: 6 }}>
              {label("Dalle")}
              <TimeInput
                name={`standardShiftPresetStart_${entry.id}`}
                value={entry.startTime}
                onChange={(value) => updateEntry(entry.id, { startTime: value })}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              {label("Alle")}
              <TimeInput
                name={`standardShiftPresetEnd_${entry.id}`}
                value={entry.endTime}
                onChange={(value) => updateEntry(entry.id, { endTime: value })}
              />
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addEntry}
        style={{
          minHeight: 44,
          borderRadius: 14,
          border: "1.5px solid #ddd6fe",
          background: "#ffffff",
          color: "#4c1d95",
          font: "inherit",
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        ＋ Aggiungi fascia
      </button>

      <PrimaryButton type="submit" style={{ minHeight: 46, borderRadius: 14 }}>
        Salva
      </PrimaryButton>
    </div>
  );
}
