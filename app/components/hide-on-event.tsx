"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Shows its children until a window event says they no longer apply - an
 * error about a missing position, gone the moment the position is taken.
 */
export function HideOnEvent({ event, children }: { event: string; children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const hide = () => setHidden(true);
    window.addEventListener(event, hide);
    return () => window.removeEventListener(event, hide);
  }, [event]);

  return hidden ? null : <>{children}</>;
}
