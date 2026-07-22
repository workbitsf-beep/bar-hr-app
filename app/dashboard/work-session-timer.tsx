"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDurationFromMilliseconds } from "@/lib/time-format";
import { APP_TIME_ZONE } from "@/lib/time-zone";

const TIMER_TICK_MS = 60 * 1000;

function parseClockInTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatClockStart(value: string | null | undefined) {
  const timestamp = parseClockInTime(value);

  if (timestamp === null) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(timestamp));
}

export function WorkSessionTimer({ activeClockInAt }: { activeClockInAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  const clockInTime = useMemo(() => parseClockInTime(activeClockInAt), [activeClockInAt]);
  const clockStart = useMemo(() => formatClockStart(activeClockInAt), [activeClockInAt]);

  useEffect(() => {
    if (clockInTime === null) {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, TIMER_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, [clockInTime]);

  if (clockInTime === null) {
    return null;
  }

  const workedMs = Math.max(0, now - clockInTime);

  return (
    <div
      className="dashboard-work-session-timer"
      aria-live="polite"
      title={clockStart ? `Entrata alle ${clockStart}` : "Timer in corso"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        minHeight: 42,
        maxWidth: 128,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(124,58,237,0.18)",
        boxShadow: "0 14px 30px rgba(88,28,135,0.12)",
        color: "#4c1d95",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        flex: "0 0 auto",
      }}
    >
      <span
        className="dashboard-work-session-timer-dot"
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#22c55e",
          boxShadow: "0 0 0 5px rgba(34,197,94,0.12)",
          flex: "0 0 auto",
        }}
      />
      <span
        className="dashboard-work-session-timer-label"
        style={{
          color: "#64748b",
          fontSize: 10,
          fontWeight: 900,
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        Ora
      </span>
      <strong
        className="dashboard-work-session-timer-value"
        style={{
          color: "#4c1d95",
          fontSize: 17,
          fontWeight: 950,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: 0,
          whiteSpace: "nowrap",
        }}
      >
        {formatDurationFromMilliseconds(workedMs)}
      </strong>
    </div>
  );
}
