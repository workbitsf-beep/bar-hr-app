"use client";

import { useEffect } from "react";
import { ensureWorkbitPushRegistration, isWorkbitPushDisabled } from "@/lib/push-client";

export function PushRegistration() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    if (isWorkbitPushDisabled()) {
      return;
    }

    if (Notification.permission === "granted") {
      void ensureWorkbitPushRegistration();
    }
  }, []);

  return null;
}
