import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { roundWhite } from "../round-button";

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

/** Hours as a clock reads them, 8:12 rather than 8,2; 0 is "0:00", not a dash. */
export function hoursValue(value: number) {
  const minutes = Math.round((value || 0) * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
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

/** The quiet grey of secondary words. */
export function Quiet({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontSize: 14, color: "#8a85a3", ...style }}>{children}</span>;
}

/** A white sheet of rows, no border: the minimal card. */
export function Sheet({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ background: "#ffffff", borderRadius: 22, overflow: "hidden", boxShadow: "0 1px 2px rgba(31,27,58,.04)", ...style }}>{children}</div>;
}

export function GearLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      style={roundWhite}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#4c1d95" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
      </svg>
    </Link>
  );
}

/** "Ottobre 2026 ▾": the last twelve months, in a menu that opens on tap. */
export function MonthMenu({ base, year, month }: { base: string; year: number; month: number }) {
  // A bar: the month before and after with the arrows, and the name opens
  // the last twelve months to jump straight to one.
  const now = new Date();
  const atCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const months = Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), now.getMonth() - 11 + index, 1));
  const round: CSSProperties = { width: 38, height: 38, borderRadius: 999, background: "#f4f3f9", color: "#4c1d95", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 19, textDecoration: "none", flex: "0 0 auto" };
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, background: "#ffffff", borderRadius: 18, padding: 6, boxShadow: "0 1px 2px rgba(31,27,58,.04)" }}>
      <Link href={monthHref(base, year, month, -1)} aria-label="Mese prima" scroll={false} style={round}>
        ‹
      </Link>
      <details className="wb-month-jump" style={{ flex: 1, minWidth: 0 }}>
        <summary style={{ listStyle: "none", cursor: "pointer", textAlign: "center", fontSize: 16.5, fontWeight: 600, color: "#1f1b3a", padding: "8px 0" }}>
          {monthNames[month - 1]} {year}
        </summary>
        <div
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#ffffff",
            borderRadius: 20,
            boxShadow: "0 18px 40px rgba(31,27,58,.16)",
            padding: 10,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          {months.map((date) => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            const active = date.getFullYear() === year && date.getMonth() + 1 === month;
            return (
              <Link
                key={key}
                href={`${base}${base.includes("?") ? "&" : "?"}mese=${key}`}
                scroll={false}
                style={{
                  padding: "11px 4px",
                  borderRadius: 12,
                  fontSize: 14.5,
                  textAlign: "center",
                  textDecoration: "none",
                  color: active ? "#ffffff" : "#1f1b3a",
                  background: active ? "#3b1d8f" : "#f7f6fb",
                  fontWeight: active ? 650 : 400,
                }}
              >
                {monthNames[date.getMonth()].slice(0, 3)} {String(date.getFullYear()).slice(2)}
              </Link>
            );
          })}
        </div>
      </details>
      {atCurrent ? (
        <span aria-hidden style={{ ...round, opacity: 0.35 }}>
          ›
        </span>
      ) : (
        <Link href={monthHref(base, year, month, 1)} aria-label="Mese dopo" scroll={false} style={round}>
          ›
        </Link>
      )}
    </div>
  );
}
