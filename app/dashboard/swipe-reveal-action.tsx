"use client";

import type { CSSProperties, PointerEvent, ReactNode, TouchEvent } from "react";
import { useEffect, useRef, useState } from "react";

const REVEAL_WIDTH = 82;
const FULL_SWIPE_MIN = 180;
const FULL_SWIPE_MAX = 320;
const FULL_SWIPE_RATIO = 0.62;
const DRAG_RESISTANCE = 0.34;
const RELEASE_ACTION_RATIO = 0.94;
const RELEASE_ACTION_MIN = 76;

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

  function getReleaseActionThreshold() {
    return Math.min(getFullSwipeThreshold(), Math.max(RELEASE_ACTION_MIN, safeRevealWidth * RELEASE_ACTION_RATIO));
  }

  function getResistedOffset(rawOffset: number) {
    const fullSwipeLimit = getFullSwipeThreshold() + 18;

    if (rawOffset > safeRevealWidth) {
      return Math.min(fullSwipeLimit, safeRevealWidth + (rawOffset - safeRevealWidth) * DRAG_RESISTANCE);
    }

    if (rawOffset < -safeRevealWidth) {
      return Math.max(-fullSwipeLimit, -safeRevealWidth + (rawOffset + safeRevealWidth) * DRAG_RESISTANCE);
    }

    return rawOffset;
  }

  function settleAfterAction(side: Exclude<RevealedSide, null>) {
    window.setTimeout(() => {
      setCompletingOffset(null);
      setRevealedSide(null);
      setDragOffset(getOffsetForSide(null));
    }, side === "trailing" ? 260 : 180);
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
      settleAfterAction(side);
      return;
    }

    const button = actionRoot?.querySelector("button");
    button?.click();

    settleAfterAction(side);
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
    const rawOffset = startOffsetRef.current + deltaX;
    const minOffset = -getFullSwipeThreshold() - 18;
    const maxOffset = leadingAction ? getFullSwipeThreshold() + 18 : 0;
    const boundedRawOffset = Math.max(minOffset, Math.min(maxOffset, rawOffset));
    setDragOffset(getResistedOffset(boundedRawOffset));
  }

  function finishDrag(clientX: number) {
    const deltaX = clientX - startXRef.current;
    const maxOffset = leadingAction ? getFullSwipeThreshold() + 18 : 0;
    const finalRawOffset = Math.max(
      -getFullSwipeThreshold() - 18,
      Math.min(maxOffset, startOffsetRef.current + deltaX)
    );
    const releaseActionThreshold = getReleaseActionThreshold();

    if (horizontalDragRef.current && finalRawOffset <= -releaseActionThreshold) {
      setCompletingOffset(-(safeRevealWidth + 10));
      setRevealedSide("trailing");
      setDragOffset(-(safeRevealWidth + 10));
      setDragging(false);
      horizontalDragRef.current = false;
      window.setTimeout(() => triggerAction("trailing"), 150);
      return;
    }

    if (horizontalDragRef.current && leadingAction && finalRawOffset >= releaseActionThreshold) {
      setCompletingOffset(safeRevealWidth + 10);
      setRevealedSide("leading");
      setDragOffset(safeRevealWidth + 10);
      setDragging(false);
      horizontalDragRef.current = false;
      window.setTimeout(() => triggerAction("leading"), 150);
      return;
    }

    const nextRevealedSide = horizontalDragRef.current ? null : revealedSide;

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
      setDragOffset(getOffsetForSide(revealedSide));
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
  const actionProgress = Math.min(1, Math.abs(visualOffset) / safeRevealWidth);
  const actionScale = 0.82 + actionProgress * 0.18;
  const actionRotate = activeSide === "leading"
    ? -8 + actionProgress * 8
    : activeSide === "trailing"
      ? 8 - actionProgress * 8
      : 0;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius,
        isolation: "isolate",
        background: "transparent",
        ...style,
      }}
    >
      <div
        ref={leadingActionRef}
        className="workbit-swipe-action workbit-swipe-action-leading"
        aria-hidden={revealedSide !== "leading"}
        style={{
          position: "absolute",
          inset: "1px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          paddingLeft: actionInset,
          background: "#ede9fe",
          borderRadius,
          boxShadow: "inset 0 0 0 1px rgba(221, 214, 254, 0.72)",
          zIndex: activeSide === "leading" ? 2 : 0,
          opacity: activeSide === "leading" ? actionProgress : 0,
          visibility: leadingAction ? "visible" : "hidden",
          transform: `translateX(${activeSide === "leading" ? 0 : -6}px)`,
          transition: dragging ? "none" : "opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          ["--workbit-swipe-action-color" as string]: "#6d28d9",
          ["--workbit-swipe-action-scale" as string]: actionScale,
          ["--workbit-swipe-action-rotate" as string]: `${actionRotate}deg`,
        }}
      >
        {leadingAction}
      </div>
      <div
        ref={trailingActionRef}
        className="workbit-swipe-action workbit-swipe-action-trailing"
        aria-hidden={revealedSide !== "trailing"}
        style={{
          position: "absolute",
          inset: "1px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: actionInset,
          background: "#fee2e2",
          borderRadius,
          boxShadow: "inset 0 0 0 1px rgba(254, 202, 202, 0.72)",
          zIndex: activeSide === "trailing" ? 2 : 0,
          opacity: activeSide === "trailing" ? actionProgress : 0,
          transform: `translateX(${activeSide === "trailing" ? 0 : 6}px)`,
          transition: dragging ? "none" : "opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          ["--workbit-swipe-action-color" as string]: "#dc2626",
          ["--workbit-swipe-action-scale" as string]: actionScale,
          ["--workbit-swipe-action-rotate" as string]: `${actionRotate}deg`,
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
          transition: dragging ? "none" : "transform 240ms cubic-bezier(0.2, 0.82, 0.24, 1)",
          touchAction: "pan-y pinch-zoom",
          willChange: "transform",
        }}
      >
        {children}
      </div>
      <style jsx>{`
        .workbit-swipe-action :global(button) {
          background: rgba(255, 255, 255, 0.78) !important;
          border-color: rgba(255, 255, 255, 0.82) !important;
          color: var(--workbit-swipe-action-color) !important;
          box-shadow:
            0 12px 26px rgba(15, 23, 42, 0.13),
            inset 0 1px 0 rgba(255, 255, 255, 0.92) !important;
          backdrop-filter: blur(12px);
          transform: scale(var(--workbit-swipe-action-scale)) rotate(var(--workbit-swipe-action-rotate));
          transition:
            transform 220ms cubic-bezier(0.2, 0.82, 0.24, 1),
            box-shadow 180ms ease,
            background 180ms ease,
            color 180ms ease !important;
        }

        .workbit-swipe-action :global(button:active) {
          transform: scale(0.94) rotate(var(--workbit-swipe-action-rotate));
        }
      `}</style>
    </div>
  );
}
