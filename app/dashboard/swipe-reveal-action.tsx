"use client";

import type { CSSProperties, PointerEvent, ReactNode, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";

const REVEAL_WIDTH = 82;
const OPEN_THRESHOLD = 42;
const FULL_SWIPE_MIN = 180;
const FULL_SWIPE_MAX = 320;
const FULL_SWIPE_RATIO = 0.62;

type RevealedSide = "leading" | "trailing" | null;

export function SwipeRevealAction({
  children,
  action,
  leadingAction,
  enabled = true,
  className,
  style,
  resetKey,
  revealWidth = REVEAL_WIDTH,
  actionInset = 14,
  borderRadius = 20,
}: {
  children: ReactNode;
  action: ReactNode;
  leadingAction?: ReactNode;
  enabled?: boolean;
  className?: string;
  style?: CSSProperties;
  resetKey?: string | number;
  revealWidth?: number;
  actionInset?: number;
  borderRadius?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trailingActionRef = useRef<HTMLDivElement | null>(null);
  const leadingActionRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const horizontalDragRef = useRef(false);
  const actionTriggeredRef = useRef(false);
  const [revealedSide, setRevealedSide] = useState<RevealedSide>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completingOffset, setCompletingOffset] = useState<number | null>(null);
  const safeRevealWidth = Math.max(48, Math.min(120, revealWidth));
  const openThreshold = Math.min(OPEN_THRESHOLD, safeRevealWidth * 0.58);

  function resetSwipe() {
    pointerIdRef.current = null;
    touchIdRef.current = null;
    horizontalDragRef.current = false;
    actionTriggeredRef.current = false;
    setRevealedSide(null);
    setDragOffset(0);
    setDragging(false);
    setCompletingOffset(null);
  }

  useEffect(() => {
    resetSwipe();
  }, [resetKey]);

  useEffect(() => {
    window.addEventListener("workbit:swipe-reset", resetSwipe);
    window.addEventListener("workbit:calendar-cleanup", resetSwipe);
    window.addEventListener("workbit:dashboard-route-change", resetSwipe);

    return () => {
      window.removeEventListener("workbit:swipe-reset", resetSwipe);
      window.removeEventListener("workbit:calendar-cleanup", resetSwipe);
      window.removeEventListener("workbit:dashboard-route-change", resetSwipe);
    };
  }, []);

  function getContainerWidth() {
    return containerRef.current?.offsetWidth ?? safeRevealWidth;
  }

  function getFullSwipeThreshold() {
    const width = getContainerWidth();
    return Math.min(FULL_SWIPE_MAX, Math.max(FULL_SWIPE_MIN, width * FULL_SWIPE_RATIO));
  }

  function triggerAction(side: Exclude<RevealedSide, null>) {
    if (actionTriggeredRef.current) {
      return;
    }

    actionTriggeredRef.current = true;
    const actionRoot = side === "leading" ? leadingActionRef.current : trailingActionRef.current;
    const form = actionRoot?.querySelector("form");

    if (form) {
      form.requestSubmit();
      return;
    }

    const button = actionRoot?.querySelector("button");
    button?.click();

    if (side === "leading") {
      window.setTimeout(() => {
        setCompletingOffset(null);
        setRevealedSide(null);
        setDragOffset(0);
      }, 180);
    }
  }

  function getOffsetForSide(side: RevealedSide) {
    if (side === "leading") {
      return safeRevealWidth;
    }

    if (side === "trailing") {
      return -safeRevealWidth;
    }

    return 0;
  }

  function beginDrag(clientX: number, clientY: number) {
    startXRef.current = clientX;
    startYRef.current = clientY;
    startOffsetRef.current = getOffsetForSide(revealedSide);
    horizontalDragRef.current = false;
    actionTriggeredRef.current = false;
    setCompletingOffset(null);
    setDragOffset(getOffsetForSide(revealedSide));
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
    const width = getContainerWidth();
    const minOffset = -width;
    const maxOffset = leadingAction ? width : 0;
    const nextOffset = Math.max(minOffset, Math.min(maxOffset, startOffsetRef.current + deltaX));
    setDragOffset(nextOffset);
  }

  function finishDrag(clientX: number) {
    const deltaX = clientX - startXRef.current;
    const width = getContainerWidth();
    const minOffset = -width;
    const maxOffset = leadingAction ? width : 0;
    const finalOffset = Math.max(minOffset, Math.min(maxOffset, startOffsetRef.current + deltaX));
    const fullSwipeThreshold = getFullSwipeThreshold();

    if (horizontalDragRef.current && finalOffset <= -fullSwipeThreshold) {
      setCompletingOffset(-width);
      setRevealedSide(null);
      setDragOffset(-width);
      setDragging(false);
      horizontalDragRef.current = false;
      window.setTimeout(() => triggerAction("trailing"), 120);
      return;
    }

    if (horizontalDragRef.current && leadingAction && finalOffset >= fullSwipeThreshold) {
      setCompletingOffset(width);
      setRevealedSide(null);
      setDragOffset(width);
      setDragging(false);
      horizontalDragRef.current = false;
      window.setTimeout(() => triggerAction("leading"), 120);
      return;
    }

    const nextRevealedSide = horizontalDragRef.current
      ? finalOffset >= openThreshold && leadingAction
        ? "leading"
        : finalOffset <= -openThreshold
          ? "trailing"
          : null
      : revealedSide;

    setRevealedSide(nextRevealedSide);
    setDragOffset(getOffsetForSide(nextRevealedSide));
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
    setDragOffset(getOffsetForSide(revealedSide));
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
    setDragOffset(getOffsetForSide(revealedSide));
    horizontalDragRef.current = false;
  }

  if (!enabled) {
    return <>{children}</>;
  }

  const visualOffset = completingOffset ?? (dragging ? dragOffset : getOffsetForSide(revealedSide));
  const activeSide: RevealedSide =
    visualOffset > 0 ? "leading" : visualOffset < 0 ? "trailing" : revealedSide;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius,
        ...style,
      }}
    >
      <div
        ref={leadingActionRef}
        aria-hidden={revealedSide !== "leading"}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: actionInset,
          background: "#ede9fe",
          border: "1px solid #ddd6fe",
          borderRadius,
          zIndex: activeSide === "leading" ? 2 : 0,
          opacity: activeSide === "leading" ? 1 : 0,
          visibility: leadingAction ? "visible" : "hidden",
        }}
      >
        {leadingAction}
      </div>
      <div
        ref={trailingActionRef}
        aria-hidden={revealedSide !== "trailing"}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: actionInset,
          background: "#fee2e2",
          border: "1px solid #fecaca",
          borderRadius,
          zIndex: activeSide === "trailing" ? 2 : 0,
          opacity: activeSide === "trailing" ? 1 : 0,
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
          transform: `translateX(${visualOffset}px)`,
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
