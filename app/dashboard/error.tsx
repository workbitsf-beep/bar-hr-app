"use client";

import Link from "next/link";
import { useEffect } from "react";
import { describeActionError } from "@/lib/rule-error";

/**
 * When something fails that no form caught. Before this file there was no
 * error page at all, and production showed Next.js's own white screen -
 * "Application error: a client-side exception has occurred" - with no way
 * back but closing the app.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[workbit] page error", error);
  }, [error]);

  return (
    <div
      role="alert"
      style={{
        display: "grid",
        gap: 14,
        maxWidth: 440,
        margin: "48px auto",
        padding: "24px 20px",
        borderRadius: 22,
        background: "#ffffff",
        border: "1px solid #e9e6f5",
        borderLeft: "3px solid #b3202f",
        boxShadow: "0 18px 40px rgba(60, 40, 140, 0.08)",
      }}
    >
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.6, textTransform: "uppercase", color: "#b3202f" }}>
        Non è andata a buon fine
      </span>
      <strong style={{ fontSize: 18, color: "#17161f", lineHeight: 1.3 }}>
        Quello che hai chiesto non è stato salvato.
      </strong>
      <span style={{ fontSize: 14, color: "#5b5675", lineHeight: 1.5 }}>{describeActionError(error)}</span>
      {error.digest ? (
        <span style={{ fontSize: 11.5, color: "#a3a0b8", fontVariantNumeric: "tabular-nums" }}>Codice {error.digest}</span>
      ) : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            minHeight: 46,
            padding: "0 20px",
            borderRadius: 999,
            border: 0,
            background: "linear-gradient(135deg,#3b1d8f,#5e4ae3 55%,#8b5cf6)",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: 14.5,
            cursor: "pointer",
          }}
        >
          Riprova
        </button>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 46,
            padding: "0 20px",
            borderRadius: 999,
            border: "1px solid #e9e6f5",
            color: "#4c1d95",
            fontWeight: 800,
            fontSize: 14.5,
            textDecoration: "none",
          }}
        >
          Torna all&apos;inizio
        </Link>
      </div>
    </div>
  );
}
