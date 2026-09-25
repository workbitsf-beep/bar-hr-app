"use client";

import { useEffect, useState } from "react";

/**
 * The running timer, and the month it is adding to.
 *
 * The month total only ever counted closed sessions, so the hours being worked
 * right now sat nowhere: the figure stood still all shift and jumped at the
 * end. Both numbers carry the open session here, and both move together.
 *
 * The ring measures how much of today's shift has passed. With no shift to
 * measure against it stays empty rather than inventing a proportion.
 */
export function WorkHoursRing({
  activeClockInAt,
  shiftStartAt,
  shiftEndAt,
  closedTodayMinutes,
  closedMonthMinutes,
  monthDays,
}: {
  activeClockInAt: string | null;
  shiftStartAt: string | null;
  shiftEndAt: string | null;
  closedTodayMinutes: number;
  closedMonthMinutes: number;
  monthDays: number;
}) {
  const [openMinutes, setOpenMinutes] = useState(0);

  useEffect(() => {
    if (!activeClockInAt) {
      setOpenMinutes(0);
      return;
    }

    const startedAt = new Date(activeClockInAt).getTime();

    function tick() {
      setOpenMinutes(Math.max(0, (Date.now() - startedAt) / 60000));
    }

    tick();
    const id = window.setInterval(tick, 20_000);

    return () => window.clearInterval(id);
  }, [activeClockInAt]);

  const inService = Boolean(activeClockInAt);
  const todayMinutes = closedTodayMinutes + openMinutes;
  const monthMinutes = closedMonthMinutes + openMinutes;

  const shiftMinutes =
    shiftStartAt && shiftEndAt
      ? Math.max(0, (new Date(shiftEndAt).getTime() - new Date(shiftStartAt).getTime()) / 60000)
      : 0;

  // 414.7 is the circle's circumference at this radius; the offset is what is
  // left to travel.
  const circumference = 414.7;
  const progress = shiftMinutes > 0 ? Math.min(1, todayMinutes / shiftMinutes) : 0;

  // Past the end of the shift the ring has nowhere left to go, so it changes
  // colour instead. Without that, the moment overtime starts is the moment the
  // ring stops saying anything.
  const overtimeMinutes = shiftMinutes > 0 ? Math.max(0, todayMinutes - shiftMinutes) : 0;
  const overtime = overtimeMinutes >= 1;

  return (
    <section className="workbit-ring" aria-label="Ore di oggi e del mese">
      <div className="workbit-ring-side">
        <strong>{monthDays}</strong>
        <span>{monthDays === 1 ? "giornata" : "giornate"}</span>
      </div>

      <div className={`workbit-ring-dial${overtime ? " workbit-ring-dial--over" : ""}`}>
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <defs>
            <linearGradient id="workbit-ring-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={overtime ? "#fbbf24" : "#a78bfa"} />
              <stop offset="100%" stopColor={overtime ? "#b45309" : "#4c1d95"} />
            </linearGradient>
          </defs>
          <circle cx="80" cy="80" r="66" fill="none" stroke="#e3dbf7" strokeWidth="12" />
          <circle
            cx="80"
            cy="80"
            r="66"
            fill="none"
            stroke="url(#workbit-ring-stroke)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
        </svg>

        <div className="workbit-ring-mid">
          <strong>{formatClock(todayMinutes)}</strong>
          <span>
            {inService ? <i className="workbit-ring-live" aria-hidden="true" /> : null}
            {overtime ? `+${formatClock(overtimeMinutes)} oltre` : inService ? "in servizio" : "oggi"}
          </span>
        </div>
      </div>

      <div className="workbit-ring-side">
        <strong>{formatClock(monthMinutes)}</strong>
        <span>ore del mese</span>
      </div>
    </section>
  );
}

function formatClock(minutes: number) {
  const whole = Math.max(0, Math.floor(minutes));

  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
