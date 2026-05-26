"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

export function CalendarWeekStrip({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const strip = stripRef.current;
    const currentWeek = strip?.querySelector<HTMLElement>('[data-current-week="true"]');

    if (!strip || !currentWeek) {
      return;
    }

    currentWeek.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "center",
    });
  }, [children]);

  return (
    <div
      ref={stripRef}
      className={className}
      style={{
        alignItems: "flex-start",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
