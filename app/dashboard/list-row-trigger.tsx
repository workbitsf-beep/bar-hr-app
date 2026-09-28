import type { CSSProperties, ReactNode } from "react";

/**
 * The visual shell of a list row that opens something.
 *
 * It deliberately carries none of the app's button classes: the stylesheet
 * pins .dashboard-popup-trigger to a 36px lilac pill with !important, which is
 * right for a plus button and wrong for every row that tried to be one.
 */
export function ListRowTrigger({
  children,
  tone = "plain",
  minHeight = 62,
}: {
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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight,
        padding: "12px 14px",
        borderRadius: 18,
        boxSizing: "border-box",
        ...palette[tone],
      }}
    >
      {children}
    </div>
  );
}
