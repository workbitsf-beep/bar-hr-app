"use client";

import type { PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";

export function SwipeRevealAction({
  children,
  action,
  enabled = true,
}: {
  children: ReactNode;
  action: ReactNode;
  enabled?: boolean;
}) {
  const startXRef = useRef<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled) {
      return;
    }

    startXRef.current = event.clientX;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || startXRef.current === null) {
      startXRef.current = null;
      return;
    }

    const deltaX = event.clientX - startXRef.current;
    startXRef.current = null;

    if (deltaX > 46) {
      setRevealed(true);
      return;
    }

    if (deltaX < -24) {
      setRevealed(false);
    }
  }

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
      }}
    >
      <div
        aria-hidden={!revealed}
        style={{
          position: "absolute",
          inset: "0 auto 0 0",
          width: 78,
          display: "grid",
          placeItems: "center",
          background: "#fee2e2",
          border: "1px solid #fecaca",
          borderRadius: 20,
          zIndex: 0,
        }}
      >
        {action}
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          startXRef.current = null;
        }}
        style={{
          position: "relative",
          zIndex: 1,
          transform: revealed ? "translateX(78px)" : "translateX(0)",
          transition: "transform 180ms ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
