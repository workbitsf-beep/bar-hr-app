import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * The costs pages' pieces, in the house style: one white card of rows
 * divided by a hairline, a small-capitals label above it, a dot for the
 * category, a rail on the left for what needs a look.
 */

export function euro(cents: number, decimals = 0) {
  return `${(cents / 100).toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} €`;
}

export function percent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("it-IT", { maximumFractionDigits: 0 })}%`;
}

export function change(now: number, before: number | null | undefined) {
  if (!before) return null;
  return ((now - before) / Math.abs(before)) * 100;
}

export function SectionLabel({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "0 4px" }}>
      <span style={{ fontSize: 14.5, fontWeight: 750, letterSpacing: "-0.01em", color: "#111827" }}>{children}</span>
      {aside ? <span style={{ fontSize: 13, color: "#667085" }}>{aside}</span> : null}
    </div>
  );
}

/** A white card of rows; its bold title, when it has one, sits inside at the top. */
export function RowsCard({ children, style, title, aside }: { children: ReactNode; style?: CSSProperties; title?: ReactNode; aside?: ReactNode }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #ece9f7",
        borderRadius: 20,
        overflow: "hidden",
        padding: title ? "12px 16px 2px" : "0 16px",
        boxShadow: "0 3px 10px rgba(76, 29, 149, 0.04)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
        ...style,
      }}
    >
      {title ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 14.5, fontWeight: 750, letterSpacing: "-0.01em", color: "#111827" }}>{title}</span>
          {aside ? <span style={{ fontSize: 13, color: "#667085", textAlign: "right" }}>{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export function Row({
  children,
  first,
  rail,
  href,
  style,
}: {
  children: ReactNode;
  first?: boolean;
  /** amber: needs a look; violet: yours; grey: worth knowing. */
  rail?: "amber" | "violet" | "grey" | "green";
  href?: string;
  style?: CSSProperties;
}) {
  const rails = { amber: "#f59e0b", violet: "#6d5ce7", grey: "#cbd5e1", green: "#10b981" };
  const css: CSSProperties = {
    display: "grid",
    gap: 4,
    padding: rail ? "10px 0 10px 10px" : "10px 0",
    borderTop: first ? undefined : "1px solid #f1eff8",
    boxShadow: rail ? `inset 3px 0 0 ${rails[rail]}` : undefined,
    color: "#111827",
    textDecoration: "none",
    minWidth: 0,
    ...style,
  };
  return href ? (
    <Link href={href} style={css}>
      {children}
    </Link>
  ) : (
    <div style={css}>{children}</div>
  );
}

export function Line({ left, right, muted }: { left: ReactNode; right?: ReactNode; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, minWidth: 0 }}>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", fontSize: muted ? 12.5 : 14.5, color: muted ? "#7c7894" : "#17161f" }}>
        {left}
      </span>
      {right !== undefined ? (
        <span style={{ flex: "0 0 auto", fontSize: muted ? 12.5 : 14.5, color: muted ? "#7c7894" : "#17161f", fontVariantNumeric: "tabular-nums" }}>
          {right}
        </span>
      ) : null}
    </div>
  );
}

export function Dot({ color }: { color: string }) {
  return <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block", flex: "0 0 auto", marginRight: 8, transform: "translateY(-1px)" }} />;
}

export function Delta({ value, goodWhenDown = true }: { value: number | null; goodWhenDown?: boolean }) {
  if (value === null || !Number.isFinite(value) || Math.abs(value) < 1) return null;
  const up = value > 0;
  const bad = goodWhenDown ? up : !up;
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: bad ? "#b3202f" : "#0f7a4f", marginLeft: 6 }}>
      {up ? "▲" : "▼"} {Math.abs(value).toLocaleString("it-IT", { maximumFractionDigits: 0 })}%
    </span>
  );
}

export function Bar({ share, color }: { share: number; color: string }) {
  return (
    <span aria-hidden="true" style={{ display: "block", height: 4, borderRadius: 999, background: "#f1eff8", overflow: "hidden" }}>
      <span style={{ display: "block", height: "100%", width: `${Math.max(2, Math.min(100, share))}%`, background: color, borderRadius: 999 }} />
    </span>
  );
}

export function Pill({ children, tone = "grey" }: { children: ReactNode; tone?: "grey" | "amber" | "green" | "violet" }) {
  const tones = {
    grey: { background: "#f1f5f9", color: "#475569" },
    amber: { background: "#fef3c7", color: "#92400e" },
    green: { background: "#dcfce7", color: "#166534" },
    violet: { background: "#ede9fe", color: "#5b21b6" },
  };
  return (
    <span style={{ ...tones[tone], fontSize: 11, fontWeight: 760, padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>{children}</span>
  );
}

export const softButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  minHeight: 34,
  padding: "6px 13px",
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13,
  fontWeight: 720,
  cursor: "pointer",
  textDecoration: "none",
};
