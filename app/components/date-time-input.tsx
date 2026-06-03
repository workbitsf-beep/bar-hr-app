"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { TimeInput } from "./time-input";

function splitDateTimeValue(value: string) {
  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return { date: "", time: "" };
  }

  if (trimmed.includes("T")) {
    const [date = "", time = ""] = trimmed.split("T");
    return {
      date: date.slice(0, 10),
      time: time.slice(0, 5),
    };
  }

  return {
    date: trimmed.slice(0, 10),
    time: "",
  };
}

function buildDateTimeValue(date: string, time: string) {
  if (!date || !time) {
    return "";
  }

  return `${date}T${time}`;
}

export function DateTimeInput({
  value = "",
  onChange,
  name,
  disabled,
  required,
  style,
}: {
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
}) {
  const [date, setDate] = useState(() => splitDateTimeValue(value).date);
  const [time, setTime] = useState(() => splitDateTimeValue(value).time);

  useEffect(() => {
    const next = splitDateTimeValue(value);
    setDate(next.date);
    setTime(next.time);
  }, [value]);

  function commit(nextDate = date, nextTime = time) {
    if (!nextDate || !nextTime) {
      onChange?.("");
      return;
    }

    const finalValue = buildDateTimeValue(nextDate, nextTime);
    onChange?.(finalValue);
  }

  const hiddenValue = buildDateTimeValue(date, time);

  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        width: "100%",
        minWidth: 0,
        ...style,
      }}
    >
      <input
        type="date"
        disabled={disabled}
        required={required}
        value={date}
        onChange={(event) => {
          const nextDate = event.target.value;
          setDate(nextDate);
          commit(nextDate, time);
        }}
        onBlur={() => commit()}
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
      <TimeInput
        value={time}
        required={required}
        disabled={disabled}
        onChange={(nextTime) => {
          setTime(nextTime);
          commit(date, nextTime);
        }}
      />
      {name ? <input type="hidden" name={name} value={hiddenValue} /> : null}
    </div>
  );
}
