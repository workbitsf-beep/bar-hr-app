"use client";

import { useState, type ReactNode } from "react";

export type AskOption = {
  id: string;
  emoji: string;
  label: string;
  hint: string;
  form: ReactNode;
};

/**
 * One door instead of three.
 *
 * Asking for holiday, proposing a swap and saying "I can't be there on the
 * 12th" were three separate cards with three separate plus buttons, and in the
 * head of the person using them they are one thing: I need something. They are
 * one list now, and the kind decides which questions come next - the same
 * shape as notes, courses and document upload.
 */
export function AskSomething({
  options,
  heading = "Cosa ti serve?",
}: {
  options: AskOption[];
  heading?: string;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const option = options.find((item) => item.id === chosen) ?? null;

  if (!option) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <strong style={{ color: "#0f172a", fontSize: 15 }}>{heading}</strong>

        <div style={{ display: "grid", gap: 8 }}>
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setChosen(item.id)}
              style={{
                display: "grid",
                gridTemplateColumns: "40px minmax(0, 1fr)",
                alignItems: "center",
                gap: 11,
                padding: "11px 13px",
                borderRadius: 18,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  display: "inline-grid",
                  placeItems: "center",
                  borderRadius: 13,
                  background: "#f8fafc",
                  fontSize: 17,
                }}
              >
                {item.emoji}
              </span>
              <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
                <strong style={{ color: "#0f172a", fontSize: 14.5 }}>{item.label}</strong>
                <span style={{ color: "#64748b", fontSize: 12, fontWeight: 680 }}>{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button
        type="button"
        onClick={() => setChosen(null)}
        style={{
          justifySelf: "start",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px 8px 11px",
          borderRadius: 999,
          border: "1px solid rgba(124, 58, 237, 0.46)",
          background: "#f3e8ff",
          color: "#4c1d95",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        <span aria-hidden="true">‹</span>
        {option.emoji} {option.label}
      </button>

      {option.form}
    </div>
  );
}
