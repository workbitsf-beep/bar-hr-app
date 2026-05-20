"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

async function refreshSession() {
  try {
    await fetch("/api/auth/session/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      keepalive: true,
    });
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
