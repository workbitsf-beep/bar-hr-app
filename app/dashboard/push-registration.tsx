"use client";

import { useEffect } from "react";
import { ensureWorkbitPushRegistration } from "@/lib/push-client";

export function PushRegistration() {
  useEffect(() => {
    void ensureWorkbitPushRegistration();
  }, []);

  return null;
}
