"use client";

import { useEffect } from "react";
import { CLOCK_CHANGED_EVENT, refreshNativeWidgets } from "@/lib/native-widgets";

/**
 * Inside the installed app only: keeps the home screen widgets and the Live
 * Activity in step with the shifts and the stamps. They are refreshed when
 * the app opens, when it comes back to the front, and right after a stamp.
 */
export function NativeWidgetsSync() {
  useEffect(() => {
    void refreshNativeWidgets();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshNativeWidgets();
    };
    const onClock = () => void refreshNativeWidgets();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(CLOCK_CHANGED_EVENT, onClock);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(CLOCK_CHANGED_EVENT, onClock);
    };
  }, []);

  return null;
}
