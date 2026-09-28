"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * A row that opens something.
 *
 * It carries none of the app's button classes on purpose: the stylesheet
 * forces .dashboard-popup-trigger to a 36px lilac pill with !important, which
 * is right for a plus button and wrong for every list row that tried to be
 * one.
 */
export function ListRowTrigger({
  onClick,
  label,
  children,
  tone = "plain",
  minHeight = 62,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  tone?: "plain" | "live" | "warn";
  minHeight?: number;
}) {
  const palette: Record<string, CSSProperties> = {
    plain: { border: "1px solid #e9edf3", background: "#ffffff" },
    live: { border: "1px solid #bfe8cd", background: "#f4fdf6" },
    warn: { border: "1px solid #fde68a", background: "#fffbeb" },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight,
        padding: "12px 14px",
        borderRadius: 18,
        textAlign: "left",
        cursor: "pointer",
        font: "inherit",
        color: "#0f172a",
        ...palette[tone],
      }}
    >
      {children}
    </button>
  );
}
