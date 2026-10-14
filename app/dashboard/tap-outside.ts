"use client";

import type { PointerEvent } from "react";

const MAX_MOVE_PX = 10;
const MAX_TAP_MS = 600;

/**
 * Close a popup with a tap on the veil around it - a tap, not a drag. The
 * veil used to close on any click, and a thumb scrolling a long list that
 * slid off the panel threw the popup away with what was typed in it. Here a
 * press that moves more than a few pixels, or lasts long, is a scroll and
 * leaves the popup open.
 *
 * Spread the result on the veil element itself: presses that start inside
 * the panel never count.
 */
export function tapOutsideProps(onClose: () => void) {
  let start: { x: number; y: number; at: number } | null = null;

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      start = event.target === event.currentTarget ? { x: event.clientX, y: event.clientY, at: Date.now() } : null;
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const began = start;
      start = null;
      if (!began || event.target !== event.currentTarget) return;
      const moved = Math.hypot(event.clientX - began.x, event.clientY - began.y);
      if (moved <= MAX_MOVE_PX && Date.now() - began.at <= MAX_TAP_MS) onClose();
    },
    onPointerCancel() {
      start = null;
    },
  };
}
