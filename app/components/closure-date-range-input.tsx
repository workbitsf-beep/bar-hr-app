"use client";

import { useEffect, useState, type CSSProperties } from "react";

function splitDateValue(value: string) {
  const trimmed = String(value ?? "").trim();
  return trimmed.slice(0, 10);
}

function toStartOfDay(date: string) {
  return `${date}T00:00`;
}

function toEndOfDay(date: string) {
  return `${date}T23:59`;
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ClosureDateRangeInput({
  startName,
  endName,
  startValue = "",
  endValue = "",
  disabled,
  required,
  style,
}: {
  startName: string;
  endName: string;
  startValue?: string;
  endValue?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
}) {
  const [startDate, setStartDate] = useState(() => splitDateValue(startValue));
  const [endDate, setEndDate] = useState(() => splitDateValue(endValue));

  useEffect(() => {
    setStartDate(splitDateValue(startValue));
  }, [startValue]);

  useEffect(() => {
    setEndDate(splitDateValue(endValue));
  }, [endValue]);

  useEffect(() => {
    if (!startDate) {
      if (endDate) {
        setEndDate("");
      }

      return;
    }

    if (!endDate || endDate < startDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  const startHiddenValue = startDate ? toStartOfDay(startDate) : "";
  const endHiddenValue = endDate ? toEndOfDay(endDate) : "";
  const today = getTodayInputValue();

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        width: "100%",
        minWidth: 0,
        ...style,
      }}
    >
      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Dal giorno</span>
        <input
          type="date"
          disabled={disabled}
          required={required}
          min={today}
          value={startDate}
          onChange={(event) => {
            const nextValue =
              event.target.value && event.target.value < today ? today : event.target.value;
            setStartDate(nextValue);

            if (!nextValue) {
              setEndDate("");
              return;
            }

            if (!endDate || endDate < nextValue) {
              setEndDate(nextValue);
            }
          }}
          style={{
            width: "100%",
            minWidth: 0,
            borderRadius: 16,
            border: "1px solid #dbe3ee",
            padding: "12px 14px",
            fontSize: 15,
            background: "#ffffff",
          }}
        />
      </label>

      <label style={{ display: "grid", gap: 8 }}>
        <span style={{ fontWeight: 600, color: "#1e293b" }}>Al giorno</span>
        <input
          type="date"
          disabled={disabled}
          required={required}
          min={startDate || today}
          value={endDate}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (!startDate) {
              setEndDate("");
              return;
            }

            setEndDate(nextValue && nextValue < startDate ? startDate : nextValue);
          }}
          style={{
            width: "100%",
            minWidth: 0,
            borderRadius: 16,
            border: "1px solid #dbe3ee",
            padding: "12px 14px",
            fontSize: 15,
            background: "#ffffff",
          }}
        />
      </label>

      <input type="hidden" name={startName} value={startHiddenValue} />
      <input type="hidden" name={endName} value={endHiddenValue} />
    </div>
  );
}
