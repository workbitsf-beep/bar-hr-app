"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { APP_TIME_ZONE, getZonedDateParts, toDateInputValueInTimeZone } from "@/lib/time-zone";

/**
 * Turns the page over at midnight.
 *
 * Which day is today is decided on the server, when the page is rendered, and
 * every "Oggi" on screen comes from that one answer. The installed app keeps
 * its web view alive for days, so a phone left on the calendar at half past
 * eleven was still calling the 28th today well into the 29th - and so was a
 * browser tab nobody had closed.
 *
 * So: a timer that fires just after the next midnight, plus a check whenever
 * the page comes back into view, since phones throttle timers in the
 * background and the alarm can arrive late or not at all.
 */
export function DayRollover() {
  const router = useRouter();
  const renderedDay = useRef(toDateInputValueInTimeZone(new Date()));

  useEffect(() => {
    let timer: number | null = null;

    function check() {
      const currentDay = toDateInputValueInTimeZone(new Date());

      if (currentDay !== renderedDay.current) {
        renderedDay.current = currentDay;
        router.refresh();
      }

      arm();
    }

    function arm() {
      if (timer !== null) {
        window.clearTimeout(timer);
      }

      timer = window.setTimeout(check, millisecondsUntilMidnight());
    }

    function onBackInView() {
      if (document.visibilityState === "visible") {
        check();
      }
    }

    arm();
    document.addEventListener("visibilitychange", onBackInView);
    window.addEventListener("focus", onBackInView);

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }

      document.removeEventListener("visibilitychange", onBackInView);
      window.removeEventListener("focus", onBackInView);
    };
  }, [router]);

  return null;
}

/** How long until the venue's own clock reads a new day, plus a moment. */
function millisecondsUntilMidnight() {
  const parts = getZonedDateParts(new Date(), APP_TIME_ZONE);
  const elapsed =
    Number(parts.hour) * 3_600 + Number(parts.minute) * 60 + Number(parts.second);

  // A second and a half past, so the new date has certainly arrived by the
  // time the check runs.
  return Math.max(1_000, (86_400 - elapsed) * 1_000 + 1_500);
}
