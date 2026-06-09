"use client";

import { useEffect } from "react";
import { ensureWorkbitPushRegistration } from "@/lib/push-client";

export function PushRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (Notification.permission === "granted") {
      void ensureWorkbitPushRegistration();
      return;
    }

    if (Notification.permission !== "default") {
      return;
    }

    const storageKey = "workbit.push.auto-prompted";

    if (window.localStorage.getItem(storageKey) === "1") {
      return;
    }

    window.localStorage.setItem(storageKey, "1");
    void ensureWorkbitPushRegistration({ requestPermission: true });
  }, []);

  return null;
}
