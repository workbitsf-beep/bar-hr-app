"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A small "i" next to a name, opening what it means in a sheet. Keeps lists
 * to one line per item. Clicks stay inside: it sits in labels and cards that
 * would otherwise toggle or select on the same tap.
 */
export function InfoButton({ title, text, who }: { title: string; text: string; who?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={`Cos'è ${title}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        style={{
          display: "inline-grid",
          placeItems: "center",
          flex: "0 0 auto",
          width: 22,
          height: 22,
          padding: 0,
          borderRadius: 999,
          border: "1.5px solid #c4b5fd",
          background: "#ffffff",
          color: "#6d3df0",
          fontSize: 12,
          fontWeight: 850,
          fontStyle: "italic",
          fontFamily: "Georgia, serif",
          lineHeight: 1,
          cursor: "pointer",
        }}
      >
        i
      </button>
      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(event) => {
                // React carries clicks out of a portal to the card around the
                // button, which would pick the plan or flip the switch.
                event.stopPropagation();
                setOpen(false);
              }}
              style={{
                position: "fixed",
                inset: 0,
                // Above the bottom nav (200) and the settings popups.
                zIndex: 1300,
                display: "grid",
                alignItems: "end",
                justifyItems: "center",
                padding: "16px 16px calc(max(env(safe-area-inset-bottom, 0px), var(--wb-inset-bottom, 0px)) + 16px)",
                background: "rgba(23, 20, 43, 0.38)",
              }}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                style={{
                  display: "grid",
                  gap: 10,
                  width: "min(440px, 100%)",
                  padding: "20px 18px 16px",
                  borderRadius: 22,
                  background: "#ffffff",
                  boxShadow: "0 24px 60px rgba(23, 20, 43, 0.28)",
                }}
              >
                <strong style={{ fontSize: 18, color: "#17161f" }}>{title}</strong>
                <span style={{ fontSize: 14.5, color: "#4c4670", lineHeight: 1.55 }}>{text}</span>
                {who ? <span style={{ fontSize: 13, color: "#8b88a3", lineHeight: 1.45 }}>{who}</span> : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                  }}
                  style={{
                    marginTop: 4,
                    minHeight: 44,
                    borderRadius: 999,
                    border: "1px solid #e9e6f5",
                    background: "#faf8ff",
                    color: "#4c1d95",
                    fontWeight: 800,
                    fontSize: 14.5,
                    cursor: "pointer",
                  }}
                >
                  Ho capito
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
