"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useRef, useState } from "react";

const REVEAL_WIDTH = 82;
const OPEN_THRESHOLD = 42;

export function SwipeRevealAction({
  children,
  action,
  enabled = true,
  className,
  style,
}: {
  children: ReactNode;
  action: ReactNode;
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startOffsetRef.current = revealed ? -REVEAL_WIDTH : 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - startXRef.current;
    const nextOffset = Math.max(-REVEAL_WIDTH, Math.min(0, startOffsetRef.current + deltaX));
    setDragOffset(nextOffset);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || pointerIdRef.current !== event.pointerId) {
      pointerIdRef.current = null;
      return;
    }

    const deltaX = event.clientX - startXRef.current;
    const finalOffset = Math.max(-REVEAL_WIDTH, Math.min(0, startOffsetRef.current + deltaX));
    const shouldReveal = finalOffset <= -OPEN_THRESHOLD;

    setRevealed(shouldReveal);
    setDragOffset(shouldReveal ? -REVEAL_WIDTH : 0);
    setDragging(false);
    pointerIdRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The browser can release capture first during fast native scroll gestures.
    }
  }

  function handlePointerCancel() {
    pointerIdRef.current = null;
    setDragging(false);
    setDragOffset(revealed ? -REVEAL_WIDTH : 0);
  }

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 20,
        ...style,
      }}
    >
      <div
        aria-hidden={!revealed}
        style={{
          position: "absolute",
          inset: "0 0 0 auto",
          width: REVEAL_WIDTH,
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
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{
          position: "relative",
          zIndex: 1,
          transform: `translateX(${dragging ? dragOffset : revealed ? -REVEAL_WIDTH : 0}px)`,
          transition: dragging ? "none" : "transform 190ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
