"use client";

import { useEffect } from "react";

let overlayLockCount = 0;
let previousBodyOverflow = "";

export function useOverlayLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    if (overlayLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.setAttribute("data-workbit-overlay-open", "true");
    }

    overlayLockCount += 1;

    return () => {
      overlayLockCount = Math.max(0, overlayLockCount - 1);

      if (overlayLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.removeAttribute("data-workbit-overlay-open");
      }
    };
  }, [active]);
}
