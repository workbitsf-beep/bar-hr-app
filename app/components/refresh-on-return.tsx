"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native-app";

/**
 * Brings the app up to date when it comes back to the foreground.
 *
 * Some things deliberately happen outside the app: paying goes to Stripe in
 * the phone's browser, a document opens in a viewer. Whatever changed while
 * the reader was away — a subscription that became active — the app would
 * otherwise keep showing the state it had when it was put aside.
 *
 * Only a real absence counts. Switching away for an instant, or the keyboard
 * covering the page, should not reload anything.
 */
const AWAY_LONG_ENOUGH_MS = 3000;

export function RefreshOnReturn() {
  const router = useRouter();
  const hiddenSince = useRef<number | null>(null);

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        return;
      }

      const since = hiddenSince.current;
      hiddenSince.current = null;

      if (since !== null && Date.now() - since >= AWAY_LONG_ENOUGH_MS) {
        router.refresh();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
