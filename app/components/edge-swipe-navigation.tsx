"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Back and forward with the thumb, from the edge of the screen.
 *
 * The app is installed rather than browsed, so there is no browser chrome and
 * no back arrow anywhere on a phone: the only way back was the one link that
 * happened to point where you came from. This is the gesture people already
 * use everywhere else - drag in from the left edge to go back, from the right
 * edge to go forward - and the menu closes the same way.
 *
 * It listens passively and never calls preventDefault, so ordinary scrolling
 * is untouched; the decision is taken when the finger lifts.
 */

/** How far in from the side a gesture has to start to count as an edge drag. */
const EDGE_WIDTH = 30;
/** How far it has to travel before it means anything. */
const TRIGGER_DISTANCE = 74;
/** Past this the arrow is full strength and the gesture will fire. */
const HINT_TRAVEL = 96;
/** Below this the finger has not committed to a direction yet. */
const WAKE_DISTANCE = 12;
/** A drag has to be this much more sideways than it is up and down. */
const HORIZONTAL_BIAS = 1.4;
/** A slow drag is somebody resting their thumb, not a gesture. */
const MAX_DURATION_MS = 900;

type Drag = {
  side: "left" | "right";
  x: number;
  y: number;
  at: number;
  awake: boolean;
};

/**
 * A gesture that starts inside something that scrolls sideways belongs to that
 * thing - the week strip in the calendar, a row of chips - and never to us.
 * Swipeable cards say so themselves.
 */
function belongsToSomethingElse(target: EventTarget | null) {
  let node = target instanceof Element ? target : null;

  while (node && node !== document.body) {
    if (node.hasAttribute("data-no-edge-swipe")) {
      return true;
    }

    if (node.scrollWidth - node.clientWidth > 4) {
      const overflowX = window.getComputedStyle(node).overflowX;

      if (overflowX === "auto" || overflowX === "scroll") {
        return true;
      }
    }

    node = node.parentElement;
  }

  return false;
}

export function EdgeSwipeNavigation() {
  const router = useRouter();
  const dragRef = useRef<Drag | null>(null);
  const hintRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hint = hintRef.current;

    function paintHint(side: "left" | "right" | null, travel: number) {
      if (!hint) {
        return;
      }

      if (!side) {
        hint.style.opacity = "0";
        hint.style.transform = "translate(-140%, -50%) scale(0.7)";
        return;
      }

      const progress = Math.min(1, travel / HINT_TRAVEL);
      const slide = -140 + progress * 150;

      hint.style.left = side === "left" ? "0px" : "auto";
      hint.style.right = side === "right" ? "0px" : "auto";
      hint.style.opacity = String(0.25 + progress * 0.75);
      hint.style.transform =
        `translate(${side === "left" ? slide : -slide}%, -50%) scale(${0.72 + progress * 0.28})`;
      hint.style.setProperty("--wb-edge-turn", side === "left" ? "0deg" : "180deg");
    }

    function handleStart(event: TouchEvent) {
      dragRef.current = null;
      paintHint(null, 0);

      if (event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      const width = window.innerWidth;
      const side =
        touch.clientX <= EDGE_WIDTH
          ? "left"
          : touch.clientX >= width - EDGE_WIDTH
            ? "right"
            : null;

      if (!side || belongsToSomethingElse(event.target)) {
        return;
      }

      dragRef.current = { side, x: touch.clientX, y: touch.clientY, at: Date.now(), awake: false };
    }

    function handleMove(event: TouchEvent) {
      const drag = dragRef.current;
      const touch = event.touches[0];

      if (!drag || !touch) {
        return;
      }

      const deltaX = (touch.clientX - drag.x) * (drag.side === "left" ? 1 : -1);
      const deltaY = Math.abs(touch.clientY - drag.y);

      // Pulled the wrong way, or dragged down the page: this was never ours.
      if (deltaX < 0 || (deltaY > WAKE_DISTANCE && deltaY > Math.abs(deltaX) * HORIZONTAL_BIAS)) {
        dragRef.current = null;
        paintHint(null, 0);
        return;
      }

      if (deltaX > WAKE_DISTANCE) {
        drag.awake = true;
      }

      paintHint(drag.awake ? drag.side : null, deltaX);
    }

    function handleEnd(event: TouchEvent) {
      const drag = dragRef.current;
      const touch = event.changedTouches[0];
      dragRef.current = null;
      paintHint(null, 0);

      if (!drag || !touch || Date.now() - drag.at > MAX_DURATION_MS) {
        return;
      }

      const deltaX = (touch.clientX - drag.x) * (drag.side === "left" ? 1 : -1);
      const deltaY = Math.abs(touch.clientY - drag.y);

      if (deltaX < TRIGGER_DISTANCE || deltaY > deltaX * HORIZONTAL_BIAS) {
        return;
      }

      // A popup is a piece of work in progress and closes on its own terms.
      if (document.querySelector(".dashboard-modal-wrap")) {
        return;
      }

      // The menu is navigation, so going back means leaving the menu, not
      // leaving the page behind it.
      if (document.querySelector(".workbit-menu-page-overlay")) {
        if (drag.side === "left") {
          window.dispatchEvent(new Event("dashboard-menu-close"));
        }

        return;
      }

      if (drag.side === "left") {
        router.back();
      } else {
        router.forward();
      }
    }

    function handleCancel() {
      dragRef.current = null;
      paintHint(null, 0);
    }

    const options = { passive: true } as const;
    window.addEventListener("touchstart", handleStart, options);
    window.addEventListener("touchmove", handleMove, options);
    window.addEventListener("touchend", handleEnd, options);
    window.addEventListener("touchcancel", handleCancel, options);

    return () => {
      window.removeEventListener("touchstart", handleStart);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleCancel);
    };
  }, [router]);

  return (
    <div
      ref={hintRef}
      aria-hidden="true"
      className="workbit-edge-hint"
      style={{ opacity: 0, transform: "translate(-140%, -50%) scale(0.7)" }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path
          d="M15 5l-7 7 7 7"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
