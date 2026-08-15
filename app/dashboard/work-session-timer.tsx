"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_TIME_ZONE } from "@/lib/time-zone";

const TIMER_TICK_MS = 60 * 1000;

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatClockTime(value: string | null | undefined) {
  const timestamp = parseTimestamp(value);

  if (timestamp === null) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(timestamp));
}

function formatDuration(durationMs: number) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / TIMER_TICK_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

type WorkSessionTimerProps = {
  activeClockInAt?: string | null;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
};

export function WorkSessionTimer({
  activeClockInAt,
  scheduledStartAt,
  scheduledEndAt,
}: WorkSessionTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const clockInTime = useMemo(() => parseTimestamp(activeClockInAt), [activeClockInAt]);
  const scheduledStart = useMemo(() => parseTimestamp(scheduledStartAt), [scheduledStartAt]);
  const scheduledEnd = useMemo(() => parseTimestamp(scheduledEndAt), [scheduledEndAt]);

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

  const workedMs = clockInTime === null ? 0 : Math.max(0, now - clockInTime);
  const scheduledDurationMs =
    scheduledStart !== null && scheduledEnd !== null
      ? Math.max(0, scheduledEnd - scheduledStart)
      : 0;
  const progress =
    clockInTime !== null && scheduledDurationMs > 0
      ? Math.min(100, (workedMs / scheduledDurationMs) * 100)
      : 0;
  const clockStart = formatClockTime(activeClockInAt);

  return (
    <section className="workbit-home-hours" aria-label="Avanzamento turno">
      <div
        className="workbit-home-ring workbit-home-live-ring"
        style={{
          background: `conic-gradient(#5E5CE6 0 ${progress}%, #E3E1EA ${progress}% 100%)`,
        }}
      >
        <span>{formatDuration(workedMs)}</span>
      </div>
      <div>
        <strong>{clockInTime !== null ? "Turno in corso" : "Timer pronto"}</strong>
        <small>
          {clockInTime !== null
            ? scheduledDurationMs > 0
              ? `${formatDuration(scheduledDurationMs)} previste`
              : clockStart
                ? `Entrata alle ${clockStart}`
                : "Timbratura attiva"
            : scheduledDurationMs > 0
              ? `Turno di ${formatDuration(scheduledDurationMs)}`
              : "Si avvia con l'entrata"}
        </small>
      </div>
    </section>
  );
}
