"use client";

// Lightweight stand-ins for a handful of components from ../ui - that file
// is ~4400 lines shared by the whole app (calendar, timelogs, requests...).
// Importing even one export from it pulls the whole module into this page's
// client bundle. These are byte-for-byte the same styling, just without the
// dependency, so super-admin pages that only need a few form primitives
// don't have to ship the rest of the app's UI kit to render a list.

import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { PendingButton } from "@/app/components/pending-button";
import { ConfirmationToast } from "@/app/components/confirmation-toast";

const fieldStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(60, 60, 67, 0.12)",
  padding: "13px 15px",
  fontSize: 15,
  background: "#ffffff",
  width: "100%",
  color: "#1C1C1E",
  boxSizing: "border-box",
  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
};

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  if (props.type !== "date") {
    return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
  }

  const today = getTodayInputValue();
  const min = typeof props.min === "string" && props.min > today ? props.min : today;
  const value = typeof props.value === "string" && props.value && props.value < min ? min : props.value;

  return <input {...props} min={min} value={value} style={{ ...fieldStyle, ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        ...fieldStyle,
        appearance: "none",
        backgroundImage:
          "linear-gradient(45deg, transparent 50%, var(--workbit-purple-dark) 50%), linear-gradient(135deg, var(--workbit-purple-dark) 50%, transparent 50%)",
        backgroundPosition: "calc(100% - 18px) 52%, calc(100% - 12px) 52%",
        backgroundSize: "6px 6px, 6px 6px",
        backgroundRepeat: "no-repeat",
        paddingRight: 38,
        ...props.style,
      }}
    />
  );
}

export function PrimaryButton({
  children,
  tone = "dark",
  pendingLabel,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "dark" | "green" | "red" | "sand";
  pendingLabel?: ReactNode;
}) {
  const backgrounds = {
    dark: "var(--workbit-gradient)",
    green: "linear-gradient(135deg, #15803d 0%, #22c55e 58%, #4ade80 100%)",
    red: "linear-gradient(135deg, #b91c1c 0%, #ef4444 58%, #fb7185 100%)",
    sand: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
  };

  return (
    <PendingButton
      {...props}
      data-tone={tone}
      pendingLabel={pendingLabel}
      className={["dashboard-button", props.className].filter(Boolean).join(" ")}
      style={{
        background: backgrounds[tone],
        color: tone === "sand" ? "var(--workbit-navy)" : "#ffffff",
        border:
          tone === "sand"
            ? "1px solid var(--workbit-border)"
            : tone === "red"
              ? "1px solid rgba(239, 68, 68, 0.75)"
              : tone === "green"
                ? "1px solid rgba(34, 197, 94, 0.75)"
                : 0,
        borderRadius: 999,
        minHeight: 38,
        padding: "9px 15px",
        fontSize: 13,
        fontWeight: 760,
        letterSpacing: "-0.01em",
        boxShadow: "0 10px 22px rgba(124, 58, 237, 0.13)",
        transition: "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
        touchAction: "manipulation",
        ...props.style,
      }}
      idleStyle={{ cursor: "pointer", opacity: 1 }}
      pendingStyle={{ cursor: "default", opacity: 0.65 }}
    >
      {children}
    </PendingButton>
  );
}

export function IconButton({
  children,
  pendingLabel,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: ReactNode;
}) {
  const ariaLabel = typeof props["aria-label"] === "string" ? props["aria-label"] : "";
  const intent = /elimina|rimuovi|cancella/i.test(ariaLabel)
    ? "danger"
    : /aggiungi|nuov[oa]/i.test(ariaLabel)
      ? "add"
      : /completa|conferma|salva|approva/i.test(ariaLabel)
        ? "confirm"
        : "neutral";
  const symbol = typeof children === "string" ? children.trim() : "";
  const iconChildren =
    symbol === "+" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ) : symbol === "✓" || symbol === "✔" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="m5.5 12.5 4 4 9-9"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      children
    );

  return (
    <PendingButton
      {...props}
      data-intent={intent}
      pendingLabel={pendingLabel}
      className={["dashboard-icon-button", props.className].filter(Boolean).join(" ")}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: "1px solid var(--workbit-border)",
        background: "linear-gradient(180deg, var(--workbit-surface-elevated) 0%, var(--workbit-purple-soft) 100%)",
        color: "var(--workbit-purple-dark)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 18px rgba(124, 58, 237, 0.08)",
        touchAction: "manipulation",
        ...props.style,
      }}
      idleStyle={{ cursor: "pointer", opacity: 1 }}
      pendingStyle={{ cursor: "default", opacity: 0.65 }}
    >
      {iconChildren}
    </PendingButton>
  );
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const palette = {
    neutral: { background: "#f7f3ff", color: "#5b21b6", border: "1px solid rgba(124, 58, 237, 0.16)" },
    success: { background: "#dcfce7", color: "#166534", border: "1px solid #bbf7d0" },
    warning: { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" },
    danger: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tone === "success" ? 6 : 0,
        borderRadius: 999,
        padding: "6px 10px",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        ...palette[tone],
      }}
    >
      {label}
    </span>
  );
}

export function SuccessCallout({ children }: { children: ReactNode }) {
  return <ConfirmationToast>{children}</ConfirmationToast>;
}

export function StatusBanner({ kind, text }: { kind: "success" | "warning" | "error"; text: string }) {
  if (kind === "success") {
    return <ConfirmationToast>{text}</ConfirmationToast>;
  }

  const palette =
    kind === "warning"
      ? { background: "#fff7ed", border: "#fed7aa", color: "#c2410c" }
      : { background: "#fef2f2", border: "#fecaca", color: "#b91c1c" };

  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        lineHeight: 1.5,
      }}
    >
      {text}
    </div>
  );
}
