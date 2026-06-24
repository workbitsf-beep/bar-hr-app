"use client";

import { useMemo, useState } from "react";
import { TimeInput } from "./time-input";

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
