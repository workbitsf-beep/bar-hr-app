"use client";

import type { CSSProperties, PointerEvent, ReactNode, TouchEvent } from "react";
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
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const horizontalDragRef = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  function beginDrag(clientX: number, clientY: number) {
    startXRef.current = clientX;
    startYRef.current = clientY;
    startOffsetRef.current = revealed ? -REVEAL_WIDTH : 0;
    horizontalDragRef.current = false;
    setDragOffset(revealed ? -REVEAL_WIDTH : 0);
  }

  function updateDrag(clientX: number, clientY: number) {
    const deltaX = clientX - startXRef.current;
    const deltaY = clientY - startYRef.current;

    if (!horizontalDragRef.current && Math.abs(deltaX) < 8) {
      return;
    }

    if (!horizontalDragRef.current && Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }

    horizontalDragRef.current = true;
    setDragging(true);
    const nextOffset = Math.max(-REVEAL_WIDTH, Math.min(0, startOffsetRef.current + deltaX));
    setDragOffset(nextOffset);
  }

  function finishDrag(clientX: number) {
    const deltaX = clientX - startXRef.current;
    const finalOffset = Math.max(-REVEAL_WIDTH, Math.min(0, startOffsetRef.current + deltaX));
    const shouldReveal = horizontalDragRef.current
      ? finalOffset <= -OPEN_THRESHOLD
      : revealed;

    setRevealed(shouldReveal);
    setDragOffset(shouldReveal ? -REVEAL_WIDTH : 0);
    setDragging(false);
    horizontalDragRef.current = false;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType === "touch") {
      return;
    }

    pointerIdRef.current = event.pointerId;
    beginDrag(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType === "touch" || pointerIdRef.current !== event.pointerId) {
      return;
    }

    updateDrag(event.clientX, event.clientY);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.pointerType === "touch" || pointerIdRef.current !== event.pointerId) {
      pointerIdRef.current = null;
      return;
    }

    finishDrag(event.clientX);
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
    horizontalDragRef.current = false;
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (!enabled || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    touchIdRef.current = touch.identifier;
    beginDrag(touch.clientX, touch.clientY);
  }

  function getActiveTouch(touches: TouchEvent<HTMLDivElement>["touches"]) {
    if (touchIdRef.current === null) {
      return null;
    }

    for (let index = 0; index < touches.length; index += 1) {
      const touch = touches.item(index);

      if (touch?.identifier === touchIdRef.current) {
        return touch;
      }
    }

    return null;
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    const touch = getActiveTouch(event.touches);

    if (!enabled || !touch) {
      return;
    }

    updateDrag(touch.clientX, touch.clientY);

    if (horizontalDragRef.current) {
      event.preventDefault();
    }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const touch = getActiveTouch(event.changedTouches);

    if (!enabled || !touch) {
      touchIdRef.current = null;
      setDragging(false);
      return;
    }

    finishDrag(touch.clientX);
    touchIdRef.current = null;
  }

  function handleTouchCancel() {
    touchIdRef.current = null;
    setDragging(false);
    setDragOffset(revealed ? -REVEAL_WIDTH : 0);
    horizontalDragRef.current = false;
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          position: "relative",
          zIndex: 1,
          transform: `translateX(${dragging ? dragOffset : revealed ? -REVEAL_WIDTH : 0}px)`,
          transition: dragging ? "none" : "transform 190ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y pinch-zoom",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
