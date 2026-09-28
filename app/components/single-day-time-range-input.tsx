"use client";

import { useMemo, useState } from "react";
import { toDateInputValueInTimeZone, toTimeInputValueInTimeZone } from "@/lib/time-zone";
import { TimeInput } from "./time-input";

function hasExplicitTimeZone(value: string) {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function splitDateTimeValue(value?: string | null) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return { date: "", time: "" };
  }

  if (hasExplicitTimeZone(raw)) {
    return {
      date: toDateInputValueInTimeZone(raw),
      time: toTimeInputValueInTimeZone(raw),
    };
  }

  const [date = "", time = ""] = raw.includes("T") ? raw.split("T") : [raw.slice(0, 10), ""];

  return {
    date: date.slice(0, 10),
    time: time.slice(0, 5),
  };
}

function buildDateTime(date: string, time: string) {
  if (!date || !time) {
    return "";
  }

  return `${date}T${time}`;
}

const TIME_PRESETS = [
  { label: "Mattina", startTime: "09:00", endTime: "13:00" },
  { label: "Pomeriggio", startTime: "14:00", endTime: "18:00" },
  { label: "Sera", startTime: "18:00", endTime: "23:00" },
  { label: "Tutto il giorno", startTime: "09:00", endTime: "18:00" },
];

export function SingleDayTimeRangeInput({
  startName,
  endName,
  startValue,
  endValue,
  required,
}: {
  startName: string;
  endName: string;
  startValue?: string | null;
  endValue?: string | null;
  required?: boolean;
}) {
  const today = useMemo(() => getTodayInputValue(), []);
  const initialStart = splitDateTimeValue(startValue);
  const initialEnd = splitDateTimeValue(endValue);
  const [date, setDate] = useState(initialStart.date || initialEnd.date || today);
  const [startTime, setStartTime] = useState(initialStart.time);
  const [endTime, setEndTime] = useState(initialEnd.time);
  const safeDate = date && date < today ? today : date;

  return (
    <div
      className="dashboard-inline-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
      }}
    >
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Data</span>
        <input
          type="date"
          min={today}
          required={required}
          value={safeDate}
          onChange={(event) => {
            const nextDate = event.target.value;
            setDate(nextDate && nextDate < today ? today : nextDate);
          }}
          style={{
            borderRadius: 16,
            border: "1px solid rgba(124, 58, 237, 0.14)",
            padding: "12px 14px",
            fontSize: 15,
            background: "#ffffff",
            width: "100%",
            color: "#0f172a",
            boxSizing: "border-box",
          }}
        />
      </label>
      {/* The shapes a shift actually takes. Four number boxes with a colon
          between them meant four taps and four keypads for what is nearly
          always one of these. */}
      <div style={{ gridColumn: "1 / -1", display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Orario</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {TIME_PRESETS.map((preset) => {
            const active = startTime === preset.startTime && endTime === preset.endTime;

            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setStartTime(preset.startTime);
                  setEndTime(preset.endTime);
                }}
                style={{
                  minHeight: 38,
                  padding: "0 13px",
                  borderRadius: 999,
                  border: active ? "1px solid rgba(124, 58, 237, 0.46)" : "1px solid #e2e8f0",
                  background: active ? "#f3e8ff" : "#ffffff",
                  color: active ? "#4c1d95" : "#475569",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Ora inizio</span>
        <TimeInput value={startTime} onChange={setStartTime} required={required} />
      </label>
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Ora fine</span>
        <TimeInput value={endTime} onChange={setEndTime} required={required} />
      </label>
      <input type="hidden" name={startName} value={buildDateTime(safeDate, startTime)} />
      <input type="hidden" name={endName} value={buildDateTime(safeDate, endTime)} />
    </div>
  );
}
