"use client";

import { useEffect, useMemo, useState } from "react";

const TIMER_TICK_MS = 60 * 1000;

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
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
  monthlyHours: string;
};

export function WorkSessionTimer({
  activeClockInAt,
  scheduledStartAt,
  scheduledEndAt,
  monthlyHours,
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
  return (
    <section className="workbit-home-hours" aria-label="Avanzamento turno">
      <div
        className="workbit-home-ring workbit-home-live-ring"
        style={{
          background: `conic-gradient(#6547f5 0 ${progress}%, #2f176c ${progress}% 100%)`,
        }}
      >
        <span>{formatDuration(workedMs)}</span>
      </div>
      <div>
        <strong>{monthlyHours} ore</strong>
        <small>questo mese</small>
      </div>
    </section>
  );
}
