import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export const ROLE_LABELS: Record<string, string> = {
  consulente: "Consulente del lavoro",
  commercialista: "Commercialista",
  altro: "Altro",
};

export const inputStyle = {
  minHeight: 38,
  borderRadius: 12,
  border: "1px solid #e9e6f5",
  padding: "0 10px",
  fontSize: 15,
  width: "100%",
  minWidth: 0,
  background: "#ffffff",
} as const;

export const fieldLabel = { display: "grid", gap: 4, fontSize: 12.5, color: "#7c7894" } as const;

export const capStyle = { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7c7894" } as const;

export const ghostButton = {
  minHeight: 38,
  borderRadius: 999,
  border: "1px solid #ddd6fe",
  background: "#f6f3ff",
  color: "#4c1d95",
  fontSize: 13.5,
  fontWeight: 700,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
  textDecoration: "none",
} as const;

export function hoursText(value: number) {
  return value ? value.toLocaleString("it-IT", { maximumFractionDigits: 2 }) : "–";
}

/** Hours as a number people read: 0 is "0", not a dash. */
export function hoursValue(value: number) {
  return (value || 0).toLocaleString("it-IT", { maximumFractionDigits: 1 });
}

export function initials(firstName: string, lastName: string) {
  return `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase() || "?";
}

export function Avatar({ text, size = 34, tone = "violet" }: { text: string; size?: number; tone?: "violet" | "blue" }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: tone === "blue" ? "#e6f4ff" : "#eeecfb",
        color: tone === "blue" ? "#0369a1" : "#4c1d95",
        fontSize: size > 40 ? 15 : 12.5,
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
      }}
    >
      {text}
    </span>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e9e6f5", borderRadius: 20, overflow: "hidden", ...style }}>{children}</div>
  );
}

export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "0 6px" }}>
      <span style={capStyle}>{title}</span>
      {aside ? <span style={{ fontSize: 12, color: "#6f6a88" }}>{aside}</span> : null}
    </div>
  );
}

function monthHref(base: string, year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return `${base}${base.includes("?") ? "&" : "?"}mese=${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const arrow = {
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "1px solid #e9e6f5",
  background: "#ffffff",
  color: "#4c1d95",
  fontSize: 17,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  flex: "0 0 auto",
} as const;

const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];

/** ‹ Ottobre 2026 ›, the arrows moving a month at a time; no future months. */
export function MonthSwitch({ base, year, month, size = "large" }: { base: string; year: number; month: number; size?: "large" | "small" }) {
  const now = new Date();
  const atCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: size === "small" ? "space-between" : "flex-start" }}>
      <Link href={monthHref(base, year, month, -1)} aria-label="Mese prima" style={arrow}>
        ‹
      </Link>
      {size === "large" ? (
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 750, letterSpacing: "-0.03em" }}>
          {monthNames[month - 1]} {year}
        </h1>
      ) : (
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {monthNames[month - 1]} {year}
        </span>
      )}
      {atCurrent ? (
        <span aria-hidden style={{ ...arrow, opacity: 0.35 }}>
          ›
        </span>
      ) : (
        <Link href={monthHref(base, year, month, 1)} aria-label="Mese dopo" style={arrow}>
          ›
        </Link>
      )}
    </div>
  );
}
