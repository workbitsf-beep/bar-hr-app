"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useEffect, useRef } from "react";

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
  }, [children]);

  return (
    <div
      ref={stripRef}
      className={className}
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
