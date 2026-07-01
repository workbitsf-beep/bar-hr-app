"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const MIN_REFRESH_GAP_MS = 10 * 60 * 1000;
const LAST_REFRESH_KEY = "workbit:last-session-refresh";

async function refreshSession() {
  try {
    const lastRefresh = Number(window.sessionStorage.getItem(LAST_REFRESH_KEY) ?? "0");
    if (Number.isFinite(lastRefresh) && Date.now() - lastRefresh < MIN_REFRESH_GAP_MS) {
      return;
    }

    await fetch("/api/auth/session/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      keepalive: true,
    });
    window.sessionStorage.setItem(LAST_REFRESH_KEY, String(Date.now()));
  } catch {
    // Ignore keepalive failures: auth checks will handle invalid sessions.
  }
}

export function SessionKeepAlive() {
  useEffect(() => {
    void refreshSession();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    }, REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
