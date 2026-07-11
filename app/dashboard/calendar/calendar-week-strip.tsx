"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";

function scrollToNearestCard(strip: HTMLDivElement, behavior: ScrollBehavior = "smooth") {
  const cards = Array.from(strip.querySelectorAll<HTMLElement>(".dashboard-week-card"));

  if (cards.length === 0) {
    return;
  }

  const targetLeft = strip.scrollLeft;
  let nearestCard = cards[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const card of cards) {
    const distance = Math.abs(card.offsetLeft - targetLeft);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestCard = card;
    }
  }

  strip.scrollTo({
    left: nearestCard.offsetLeft,
    behavior,
  });
}

function centerCurrentDay(currentWeek: HTMLElement) {
  const currentDay = currentWeek.querySelector<HTMLElement>('[data-calendar-today="true"]');

  if (!currentDay) {
    return;
  }

  window.requestAnimationFrame(() => {
    currentDay.scrollIntoView({
      behavior: "instant",
      block: "center",
      inline: "nearest",
    });
  });
}

export function CalendarWeekStrip({
  children,
  className,
  style,
  ...props
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className" | "style">) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const snapTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (hasAutoScrolledRef.current) {
      return;
    }

    const strip = stripRef.current;
    const currentWeek = strip?.querySelector<HTMLElement>('[data-current-week="true"]');

    if (!strip || !currentWeek) {
      return;
    }

    hasAutoScrolledRef.current = true;
    currentWeek.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "center",
    });
    centerCurrentDay(currentWeek);
  }, [children]);

  useEffect(() => {
    return () => {
      if (snapTimerRef.current !== null) {
        window.clearTimeout(snapTimerRef.current);
      }
    };
  }, []);

  function scheduleSnap() {
    const strip = stripRef.current;

    if (!strip) {
      return;
    }

    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
    }

    snapTimerRef.current = window.setTimeout(() => {
      const currentStrip = stripRef.current;

      if (currentStrip) {
        scrollToNearestCard(currentStrip);
      }
    }, 120);
  }

  return (
    <div
      ref={stripRef}
      className={className}
      onScroll={scheduleSnap}
      {...props}
      style={{
        alignItems: "flex-start",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
