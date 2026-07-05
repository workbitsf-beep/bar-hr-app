"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

function sanitizePart(value: string) {
  return value.replace(/\D/g, "").slice(0, 2);
}

function splitTimeValue(value: string) {
  const [hours = "", minutes = ""] = String(value ?? "").split(":");
  return {
    hours: sanitizePart(hours),
    minutes: sanitizePart(minutes),
  };
}

function buildTimeValue(hours: string, minutes: string) {
  return `${sanitizePart(hours).padStart(2, "0")}:${sanitizePart(minutes).padStart(2, "0")}`;
}

export function TimeInput({
  value,
  onChange,
  name,
  disabled,
  required,
  style,
}: {
  value: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  style?: CSSProperties;
}) {
  const [hours, setHours] = useState(() => splitTimeValue(value).hours);
  const [minutes, setMinutes] = useState(() => splitTimeValue(value).minutes);
  const lastEmittedValue = useRef<string | null>(null);
  const preserveEmptyMinutes = useRef(false);

  useEffect(() => {
    if (
      value &&
      value === lastEmittedValue.current &&
      value.endsWith(":00") &&
      preserveEmptyMinutes.current
    ) {
      setHours(splitTimeValue(value).hours);
      setMinutes("");
      return;
    }

    const next = splitTimeValue(value);
    setHours(next.hours);
    setMinutes(next.minutes);
    preserveEmptyMinutes.current = false;
  }, [value]);

  function commit(nextHours = hours, nextMinutes = minutes) {
    if (!nextHours && !nextMinutes) {
      setHours("");
      setMinutes("");
      lastEmittedValue.current = "";
      preserveEmptyMinutes.current = false;
      onChange?.("");
      return;
    }

    const cleanHours = sanitizePart(nextHours);
    const cleanMinutes = sanitizePart(nextMinutes);
    const finalValue = buildTimeValue(nextHours, nextMinutes);
    setHours(cleanHours ? cleanHours.padStart(2, "0") : "");
    setMinutes(cleanMinutes ? cleanMinutes.padStart(2, "0") : "");
    lastEmittedValue.current = finalValue;
    preserveEmptyMinutes.current = !cleanMinutes;
    onChange?.(finalValue);
  }

  const inputStyle: CSSProperties = {
    flex: "1 1 0",
    width: "100%",
    minWidth: 0,
    borderRadius: 16,
    border: "1px solid var(--workbit-border)",
    padding: "12px 14px",
    fontSize: 15,
    background: "var(--workbit-field-bg)",
    color: "var(--workbit-text)",
    textAlign: "center",
  };
  const hiddenValue = hours || minutes ? buildTimeValue(hours, minutes) : "";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        minWidth: 0,
        ...style,
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        disabled={disabled}
        required={required}
        value={hours}
        onChange={(event) => {
          setHours(sanitizePart(event.target.value));
        }}
        onBlur={() => commit()}
        style={inputStyle}
      />
      <span style={{ color: "var(--workbit-muted)", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>:</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        disabled={disabled}
        required={false}
        value={minutes}
        onChange={(event) => {
          setMinutes(sanitizePart(event.target.value));
        }}
        onBlur={() => commit()}
        style={inputStyle}
      />
      {name ? <input type="hidden" name={name} value={hiddenValue} /> : null}
    </div>
  );
}
